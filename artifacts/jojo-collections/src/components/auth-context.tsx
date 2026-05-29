import { createContext, useContext, type ReactNode } from "react";
    import { useQueryClient } from "@tanstack/react-query";
    import {
      createUserWithEmailAndPassword,
      sendEmailVerification,
      signInWithEmailAndPassword,
      signOut as firebaseSignOut,
    } from "firebase/auth";
    import {
      useGetCurrentUser,
      useLogout,
      useAdminLogout,
      getGetCurrentUserQueryKey,
    } from "@workspace/api-client-react";
    import { auth, isFirebaseConfigured } from "@/lib/firebase";
    import { apiFetch } from "@/lib/api";

    type AuthUser = {
      id: string;
      name: string;
      email: string;
      emailVerified: boolean;
      firebaseUid: string | null;
    };

    type AuthContextValue = {
      user: AuthUser | null;
      isAdmin: boolean;
      loading: boolean;
      login: (email: string, password: string) => Promise<void>;
      signup: (name: string, email: string, password: string) => Promise<void>;
      logout: () => Promise<void>;
      adminLogin: (email: string, password: string) => Promise<void>;
      adminLogout: () => Promise<void>;
      refresh: () => Promise<void>;
      resendVerificationEmail: () => Promise<void>;
    };

    const AuthContext = createContext<AuthContextValue | null>(null);

    export class EmailVerificationSentError extends Error {
      constructor() { super("EMAIL_VERIFICATION_SENT"); this.name = "EmailVerificationSentError"; }
    }

    export class EmailNotVerifiedError extends Error {
      constructor() {
        super("Please verify your email before logging in. Check your inbox for the verification link.");
        this.name = "EmailNotVerifiedError";
      }
    }

    function requireFirebase(): void {
      if (!isFirebaseConfigured || !auth) {
        throw new Error(
          "Firebase is not configured on this build. " +
          "Set VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID " +
          "and VITE_FIREBASE_APP_ID as environment variables on your hosting service, then redeploy."
        );
      }
    }

    export function AuthProvider({ children }: { children: ReactNode }) {
      const qc    = useQueryClient();
      const meKey = getGetCurrentUserQueryKey();
      const { data, isLoading } = useGetCurrentUser({
        query: { staleTime: 60_000, retry: false } as any,
      });

      const refresh = async () => { await qc.invalidateQueries({ queryKey: meKey }); };

      const logoutMut      = useLogout();
      const adminLogoutMut = useAdminLogout();

      const value: AuthContextValue = {
        user:    (data?.user as AuthUser | null | undefined) ?? null,
        isAdmin: Boolean(data?.isAdmin),
        loading: isLoading,
        refresh,

        // ── Signup ──────────────────────────────────────────────────────────────
        // Flow:
        //   1. Firebase Auth creates the user (validates email + password strength)
        //   2. Get the Firebase ID token while still signed in — sent to backend for
        //      server-side UID verification (prevents UID spoofing)
        //   3. Verification email sent while still signed in
        //   4. Firebase client session ended (cannot use the app until verified)
        //   5. Backend verifies the ID token cryptographically, extracts UID, writes
        //      Firestore profile — the client-provided UID is never trusted
        //   6. EmailVerificationSentError thrown → UI shows "check your inbox"
        signup: async (name, email, password) => {
          requireFirebase();
          const a = auth!;

          let firebaseIdToken: string;
          try {
            const credential = await createUserWithEmailAndPassword(a, email, password);
            // Capture the ID token BEFORE signing out — the backend will verify it
            // server-side and use the UID extracted from the verified token.
            firebaseIdToken = await credential.user.getIdToken();
            await sendEmailVerification(credential.user); // while still signed in
            await firebaseSignOut(a);                     // sign out — unverified
          } catch (fbErr: unknown) {
            const code = (fbErr as { code?: string }).code ?? "";
            if (code === "auth/email-already-in-use") {
              throw Object.assign(new Error("An account with that email already exists"), {
                data: { error: "An account with that email already exists" },
              });
            }
            throw fbErr;
          }

          const res = await apiFetch("/api/auth/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // Send the Firebase ID token — backend verifies it and extracts the UID.
            // We no longer send a bare firebaseUid that could be forged by the client.
            body: JSON.stringify({ name, email, password, firebaseIdToken }),
          });
          if (!res.ok) {
            const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
            throw Object.assign(
              new Error((body["error"] as string | undefined) ?? "Could not create account"),
              { data: body }
            );
          }
          // Always show the verification screen — account is locked until email confirmed
          throw new EmailVerificationSentError();
        },

        resendVerificationEmail: async () => {
          requireFirebase();
          if (!auth!.currentUser) {
            throw new Error("No active session found. Please sign up again.");
          }
          await sendEmailVerification(auth!.currentUser);
        },

        // ── Customer login ───────────────────────────────────────────────────────
        // Flow:
        //   1. Firebase SDK signs in with email + password
        //   2. If email is not verified → reject immediately (no session started)
        //   3. Get short-lived ID token, sign out of Firebase client
        //   4. Send token to backend → backend verifies cryptographically, starts session
        login: async (email, password) => {
          requireFirebase();
          const a = auth!;

          let idToken: string;
          try {
            const credential = await signInWithEmailAndPassword(a, email, password);
            if (!credential.user.emailVerified) {
              await firebaseSignOut(a);
              throw new EmailNotVerifiedError();
            }
            idToken = await credential.user.getIdToken();
            await firebaseSignOut(a);
          } catch (fbErr: unknown) {
            if (fbErr instanceof EmailNotVerifiedError) throw fbErr;
            const code = (fbErr as { code?: string }).code ?? "";
            if (["auth/user-not-found","auth/wrong-password","auth/invalid-credential","auth/invalid-email"].includes(code)) {
              throw Object.assign(new Error("Invalid email or password"), { data: { error: "Invalid email or password" } });
            }
            throw fbErr;
          }

          const res = await apiFetch("/api/auth/login-firebase", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ firebaseIdToken: idToken }),
          });
          if (!res.ok) {
            const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
            const msg  = (body["error"] as string | undefined) ?? "Login failed";
            throw Object.assign(new Error(msg), { data: { error: msg } });
          }
          await refresh();
        },

        logout: async () => { await logoutMut.mutateAsync(); await refresh(); },

        // ── Admin login — Firebase only ──────────────────────────────────────────
        // Flow:
        //   1. Firebase SDK signs in with admin email + password
        //   2. Get ID token, immediately sign out of Firebase client
        //   3. Backend verifies token and confirms email === ADMIN_EMAIL
        //   4. Session cookie set with isAdmin = true
        adminLogin: async (email: string, password: string) => {
          requireFirebase();
          const a = auth!;

          let idToken: string;
          try {
            const credential = await signInWithEmailAndPassword(a, email, password);
            idToken = await credential.user.getIdToken();
            await firebaseSignOut(a);
          } catch (fbErr: unknown) {
            const code = (fbErr as { code?: string }).code ?? "";
            if (["auth/user-not-found","auth/wrong-password","auth/invalid-credential","auth/invalid-email"].includes(code)) {
              throw new Error("Invalid admin credentials. Check your email and password.");
            }
            throw fbErr;
          }

          const res = await apiFetch("/api/admin/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ firebaseIdToken: idToken }),
          });
          if (!res.ok) {
            const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
            throw new Error((body["error"] as string | undefined) ?? "Admin login failed");
          }
          await refresh();
        },

        adminLogout: async () => { await adminLogoutMut.mutateAsync(); await refresh(); },
      };

      return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
    }

    export function useAuth(): AuthContextValue {
      const ctx = useContext(AuthContext);
      if (!ctx) throw new Error("useAuth must be used within AuthProvider");
      return ctx;
    }
    
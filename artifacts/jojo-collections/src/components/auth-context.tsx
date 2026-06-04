import { createContext, useContext, type ReactNode } from "react";
    import { useQueryClient } from "@tanstack/react-query";
    import {
      createUserWithEmailAndPassword,
      sendEmailVerification,
      signInWithEmailAndPassword,
      signInWithPopup,
      signOut as firebaseSignOut,
    } from "firebase/auth";
    import {
      useGetCurrentUser,
      useLogout,
      useAdminLogout,
      getGetCurrentUserQueryKey,
    } from "@workspace/api-client-react";
    import { auth, isFirebaseConfigured, googleProvider } from "@/lib/firebase";
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
      googleSignIn: () => Promise<void>;
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

        signup: async (name, email, password) => {
          requireFirebase();
          const a = auth!;

          let firebaseIdToken: string;
          try {
            const credential = await createUserWithEmailAndPassword(a, email, password);
            firebaseIdToken = await credential.user.getIdToken();
            await sendEmailVerification(credential.user);
            await firebaseSignOut(a);
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
            body: JSON.stringify({ name, email, password, firebaseIdToken }),
          });
          if (!res.ok) {
            const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
            throw Object.assign(
              new Error((body["error"] as string | undefined) ?? "Could not create account"),
              { data: body }
            );
          }
          throw new EmailVerificationSentError();
        },

        resendVerificationEmail: async () => {
          requireFirebase();
          if (!auth!.currentUser) {
            throw new Error("No active session found. Please sign up again.");
          }
          await sendEmailVerification(auth!.currentUser);
        },

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

        // ── Google Sign-In ───────────────────────────────────────────────────────
        // Flow:
        //   1. Firebase popup — user picks their Google account
        //   2. Get ID token, sign out of Firebase client session
        //   3. Backend verifies token, finds-or-creates Firestore profile, sets session
        googleSignIn: async () => {
          requireFirebase();
          const a = auth!;

          const result = await signInWithPopup(a, googleProvider);
          const idToken = await result.user.getIdToken();
          await firebaseSignOut(a);

          const res = await apiFetch("/api/auth/google", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ firebaseIdToken: idToken }),
          });
          if (!res.ok) {
            const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
            throw new Error((body["error"] as string | undefined) ?? "Google sign-in failed");
          }
          await refresh();
        },

        logout: async () => { await logoutMut.mutateAsync(); await refresh(); },

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
    

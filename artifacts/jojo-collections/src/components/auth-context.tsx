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
    useLogin,
    useSignup,
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
      super("Please check your inbox and verify your email link to activate your account and log in.");
      this.name = "EmailNotVerifiedError";
    }
  }

  export function AuthProvider({ children }: { children: ReactNode }) {
    const qc    = useQueryClient();
    const meKey = getGetCurrentUserQueryKey();
    const { data, isLoading } = useGetCurrentUser({
      query: { staleTime: 60_000, retry: false } as any,
    });

    const refresh = async () => { await qc.invalidateQueries({ queryKey: meKey }); };

    const loginMut       = useLogin();
    const signupMut      = useSignup();
    const logoutMut      = useLogout();
    const adminLogoutMut = useAdminLogout();

    const value: AuthContextValue = {
      user:    (data?.user as AuthUser | null | undefined) ?? null,
      isAdmin: Boolean(data?.isAdmin),
      loading: isLoading,
      refresh,

      // ── Signup ──────────────────────────────────────────────────────────────
      // 1. Create the Firebase Auth account (server-side email + password validation)
      // 2. Capture the uid IMMEDIATELY from the credential (before any sign-out)
      // 3. Trigger the verification email
      // 4. Sign the user out of Firebase on the client — they cannot use the app
      //    until they click the verification link
      // 5. Write the Firestore profile using the Firebase UID as the document ID
      // 6. Throw EmailVerificationSentError so the UI shows the "check your inbox" screen
      signup: async (name, email, password) => {
        if (isFirebaseConfigured && auth) {
          let firebaseUid: string;
          try {
            const credential = await createUserWithEmailAndPassword(auth, email, password);
            firebaseUid = credential.user.uid;            // capture before any further ops
            await sendEmailVerification(credential.user); // send while still signed in
            await firebaseSignOut(auth);                  // sign out — unverified session
          } catch (fbErr: unknown) {
            const code = (fbErr as { code?: string }).code ?? "";
            if (code === "auth/email-already-in-use") {
              throw Object.assign(new Error("An account with that email already exists"), {
                data: { error: "An account with that email already exists" },
              });
            }
            throw fbErr;
          }
          // Write Firestore profile with Firebase UID as document ID
          await apiFetch("/api/auth/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, email, password, firebaseUid }),
          });
          throw new EmailVerificationSentError();
        } else {
          // Firebase not configured — legacy flow (bcrypt login, no email verification)
          await signupMut.mutateAsync({ data: { name, email, password } });
          await refresh();
        }
      },

      resendVerificationEmail: async () => {
        if (!auth || !auth.currentUser) {
          throw new Error("No pending verification session found. Please sign up again.");
        }
        await sendEmailVerification(auth.currentUser);
      },

      // ── Customer login ───────────────────────────────────────────────────────
      login: async (email, password) => {
        if (isFirebaseConfigured && auth) {
          let idToken: string;
          try {
            const credential = await signInWithEmailAndPassword(auth, email, password);
            if (!credential.user.emailVerified) {
              await firebaseSignOut(auth);
              throw new EmailNotVerifiedError();
            }
            idToken = await credential.user.getIdToken();
            await firebaseSignOut(auth);
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
        } else {
          await loginMut.mutateAsync({ data: { email, password } });
          await refresh();
        }
      },

      logout: async () => { await logoutMut.mutateAsync(); await refresh(); },

      // ── Admin login ──────────────────────────────────────────────────────────
      // Strategy: try Firebase first (most secure — cryptographic token verified
      // server-side). If the admin account does not exist in Firebase Auth yet
      // (auth/user-not-found) OR Firebase is not configured on this build, fall
      // back to sending the credentials directly to the backend which compares
      // them against ADMIN_EMAIL + ADMIN_PASSWORD environment variables.
      adminLogin: async (email: string, password: string) => {
        if (isFirebaseConfigured && auth) {
          try {
            const credential = await signInWithEmailAndPassword(auth, email, password);
            const idToken = await credential.user.getIdToken();
            await firebaseSignOut(auth); // client session not needed; backend holds the session

            const res = await apiFetch("/api/admin/auth/login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ firebaseIdToken: idToken }),
            });
            if (!res.ok) {
              const b = (await res.json().catch(() => ({}))) as Record<string, unknown>;
              throw new Error((b["error"] as string | undefined) ?? "Invalid admin credentials");
            }
            await refresh();
            return; // success — exit here
          } catch (fbErr: unknown) {
            const code = (fbErr as { code?: string }).code ?? "";
            // Wrong password or invalid email → definitive rejection, no fallback
            if (["auth/wrong-password", "auth/invalid-email"].includes(code)) {
              throw new Error("Invalid admin credentials");
            }
            // User not found in Firebase → fall through to env-var mode below
            if (code && !["auth/user-not-found", "auth/invalid-credential"].includes(code)) {
              // Any other Firebase or backend error — re-throw as a clean message
              throw fbErr instanceof Error && fbErr.message.startsWith("Invalid")
                ? fbErr
                : new Error("Invalid admin credentials");
            }
            // fall through to Mode B
          }
        }

        // Mode B: send credentials to backend — compared against ADMIN_EMAIL / ADMIN_PASSWORD
        const res = await apiFetch("/api/admin/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        if (!res.ok) {
          const b = (await res.json().catch(() => ({}))) as Record<string, unknown>;
          throw new Error((b["error"] as string | undefined) ?? "Invalid admin credentials");
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
  
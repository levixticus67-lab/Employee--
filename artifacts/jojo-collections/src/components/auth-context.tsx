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

      signup: async (name, email, password) => {
        if (isFirebaseConfigured && auth) {
          try {
            const credential = await createUserWithEmailAndPassword(auth, email, password);
            await sendEmailVerification(credential.user);
          } catch (fbErr: unknown) {
            const code = (fbErr as { code?: string }).code ?? "";
            if (code === "auth/email-already-in-use") {
              throw Object.assign(new Error("An account with that email already exists"), {
                data: { error: "An account with that email already exists" },
              });
            }
            throw fbErr;
          }
          await apiFetch("/api/auth/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, email, password, firebaseUid: auth.currentUser?.uid }),
          });
          throw new EmailVerificationSentError();
        } else {
          await signupMut.mutateAsync({ data: { name, email, password } });
          await refresh();
        }
      },

      resendVerificationEmail: async () => {
        if (!auth || !auth.currentUser) throw new Error("No pending verification session found. Please sign up again.");
        await sendEmailVerification(auth.currentUser);
      },

      login: async (email, password) => {
        if (isFirebaseConfigured && auth) {
          let idToken: string;
          try {
            const credential = await signInWithEmailAndPassword(auth, email, password);
            if (!credential.user.emailVerified) { await firebaseSignOut(auth); throw new EmailNotVerifiedError(); }
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

      // Signs into Firebase with the admin email+password, obtains a short-lived
      // ID token, and sends it to the backend. The backend verifies the token via
      // Firebase Admin SDK and checks the email matches ADMIN_EMAIL before
      // granting an admin session — no localStorage flags involved.
      adminLogin: async (email: string, password: string) => {
        if (!auth) throw new Error("Firebase is not configured on this client");

        let idToken: string;
        try {
          const credential = await signInWithEmailAndPassword(auth, email, password);
          idToken = await credential.user.getIdToken();
          await firebaseSignOut(auth); // client session not needed — backend holds the session
        } catch (fbErr: unknown) {
          const code = (fbErr as { code?: string }).code ?? "";
          if (["auth/user-not-found","auth/wrong-password","auth/invalid-credential","auth/invalid-email"].includes(code)) {
            throw new Error("Invalid admin credentials");
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
          throw new Error((body["error"] as string | undefined) ?? "Invalid admin credentials");
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
  
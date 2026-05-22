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
  useAdminLogin,
  useAdminLogout,
  getGetCurrentUserQueryKey,
} from "@workspace/api-client-react";
import { auth, isFirebaseConfigured } from "@/lib/firebase";
import { apiFetch } from "@/lib/api";

type AuthUser = { id: string; name: string; email: string; emailVerified: boolean };

type AuthContextValue = {
  user: AuthUser | null;
  isAdmin: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  adminLogin: (password: string) => Promise<void>;
  adminLogout: () => Promise<void>;
  refresh: () => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export class EmailVerificationSentError extends Error {
  constructor() {
    super("EMAIL_VERIFICATION_SENT");
    this.name = "EmailVerificationSentError";
  }
}

export class EmailNotVerifiedError extends Error {
  constructor() {
    super("Please check your inbox and verify your email link to activate your account and log in.");
    this.name = "EmailNotVerifiedError";
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const meKey = getGetCurrentUserQueryKey();
  const { data, isLoading } = useGetCurrentUser({
    query: { staleTime: 60_000, retry: false } as any,
  });

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: meKey });
  };

  const loginMut = useLogin();
  const signupMut = useSignup();
  const logoutMut = useLogout();
  const adminLoginMut = useAdminLogin();
  const adminLogoutMut = useAdminLogout();

  const value: AuthContextValue = {
    user: (data?.user as AuthUser | null | undefined) ?? null,
    isAdmin: Boolean(data?.isAdmin),
    loading: isLoading,
    refresh,

    signup: async (name, email, password) => {
      if (isFirebaseConfigured && auth) {
        let firebaseUid: string | null = null;
        try {
          const credential = await createUserWithEmailAndPassword(auth, email, password);
          firebaseUid = credential.user.uid;
          await sendEmailVerification(credential.user);
          // Keep the Firebase user signed in so resendVerificationEmail can work.
          // The backend session is NOT established for unverified users, so
          // protected routes remain inaccessible until email is verified.
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
          body: JSON.stringify({ name, email, password, firebaseUid }),
        });
        throw new EmailVerificationSentError();
      } else {
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
          if (
            code === "auth/user-not-found" ||
            code === "auth/wrong-password" ||
            code === "auth/invalid-credential" ||
            code === "auth/invalid-email"
          ) {
            throw Object.assign(new Error("Invalid email or password"), {
              data: { error: "Invalid email or password" },
            });
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
          const msg = (body["error"] as string | undefined) ?? "Login failed";
          throw Object.assign(new Error(msg), { data: { error: msg } });
        }
        await refresh();
      } else {
        await loginMut.mutateAsync({ data: { email, password } });
        await refresh();
      }
    },

    logout: async () => {
      await logoutMut.mutateAsync();
      await refresh();
    },
    adminLogin: async (password) => {
      await adminLoginMut.mutateAsync({ data: { password } });
      await refresh();
    },
    adminLogout: async () => {
      await adminLogoutMut.mutateAsync();
      await refresh();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

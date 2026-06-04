import { createContext, useContext, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithCredential,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
} from "firebase/auth";
import {
  useGetCurrentUser,
  useLogout,
  useAdminLogout,
  getGetCurrentUserQueryKey,
} from "@workspace/api-client-react";
import { auth, isFirebaseConfigured, GOOGLE_CLIENT_ID } from "@/lib/firebase";
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
  /**
   * Send a password-reset email.
   *
   * SECURITY: This function deliberately shows no difference between a
   * registered and an unregistered email. Both cases return normally so
   * the UI always shows the same "if registered, check your inbox" message.
   * This prevents user-enumeration via the forgot-password form.
   */
  sendResetEmail: (email: string) => Promise<void>;
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

/**
 * Sign in via Google Identity Services (GIS).
 *
 * Uses google.accounts.oauth2.initTokenClient — Google's own OAuth2 library.
 * This NEVER touches firebaseapp.com/__/auth/handler.
 * Instead it opens accounts.google.com directly, returns an access token,
 * and we hand that token to Firebase via signInWithCredential.
 */
function gisGoogleSignIn(): Promise<string> {
  return new Promise((resolve, reject) => {
    const gis = (window as { google?: { accounts?: { oauth2?: { initTokenClient: (cfg: unknown) => { requestAccessToken: (opts: unknown) => void } } } } }).google?.accounts?.oauth2;
    if (!gis) {
      reject(new Error("Google Identity Services not loaded. Please refresh and try again."));
      return;
    }
    if (!GOOGLE_CLIENT_ID) {
      reject(new Error("VITE_GOOGLE_CLIENT_ID is not set. Add it to your environment variables."));
      return;
    }
    const client = gis.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: "openid email profile",
      callback: (resp: { access_token?: string; error?: string }) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error ?? "Google did not return an access token"));
        } else {
          resolve(resp.access_token);
        }
      },
      error_callback: (err: { type: string }) => {
        reject(new Error(err.type ?? "Google sign-in was cancelled"));
      },
    });
    client.requestAccessToken({ prompt: "select_account" });
  });
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

    // ── Google Sign-In via GIS ────────────────────────────────────────────
    googleSignIn: async () => {
      requireFirebase();
      const a = auth!;

      const accessToken = await gisGoogleSignIn();

      const firebaseCredential = GoogleAuthProvider.credential(null, accessToken);
      const result = await signInWithCredential(a, firebaseCredential);
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

    // ── Password Reset ────────────────────────────────────────────────────
    // SECURITY: We deliberately never reveal whether an email is registered.
    // Both "user not found" and "invalid email" errors are silently swallowed
    // so the caller always sees success — showing "if registered, check inbox".
    // Genuine errors (network down, service unavailable) are re-thrown.
    sendResetEmail: async (email: string) => {
      requireFirebase();
      try {
        await sendPasswordResetEmail(auth!, email);
      } catch (err: unknown) {
        const code = (err as { code?: string }).code ?? "";
        // Swallow: prevents revealing whether the email is registered
        if (
          code === "auth/user-not-found" ||
          code === "auth/invalid-email" ||
          code === "auth/invalid-credential"
        ) return;
        // Re-throw: genuine failure the user should know about
        throw err;
      }
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

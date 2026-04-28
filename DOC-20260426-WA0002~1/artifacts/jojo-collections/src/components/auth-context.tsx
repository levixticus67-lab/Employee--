import { createContext, useContext, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetCurrentUser,
  useLogin,
  useSignup,
  useLogout,
  useAdminLogin,
  useAdminLogout,
  getGetCurrentUserQueryKey,
} from "@workspace/api-client-react";

type AuthUser = { id: string; name: string; email: string };

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
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const meKey = getGetCurrentUserQueryKey();
  const { data, isLoading } = useGetCurrentUser({
    query: { staleTime: 60_000, retry: false },
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
    login: async (email, password) => {
      await loginMut.mutateAsync({ data: { email, password } });
      await refresh();
    },
    signup: async (name, email, password) => {
      await signupMut.mutateAsync({ data: { name, email, password } });
      await refresh();
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

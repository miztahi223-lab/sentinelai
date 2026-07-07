"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useRouter } from "@/i18n/navigation";
import { api, clearTokens, getAccessToken, setTokens } from "./api";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  createdAt: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    name: string,
    organizationName: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  refetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchMe = useCallback(async () => {
    if (!getAccessToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get<AuthUser>("/auth/me");
      setUser(data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Standard "fetch on mount, ignore the result if the effect was cleaned
    // up first" pattern (see https://react.dev/learn/you-might-not-need-an-effect#fetching-data)
    // rather than calling the setState-triggering callback directly, so a
    // fast unmount (e.g. React Strict Mode's double-invoke in dev) can't
    // apply a stale result.
    let ignore = false;

    async function run() {
      if (!getAccessToken()) {
        if (!ignore) {
          setUser(null);
          setLoading(false);
        }
        return;
      }
      try {
        const { data } = await api.get<AuthUser>("/auth/me");
        if (!ignore) setUser(data);
      } catch {
        if (!ignore) setUser(null);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    void run();

    return () => {
      ignore = true;
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const { data } = await api.post("/auth/login", { email, password });
      setTokens(data.accessToken, data.refreshToken);
      setUser(data.user);
      router.push("/dashboard");
    },
    [router],
  );

  const register = useCallback(
    async (
      email: string,
      password: string,
      name: string,
      organizationName: string,
    ) => {
      const { data } = await api.post("/auth/register", {
        email,
        password,
        name,
        organizationName,
      });
      setTokens(data.accessToken, data.refreshToken);
      setUser(data.user);
      router.push("/dashboard");
    },
    [router],
  );

  const logout = useCallback(async () => {
    const refreshToken =
      typeof window !== "undefined"
        ? localStorage.getItem("sentinelai_refresh_token")
        : null;
    try {
      if (refreshToken) {
        await api.post("/auth/logout", { refreshToken });
      }
    } finally {
      clearTokens();
      setUser(null);
      router.push("/login");
    }
  }, [router]);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, refetchUser: fetchMe }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

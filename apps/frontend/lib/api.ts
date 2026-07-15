import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

const ACCESS_TOKEN_KEY = "domecortex_access_token";
const REFRESH_TOKEN_KEY = "domecortex_refresh_token";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

// Queue of requests waiting on a single in-flight token refresh so a burst
// of parallel 401s doesn't trigger a burst of parallel refresh calls.
let refreshPromise: Promise<string | null> | null = null;

async function performRefresh(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  try {
    const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
      refreshToken,
    });
    setTokens(data.accessToken, data.refreshToken);
    return data.accessToken as string;
  } catch {
    clearTokens();
    return null;
  }
}

// Public auth endpoints that legitimately return 401 for a normal, expected
// reason (wrong password, wrong/expired MFA code) — not "your session
// died". Without this exclusion, a wrong code on the MFA step would be
// treated exactly like an expired session: the interceptor finds no
// refresh token (there never was a session yet), then hard-redirects to
// /login, wiping the in-progress verification step and swallowing the
// error before the login page's own `catch` block ever sees it.
const PUBLIC_AUTH_PATHS = ["/auth/login", "/auth/mfa/verify", "/auth/register"];

export function isPublicAuthRequest(url: string | undefined): boolean {
  return !!url && PUBLIC_AUTH_PATHS.some((path) => url.includes(path));
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isPublicAuthRequest(originalRequest.url)
    ) {
      originalRequest._retry = true;

      if (!refreshPromise) {
        refreshPromise = performRefresh().finally(() => {
          refreshPromise = null;
        });
      }

      const newAccessToken = await refreshPromise;
      if (newAccessToken) {
        originalRequest.headers.set("Authorization", `Bearer ${newAccessToken}`);
        return api(originalRequest);
      }

      if (typeof window !== "undefined") {
        // Preserves whichever locale the user was on (`/he/...` vs
        // `/en/...`) — this is a hard browser navigation (not React Router),
        // so it can't use next-intl's locale-aware `Link`/`useRouter`;
        // reading the locale segment straight out of the current path is
        // the simplest correct fix without a React-only dependency here.
        // Falls back to no prefix (the proxy/middleware will redirect to
        // the default locale) if the path doesn't start with a known one.
        const KNOWN_LOCALES = ["en", "he"];
        const firstSegment = window.location.pathname.split("/")[1];
        const localePrefix = KNOWN_LOCALES.includes(firstSegment)
          ? `/${firstSegment}`
          : "";
        window.location.href = `${localePrefix}/login`;
      }
    }

    return Promise.reject(error);
  },
);

import axios from "axios";
import Cookies from "js-cookie";

// Every setting comes from GenieLaw-Admin/.env; there are no built-in fallbacks.
const CONFIGURED_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
if (!CONFIGURED_API_BASE_URL || !CONFIGURED_API_BASE_URL.trim()) {
  throw new Error("NEXT_PUBLIC_API_BASE_URL is not set. Add it to GenieLaw-Admin/.env.");
}
const API_BASE_URL = CONFIGURED_API_BASE_URL.trim().replace(/\/+$/, "");
if (!/^https?:\/\/[^/]+\/api$/i.test(API_BASE_URL)) {
  throw new Error(
    "NEXT_PUBLIC_API_BASE_URL must be the backend's API address ending in /api, e.g. http://localhost:5000/api."
  );
}
const API_TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_API_TIMEOUT_MS);
if (!Number.isFinite(API_TIMEOUT_MS) || API_TIMEOUT_MS <= 0) {
  throw new Error("NEXT_PUBLIC_API_TIMEOUT_MS is not set. Add it to GenieLaw-Admin/.env.");
}
// The backend itself: stored files (<origin>/uploads/...) and the realtime
// connection (<origin>/socket.io/) are served by the same server.
export const API_ORIGIN = API_BASE_URL.replace(/\/api$/, "");

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
  timeout: API_TIMEOUT_MS,
});

let isRefreshing = false;
let pendingRequests: Array<{ resolve: (t: string) => void; reject: () => void }> = [];

api.interceptors.request.use((config) => {
  const token = Cookies.get("admin_token") || (typeof window !== "undefined" ? localStorage.getItem("admin_token") : null);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      if (typeof window === "undefined" || original.url?.startsWith("/auth/refresh-token")) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingRequests.push({
            resolve: (t: string) => {
              original.headers.Authorization = `Bearer ${t}`;
              resolve(api(original));
            },
            reject,
          });
        });
      }

      original._retry = true;
      isRefreshing = true;
      try {
        const rToken = localStorage.getItem("admin_refresh_token");
        if (!rToken) throw new Error("no refresh token");

        const refreshApi = axios.create({
          baseURL: API_BASE_URL,
          headers: { "Content-Type": "application/json" },
        });
        const res = await refreshApi.post("/auth/refresh-token", { refreshToken: rToken });
        const { token, refreshToken } = res.data.data;

        Cookies.set("admin_token", token, { expires: 7 });
        localStorage.setItem("admin_token", token);
        localStorage.setItem("admin_refresh_token", refreshToken);

        original.headers.Authorization = `Bearer ${token}`;
        pendingRequests.forEach((p) => p.resolve(token));
        pendingRequests = [];
        return api(original);
      } catch {
        Cookies.remove("admin_token");
        localStorage.removeItem("admin_token");
        localStorage.removeItem("admin_refresh_token");
        if (!window.location.pathname.startsWith("/login")) {
          window.location.href = "/login";
        }
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

import { create } from "zustand";
import Cookies from "js-cookie";
import { api } from "../api/axios";
import { apiErrorMessage } from "../utils";

export interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
  profileImage?: string;
}

interface AuthState {
  user: AdminUser | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<boolean>;
  checkAuth: () => Promise<void>;
}

// A stable id for this browser, sent with sign-in so the backend replaces
// this browser's previous admin session instead of adding another one.
const DEVICE_ID_KEY = "admin_device_id";
function browserDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = `admin-web-${crypto.randomUUID()}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function clearStoredSession() {
  Cookies.remove("admin_token");
  localStorage.removeItem("admin_token");
  localStorage.removeItem("admin_refresh_token");
}

type AuthResponse = {
  token: string;
  refreshToken: string;
  user: AdminUser & { _id?: string };
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: typeof window !== "undefined" ? Cookies.get("admin_token") || localStorage.getItem("admin_token") : null,
  refreshToken: typeof window !== "undefined" ? localStorage.getItem("admin_refresh_token") : null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const res = await api.post("/auth/login", {
        email,
        password,
        deviceId: browserDeviceId(),
        deviceName: "Admin panel",
        platform: "web",
      });
      const { token, refreshToken: rToken, user } = res.data.data as AuthResponse;

      if (user.role !== "admin") {
        throw new Error("Access denied. Admin authorization required.");
      }

      Cookies.set("admin_token", token, { expires: 7 });
      localStorage.setItem("admin_token", token);
      localStorage.setItem("admin_refresh_token", rToken);

      set({
        user: {
          id: user.id || user._id || "",
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          profileImage: user.profileImage,
        },
        token,
        refreshToken: rToken,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err: any) {
      set({ isLoading: false });
      throw new Error(apiErrorMessage(err));
    }
  },

  logout: async () => {
    // End the session on the backend too, so its tokens stop working at once.
    // Signing out locally still happens if the backend cannot be reached.
    try {
      await api.post("/auth/logout");
    } catch {
      // Already expired or offline: nothing more to revoke from here.
    }
    clearStoredSession();
    set({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  },

  refreshAuth: async () => {
    try {
      const rToken = localStorage.getItem("admin_refresh_token");
      if (!rToken) return false;

      const res = await api.post("/auth/refresh-token", { refreshToken: rToken });
      const { token: newToken, refreshToken: newRefreshToken } = res.data.data;

      Cookies.set("admin_token", newToken, { expires: 7 });
      localStorage.setItem("admin_token", newToken);
      localStorage.setItem("admin_refresh_token", newRefreshToken);

      set({ token: newToken, refreshToken: newRefreshToken });
      return true;
    } catch {
      // refresh failed — caller will trigger logout
      return false;
    }
  },

  checkAuth: async () => {
    const token = Cookies.get("admin_token") || localStorage.getItem("admin_token");
    if (!token) {
      set({ user: null, token: null, refreshToken: null, isAuthenticated: false, isLoading: false });
      return;
    }

    try {
      const res = await api.get("/auth/profile");
      const user = res.data.data;
      if (user.role !== "admin") {
        throw new Error("Not an admin");
      }
      set({
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          profileImage: user.profileImage,
        },
        token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch {
      // try refreshing the token before giving up
      const ok = await useAuthStore.getState().refreshAuth();
      if (ok) {
        // retry profile once
        try {
          const res = await api.get("/auth/profile");
          const user = res.data.data;
          set({
            user: {
              id: user._id,
              fullName: user.fullName,
              email: user.email,
              role: user.role,
              profileImage: user.profileImage,
            },
            token: useAuthStore.getState().token,
            isAuthenticated: true,
            isLoading: false,
          });
          return;
        } catch {
          // fall through to logout
        }
      }

      clearStoredSession();
      set({
        user: null,
        token: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },
}));

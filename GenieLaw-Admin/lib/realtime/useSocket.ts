import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io, Socket } from "socket.io-client";
import { toast } from "sonner";
import { API_ORIGIN } from "@/lib/api/axios";

// Live updates from the backend's Socket.IO server (same server as the API,
// at <origin>/socket.io/). The admin panel listens on the public "/"
// namespace, where the backend broadcasts platform-wide events
// (backend/src/realtime/events.js). Everything else stays fresh through
// React Query refetching (app/providers.tsx).
let socket: Socket | null = null;

export function useSocket() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket) {
      socket = io(API_ORIGIN, {
        transports: ["websocket", "polling"],
        reconnection: true,
      });
    }

    const invalidate = (keys: string[][]) =>
      keys.forEach((k) => queryClient.invalidateQueries({ queryKey: k }));

    const onConnectError = (err: Error) => {
      console.warn("Realtime connection error:", err.message);
    };
    // After a reconnect, anything missed while offline is refetched.
    const onReconnect = () => queryClient.invalidateQueries({ queryKey: ["admin"] });

    const handlers: Record<string, () => void> = {
      lawyer_verification_updated: () => {
        toast.info("A lawyer verification status was updated");
        invalidate([["admin", "lawyers"], ["admin", "stats"]]);
      },
      lawyer_rating_updated: () => {
        invalidate([["admin", "lawyers"], ["admin", "reviews"]]);
      },
      admin_broadcast: () => {
        toast.success("A new broadcast notification was sent");
        invalidate([["admin", "notifications"]]);
      },
    };

    socket.on("connect_error", onConnectError);
    socket.io.on("reconnect", onReconnect);
    Object.entries(handlers).forEach(([event, handler]) => socket?.on(event, handler));

    return () => {
      socket?.off("connect_error", onConnectError);
      socket?.io.off("reconnect", onReconnect);
      Object.entries(handlers).forEach(([event, handler]) => socket?.off(event, handler));
    };
  }, [queryClient]);
}

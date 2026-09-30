"use client";

import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { useSocket } from "@/lib/realtime/useSocket";

function SocketInitializer() {
  useSocket();
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 30, // 30 seconds
            // Most platform changes (new cases, signups, payments) are not
            // pushed over the socket, so data older than staleTime is
            // reloaded when the admin returns to the tab.
            refetchOnWindowFocus: true,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SocketInitializer />
      {children}
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  );
}

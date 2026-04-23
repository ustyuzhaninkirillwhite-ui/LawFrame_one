"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import { RealtimeProvider } from "./realtime-provider";
import { SessionProvider } from "./session-provider";

declare global {
  interface Window {
    __LEXFRAME_MSW_READY?: boolean;
  }
}

function MswBootstrap() {
  React.useEffect(() => {
    if (process.env.NEXT_PUBLIC_ENABLE_MSW !== "1") {
      window.__LEXFRAME_MSW_READY = true;
      return;
    }

    void import("@/mocks/browser").then(async ({ worker }) => {
      await worker.start({ onUnhandledRequest: "bypass" });
      window.__LEXFRAME_MSW_READY = true;
    });
  }, []);

  return null;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <RealtimeProvider>
          <MswBootstrap />
          {children}
        </RealtimeProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}

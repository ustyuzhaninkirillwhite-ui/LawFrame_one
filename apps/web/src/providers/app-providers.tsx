"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import { getPublicEnv } from "@/lib/browser-auth";
import { RealtimeProvider } from "./realtime-provider";
import { SessionProvider } from "./session-provider";
import { ThemeProvider } from "./theme-provider";

declare global {
  interface Window {
    __LEXFRAME_MSW_READY?: boolean;
  }
}

function shouldStartMockApi() {
  const env = getPublicEnv();
  if (env.NEXT_PUBLIC_ENABLE_MSW === "1") {
    return true;
  }
  if (env.NEXT_PUBLIC_ENABLE_MSW === "0") {
    return false;
  }
  return (
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.startsWith("demo_")
  );
}

function MswBootstrap({ children }: { readonly children: React.ReactNode }) {
  const [ready, setReady] = React.useState(() => !shouldStartMockApi());

  React.useEffect(() => {
    if (!shouldStartMockApi()) {
      window.__LEXFRAME_MSW_READY = true;
      return;
    }

    void import("@/mocks/browser").then(async ({ worker }) => {
      await worker.start({ onUnhandledRequest: "bypass" });
      window.__LEXFRAME_MSW_READY = true;
      setReady(true);
    }).catch((error: unknown) => {
      console.error("Failed to start LexFrame mock API.", error);
      window.__LEXFRAME_MSW_READY = true;
      setReady(true);
    });
  }, []);

  return ready ? <>{children}</> : null;
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
      <ThemeProvider>
        <MswBootstrap>
          <SessionProvider>
            <RealtimeProvider>
              {children}
            </RealtimeProvider>
          </SessionProvider>
        </MswBootstrap>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

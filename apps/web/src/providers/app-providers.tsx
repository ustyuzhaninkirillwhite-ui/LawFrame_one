"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import { RealtimeProvider } from "./realtime-provider";
import { SessionProvider } from "./session-provider";
import { ThemeProvider } from "./theme-provider";

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
        <SessionProvider>
          <RealtimeProvider>
            {children}
          </RealtimeProvider>
        </SessionProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

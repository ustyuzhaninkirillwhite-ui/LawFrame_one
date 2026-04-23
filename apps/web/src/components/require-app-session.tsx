"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSessionBridge } from "@/providers/session-provider";

export function RequireAppSession({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { authPending, sessionContext, signOut } = useSessionBridge();

  React.useEffect(() => {
    if (authPending) {
      return;
    }

    if (sessionContext.state === "unauthenticated") {
      router.replace("/sign-in");
      return;
    }

    if (sessionContext.state === "needs_workspace") {
      router.replace("/onboarding/workspace");
    }
  }, [authPending, router, sessionContext.state]);

  if (authPending || sessionContext.state === "unauthenticated" || sessionContext.state === "needs_workspace") {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-10">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>Готовим контекст рабочего пространства</CardTitle>
            <CardDescription>
              LexFrame проверяет сессию и права доступа перед открытием защищённых разделов.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  if (sessionContext.state === "email_unconfirmed") {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-10">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>Требуется подтверждение почты</CardTitle>
            <CardDescription>
              Пользователь определён, но действия в рабочем пространстве заблокированы до подтверждения почты.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <button
              type="button"
              onClick={() => {
                void signOut();
              }}
              className="rounded-full border border-[color:var(--line)] px-4 py-2 text-sm"
            >
              Выйти
            </button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return <AppShell>{children}</AppShell>;
}

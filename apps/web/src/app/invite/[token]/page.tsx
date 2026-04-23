"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSessionBridge } from "@/providers/session-provider";

export default function AcceptInvitePage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const { apiClient, authPending, sessionContext, setSessionContext } = useSessionBridge();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const token = params.token;

  if (authPending) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-10">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>Загружаем приглашение</CardTitle>
          </CardHeader>
        </Card>
      </main>
    );
  }

  if (sessionContext.state === "unauthenticated") {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-10">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>Войдите перед принятием приглашения</CardTitle>
            <CardDescription>
              Принятие приглашения меняет рабочее пространство только через
              backend и требует авторизованного пользователя.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/sign-in")}>Открыть вход</Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Принять приглашение в рабочее пространство</CardTitle>
          <CardDescription>
            Backend проверит токен, совпадение email, срок действия и членство
            перед привязкой рабочего пространства.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {error ? (
            <div className="rounded-[18px] border border-[color:var(--danger)]/40 bg-[color:var(--danger)]/10 px-4 py-3 text-sm">
              {error}
            </div>
          ) : null}
          <Button
            disabled={submitting}
            onClick={() => {
              void (async () => {
                setSubmitting(true);
                setError(null);

                try {
                  const nextContext = await apiClient.acceptWorkspaceInvitation({
                    token,
                  });
                  setSessionContext(nextContext);
                  router.replace("/dashboard");
                } catch (nextError) {
                  setError(
                    nextError instanceof Error
                      ? nextError.message
                      : "Не удалось принять приглашение.",
                  );
                } finally {
                  setSubmitting(false);
                }
              })();
            }}
          >
            Принять приглашение
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

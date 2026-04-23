"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { t } from "@/lib/i18n";
import { useSessionBridge } from "@/providers/session-provider";

export default function WorkspaceOnboardingPage() {
  const router = useRouter();
  const {
    apiClient,
    authPending,
    refreshSessionContext,
    sessionContext,
    signOut,
  } = useSessionBridge();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authPending) {
      return;
    }

    if (sessionContext.state === "unauthenticated") {
      router.replace("/sign-in");
      return;
    }

    if (sessionContext.state === "ready" || sessionContext.state === "needs_mfa") {
      router.replace("/dashboard");
    }
  }, [authPending, router, sessionContext.state]);

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Create the first workspace</CardTitle>
          <CardDescription>
            A valid identity exists, but the application stays blocked until at least one workspace is attached to the actor.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Orlov & Partners"
          />
          <Input
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            placeholder="orlov-partners"
          />
          {error ? (
            <div className="rounded-[18px] border border-[color:var(--danger)]/40 bg-[color:var(--danger)]/10 px-4 py-3 text-sm">
              {error}
            </div>
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              disabled={submitting}
              onClick={() => {
                void (async () => {
                  setSubmitting(true);
                  setError(null);

                  try {
                    await apiClient.createWorkspace({
                      name,
                      ...(slug.trim() ? { slug } : {}),
                    });
                    await refreshSessionContext();
                    router.replace("/dashboard");
                  } catch (nextError) {
                    setError(
                      nextError instanceof Error
                        ? nextError.message
                        : t("Workspace creation failed."),
                    );
                  } finally {
                    setSubmitting(false);
                  }
                })();
              }}
            >
              Create workspace
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                void signOut();
              }}
            >
              Sign out
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

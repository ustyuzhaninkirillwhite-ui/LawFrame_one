"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSessionBridge } from "@/providers/session-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { t } from "@/lib/i18n";

export default function SignInPage() {
  const router = useRouter();
  const { authMode, authPending, sessionContext, signIn, signUp } = useSessionBridge();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authPending) {
      return;
    }

    if (sessionContext.state === "ready" || sessionContext.state === "needs_mfa") {
      router.replace("/dashboard");
      return;
    }

    if (sessionContext.state === "needs_workspace") {
      router.replace("/onboarding/workspace");
    }
  }, [authPending, router, sessionContext.state]);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);

    try {
      if (mode === "sign-in") {
        await signIn({
          email,
          password,
          fullName,
        });
      } else {
        await signUp({
          email,
          password,
          fullName,
        });
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t("Authentication failed."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>LexFrame Stage 1 sign in</CardTitle>
          <CardDescription>
            {authMode === "demo"
              ? "Development mode issues deterministic local bearer tokens so the workspace, RBAC and audit flows can be exercised without a live Supabase project."
              : "Browser identity stays limited to Supabase Auth. The application session context is resolved only through the LexFrame backend."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-3">
            <Input
              data-testid="sign-in-email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              type="email"
            />
            <Input
              data-testid="sign-in-full-name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Full name"
            />
            <Input
              data-testid="sign-in-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={authMode === "demo" ? "Any password in demo mode" : "Password"}
              type="password"
            />
          </div>
          {error ? (
            <div className="rounded-[18px] border border-[color:var(--danger)]/40 bg-[color:var(--danger)]/10 px-4 py-3 text-sm">
              {error}
            </div>
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              data-testid="sign-in-submit"
              disabled={submitting}
              onClick={() => void handleSubmit()}
            >
              {mode === "sign-in" ? "Sign in" : "Create account"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setMode((current) => (current === "sign-in" ? "sign-up" : "sign-in"))}
            >
              {mode === "sign-in" ? "Need an account?" : "Already have an account?"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

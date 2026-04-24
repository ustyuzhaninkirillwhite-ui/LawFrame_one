"use client";

import type { Stage15BlockedState, Stage15UiStatus } from "@lexframe/contracts";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const statusLabel: Record<Stage15UiStatus, string> = {
  draft: "черновик",
  saved: "сохранено",
  autosaving: "автосохранение",
  syncing: "синхронизация",
  synced: "синхронизировано",
  conflict: "конфликт",
  validation_failed: "ошибка валидации",
  runtime_unavailable: "runtime недоступен",
  missing_connection: "нет подключения",
  blocked_by_policy: "заблокировано policy",
  permission_required: "нужны права",
};

const statusVariant: Record<Stage15UiStatus, "accent" | "muted" | "success" | "danger"> = {
  draft: "muted",
  saved: "success",
  autosaving: "accent",
  syncing: "accent",
  synced: "success",
  conflict: "danger",
  validation_failed: "danger",
  runtime_unavailable: "danger",
  missing_connection: "danger",
  blocked_by_policy: "danger",
  permission_required: "muted",
};

const blockedReasonLabel: Record<Stage15BlockedState["reason"], string> = {
  permission_required: "нужны права",
  feature_disabled: "feature flag",
  connection_required: "нет подключения",
  runtime_unavailable: "runtime недоступен",
  blocked_by_policy: "заблокировано policy",
};

export function Stage15StatusBadge({ status }: { readonly status: Stage15UiStatus }) {
  return <Badge variant={statusVariant[status]}>{statusLabel[status]}</Badge>;
}

export function BlockedStateView({ state }: { readonly state: Stage15BlockedState }) {
  return (
    <Card className="border-[color:var(--danger)]/30 bg-[color:var(--danger)]/8">
      <CardHeader>
        <Badge variant="danger">{blockedReasonLabel[state.reason]}</Badge>
        <CardTitle>{state.title}</CardTitle>
        <CardDescription>{state.description}</CardDescription>
      </CardHeader>
      {state.actionHref && state.actionLabel ? (
        <CardContent>
          <Button asChild variant="ghost">
            <Link href={state.actionHref}>{state.actionLabel}</Link>
          </Button>
        </CardContent>
      ) : null}
    </Card>
  );
}

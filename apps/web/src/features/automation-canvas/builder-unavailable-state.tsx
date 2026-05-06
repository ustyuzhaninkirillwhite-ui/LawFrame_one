"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActivepiecesSessionFailureResponse } from "./use-activepieces-session";

export function BuilderUnavailableState({
  response,
  message,
  onRetry,
}: {
  readonly response: ActivepiecesSessionFailureResponse | null;
  readonly message?: string | null;
  readonly onRetry?: () => void;
}) {
  const code =
    response && "readinessCode" in response ? response.readinessCode : null;
  const title =
    response?.status === "blocked"
      ? "Конструктор автоматизаций заблокирован"
      : "Конструктор автоматизаций временно недоступен";

  return (
    <Card data-testid="builder-unavailable-state">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={response?.status === "blocked" ? "muted" : "danger"}>
            {formatStatus(response?.status)}
          </Badge>
          {code ? <Badge variant="muted">{code}</Badge> : null}
        </div>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm leading-6 text-[color:var(--muted-strong)]">
        <p>
          {message ??
            response?.message ??
            "Внешняя форма входа не открывается. Система ожидает готовности backend-моста сессии."}
        </p>
        {response?.diagnostics?.traceId ? (
          <div className="rounded-[var(--lf-radius-control)] border border-[color:var(--line)] bg-[color:var(--lf-bg-muted)] p-3">
            ID трассировки: {response.diagnostics.traceId}
          </div>
        ) : null}
        {onRetry ? (
          <div>
            <Button type="button" variant="ghost" onClick={onRetry}>
              Обновить состояние
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function formatStatus(
  status: ActivepiecesSessionFailureResponse["status"] | undefined,
) {
  switch (status) {
    case "blocked":
      return "заблокировано";
    case "unavailable":
      return "недоступно";
    default:
      return "недоступно";
  }
}

"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  SafeActivepiecesSession,
  SafeActivepiecesSessionResponse,
} from "./use-activepieces-session";

export function DiagnosticsPanel({
  session,
  response,
}: {
  readonly session: SafeActivepiecesSession | null;
  readonly response: SafeActivepiecesSessionResponse | null;
}) {
  const diagnostics = response?.diagnostics;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <Badge variant="muted">Конструктор автоматизаций</Badge>
          <CardTitle>Безопасная диагностика</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-[color:var(--muted-strong)]">
          <StateLine label="Статус" value={formatStatus(response?.status)} />
          <StateLine
            label="Готовность"
            value={
              response && "readinessCode" in response
                ? response.readinessCode
                : "неизвестно"
            }
          />
          <StateLine
            label="ID трассировки"
            value={diagnostics?.traceId ?? "нет"}
          />
          <StateLine
            label="Локальные ключи"
            value={diagnostics?.localOwnerKeys ?? "нет данных"}
          />
          <StateLine label="Токен" value="только в памяти, скрыт" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Badge variant={session ? "success" : "muted"}>runtime</Badge>
          <CardTitle>Runtime-связь</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-[color:var(--muted-strong)]">
          <StateLine label="Режим" value={session?.mode ?? "нет"} />
          <StateLine label="Роль" value={formatRole(session?.role)} />
          <StateLine
            label="Приложение runtime"
            value={
              session?.runtimeStatus.apApp ?? diagnostics?.apApp ?? "неизвестно"
            }
          />
          <StateLine
            label="Worker runtime"
            value={
              session?.runtimeStatus.apWorker ??
              diagnostics?.apWorker ??
              "неизвестно"
            }
          />
          <StateLine
            label="Автоматизация"
            value={session?.flowBinding.activepiecesFlowId ?? "не подключена"}
          />
          <StateLine
            label="Срок сессии"
            value={session ? `${session.ttlSeconds} с` : "нет"}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function formatStatus(status: SafeActivepiecesSessionResponse['status'] | undefined) {
  switch (status) {
    case 'ready':
      return 'готово';
    case 'degraded':
      return 'частично готово';
    case 'blocked':
      return 'заблокировано';
    case 'unavailable':
      return 'недоступно';
    default:
      return 'неизвестно';
  }
}

function formatRole(role: SafeActivepiecesSession['role'] | undefined) {
  switch (role) {
    case 'EDITOR':
      return 'редактор';
    case 'VIEWER':
      return 'просмотр';
    default:
      return 'нет';
  }
}

function StateLine({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-[8px] border border-[color:var(--line)] p-3">
      <span>{label}</span>
      <span className="break-all text-right text-[color:var(--foreground)]">
        {value}
      </span>
    </div>
  );
}

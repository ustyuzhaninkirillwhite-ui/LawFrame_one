"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { QueryState, badgeVariantForStatus, readParam } from "@/components/stage3-shared";
import {
  useAutomationDetail,
  useAutomationRuntimeRequirements,
  useBuilderToken,
  useSyncAutomationRuntime,
} from "@/hooks/use-stage0-data";
import { getPublicEnv } from "@/lib/browser-auth";
import { formatDateTime, formatRole, formatStatus, t } from "@/lib/i18n";

type EmbedSdk = {
  configure: (input: Record<string, unknown>) => void | Promise<void>;
  navigate?: (input: { route: string }) => void | Promise<void>;
};

declare global {
  interface Window {
    activepieces?: EmbedSdk;
    ActivepiecesEmbeddedBuilder?: EmbedSdk;
    ActivepiecesEmbed?: EmbedSdk;
  }
}

let embedSdkPromise: Promise<EmbedSdk> | null = null;

export function BuilderReadiness({
  projectId,
}: {
  readonly projectId?: string;
}) {
  const params = useParams<{ id?: string; automationId?: string }>();
  const automationId =
    readParam(params.automationId) ??
    readParam(params.id) ??
    "aut_01hzyd8md4j4yhr40t1k0f8p9n";
  const env = React.useMemo(() => getPublicEnv(), []);
  const containerId = React.useMemo(
    () => `activepieces-builder-${automationId.replace(/[^a-z0-9_-]/gi, "-")}`,
    [automationId],
  );
  const automation = useAutomationDetail(automationId);
  const runtime = useAutomationRuntimeRequirements(automationId);
  const syncMutation = useSyncAutomationRuntime(automationId);
  const token = useBuilderToken(
    {
      installedAutomationId: automationId,
      purpose: "builder",
    },
    {
      enabled: runtime.data?.canOpenBuilder ?? false,
    },
  );
  const [expired, setExpired] = React.useState(false);
  const [sdkState, setSdkState] = React.useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [sdkError, setSdkError] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!token.data) {
      const resetId = window.setTimeout(() => {
        setExpired(false);
      }, 0);

      return () => {
        window.clearTimeout(resetId);
      };
    }

    const syncExpiryState = () => {
      setExpired(new Date(token.data.expiresAt).getTime() <= Date.now());
    };
    const initialId = window.setTimeout(syncExpiryState, 0);
    const intervalId = window.setInterval(syncExpiryState, 30_000);

    return () => {
      window.clearTimeout(initialId);
      window.clearInterval(intervalId);
    };
  }, [token.data]);

  React.useEffect(() => {
    if (!token.data || !runtime.data?.canOpenBuilder || expired) {
      return;
    }

    const tokenData = token.data;
    let disposed = false;

    async function mount() {
      try {
        setSdkState("loading");
        setSdkError(null);
        const sdk = await loadEmbedSdk(env.NEXT_PUBLIC_ACTIVEPIECES_EMBED_SDK_URL);

        if (disposed) {
          return;
        }

        await sdk.configure({
          instanceUrl: tokenData.instanceUrl,
          jwtToken: tokenData.token,
          containerId,
          prefix: projectId
            ? `/app/projects/${projectId}/automations/${automationId}/advanced-builder`
            : `/automations/${automationId}/builder`,
          disableNavigation: "keep_home_button_only",
          hideFlowName: false,
          navigationHandler: () => undefined,
        });

        if (!disposed && automation.data?.runtimeFlowId && typeof sdk.navigate === "function") {
          await sdk.navigate({ route: `/flows/${automation.data.runtimeFlowId}` });
        }

        if (!disposed) {
          setSdkState("ready");
        }
      } catch (error) {
        if (!disposed) {
          setSdkState("error");
          setSdkError(
            error instanceof Error ? error.message : "Не удалось инициализировать embed SDK.",
          );
        }
      }
    }

    void mount();

    return () => {
      disposed = true;
    };
  }, [
    automation.data?.runtimeFlowId,
    automationId,
    containerId,
    env.NEXT_PUBLIC_ACTIVEPIECES_EMBED_SDK_URL,
    expired,
    projectId,
    runtime.data?.canOpenBuilder,
    token.data,
  ]);

  if (automation.isLoading || runtime.isLoading || !automation.data || !runtime.data) {
    return (
      <QueryState
        title="Загрузка shell конструктора"
        description="Проверяем готовность runtime, привязку проекта и краткосрочный embed-токен."
      />
    );
  }

  if (!runtime.data.canOpenBuilder) {
    return (
      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <Card>
          <CardHeader>
            <Badge variant="accent">встроенный конструктор</Badge>
            <CardTitle>Конструктор пока не открыт</CardTitle>
            <CardDescription>
              В этапе 4 конструктор выдаётся только после runtime-синхронизации
              и backend-контура готовности.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <StateLine label="Состояние конструктора" value={formatStatus(automation.data.builderState)} />
            <StateLine label="Состояние синхронизации" value={formatStatus(automation.data.syncState)} />
            <StateLine label="Следующий контур" value={formatStatus(automation.data.nextGate)} />
            <Button
              onClick={() => {
                void syncMutation.mutateAsync({ dryRun: false });
              }}
              disabled={syncMutation.isPending}
            >
              {syncMutation.isPending ? "Синхронизируем..." : "Запустить runtime-синхронизацию"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Badge variant="muted">runtime-блокеры</Badge>
            <CardTitle>Что мешает открыть конструктор</CardTitle>
            <CardDescription>
              UI не принимает решение сам: он показывает то, что вернул backend.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-[color:var(--muted-strong)]">
            {runtime.data.warnings.map((warning) => (
              <div
                key={warning}
                className="rounded-[20px] border border-[color:var(--line)] bg-black/20 p-4"
              >
                {warning}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (token.isLoading || !token.data) {
    return (
      <QueryState
        title="Выдаём embed-токен"
        description="Backend создаёт краткосрочный JWT и связывает пользователя/проект Activepieces с текущим пространством."
      />
    );
  }

  if (token.isError) {
    return (
      <Card>
        <CardHeader>
          <Badge variant="danger">ошибка токена</Badge>
          <CardTitle>Не удалось получить embed-токен</CardTitle>
          <CardDescription>
            Shell конструктора не открывается без backend-токена и runtime-привязки.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="rounded-[22px] border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
            {token.error instanceof Error ? token.error.message : "Неизвестная ошибка токена."}
          </div>
          <Button
            onClick={() => {
              void token.refetch();
            }}
          >
            Повторить
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (expired) {
    return (
      <Card>
        <CardHeader>
          <Badge variant="danger">токен истёк</Badge>
          <CardTitle>Сессия конструктора устарела</CardTitle>
          <CardDescription>
            Embed-токен краткосрочный. Обновите сессию и откройте конструктор заново.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => {
              void token.refetch();
            }}
          >
            Обновить сессию
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="accent">встроенный конструктор</Badge>
            <Badge variant={badgeVariantForStatus(automation.data.builderState)}>
              {formatStatus(automation.data.builderState)}
            </Badge>
            <Badge variant={badgeVariantForStatus(automation.data.syncState)}>
              {formatStatus(automation.data.syncState)}
            </Badge>
            <Badge variant={sdkState === "ready" ? "success" : "muted"}>{formatStatus(sdkState)}</Badge>
          </div>
          <CardTitle>Сессия конструктора</CardTitle>
          <CardDescription>
            Shell использует backend-токен и пытается загрузить официальный SDK
            Activepieces.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative rounded-[24px] border border-[color:var(--line)] bg-black/20 p-4">
            <div
              id={containerId}
              className="min-h-[520px] rounded-[18px] border border-dashed border-[color:var(--line)] bg-black/25"
            />
            {sdkState !== "ready" ? (
              <div className="pointer-events-none absolute inset-4 flex items-center justify-center rounded-[18px] border border-[color:var(--line)] bg-black/55 p-6 text-center text-sm text-[color:var(--muted-strong)]">
                {sdkState === "loading"
                  ? "Загружаем embed SDK и открываем runtime-процесс..."
                  : "Оболочка ожидает инициализацию SDK."}
              </div>
            ) : null}
          </div>
          {sdkError ? (
            <div className="mt-4 rounded-[22px] border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
              {sdkError}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Badge variant="muted">сессия</Badge>
          <CardTitle>Runtime-контекст</CardTitle>
          <CardDescription>
            Состояние маршрута конструктора, привязки процесса и выданного
            embed-токена.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm text-[color:var(--muted-strong)]">
          <StateLine label="Инстанс" value={token.data.instanceUrl} />
          <StateLine label="Runtime-проект" value={token.data.runtimeProjectId ?? "—"} />
          <StateLine label="Runtime-процесс" value={token.data.runtimeFlowId ?? "—"} />
          <StateLine label="Роль" value={formatRole(token.data.role)} />
          <StateLine label="Истекает" value={formatDateTime(token.data.expiresAt)} />
          <div className="rounded-[22px] border border-[color:var(--line)] bg-white/3 p-4">
            <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
              Теги компонентов
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {token.data.piecesTags.map((tag) => (
                <Badge key={tag} variant="muted">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={() => {
              void token.refetch();
            }}
          >
            Обновить токен
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function StateLine({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="rounded-[22px] border border-[color:var(--line)] bg-white/3 p-4">
      <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
        {t(label)}
      </div>
      <div className="mt-2 break-all text-sm">{value}</div>
    </div>
  );
}

async function loadEmbedSdk(src: string): Promise<EmbedSdk> {
  const existing = readSdkFromWindow();
  if (existing) {
    return existing;
  }

  if (!embedSdkPromise) {
    embedSdkPromise = new Promise<EmbedSdk>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = () => {
        const sdk = readSdkFromWindow();
        if (sdk) {
          resolve(sdk);
          return;
        }

        reject(new Error("SDK Activepieces загружен без глобальной точки входа."));
      };
      script.onerror = () => {
        reject(new Error(`Не удалось загрузить SDK-скрипт: ${src}`));
      };
      document.head.appendChild(script);
    });
  }

  return embedSdkPromise;
}

function readSdkFromWindow(): EmbedSdk | null {
  return (
    window.activepieces ??
    window.ActivepiecesEmbeddedBuilder ??
    window.ActivepiecesEmbed ??
    null
  );
}

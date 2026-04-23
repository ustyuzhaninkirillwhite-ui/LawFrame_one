"use client";

import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { JsonPreview, QueryState, RequirementPanel, badgeVariantForStatus, readParam } from "@/components/stage3-shared";
import { useLegalModule } from "@/hooks/use-stage0-data";
import { formatDateTime, formatStatus } from "@/lib/i18n";

export function ModuleDetailPanel() {
  const params = useParams<{ code: string }>();
  const code = readParam(params.code);
  const moduleDetail = useLegalModule(code);

  if (moduleDetail.isLoading || !moduleDetail.data) {
    return (
      <QueryState
        title="Загрузка деталей модуля"
        description="Загружаем контракт модуля этапа 3, IO-схемы и требования."
      />
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="accent">{formatStatus(moduleDetail.data.category)}</Badge>
              <Badge variant={badgeVariantForStatus(moduleDetail.data.status)}>
                {formatStatus(moduleDetail.data.status)}
              </Badge>
              <Badge variant={badgeVariantForStatus(moduleDetail.data.riskLevel)}>
                риск {formatStatus(moduleDetail.data.riskLevel)}
              </Badge>
              <Badge variant="muted">
                опубликовано {moduleDetail.data.publishedVersion ?? "н/д"}
              </Badge>
            </div>
            <CardTitle>{moduleDetail.data.title}</CardTitle>
            <CardDescription>{moduleDetail.data.description}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <div className="rounded-[24px] border border-[color:var(--line)] bg-black/20 p-4">
              <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
                Входные данные
              </div>
              <div className="mt-3 grid gap-3">
                {moduleDetail.data.inputs.map((input) => (
                  <div key={input.code}>
                    <div className="font-medium">{input.label}</div>
                    <div className="text-sm text-[color:var(--muted)]">{input.code}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-[24px] border border-[color:var(--line)] bg-black/20 p-4">
              <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
                Выходные данные
              </div>
              <div className="mt-3 grid gap-3">
                {moduleDetail.data.outputs.map((output) => (
                  <div key={output.code}>
                    <div className="font-medium">{output.label}</div>
                    <div className="text-sm text-[color:var(--muted)]">{output.code}</div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <RequirementPanel requirements={moduleDetail.data.requirements} />
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <Badge variant="muted">версии</Badge>
            <CardTitle>История версий</CardTitle>
            <CardDescription>
              Опубликованные версии остаются неизменяемыми и несут явный статус проверки.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {moduleDetail.data.versions.map((version) => (
              <div
                key={version.id}
                className="rounded-[22px] border border-[color:var(--line)] bg-white/3 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="accent">{version.version}</Badge>
                  <Badge variant={badgeVariantForStatus(version.status)}>
                    {formatStatus(version.status)}
                  </Badge>
                  <Badge variant={badgeVariantForStatus(version.validationStatus)}>
                    {formatStatus(version.validationStatus)}
                  </Badge>
                </div>
                <div className="mt-3 text-sm text-[color:var(--muted)]">
                  создано {formatDateTime(version.createdAt)}
                </div>
                {version.publishedAt ? (
                  <div className="mt-1 text-sm text-[color:var(--muted)]">
                    опубликовано {formatDateTime(version.publishedAt)}
                  </div>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>

        <JsonPreview
          title="Runtime-маппинг"
          description="Этап 3 хранит каноническое сопоставление на продуктовой стороне и не делает runtime-внутренности источником истины."
          value={moduleDetail.data.runtimeMapping}
        />
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { QueryState, badgeVariantForStatus } from "@/components/stage3-shared";
import { useLibraryTemplates, useSessionContext } from "@/hooks/use-stage0-data";
import { formatPermission, formatStatus } from "@/lib/i18n";

export function LibraryCatalog() {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const session = useSessionContext();
  const { data = [], isLoading } = useLibraryTemplates({
    q: deferredQuery,
  });
  const canModerate = new Set(session.data.permissions).has("moderation.review");

  if (isLoading) {
    return (
      <QueryState
        title="Загрузка каталога шаблонов"
        description="Backend-реестр шаблонов определяет текущую видимость и готовность."
      />
    );
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="accent">библиотека</Badge>
            <Badge variant="muted">{data.length} видно</Badge>
            <Button asChild variant="ghost" size="sm">
              <Link href="/library/my">Мои шаблоны</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/modules">Модули</Link>
            </Button>
            {canModerate ? (
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin/moderation/publications">Очередь модерации</Link>
              </Button>
            ) : null}
          </div>
          <CardTitle>Библиотека шаблонов</CardTitle>
          <CardDescription>
            Поиск работает через endpoint каталога этапа 3, а доступность уже
            учитывает права доступа на backend.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по коду, названию, категории или описанию"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="muted">видимость: продуктовая + публичная + рабочее пространство</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {data.map((template) => (
          <Card key={template.id}>
            <CardHeader className="gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="accent">{formatStatus(template.owner)}</Badge>
                  <Badge variant="muted">{formatStatus(template.scope)}</Badge>
                  <Badge variant={badgeVariantForStatus(template.status)}>
                    {formatStatus(template.status)}
                  </Badge>
                  <Badge variant={badgeVariantForStatus(template.publicationStatus)}>
                    {formatStatus(template.publicationStatus)}
                  </Badge>
                  <Badge variant={badgeVariantForStatus(template.compatibilityStatus)}>
                    {formatStatus(template.compatibilityStatus)}
                  </Badge>
                </div>
                <div>
                  <CardTitle>{template.title}</CardTitle>
                  <CardDescription>{template.description}</CardDescription>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button asChild variant="ghost">
                  <Link href={`/library/${template.id}`}>Открыть детали</Link>
                </Button>
                <Button asChild>
                  <Link href={`/templates/${template.id}/publish`}>Публикация</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr]">
              <div>
                <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
                  Модули
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {template.moduleCodes.map((moduleCode) => (
                    <Badge key={moduleCode} variant="muted">
                      {moduleCode}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
                  Права доступа
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {template.requiredPermissions.map((permission) => (
                    <Badge key={permission} variant="muted">
                      {formatPermission(permission).label}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
                  Готовность
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="muted">{formatStatus(template.readiness)}</Badge>
                  <Badge variant={badgeVariantForStatus(template.runtimeSyncState)}>
                    синхронизация {formatStatus(template.runtimeSyncState)}
                  </Badge>
                  {template.available ? (
                    <Badge variant="success">доступно</Badge>
                  ) : (
                    <Badge variant="danger">заблокировано</Badge>
                  )}
                </div>
                {template.disabledReason ? (
                  <div className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
                    {template.disabledReason}
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

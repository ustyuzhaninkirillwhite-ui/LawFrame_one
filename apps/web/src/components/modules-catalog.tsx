"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { QueryState, badgeVariantForStatus } from "@/components/stage3-shared";
import { useLegalModules } from "@/hooks/use-stage0-data";
import { formatStatus } from "@/lib/i18n";

export function ModulesCatalog() {
  const { data = [], isLoading } = useLegalModules();

  if (isLoading) {
    return (
      <QueryState
        title="Загрузка юридических модулей"
        description="Backend загружает реестр, версии и метаданные совместимости."
      />
    );
  }

  return (
    <div className="grid gap-4">
      {data.map((module) => (
        <Card key={module.code}>
          <CardHeader className="gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="accent">{formatStatus(module.category)}</Badge>
                <Badge variant={badgeVariantForStatus(module.status)}>{formatStatus(module.status)}</Badge>
                <Badge variant={badgeVariantForStatus(module.riskLevel)}>{formatStatus(module.riskLevel)}</Badge>
                <Badge variant={badgeVariantForStatus(module.compatibilityStatus)}>
                  {formatStatus(module.compatibilityStatus)}
                </Badge>
              </div>
              <div>
                <CardTitle>{module.title}</CardTitle>
                <CardDescription>{module.description}</CardDescription>
              </div>
            </div>
            <Button asChild variant="ghost">
              <Link href={`/modules/${module.code}`}>Открыть модуль</Link>
            </Button>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
                Входные данные
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {module.inputCodes.map((code) => (
                  <Badge key={code} variant="muted">
                    {code}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
                Выходные данные
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {module.outputCodes.map((code) => (
                  <Badge key={code} variant="muted">
                    {code}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useReadiness } from "@/hooks/use-stage0-data";
import { formatStatus, t } from "@/lib/i18n";

export function ReadinessMap() {
  const readiness = useReadiness();

  return (
    <Card className="rounded-[32px]">
      <CardHeader>
        <Badge variant="accent">карта зависимостей</Badge>
        <CardTitle>Карта готовности</CardTitle>
        <CardDescription>
          Карта показывает, какие контракты уже зафиксированы и какие downstream-функции пока остаются заблокированными.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-3">
        {readiness.data?.map((gate) => (
          <div key={gate.stage} className="rounded-[24px] border border-[color:var(--line)] bg-black/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium">{t(gate.stage)}</div>
              <Badge variant={gate.state === "contract_ready" ? "success" : "muted"}>
                {formatStatus(gate.state)}
              </Badge>
            </div>
            <div className="mt-3 text-sm text-[color:var(--muted)]">Ответственный: {gate.owner}</div>
            <ul className="mt-4 flex flex-col gap-2 text-sm leading-6 text-[color:var(--muted-strong)]">
              {gate.blockers.map((blocker) => (
                <li key={blocker}>• {t(blocker)}</li>
              ))}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

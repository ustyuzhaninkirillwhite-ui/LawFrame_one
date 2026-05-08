"use client";

import type {
  AiConnectionTestResultDto,
  AiProviderConnectionDto,
  AiRouteGroup,
  AiRouteGroupPreferenceDto,
} from "@lexframe/contracts";
import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SecretStatusBadge } from "./secret-status-badge";
import {
  AiProviderConnectionForm,
  type AiProviderConnectionFormValue,
} from "./ai-provider-connection-form";

export function AiRouteGroupCard({
  canManageWorkspace,
  connection,
  isSaving,
  preference,
  routeGroup,
  testPending,
  testResult,
  title,
  onSave,
  onTest,
}: {
  readonly canManageWorkspace: boolean;
  readonly connection: AiProviderConnectionDto | null;
  readonly isSaving?: boolean;
  readonly preference: AiRouteGroupPreferenceDto | null;
  readonly routeGroup: AiRouteGroup;
  readonly testPending?: boolean;
  readonly testResult?: AiConnectionTestResultDto | null;
  readonly title: string;
  readonly onSave: (input: AiProviderConnectionFormValue) => Promise<void>;
  readonly onTest: () => void;
}) {
  const [form, setForm] = React.useState<AiProviderConnectionFormValue | null>(
    null,
  );
  const automationCapabilityMissing =
    routeGroup === "automation_ai" &&
    !form?.capabilities.structuredJsonSchema &&
    !form?.capabilities.jsonMode;

  return (
    <section className="grid gap-4 rounded-[var(--lf-radius-card)] border border-[color:var(--lf-border)] bg-[color:var(--lf-bg-panel)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="mt-1 text-sm text-[color:var(--lf-text-muted)]">
            {preference?.scopeType === "workspace"
              ? "Workspace preference"
              : "User preference"}
          </p>
        </div>
        <SecretStatusBadge
          secret={
            connection?.secret ?? {
              hasSecret: false,
              secretStatus: "missing",
              fingerprint: null,
              lastUpdatedAt: null,
              backend: null,
            }
          }
        />
      </div>

      {automationCapabilityMissing ? (
        <div className="flex items-start gap-2 rounded-[var(--lf-radius-control)] border border-[color:var(--warning)]/40 bg-[color:var(--warning)]/10 p-3 text-sm">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            Для автоматизаций нужна подтверждённая поддержка structured JSON/schema output.
          </span>
        </div>
      ) : null}

      <AiProviderConnectionForm
        connection={connection}
        disabled={!canManageWorkspace}
        routeGroup={routeGroup}
        testPending={testPending}
        testResult={testResult}
        onChange={setForm}
        onTest={onTest}
      />

      <div className="flex justify-end">
        <Button
          type="button"
          disabled={!canManageWorkspace || isSaving || automationCapabilityMissing}
          onClick={() => {
            if (form) {
              void onSave(form);
            }
          }}
        >
          {isSaving ? "Сохранение..." : "Сохранить"}
        </Button>
      </div>
    </section>
  );
}

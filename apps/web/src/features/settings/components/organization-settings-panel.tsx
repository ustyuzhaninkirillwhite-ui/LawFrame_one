"use client";

import type {
  SettingsOrganizationDto,
  UpdateOrganizationSettingsRequest,
} from "@lexframe/contracts";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SettingsSaveBar } from "./settings-save-bar";

export function OrganizationSettingsPanel({
  isSaving,
  organization,
  onSave,
}: {
  readonly isSaving?: boolean;
  readonly organization: SettingsOrganizationDto | null;
  readonly onSave: (input: UpdateOrganizationSettingsRequest) => Promise<void>;
}) {
  const [form, setForm] = React.useState({
    organizationDisplayName: organization?.organizationDisplayName ?? "",
    organizationLegalName: organization?.organizationLegalName ?? "",
  });

  React.useEffect(() => {
    setForm({
      organizationDisplayName: organization?.organizationDisplayName ?? "",
      organizationLegalName: organization?.organizationLegalName ?? "",
    });
  }, [organization]);

  if (!organization) {
    return <div>Активное рабочее пространство не выбрано.</div>;
  }

  const disabled = !organization.canEditDisplayFields;

  return (
    <section className="grid gap-5">
      <div>
        <h2 className="text-xl font-semibold">Организация</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge variant="muted">{organization.workspaceName}</Badge>
          <Badge variant="accent">{organization.role}</Badge>
          <Badge variant={organization.status === "active" ? "success" : "muted"}>
            {organization.status}
          </Badge>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Display name">
          <Input
            data-testid="settings-organization-display-name"
            value={form.organizationDisplayName}
            disabled={disabled}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                organizationDisplayName: event.target.value,
              }))
            }
          />
        </Field>
        <Field label="Legal name">
          <Input
            data-testid="settings-organization-legal-name"
            value={form.organizationLegalName}
            disabled={disabled}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                organizationLegalName: event.target.value,
              }))
            }
          />
        </Field>
      </div>
      <SettingsSaveBar
        disabled={disabled}
        isSaving={isSaving}
        onSave={() =>
          onSave({
            format: "manual_form",
            organizationDisplayName: form.organizationDisplayName,
            organizationLegalName: form.organizationLegalName,
          })
        }
      />
    </section>
  );
}

function Field({
  children,
  label,
}: {
  readonly children: React.ReactNode;
  readonly label: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-[color:var(--lf-text-primary)]">
      <span>{label}</span>
      {children}
    </label>
  );
}

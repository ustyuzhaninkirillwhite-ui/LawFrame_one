"use client";

import type {
  SettingsOrganizationDto,
  UpdateOrganizationSettingsRequest,
} from "@lexframe/contracts";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SettingsSaveBar } from "./settings-save-bar";

interface OrganizationFormState {
  readonly organizationDisplayName: string;
  readonly organizationLegalName: string;
}

type OrganizationFormAction =
  | { readonly type: "reset"; readonly form: OrganizationFormState }
  | { readonly type: "patch"; readonly patch: Partial<OrganizationFormState> };

function buildOrganizationForm(
  organization: SettingsOrganizationDto | null,
): OrganizationFormState {
  return {
    organizationDisplayName: organization?.organizationDisplayName ?? "",
    organizationLegalName: organization?.organizationLegalName ?? "",
  };
}

function organizationFormReducer(
  state: OrganizationFormState,
  action: OrganizationFormAction,
): OrganizationFormState {
  switch (action.type) {
    case "reset":
      return action.form;
    case "patch":
      return { ...state, ...action.patch };
  }
}

export function OrganizationSettingsPanel({
  isSaving,
  organization,
  onSave,
  saveButtonTestId,
}: {
  readonly isSaving?: boolean;
  readonly organization: SettingsOrganizationDto | null;
  readonly onSave: (input: UpdateOrganizationSettingsRequest) => Promise<void>;
  readonly saveButtonTestId?: string;
}) {
  const [form, dispatchForm] = React.useReducer(
    organizationFormReducer,
    organization,
    buildOrganizationForm,
  );

  React.useEffect(() => {
    dispatchForm({ type: "reset", form: buildOrganizationForm(organization) });
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
              dispatchForm({
                type: "patch",
                patch: { organizationDisplayName: event.target.value },
              })
            }
          />
        </Field>
        <Field label="Legal name">
          <Input
            data-testid="settings-organization-legal-name"
            value={form.organizationLegalName}
            disabled={disabled}
            onChange={(event) =>
              dispatchForm({
                type: "patch",
                patch: { organizationLegalName: event.target.value },
              })
            }
          />
        </Field>
      </div>
      <SettingsSaveBar
        disabled={disabled}
        isSaving={isSaving}
        testId={saveButtonTestId}
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

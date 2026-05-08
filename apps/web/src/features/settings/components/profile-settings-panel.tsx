"use client";

import type {
  SettingsProfileDto,
  UpdateProfileSettingsRequest,
} from "@lexframe/contracts";
import * as React from "react";
import { Input } from "@/components/ui/input";
import { SettingsSaveBar } from "./settings-save-bar";

export function ProfileSettingsPanel({
  isSaving,
  profile,
  onSave,
}: {
  readonly isSaving?: boolean;
  readonly profile: SettingsProfileDto;
  readonly onSave: (input: UpdateProfileSettingsRequest) => Promise<void>;
}) {
  const [form, setForm] = React.useState({
    firstName: profile.firstName ?? "",
    lastName: profile.lastName ?? "",
    displayName: profile.displayName ?? "",
    locale: profile.locale,
    timezone: profile.timezone,
  });

  React.useEffect(() => {
    setForm({
      firstName: profile.firstName ?? "",
      lastName: profile.lastName ?? "",
      displayName: profile.displayName ?? "",
      locale: profile.locale,
      timezone: profile.timezone,
    });
  }, [profile]);

  return (
    <section className="grid gap-5">
      <div>
        <h2 className="text-xl font-semibold">Профиль</h2>
        <p className="mt-1 text-sm text-[color:var(--lf-text-muted)]">
          Имя пользователя в рабочих пространствах LexFrame.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Email">
          <Input value={profile.email} readOnly />
        </Field>
        <Field label="Отображаемое имя">
          <Input
            value={form.displayName}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                displayName: event.target.value,
              }))
            }
          />
        </Field>
        <Field label="Имя">
          <Input
            value={form.firstName}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                firstName: event.target.value,
              }))
            }
          />
        </Field>
        <Field label="Фамилия">
          <Input
            value={form.lastName}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                lastName: event.target.value,
              }))
            }
          />
        </Field>
        <Field label="Locale">
          <Input
            value={form.locale}
            onChange={(event) =>
              setForm((current) => ({ ...current, locale: event.target.value }))
            }
          />
        </Field>
        <Field label="Timezone">
          <Input
            value={form.timezone}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                timezone: event.target.value,
              }))
            }
          />
        </Field>
      </div>
      <SettingsSaveBar
        isSaving={isSaving}
        onSave={() =>
          onSave({
            format: "manual_form",
            firstName: form.firstName,
            lastName: form.lastName,
            displayName: form.displayName,
            locale: form.locale,
            timezone: form.timezone,
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

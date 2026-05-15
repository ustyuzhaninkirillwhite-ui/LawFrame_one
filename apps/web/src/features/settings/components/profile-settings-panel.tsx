"use client";

import type {
  SettingsProfileDto,
  UpdateProfileSettingsRequest,
} from "@lexframe/contracts";
import * as React from "react";
import { Input } from "@/components/ui/input";
import { SettingsSaveBar } from "./settings-save-bar";

interface ProfileFormState {
  readonly firstName: string;
  readonly lastName: string;
  readonly displayName: string;
  readonly locale: string;
  readonly timezone: string;
}

type ProfileFormAction =
  | { readonly type: "reset"; readonly form: ProfileFormState }
  | { readonly type: "patch"; readonly patch: Partial<ProfileFormState> };

function buildProfileForm(profile: SettingsProfileDto): ProfileFormState {
  return {
    firstName: profile.firstName ?? "",
    lastName: profile.lastName ?? "",
    displayName: profile.displayName ?? "",
    locale: profile.locale,
    timezone: profile.timezone,
  };
}

function profileFormReducer(
  state: ProfileFormState,
  action: ProfileFormAction,
): ProfileFormState {
  switch (action.type) {
    case "reset":
      return action.form;
    case "patch":
      return { ...state, ...action.patch };
  }
}

export function ProfileSettingsPanel({
  isSaving,
  profile,
  onSave,
  saveButtonTestId,
}: {
  readonly isSaving?: boolean;
  readonly profile: SettingsProfileDto;
  readonly onSave: (input: UpdateProfileSettingsRequest) => Promise<void>;
  readonly saveButtonTestId?: string;
}) {
  const [form, dispatchForm] = React.useReducer(
    profileFormReducer,
    profile,
    buildProfileForm,
  );

  React.useEffect(() => {
    dispatchForm({ type: "reset", form: buildProfileForm(profile) });
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
            data-testid="settings-profile-display-name"
            value={form.displayName}
            onChange={(event) =>
              dispatchForm({
                type: "patch",
                patch: { displayName: event.target.value },
              })
            }
          />
        </Field>
        <Field label="Имя">
          <Input
            data-testid="settings-profile-first-name"
            value={form.firstName}
            onChange={(event) =>
              dispatchForm({
                type: "patch",
                patch: { firstName: event.target.value },
              })
            }
          />
        </Field>
        <Field label="Фамилия">
          <Input
            data-testid="settings-profile-last-name"
            value={form.lastName}
            onChange={(event) =>
              dispatchForm({
                type: "patch",
                patch: { lastName: event.target.value },
              })
            }
          />
        </Field>
        <Field label="Locale">
          <Input
            value={form.locale}
            onChange={(event) =>
              dispatchForm({
                type: "patch",
                patch: { locale: event.target.value },
              })
            }
          />
        </Field>
        <Field label="Timezone">
          <Input
            value={form.timezone}
            onChange={(event) =>
              dispatchForm({
                type: "patch",
                patch: { timezone: event.target.value },
              })
            }
          />
        </Field>
      </div>
      <SettingsSaveBar
        isSaving={isSaving}
        testId={saveButtonTestId}
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

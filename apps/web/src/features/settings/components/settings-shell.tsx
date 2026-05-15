"use client";

import { ApiClientError } from "@lexframe/api-client";
import type { SettingsTab } from "@lexframe/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { useSessionBridge } from "@/providers/session-provider";
import { AiSettingsPanel } from "./ai-settings-panel";
import { OrganizationSettingsPanel } from "./organization-settings-panel";
import { ProfileSettingsPanel } from "./profile-settings-panel";
import { SettingsErrorState } from "./settings-error-state";
import { SettingsSidebarNav } from "./settings-sidebar-nav";
import { SettingsSkeleton } from "./settings-skeleton";

const validTabs: readonly SettingsTab[] = [
  "profile",
  "organization",
  "ai",
  "diagnostics",
];

export function SettingsShell({
  mode = "page",
  onClose,
}: {
  readonly mode?: "page" | "dialog";
  readonly onClose?: () => void;
}) {
  const { apiClient, refreshSessionContext, sessionContext } = useSessionBridge();
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabFromQuery = readTab(searchParams.get("tab"));
  const [dialogTab, setDialogTab] = React.useState<SettingsTab>(
    tabFromQuery ?? "profile",
  );
  const [profileError, setProfileError] = React.useState<string | null>(null);
  const [organizationError, setOrganizationError] = React.useState<string | null>(
    null,
  );
  const activeTab = mode === "page" ? tabFromQuery ?? "profile" : dialogTab;

  const bootstrapQuery = useQuery({
    queryKey: ["settings", "bootstrap"],
    queryFn: () => apiClient.getSettingsBootstrap(),
  });
  const aiQuery = useQuery({
    queryKey: ["settings", "ai"],
    queryFn: () => apiClient.getAiSettings(),
    enabled: activeTab === "ai" || activeTab === "diagnostics",
  });

  const profileMutation = useMutation({
    mutationFn: apiClient.updateSettingsProfile,
    onMutate: () => {
      setProfileError(null);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["settings", "bootstrap"] }),
        refreshSessionContext(),
      ]);
    },
    onError: (error) => {
      setProfileError(
        formatSettingsSaveError(
          error,
          "Profile settings were not saved. Try again.",
        ),
      );
    },
  });
  const organizationMutation = useMutation({
    mutationFn: apiClient.updateSettingsOrganization,
    onMutate: () => {
      setOrganizationError(null);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["settings", "bootstrap"] }),
        refreshSessionContext(),
      ]);
    },
    onError: (error) => {
      setOrganizationError(
        formatSettingsSaveError(
          error,
          "Organization settings were not saved. Try again.",
        ),
      );
    },
  });

  const selectTab = (tab: SettingsTab) => {
    if (mode === "dialog") {
      setDialogTab(tab);
      return;
    }

    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    router.replace(`${pathname}?${next.toString()}`);
  };

  const bootstrap = bootstrapQuery.data;
  const permissions = new Set(bootstrap?.permissions ?? sessionContext.permissions);

  return (
    <div className={mode === "dialog" ? "w-[min(900px,calc(100vw-2rem))]" : ""}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Настройки</h1>
          <p className="mt-1 text-sm text-[color:var(--lf-text-muted)]">
            Профиль, организация и маршруты AI Gateway.
          </p>
        </div>
        {onClose ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 w-9 px-0"
            aria-label="Закрыть настройки"
            onClick={onClose}
          >
            <X size={17} />
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-[168px_1fr]">
        <SettingsSidebarNav activeTab={activeTab} onSelect={selectTab} />
        <main className="min-h-[460px] min-w-0">
          {bootstrapQuery.isLoading ? <SettingsSkeleton /> : null}
          {bootstrapQuery.isError ? (
            <SettingsErrorState
              message={
                bootstrapQuery.error instanceof Error
                  ? bootstrapQuery.error.message
                  : "Bootstrap request failed."
              }
            />
          ) : null}
          {bootstrap ? (
            <>
              <div hidden={activeTab !== "profile"}>
                {profileError ? (
                  <div className="mb-4">
                    <SettingsErrorState
                      title="Profile settings were not saved"
                      message={profileError}
                    />
                  </div>
                ) : null}
                <ProfileSettingsPanel
                  profile={bootstrap.profile}
                  isSaving={profileMutation.isPending}
                  saveButtonTestId={
                    activeTab === "profile"
                      ? "settings-save-button"
                      : "settings-profile-save-button"
                  }
                  onSave={async (input) => {
                    await profileMutation.mutateAsync(input);
                  }}
                />
              </div>
              <div hidden={activeTab !== "organization"}>
                {organizationError ? (
                  <div className="mb-4">
                    <SettingsErrorState
                      title="Organization settings were not saved"
                      message={organizationError}
                    />
                  </div>
                ) : null}
                <OrganizationSettingsPanel
                  organization={bootstrap.organization}
                  isSaving={organizationMutation.isPending}
                  saveButtonTestId={
                    activeTab === "organization"
                      ? "settings-save-button"
                      : "settings-organization-save-button"
                  }
                  onSave={async (input) => {
                    await organizationMutation.mutateAsync(input);
                  }}
                />
              </div>
              {activeTab === "ai" ? (
                aiQuery.isLoading ? (
                  <SettingsSkeleton />
                ) : aiQuery.isError ? (
                  <SettingsErrorState
                    message={
                      aiQuery.error instanceof Error
                        ? aiQuery.error.message
                        : "AI settings request failed."
                    }
                  />
                ) : aiQuery.data ? (
                  <AiSettingsPanel
                    canManageSelf={permissions.has("settings.ai.manage_self")}
                    canManageWorkspace={permissions.has(
                      "settings.ai.manage_workspace",
                    )}
                    connections={aiQuery.data.providerConnections}
                    policies={aiQuery.data.effectivePolicies}
                    preferences={aiQuery.data.routeGroups}
                  />
                ) : null
              ) : null}
              {activeTab === "diagnostics" ? (
                <DiagnosticsPanel
                  loading={aiQuery.isLoading}
                  policies={aiQuery.data?.effectivePolicies ?? []}
                />
              ) : null}
            </>
          ) : null}
        </main>
      </div>
    </div>
  );
}

function DiagnosticsPanel({
  loading,
  policies,
}: {
  readonly loading: boolean;
  readonly policies: readonly unknown[];
}) {
  if (loading) {
    return <SettingsSkeleton />;
  }

  return (
    <section className="grid gap-4">
      <div>
        <h2 className="text-xl font-semibold">Диагностика</h2>
        <p className="mt-1 text-sm text-[color:var(--lf-text-muted)]">
          Effective policy snapshots без секретных значений.
        </p>
      </div>
      <pre className="max-h-[420px] overflow-auto rounded-[var(--lf-radius-control)] border border-[color:var(--lf-border)] bg-[color:var(--lf-bg-muted)] p-4 text-xs">
        {JSON.stringify(policies, null, 2)}
      </pre>
    </section>
  );
}

function readTab(value: string | null): SettingsTab | null {
  return validTabs.includes(value as SettingsTab) ? (value as SettingsTab) : null;
}

function formatSettingsSaveError(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) {
    return isSafeUiErrorMessage(error.message) ? error.message : fallback;
  }

  return fallback;
}

function isSafeUiErrorMessage(message: string) {
  return (
    message.length > 0 &&
    message.length <= 220 &&
    !/stack trace|authorization|bearer|sk-[A-Za-z0-9_-]{8,}|BEGIN PRIVATE KEY|HTTP\s+5\d\d/i.test(
      message,
    )
  );
}

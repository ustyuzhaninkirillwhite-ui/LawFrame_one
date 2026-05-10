"use client";

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
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["settings", "bootstrap"] }),
        refreshSessionContext(),
      ]);
    },
  });
  const organizationMutation = useMutation({
    mutationFn: apiClient.updateSettingsOrganization,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["settings", "bootstrap"] }),
        refreshSessionContext(),
      ]);
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
    <div className={mode === "dialog" ? "w-[min(960px,calc(100vw-2rem))]" : ""}>
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

      <div className="grid gap-5 md:grid-cols-[220px_1fr]">
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
              {activeTab === "profile" ? (
                <ProfileSettingsPanel
                  profile={bootstrap.profile}
                  isSaving={profileMutation.isPending}
                  onSave={async (input) => {
                    await profileMutation.mutateAsync(input);
                  }}
                />
              ) : null}
              {activeTab === "organization" ? (
                <OrganizationSettingsPanel
                  organization={bootstrap.organization}
                  isSaving={organizationMutation.isPending}
                  onSave={async (input) => {
                    await organizationMutation.mutateAsync(input);
                  }}
                />
              ) : null}
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

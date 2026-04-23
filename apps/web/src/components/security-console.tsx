"use client";

import type { RoleCode } from "@lexframe/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  useAuditEvents,
  usePermissionDefinitions,
  useRoleDefinitions,
  useSecurityAccount,
  useWorkspaceInvitations,
  useWorkspaceMembers,
} from "@/hooks/use-stage0-data";
import { useSessionBridge } from "@/providers/session-provider";
import { Stage11OverviewPanel } from "@/components/stage11-security-panels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  formatBoolean,
  formatPermission,
  formatPermissionScope,
  formatRole,
  formatStatus,
} from "@/lib/i18n";

const inviteRoleOptions: readonly RoleCode[] = [
  "admin",
  "lawyer",
  "assistant",
  "viewer",
  "security_admin",
  "billing_admin",
];

export function SecurityConsole() {
  const queryClient = useQueryClient();
  const { apiClient, refreshSessionContext, sessionContext } = useSessionBridge();
  const members = useWorkspaceMembers();
  const invitations = useWorkspaceInvitations();
  const auditEvents = useAuditEvents();
  const roles = useRoleDefinitions();
  const permissions = usePermissionDefinitions();
  const securityAccount = useSecurityAccount();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<RoleCode>("lawyer");
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const activeWorkspaceId = sessionContext.activeWorkspace?.id ?? null;

  const roleOptions = useMemo(
    () => roles.data?.map((role) => role.code) ?? inviteRoleOptions,
    [roles.data],
  );

  if (!activeWorkspaceId) {
    return null;
  }

  const canInvite = sessionContext.permissions.includes("workspace.invite");
  const canUpdateRole = sessionContext.permissions.includes(
    "workspace.member.update_role",
  );
  const canRemoveMember = sessionContext.permissions.includes(
    "workspace.member.remove",
  );
  const canReadAudit = sessionContext.permissions.includes("audit.read");

  async function reloadSecurityQueries() {
    await queryClient.invalidateQueries({
      queryKey: ["workspace-members", activeWorkspaceId],
    });
    await queryClient.invalidateQueries({
      queryKey: ["workspace-invitations", activeWorkspaceId],
    });
    await queryClient.invalidateQueries({
      queryKey: ["audit-events", activeWorkspaceId],
    });
    await refreshSessionContext();
  }

  return (
    <div className="grid gap-6">
      <Stage11OverviewPanel />

      <Card>
        <CardHeader>
          <Badge variant="muted">административный контур</Badge>
          <CardTitle>Контроли этапов 1-10</CardTitle>
          <CardDescription>
            RBAC, управление участниками и аудит остаются доступны в новом контуре этапа 11.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <Badge variant="accent">состояние безопасности</Badge>
            <CardTitle>Учётная запись и контур пространства</CardTitle>
            <CardDescription>
              Интерфейс показывает только права, возвращённые backend в контексте сессии.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="rounded-[22px] border border-[color:var(--line)] bg-black/20 p-4">
              <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
                Текущие роли
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(securityAccount.data?.currentRoles ?? sessionContext.roles).map((role) => (
                  <Badge key={role} variant="accent">
                    {formatRole(role)}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="rounded-[22px] border border-[color:var(--line)] bg-black/20 p-4 text-sm leading-6 text-[color:var(--muted-strong)]">
              <div>Email подтверждён: {formatBoolean(Boolean(securityAccount.data?.emailConfirmed))}</div>
              <div>Уровень подтверждения: {securityAccount.data?.assuranceLevel ?? "aal1"}</div>
              <div>
                MFA для административных действий:{" "}
                {formatBoolean(Boolean(securityAccount.data?.mfaRequiredForAdminActions))}
              </div>
              <div>ID запроса: {sessionContext.requestId}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Badge variant="muted">backend</Badge>
            <CardTitle>Словарь прав доступа</CardTitle>
            <CardDescription>
              Каталоги ролей и прав загружаются из backend-реестра RBAC.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(permissions.data ?? []).map((permission) => (
              <div
                key={permission.code}
                className="rounded-[18px] border border-[color:var(--line)] bg-white/3 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm">{formatPermission(permission.code).label}</span>
                  <Badge variant={permission.highRisk ? "danger" : "muted"}>
                    {formatPermissionScope(permission.scope)}
                  </Badge>
                </div>
                <div className="mt-2 text-xs text-[color:var(--muted)]">
                  {formatPermission(permission.code).description}
                </div>
                <div className="mt-2 text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  {permission.code}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <Badge variant="accent">участники</Badge>
          <CardTitle>Команда пространства</CardTitle>
          <CardDescription>
            Приглашения, смена ролей и удаление участников проходят через backend с записью в аудит.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {canInvite ? (
            <div className="grid gap-3 rounded-[22px] border border-[color:var(--line)] bg-black/20 p-4 lg:grid-cols-[1.4fr_0.9fr_auto]">
              <Input
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="invitee@example.com"
              />
              <select
                value={inviteRole}
                onChange={(event) => setInviteRole(event.target.value as RoleCode)}
                className="rounded-[18px] border border-[color:var(--line)] bg-transparent px-4 py-2 text-sm"
              >
                {inviteRoleOptions.map((role) => (
                  <option key={role} value={role}>
                    {formatRole(role)}
                  </option>
                ))}
              </select>
              <Button
                disabled={submitting}
                onClick={() => {
                  void (async () => {
                    if (!inviteEmail.trim()) {
                      return;
                    }

                    setSubmitting(true);
                    try {
                      const invitation =
                        await apiClient.createWorkspaceInvitation(activeWorkspaceId, {
                          email: inviteEmail,
                          role: inviteRole,
                        });
                      setInviteEmail("");
                      setLastInviteUrl(invitation.deliveryPreview?.acceptUrl ?? null);
                      await reloadSecurityQueries();
                    } finally {
                      setSubmitting(false);
                    }
                  })();
                }}
              >
                Отправить приглашение
              </Button>
            </div>
          ) : null}

          {lastInviteUrl ? (
            <div className="rounded-[18px] border border-[color:var(--line)] bg-white/4 px-4 py-3 text-sm text-[color:var(--muted-strong)]">
              Предпросмотр доставки: <a className="underline" href={lastInviteUrl}>{lastInviteUrl}</a>
            </div>
          ) : null}

          <div className="grid gap-3">
            {(members.data ?? []).map((member) => (
              <div
                key={member.id}
                className="grid gap-3 rounded-[18px] border border-[color:var(--line)] bg-white/3 px-4 py-3 lg:grid-cols-[1.2fr_0.9fr_0.9fr_auto]"
              >
                <div>
                  <div className="text-sm font-medium text-[color:var(--foreground)]">
                    {member.fullName ?? member.email}
                  </div>
                  <div className="text-xs text-[color:var(--muted)]">{member.email}</div>
                </div>
                <div className="flex items-center">
                  <Badge variant="muted">{formatStatus(member.status)}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  {canUpdateRole ? (
                    <select
                      value={member.role}
                      onChange={(event) => {
                        void (async () => {
                          await apiClient.changeWorkspaceMemberRole(
                            activeWorkspaceId,
                            member.id,
                            {
                              role: event.target.value as RoleCode,
                            },
                          );
                          await reloadSecurityQueries();
                        })();
                      }}
                      className="rounded-[16px] border border-[color:var(--line)] bg-transparent px-3 py-2 text-sm"
                    >
                      {roleOptions.map((role) => (
                        <option key={role} value={role}>
                          {formatRole(role)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Badge variant="accent">{formatRole(member.role)}</Badge>
                  )}
                </div>
                <div className="flex items-center justify-end gap-2">
                  {canRemoveMember ? (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        void (async () => {
                          await apiClient.removeWorkspaceMember(
                            activeWorkspaceId,
                            member.id,
                          );
                          await reloadSecurityQueries();
                        })();
                      }}
                    >
                      Удалить
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Badge variant="muted">приглашения</Badge>
          <CardTitle>Ожидающие приглашения</CardTitle>
          <CardDescription>
            В демо-режиме доставка имитируется, но токены и аудит проходят через backend-контур.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {(invitations.data ?? []).map((invitation) => (
            <div
              key={invitation.id}
              className="flex items-center justify-between gap-4 rounded-[18px] border border-[color:var(--line)] bg-white/3 px-4 py-3"
            >
              <div>
                <div className="text-sm text-[color:var(--foreground)]">{invitation.email}</div>
                <div className="text-xs text-[color:var(--muted)]">
                  {formatRole(invitation.role)} • {formatStatus(invitation.status)}
                </div>
              </div>
              {canInvite && invitation.status === "pending" ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    void (async () => {
                      await apiClient.revokeWorkspaceInvitation(
                        activeWorkspaceId,
                        invitation.id,
                      );
                      await reloadSecurityQueries();
                    })();
                  }}
                >
                  Отозвать
                </Button>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Badge variant="accent">аудит</Badge>
          <CardTitle>Последние события безопасности</CardTitle>
          <CardDescription>
            ID запросов видны для связи ошибок интерфейса с backend-аудитом при расследовании.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {!canReadAudit ? (
            <div className="rounded-[18px] border border-[color:var(--line)] bg-white/3 px-4 py-3 text-sm text-[color:var(--muted)]">
              Видимость аудита ограничена backend-каталогом прав доступа.
            </div>
          ) : (
            (auditEvents.data ?? []).map((event) => (
              <div
                key={event.id}
                className="rounded-[18px] border border-[color:var(--line)] bg-white/3 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-[color:var(--foreground)]">
                    {event.action}
                  </div>
                  <Badge variant={event.result === "success" ? "success" : "danger"}>
                    {event.result}
                  </Badge>
                </div>
                <div className="mt-2 text-xs text-[color:var(--muted)]">
                  запрос {event.requestId ?? "нет"} • trace {event.traceId ?? "нет"}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import type { PermissionCode } from "@lexframe/contracts";
import type * as React from "react";
import { BlockedStateView } from "@/components/status/stage15-status";
import { useSessionBridge } from "@/providers/session-provider";

export function usePermission(permission: PermissionCode) {
  const { sessionContext } = useSessionBridge();
  return sessionContext.permissions.includes(permission);
}

export function PermissionGate({
  permission,
  children,
  fallback,
}: {
  readonly permission: PermissionCode;
  readonly children: React.ReactNode;
  readonly fallback?: React.ReactNode;
}) {
  const allowed = usePermission(permission);

  if (allowed) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <BlockedStateView
      state={{
        reason: "permission_required",
        title: "Действие недоступно для текущей роли",
        description: `Backend session context не содержит permission ${permission}.`,
        requiredPermission: permission,
      }}
    />
  );
}

export function FeatureGate({
  flag,
  children,
  fallback,
}: {
  readonly flag: string;
  readonly children: React.ReactNode;
  readonly fallback?: React.ReactNode;
}) {
  const { sessionContext } = useSessionBridge();

  if (sessionContext.featureFlags.includes(flag)) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <BlockedStateView
      state={{
        reason: "feature_disabled",
        title: "Функция отключена",
        description: `Feature flag ${flag} не активен для текущего workspace.`,
      }}
    />
  );
}

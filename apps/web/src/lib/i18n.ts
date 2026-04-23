import * as React from "react";
import {
  ruMessages,
  ruPageMessages,
  ruPermissionScopes,
  ruPermissions,
  ruRoleDescriptions,
  ruRoles,
  ruStatuses,
} from "@/messages/ru";

export const DEFAULT_LOCALE = "ru-RU";

export function t(value: string): string {
  const direct =
    ruMessages[value] ?? ruPageMessages[value] ?? ruStatuses[value] ?? ruRoles[value];
  if (direct) {
    return direct;
  }

  const permission = ruPermissions[value];
  if (permission) {
    return permission.label;
  }

  return value;
}

export function useT() {
  return t;
}

export function localizeNode(node: React.ReactNode): React.ReactNode {
  if (typeof node === "string") {
    return t(node);
  }

  if (Array.isArray(node)) {
    return node.map((child, index) =>
      React.createElement(React.Fragment, { key: index }, localizeNode(child)),
    );
  }

  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    const children = node.props.children;
    if (children === undefined) {
      return node;
    }

    return React.cloneElement(node, {
      children: localizeNode(children),
    });
  }

  return node;
}

export function formatStatus(value: string | null | undefined): string {
  if (!value) {
    return "не указано";
  }

  return ruStatuses[value] ?? ruMessages[value] ?? humanizeCode(value);
}

export function formatRole(value: string | null | undefined): string {
  if (!value) {
    return "роль не указана";
  }

  return ruRoles[value] ?? humanizeCode(value);
}

export function formatRoleDescription(value: string | null | undefined): string {
  if (!value) {
    return "Описание роли не указано.";
  }

  return ruRoleDescriptions[value] ?? value;
}

export function formatPermission(
  code: string | null | undefined,
): { readonly label: string; readonly description: string } {
  if (!code) {
    return {
      label: "Право не указано",
      description: "Описание права доступа не указано.",
    };
  }

  return (
    ruPermissions[code] ?? {
      label: humanizeCode(code),
      description: `Право доступа: ${code}.`,
    }
  );
}

export function formatPermissionScope(value: string | null | undefined): string {
  if (!value) {
    return "контур не указан";
  }

  return ruPermissionScopes[value] ?? humanizeCode(value);
}

export function formatBoolean(value: boolean): string {
  return value ? "да" : "нет";
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "не указано";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(DEFAULT_LOCALE).format(value);
}

export function localizeTextValue(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  return t(value);
}

export function humanizeCode(value: string): string {
  return value
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

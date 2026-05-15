"use client";

import type { AiSecretStatusDto } from "@lexframe/contracts";
import { KeyRound } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AiKeyWriteOnlyField({
  disabled,
  inputId = "stage21-ai-api-key",
  inputTestId,
  secret,
  value,
  onChange,
}: {
  readonly disabled?: boolean;
  readonly inputId?: string;
  readonly inputTestId?: string;
  readonly secret: AiSecretStatusDto;
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  const [userReplacing, setUserReplacing] = React.useState(false);
  const replacing = !secret.hasSecret || userReplacing;

  if (secret.hasSecret && !replacing) {
    return (
      <div className="rounded-[var(--lf-radius-control)] border border-[color:var(--lf-border)] bg-[color:var(--lf-bg-muted)] p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-medium text-[color:var(--lf-text-primary)]">
              <KeyRound size={16} />
              <span>Ключ сохранён</span>
            </div>
            <div className="mt-1 truncate text-xs text-[color:var(--lf-text-muted)]">
              {secret.fingerprint ?? "fingerprint unavailable"}
            </div>
            {secret.lastUpdatedAt ? (
              <div className="mt-1 text-xs text-[color:var(--muted)]">
                {new Date(secret.lastUpdatedAt).toLocaleString("ru-RU")}
              </div>
            ) : null}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => {
              onChange("");
              setUserReplacing(true);
            }}
          >
            Заменить ключ
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <label
        htmlFor={inputId}
        className="text-sm font-medium text-[color:var(--lf-text-primary)]"
      >
        Новый API key
      </label>
      <Input
        id={inputId}
        data-testid={inputTestId}
        type="password"
        value={value}
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Введите новый ключ"
      />
      {secret.hasSecret ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-fit"
          onClick={() => {
            onChange("");
            setUserReplacing(false);
          }}
        >
          Оставить сохранённый ключ
        </Button>
      ) : null}
    </div>
  );
}

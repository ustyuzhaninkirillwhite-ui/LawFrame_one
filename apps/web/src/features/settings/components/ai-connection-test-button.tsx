"use client";

import type { AiConnectionTestResultDto } from "@lexframe/contracts";
import { FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AiConnectionTestButton({
  disabled,
  isPending,
  requiresSave,
  result,
  testId,
  onTest,
}: {
  readonly disabled?: boolean;
  readonly isPending?: boolean;
  readonly requiresSave?: boolean;
  readonly result?: AiConnectionTestResultDto | null;
  readonly testId?: string;
  readonly onTest: () => void;
}) {
  const label = isPending
    ? requiresSave
      ? "Сохранение и проверка..."
      : "Проверка..."
    : requiresSave
      ? "Сохранить и проверить"
      : "Проверить подключение";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="outline"
        data-testid={testId}
        disabled={disabled || isPending}
        onClick={onTest}
      >
        <FlaskConical size={16} />
        <span>{label}</span>
      </Button>
      {result ? (
        <span className="text-xs text-[color:var(--lf-text-muted)]">
          {result.status} В· {result.message}
        </span>
      ) : null}
    </div>
  );
}

"use client";

import type { AiConnectionTestResultDto } from "@lexframe/contracts";
import { FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AiConnectionTestButton({
  disabled,
  isPending,
  result,
  onTest,
}: {
  readonly disabled?: boolean;
  readonly isPending?: boolean;
  readonly result?: AiConnectionTestResultDto | null;
  readonly onTest: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="outline"
        disabled={disabled || isPending}
        onClick={onTest}
      >
        <FlaskConical size={16} />
        <span>{isPending ? "Проверка..." : "Проверить подключение"}</span>
      </Button>
      {result ? (
        <span className="text-xs text-[color:var(--lf-text-muted)]">
          {result.status} · {result.message}
        </span>
      ) : null}
    </div>
  );
}

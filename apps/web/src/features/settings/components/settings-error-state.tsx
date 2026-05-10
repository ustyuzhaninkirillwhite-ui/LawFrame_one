import { AlertTriangle } from "lucide-react";

export function SettingsErrorState({
  message,
  title = "Не удалось загрузить настройки",
}: {
  readonly message: string;
  readonly title?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-[var(--lf-radius-control)] border border-[color:var(--danger)]/35 bg-[color:var(--danger)]/10 p-4 text-sm">
      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[color:var(--danger)]" />
      <div>
        <div className="font-medium text-[color:var(--lf-text-primary)]">
          {title}
        </div>
        <div className="mt-1 text-[color:var(--lf-text-muted)]">{message}</div>
      </div>
    </div>
  );
}

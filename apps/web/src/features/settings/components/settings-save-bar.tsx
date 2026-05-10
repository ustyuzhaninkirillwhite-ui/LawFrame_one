import { Button } from "@/components/ui/button";

export function SettingsSaveBar({
  disabled,
  isSaving,
  onSave,
}: {
  readonly disabled?: boolean;
  readonly isSaving?: boolean;
  readonly onSave: () => void;
}) {
  return (
    <div className="sticky bottom-0 mt-5 flex items-center justify-end gap-2 border-t border-[color:var(--lf-border)] bg-[color:var(--lf-bg-panel)]/95 px-0 py-3 backdrop-blur">
      <Button
        type="button"
        data-testid="settings-save-button"
        disabled={disabled || isSaving}
        onClick={onSave}
      >
        {isSaving ? "Сохранение..." : "Сохранить"}
      </Button>
    </div>
  );
}

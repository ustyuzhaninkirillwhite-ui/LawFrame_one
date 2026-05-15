import * as React from "react";
import { Button } from "@/components/ui/button";

export function SettingsSaveBar({
  disabled,
  isSaving,
  onSave,
  testId = "settings-save-button",
}: {
  readonly disabled?: boolean;
  readonly isSaving?: boolean;
  readonly onSave: () => Promise<void> | void;
  readonly testId?: string;
}) {
  const [localSaving, setLocalSaving] = React.useState(false);
  const savingRef = React.useRef(false);
  const saving = Boolean(isSaving || localSaving);

  const handleSave = () => {
    if (disabled || isSaving || savingRef.current) {
      return;
    }

    savingRef.current = true;
    setLocalSaving(true);
    void Promise.resolve(onSave())
      .catch(() => undefined)
      .finally(() => {
        savingRef.current = false;
        setLocalSaving(false);
      });
  };

  return (
    <div className="sticky bottom-0 mt-5 flex items-center justify-end gap-2 border-t border-[color:var(--lf-border)] bg-[color:var(--lf-bg-panel)]/95 px-0 py-3 backdrop-blur">
      <Button
        type="button"
        data-testid={testId}
        disabled={disabled || saving}
        onClick={handleSave}
      >
        {saving ? "Сохранение..." : "Сохранить"}
      </Button>
    </div>
  );
}

import { SendHorizonal } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function AutomationGoalComposer({
  disabled,
  initialValue = "",
  onSubmit,
}: {
  readonly disabled: boolean;
  readonly initialValue?: string;
  readonly onSubmit: (goal: string) => Promise<void>;
}) {
  const [goal, setGoal] = React.useState(initialValue);

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = goal.trim();
        if (trimmed.length === 0 || disabled) {
          return;
        }
        void onSubmit(trimmed);
      }}
    >
      <Textarea
        className="min-h-32 resize-none"
        value={goal}
        disabled={disabled}
        placeholder="Например: собрать процесс проверки договора, выделить риски, согласовать у юриста и подготовить Canvas draft."
        onChange={(event) => setGoal(event.target.value)}
      />
      <div className="flex justify-end">
        <Button type="submit" disabled={disabled || goal.trim().length === 0}>
          <SendHorizonal className="mr-2 size-4" aria-hidden="true" />
          Построить Blueprint
        </Button>
      </div>
    </form>
  );
}

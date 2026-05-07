import type { AutomationClarificationQuestion } from "../domain/automationBuilderTypes";
import { Check } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export function ClarificationAnswerForm({
  question,
  disabled,
  onAnswer,
}: {
  readonly question: AutomationClarificationQuestion;
  readonly disabled: boolean;
  readonly onAnswer: (answer: unknown) => Promise<void>;
}) {
  const [value, setValue] = React.useState("");

  const hasChoices =
    question.answerType === "single_choice" && (question.choices?.length ?? 0) > 0;

  return (
    <form
      className="mt-3 flex flex-col gap-2 sm:flex-row"
      onSubmit={(event) => {
        event.preventDefault();
        if (disabled || value.trim().length === 0) {
          return;
        }
        void onAnswer(value);
      }}
    >
      {hasChoices ? (
        <Select
          value={value}
          disabled={disabled}
          onChange={(event) => setValue(event.target.value)}
        >
          <option value="">Выберите ответ</option>
          {question.choices?.map((choice) => (
            <option key={choice.id} value={choice.id}>
              {choice.label}
            </option>
          ))}
        </Select>
      ) : (
        <Input
          value={value}
          disabled={disabled}
          placeholder="Ответ"
          onChange={(event) => setValue(event.target.value)}
        />
      )}
      <Button type="submit" disabled={disabled || value.trim().length === 0}>
        <Check className="mr-2 size-4" aria-hidden="true" />
        Ответить
      </Button>
    </form>
  );
}

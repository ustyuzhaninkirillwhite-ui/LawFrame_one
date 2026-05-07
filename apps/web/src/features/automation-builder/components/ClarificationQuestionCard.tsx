import type { AutomationClarificationQuestion } from "../domain/automationBuilderTypes";
import { HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ClarificationAnswerForm } from "./ClarificationAnswerForm";

export function ClarificationQuestionCard({
  question,
  disabled,
  onAnswer,
}: {
  readonly question: AutomationClarificationQuestion;
  readonly disabled: boolean;
  readonly onAnswer: (questionId: string, answer: unknown) => Promise<void>;
}) {
  return (
    <div className="rounded-[8px] border border-[color:var(--line)] p-4">
      <div className="flex items-start gap-3">
        <HelpCircle className="mt-0.5 size-5 text-[color:var(--accent)]" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="muted">{question.kind}</Badge>
            {question.required ? <Badge variant="warning">required</Badge> : null}
          </div>
          <p className="mt-2 text-sm font-medium text-[color:var(--text)]">
            {question.question}
          </p>
          <ClarificationAnswerForm
            question={question}
            disabled={disabled}
            onAnswer={(answer) => onAnswer(question.id, answer)}
          />
        </div>
      </div>
    </div>
  );
}

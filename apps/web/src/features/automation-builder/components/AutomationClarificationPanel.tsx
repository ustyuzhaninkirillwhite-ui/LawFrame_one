import type { AutomationClarificationQuestion } from "../domain/automationBuilderTypes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClarificationQuestionCard } from "./ClarificationQuestionCard";

export function AutomationClarificationPanel({
  questions,
  disabled,
  onAnswer,
}: {
  readonly questions: readonly AutomationClarificationQuestion[];
  readonly disabled: boolean;
  readonly onAnswer: (questionId: string, answer: unknown) => Promise<void>;
}) {
  if (questions.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Уточнения</CardTitle>
        <CardDescription>
          Ответы сохраняются backend-side и не могут понизить classification или обойти policy.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {questions.map((question) => (
          <ClarificationQuestionCard
            key={question.id}
            question={question}
            disabled={disabled}
            onAnswer={onAnswer}
          />
        ))}
      </CardContent>
    </Card>
  );
}

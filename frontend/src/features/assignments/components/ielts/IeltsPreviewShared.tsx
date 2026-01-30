/**
 * Location: features/assignments/components/ielts/IeltsPreviewShared.tsx
 * Purpose: Shared helpers for IELTS content previews.
 * Why: Prevents duplication across reading/listening/writing/speaking previews.
 */

import { useState } from 'react';
import type { IeltsQuestion, IeltsQuestionType } from '@lib/ielts';
import { RadioGroup, RadioGroupItem } from '@components/ui/radio-group';

const questionTypeLabels: Record<IeltsQuestionType, string> = {
  multiple_choice: 'Multiple Choice',
  true_false_not_given: 'True / False / Not Given',
  matching_headings: 'Matching Headings',
  matching_information: 'Matching Information',
  sentence_completion: 'Sentence Completion',
  summary_completion: 'Summary Completion',
  matching_features: 'Matching Features',
  form_completion: 'Form Completion',
  table_completion: 'Table Completion',
  map_labeling: 'Map Labeling',
  short_answer: 'Short Answer',
};

export const getQuestionTypeLabel = (type: IeltsQuestionType) =>
  questionTypeLabels[type] ?? 'Question';

export function QuestionList({
  questions,
  startIndex = 1,
}: {
  questions: IeltsQuestion[];
  startIndex?: number;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  if (!questions || questions.length === 0) {
    return <EmptyState label="No questions yet." />;
  }

  return (
    <div className="space-y-3">
      {questions.map((question, index) => (
        <div key={question.id} className="rounded-[10px] bg-muted/20 p-4 space-y-2">
          <div className="text-xs text-muted-foreground">
            {getQuestionTypeLabel(question.type)}
          </div>
          <p className="text-sm font-medium">
            {startIndex + index}. {question.prompt || 'Untitled question'}
          </p>
          {question.options && question.options.length > 0 ? (
            <RadioGroup
              value={answers[question.id] ?? ''}
              onValueChange={value =>
                setAnswers(prev => ({
                  ...prev,
                  [question.id]: value,
                }))
              }
              className="gap-2"
            >
              {question.options.map((option, optionIndex) => {
                const id = `${question.id}-option-${optionIndex}`;
                const label = option?.trim() || `Option ${optionIndex + 1}`;
                const prefix = String.fromCharCode(65 + optionIndex);
                return (
                  <label
                    key={id}
                    htmlFor={id}
                    className="flex items-start gap-2 rounded-[10px] border border-border bg-background px-3 py-2 text-sm text-foreground"
                  >
                    <RadioGroupItem id={id} value={`${optionIndex}`} className="mt-0.5" />
                    <span>
                      <span className="font-medium mr-2">{prefix}.</span>
                      {label}
                    </span>
                  </label>
                );
              })}
            </RadioGroup>
          ) : (
            <p className="text-xs text-muted-foreground">No answer options provided.</p>
          )}
          {question.correctAnswer && (
            <p className="text-xs text-muted-foreground">Answer: {question.correctAnswer}</p>
          )}
        </div>
      ))}
    </div>
  );
}

export function BulletList({ items, emptyLabel }: { items: string[]; emptyLabel: string }) {
  if (!items || items.length === 0 || items.every(item => !item.trim())) {
    return <EmptyState label={emptyLabel} />;
  }

  return (
    <ul className="space-y-2 text-sm text-foreground list-disc pl-5">
      {items.map((item, index) => (
        <li key={`${item}-${index}`}>{item}</li>
      ))}
    </ul>
  );
}

export function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

export function EmptyState({ label }: { label: string }) {
  return <p className="text-sm text-muted-foreground">{label}</p>;
}

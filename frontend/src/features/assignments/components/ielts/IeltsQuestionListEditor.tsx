/**
 * Location: features/assignments/components/ielts/IeltsQuestionListEditor.tsx
 * Purpose: Edit IELTS question lists with type-specific fields.
 * Why: Consolidates question editing logic for reading and listening builders.
 */

import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@components/ui/button';
import { Card } from '@components/ui/card';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { Textarea } from '@components/ui/textarea';
import type { IeltsQuestion, IeltsQuestionType } from '@lib/ielts';
import { StringListEditor } from './StringListEditor';

type QuestionTypeOption = {
  value: IeltsQuestionType;
  label: string;
};

type IeltsQuestionListEditorProps = {
  questions: IeltsQuestion[];
  onChange: (questions: IeltsQuestion[]) => void;
  typeOptions: QuestionTypeOption[];
};

const OPTION_TYPES = new Set<IeltsQuestionType>([
  'multiple_choice',
  'matching_headings',
  'matching_information',
  'matching_features',
  'map_labeling',
]);

const TRUE_FALSE_OPTIONS = ['true', 'false', 'not given'];

const createQuestion = (type: IeltsQuestionType): IeltsQuestion => ({
  id: globalThis.crypto?.randomUUID?.() ?? `q-${Date.now()}`,
  type,
  prompt: '',
  options: [''],
  correctAnswer: '',
});

export function IeltsQuestionListEditor({
  questions,
  onChange,
  typeOptions,
}: IeltsQuestionListEditorProps) {
  const updateQuestion = (id: string, patch: Partial<IeltsQuestion>) => {
    onChange(questions.map((question) => (question.id === id ? { ...question, ...patch } : question)));
  };

  const addQuestion = () => {
    const nextType = typeOptions[0]?.value ?? 'multiple_choice';
    onChange([...questions, createQuestion(nextType)]);
  };

  const removeQuestion = (id: string) => {
    const next = questions.filter((question) => question.id !== id);
    onChange(next.length ? next : [createQuestion(typeOptions[0]?.value ?? 'multiple_choice')]);
  };

  return (
    <div className="space-y-4">
      {questions.map((question, index) => (
        <Card key={question.id} className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <Label>Question {index + 1}</Label>
              <Select
                value={question.type}
                onValueChange={(value) =>
                  updateQuestion(question.id, { type: value as IeltsQuestionType })
                }
              >
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {typeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeQuestion(question.id)}
              aria-label={`Remove question ${index + 1}`}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>

          <div className="mt-4 space-y-3">
            <div className="space-y-2">
              <Label>Prompt</Label>
              <Textarea
                rows={3}
                value={question.prompt}
                onChange={(event) => updateQuestion(question.id, { prompt: event.target.value })}
                placeholder="Write the question prompt or instruction."
              />
            </div>

            {OPTION_TYPES.has(question.type) && (
              <StringListEditor
                label="Options"
                values={question.options}
                onChange={(options) => updateQuestion(question.id, { options })}
                placeholder="Option text"
                addLabel="Add option"
                dense
              />
            )}

            {question.type === 'true_false_not_given' ? (
              <div className="space-y-2">
                <Label>Correct Answer</Label>
                <Select
                  value={question.correctAnswer}
                  onValueChange={(value) => updateQuestion(question.id, { correctAnswer: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select answer" />
                  </SelectTrigger>
                  <SelectContent>
                    {TRUE_FALSE_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Correct Answer</Label>
                <Input
                  value={question.correctAnswer}
                  placeholder="Correct response"
                  onChange={(event) =>
                    updateQuestion(question.id, { correctAnswer: event.target.value })
                  }
                />
              </div>
            )}
          </div>
        </Card>
      ))}

      <Button type="button" variant="outline" onClick={addQuestion}>
        <Plus className="mr-2 size-4" />
        Add Question
      </Button>
    </div>
  );
}

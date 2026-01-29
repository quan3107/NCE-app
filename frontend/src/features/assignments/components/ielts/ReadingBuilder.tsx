/**
 * Location: features/assignments/components/ielts/ReadingBuilder.tsx
 * Purpose: Render the IELTS Reading authoring form (passages + questions).
 * Why: Gives teachers a structured editor aligned with IELTS reading format.
 */

import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@components/ui/button';
import { Card } from '@components/ui/card';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
import type { IeltsReadingConfig, IeltsReadingSection } from '@lib/ielts';
import { IeltsQuestionListEditor } from './IeltsQuestionListEditor';

type ReadingBuilderProps = {
  value: IeltsReadingConfig;
  onChange: (value: IeltsReadingConfig) => void;
};

const QUESTION_TYPES = [
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'true_false_not_given', label: 'True/False/Not Given' },
  { value: 'matching_headings', label: 'Matching Headings' },
  { value: 'matching_information', label: 'Matching Information' },
  { value: 'sentence_completion', label: 'Sentence Completion' },
  { value: 'summary_completion', label: 'Summary Completion' },
  { value: 'matching_features', label: 'Matching Features' },
] as const;

const createSection = (index: number): IeltsReadingSection => ({
  id: globalThis.crypto?.randomUUID?.() ?? `reading-${Date.now()}`,
  title: `Passage ${index + 1}`,
  passage: '',
  questions: [],
});

export function ReadingBuilder({ value, onChange }: ReadingBuilderProps) {
  const updateSection = (id: string, patch: Partial<IeltsReadingSection>) => {
    onChange({
      ...value,
      sections: value.sections.map((section) =>
        section.id === id ? { ...section, ...patch } : section,
      ),
    });
  };

  const addSection = () => {
    onChange({
      ...value,
      sections: [...value.sections, createSection(value.sections.length)],
    });
  };

  const removeSection = (id: string) => {
    const next = value.sections.filter((section) => section.id !== id);
    onChange({ ...value, sections: next.length ? next : [createSection(0)] });
  };

  return (
    <div className="space-y-6">
      {value.sections.map((section, index) => (
        <Card key={section.id} className="p-6 border-2 bg-card shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
            <div className="flex items-center gap-3">
              <span className="section-badge">{index + 1}</span>
              <div className="space-y-2 flex-1">
                <Label className="text-base font-semibold">Passage {index + 1} Title</Label>
                <Input
                  value={section.title}
                  onChange={(event) =>
                    updateSection(section.id, { title: event.target.value })
                  }
                  placeholder="Passage title"
                  className="max-w-md"
                />
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeSection(section.id)}
              aria-label={`Remove passage ${index + 1}`}
              className="shrink-0"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">Passage Text</Label>
            <Textarea
              rows={6}
              value={section.passage}
              onChange={(event) =>
                updateSection(section.id, { passage: event.target.value })
              }
              placeholder="Paste the reading passage (markdown supported)."
              className="resize-none font-mono text-sm"
            />
          </div>

          <div className="mt-6 space-y-4">
            <Label className="text-sm font-semibold">Questions</Label>
            <IeltsQuestionListEditor
              questions={section.questions}
              onChange={(questions) => updateSection(section.id, { questions })}
              typeOptions={QUESTION_TYPES.map((type) => ({
                value: type.value,
                label: type.label,
              }))}
            />
          </div>
        </Card>
      ))}

      <Button 
        type="button" 
        variant="outline" 
        onClick={addSection}
        className="w-full md:w-auto btn-icon-text border-2 border-dashed hover:border-solid"
      >
        <Plus className="mr-2 size-5" />
        Add Passage
      </Button>
    </div>
  );
}

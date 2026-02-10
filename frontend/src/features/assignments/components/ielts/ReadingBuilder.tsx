/**
 * Location: features/assignments/components/ielts/ReadingBuilder.tsx
 * Purpose: Render the IELTS Reading authoring form (passages + questions).
 * Why: Gives teachers a structured editor aligned with IELTS reading format.
 */

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@components/ui/button';
import { Card } from '@components/ui/card';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
import type { IeltsReadingConfig, IeltsReadingSection } from '@lib/ielts';
import { useEnabledReadingQuestionTypes, useEnabledCompletionFormats } from '@features/ielts-config/api';
import type { UploadFile } from '@types/domain';
import { IeltsQuestionListEditor } from './IeltsQuestionListEditor';

type ReadingBuilderProps = {
  value: IeltsReadingConfig;
  onChange: (value: IeltsReadingConfig) => void;
};

const createId = () => globalThis.crypto?.randomUUID?.() ?? `reading-${Date.now()}`;

const createSection = (index: number): IeltsReadingSection => ({
  id: createId(),
  title: `Passage ${index + 1}`,
  passage: '',
  questions: [],
});

export function ReadingBuilder({ value, onChange }: ReadingBuilderProps) {
  // Track uploaded images for diagram labeling questions
  const [uploadedImages, setUploadedImages] = useState<Record<string, UploadFile>>({});

  const { data: questionTypes, isLoading: isLoadingQuestionTypes, error: questionTypesError } = useEnabledReadingQuestionTypes();
  const { data: completionFormats, isLoading: isLoadingCompletionFormats, error: completionFormatsError } = useEnabledCompletionFormats();

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

  // Image upload handler for diagram labeling
  const handleImageUpload = async (file: File): Promise<string> => {
    const imageId = createId();
    const uploadFile: UploadFile = {
      id: imageId,
      name: file.name,
      size: file.size,
      mime: file.type,
      url: URL.createObjectURL(file),
      createdAt: new Date().toISOString(),
    };

    setUploadedImages((prev) => ({ ...prev, [imageId]: uploadFile }));
    return imageId;
  };

  // Image removal handler
  const handleImageRemove = (imageId: string) => {
    setUploadedImages((prev) => {
      const next = { ...prev };
      if (next[imageId]?.url) {
        URL.revokeObjectURL(next[imageId].url);
      }
      delete next[imageId];
      return next;
    });
  };

  // Show loading or error state
  if (isLoadingQuestionTypes || isLoadingCompletionFormats) {
    return (
      <div className="rounded-[14px] border bg-card p-8 text-center">
        <p className="text-muted-foreground">Loading IELTS configuration...</p>
      </div>
    );
  }

  if (questionTypesError || completionFormatsError) {
    return (
      <div className="rounded-[14px] border bg-card p-8 text-center">
        <p className="text-destructive">Failed to load IELTS configuration</p>
        <p className="text-sm text-muted-foreground mt-2">
          Please refresh the page or contact support if the problem persists.
        </p>
      </div>
    );
  }

  const questionTypeOptions = questionTypes?.map(qt => ({ value: qt.id, label: qt.label })) ?? [];
  const completionFormatOptions = completionFormats?.map(cf => ({ value: cf.id, label: cf.label })) ?? [];

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
              typeOptions={questionTypeOptions}
              completionFormats={completionFormatOptions}
              onImageUpload={handleImageUpload}
              onImageRemove={handleImageRemove}
              uploadedImages={uploadedImages}
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

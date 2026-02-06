/**
 * Location: features/assignments/components/ielts/ListeningBuilder.tsx
 * Purpose: Render the IELTS Listening authoring form with audio sections.
 * Why: Supports per-section audio uploads, playback rules, and question editing.
 */

import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@components/ui/button';
import { Card } from '@components/ui/card';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Switch } from '@components/ui/switch';
import { Textarea } from '@components/ui/textarea';
import type { IeltsListeningConfig, IeltsListeningSection } from '@lib/ielts';
import { useEnabledListeningQuestionTypes, useEnabledCompletionFormats } from '@features/ielts-config/api';
import type { UploadFile } from '@lib/mock-data';
import { FileUploader } from '@components/common/FileUploader';
import { IeltsQuestionListEditor } from './IeltsQuestionListEditor';

type ListeningBuilderProps = {
  value: IeltsListeningConfig;
  onChange: (value: IeltsListeningConfig) => void;
};

const createSection = (index: number): IeltsListeningSection => ({
  id: globalThis.crypto?.randomUUID?.() ?? `listening-${Date.now()}`,
  title: `Section ${index + 1}`,
  audioFileId: null,
  playback: { limitPlays: 1 },
  questions: [],
});

export function ListeningBuilder({ value, onChange }: ListeningBuilderProps) {
  const [uploads, setUploads] = useState<Record<string, UploadFile[]>>({});

  const { data: questionTypes, isLoading: isLoadingQuestionTypes, error: questionTypesError } = useEnabledListeningQuestionTypes();
  const { data: completionFormats, isLoading: isLoadingCompletionFormats, error: completionFormatsError } = useEnabledCompletionFormats();

  const updateSection = (id: string, patch: Partial<IeltsListeningSection>) => {
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

  const handleFilesChange = (sectionId: string, files: UploadFile[]) => {
    setUploads((current) => ({ ...current, [sectionId]: files }));
    const fileId = files[0]?.id ?? null;
    updateSection(sectionId, { audioFileId: fileId });
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
      {value.sections.map((section, index) => {
        const sectionFiles = uploads[section.id] ?? [];
        return (
          <Card key={section.id} className="p-6 border-2 bg-card shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
              <div className="flex items-center gap-3">
                <span className="section-badge">{index + 1}</span>
                <div className="space-y-2 flex-1">
                  <Label className="text-base font-semibold">Section {index + 1} Title</Label>
                  <Input
                    value={section.title}
                    onChange={(event) =>
                      updateSection(section.id, { title: event.target.value })
                    }
                    placeholder="Section title"
                    className="max-w-md"
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeSection(section.id)}
                aria-label={`Remove section ${index + 1}`}
                className="shrink-0"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium">Audio Upload</Label>
              <FileUploader
                value={sectionFiles}
                onChange={(files) => handleFilesChange(section.id, files)}
              />
            </div>

            <div className="mt-5 space-y-3">
              <Label className="text-sm font-medium">Transcript (optional)</Label>
              <Textarea
                rows={4}
                value={section.transcript ?? ''}
                onChange={(event) =>
                  updateSection(section.id, { transcript: event.target.value })
                }
                placeholder="Store transcript separately; not visible to students."
                className="resize-none font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Transcript storage is optional and kept instructor-only.
              </p>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-4 rounded-md border-2 bg-muted/30 p-4">
              <div className="space-y-1 flex-1">
                <Label className="text-sm font-medium">Playback Limit</Label>
                <p className="text-xs text-muted-foreground">Limit student replays.</p>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={(section.playback?.limitPlays ?? 0) > 0}
                  onCheckedChange={(checked) =>
                    updateSection(section.id, {
                      playback: { limitPlays: checked ? 1 : 0 },
                    })
                  }
                />
                <span className="text-sm text-muted-foreground">
                  {section.playback?.limitPlays === 0 ? 'Unlimited' : 'Single play'}
                </span>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <Label className="text-sm font-semibold">Questions</Label>
              <IeltsQuestionListEditor
                questions={section.questions}
                onChange={(questions) => updateSection(section.id, { questions })}
                typeOptions={questionTypeOptions}
                completionFormats={completionFormatOptions}
              />
            </div>
          </Card>
        );
      })}

      <Button 
        type="button" 
        variant="outline" 
        onClick={addSection}
        className="w-full md:w-auto btn-icon-text border-2 border-dashed hover:border-solid"
      >
        <Plus className="mr-2 size-5" />
        Add Section
      </Button>
    </div>
  );
}

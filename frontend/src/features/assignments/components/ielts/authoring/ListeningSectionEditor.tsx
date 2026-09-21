/**
 * Location: features/assignments/components/ielts/authoring/ListeningSectionEditor.tsx
 * Purpose: Render one editable listening section with audio, playback, and questions.
 * Why: Keeps the listening form below the project line limit without changing behavior.
 */

import { Plus, Upload } from 'lucide-react';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select';
import { AudioPlayer } from '@components/ui/audio-player';
import type { UploadFile } from '@domain';
import type { IeltsListeningConfig, IeltsQuestion } from '@lib/ielts';
import { QuestionEditor } from '../QuestionEditor';
import { SortableSectionCard } from './SortableSectionCard';
import { toPlaybackLimit, toPlaybackSelectValue } from './listeningAuthoring.logic';

type ListeningSection = IeltsListeningConfig['sections'][number];

type ListeningSectionEditorProps = {
  section: ListeningSection;
  sectionIndex: number;
  uploadedAudio?: { file: File; url: string };
  uploadedImages: Record<string, UploadFile>;
  questionTypeOptions: Array<{ value: string; label: string }>;
  completionFormatOptions: Array<{ value: string; label: string }>;
  onAddQuestion: (sectionIndex: number) => void;
  onAudioSelect: (sectionId: string, file: File | null) => void;
  onDeleteQuestion: (sectionIndex: number, questionId: string) => void;
  onImageRemove: (imageId: string) => void;
  onImageUpload: (file: File) => Promise<UploadFile>;
  onMoveQuestion: (sectionIndex: number, questionId: string, direction: 'up' | 'down') => void;
  onUpdateQuestion: (
    sectionIndex: number,
    questionId: string,
    updatedQuestion: IeltsQuestion,
  ) => void;
  onUpdateSection: (index: number, patch: Partial<ListeningSection>) => void;
  onRemoveSection: (sectionId: string) => void;
  canRemoveSection: boolean;
};

export function ListeningSectionEditor({
  section,
  sectionIndex,
  uploadedAudio,
  uploadedImages,
  questionTypeOptions,
  completionFormatOptions,
  onAddQuestion,
  onAudioSelect,
  onDeleteQuestion,
  onImageRemove,
  onImageUpload,
  onMoveQuestion,
  onUpdateQuestion,
  onUpdateSection,
  onRemoveSection,
  canRemoveSection,
}: ListeningSectionEditorProps) {
  return (
    <SortableSectionCard
      id={section.id}
      index={sectionIndex}
      title={section.title}
      questionCount={section.questions.length}
      hasAudio={!!uploadedAudio || !!section.audioFileId}
    >
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 space-y-2">
          <Label htmlFor={`title-${section.id}`}>Section title</Label>
          <Input id={`title-${section.id}`} value={section.title}
            onChange={(event) => onUpdateSection(sectionIndex, { title: event.target.value })} />
        </div>
        <Button variant="outline" disabled={!canRemoveSection}
          onClick={() => onRemoveSection(section.id)}>Remove {section.title}</Button>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`audio-${section.id}`}>Audio File — {section.title}</Label>
        {uploadedAudio ? (
          <div className="space-y-3">
            <AudioPlayer
              audioUrl={uploadedAudio.url}
              fileName={uploadedAudio.file.name}
              fileSize={uploadedAudio.file.size}
            />
            <div className="flex gap-2">
              <Input
                id={`audio-${section.id}`}
                type="file"
                accept="audio/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onAudioSelect(section.id, file);
                  event.target.value = '';
                }}
                className="flex-1"
              />
              <Button aria-label={`Remove audio for ${section.title}`} variant="outline" onClick={() => onAudioSelect(section.id, null)}>
                Remove
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Input
              id={`audio-${section.id}`}
              type="file"
              accept="audio/*"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onAudioSelect(section.id, file);
                event.target.value = '';
              }}
            />
            <Button aria-label={`Upload audio for ${section.title}`} variant="outline" onClick={() => document.getElementById(`audio-${section.id}`)?.click()}>
              <Upload className="mr-2 size-4" />
              Upload
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`transcript-${section.id}`}>Transcript (instructor-only)</Label>
        <Textarea id={`transcript-${section.id}`} value={section.transcript ?? ''}
          onChange={(event) => onUpdateSection(sectionIndex, { transcript: event.target.value })} />
      </div>

      <div className="space-y-2">
        <Label>Playback Limit</Label>
        <Select
          value={toPlaybackSelectValue(section.playback?.limitPlays)}
          onValueChange={(value) =>
            onUpdateSection(sectionIndex, { playback: { limitPlays: toPlaybackLimit(value) } })
          }
        >
          <SelectTrigger aria-label="Playback Limit">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1 time (IELTS standard)</SelectItem>
            <SelectItem value="2">2 times</SelectItem>
            <SelectItem value="999">Unlimited</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {section.questions.map((question, questionIndex) => (
          <QuestionEditor
            key={question.id}
            question={question}
            questionNumber={questionIndex + 1}
            questionTypes={questionTypeOptions}
            completionFormats={completionFormatOptions}
            onChange={(updated) => onUpdateQuestion(sectionIndex, question.id, updated)}
            onDelete={() => onDeleteQuestion(sectionIndex, question.id)}
            showDelete={section.questions.length > 1}
            onImageUpload={onImageUpload}
            onImageRemove={onImageRemove}
            uploadedImages={uploadedImages}
            onMoveUp={() => onMoveQuestion(sectionIndex, question.id, 'up')}
            onMoveDown={() => onMoveQuestion(sectionIndex, question.id, 'down')}
            canMoveUp={questionIndex > 0}
            canMoveDown={questionIndex < section.questions.length - 1}
          />
        ))}
      </div>

      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => onAddQuestion(sectionIndex)}
      >
        <Plus className="mr-2 size-4" />
        Add Question to Section
      </Button>
    </SortableSectionCard>
  );
}

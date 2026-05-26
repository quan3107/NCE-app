/**
 * Location: features/assignments/components/ielts/authoring/WritingTaskSection.tsx
 * Purpose: Render shared IELTS writing task prompt, response placeholder, rubric, and sample UI.
 * Why: Removes duplicated Task 1/Task 2 structure from the main writing form.
 */

import { Badge } from '@components/ui/badge';
import { Label } from '@components/ui/label';
import { RichTextEditor } from '@components/ui/rich-text-editor';
import { Textarea } from '@components/ui/textarea';
import { RubricSelector } from '@features/rubrics/components/RubricSelector';
import type { ShowSampleTiming } from '@lib/ielts';
import { stripHtml } from '@lib/rich-text';
import { WritingSampleResponsePanel } from './WritingSampleResponsePanel';

type SampleTimingOption = {
  value: string;
  label: string;
};

type WritingTaskSectionProps = {
  children?: React.ReactNode;
  courseId: string;
  minimumWords: number;
  onChangePrompt: (prompt: string) => void;
  onChangeRubric: (rubricId: string | null) => void;
  onChangeSampleDate: (date: string) => void;
  onChangeSampleResponse: (text: string) => void;
  onChangeSampleTiming: (timing: ShowSampleTiming) => void;
  onChangeShowSample: (checked: boolean) => void;
  onManageRubrics?: () => void;
  prompt: string;
  promptPlaceholder: string;
  rubricId?: string | null;
  rubricLabel: string;
  sampleDate?: string;
  sampleResponse?: string;
  sampleTiming?: ShowSampleTiming;
  sampleTimingOptions: SampleTimingOption[];
  sectionClassName?: string;
  showSampleToStudents?: boolean;
  taskLabel: string;
};

export function WritingTaskSection({
  children,
  courseId,
  minimumWords,
  onChangePrompt,
  onChangeRubric,
  onChangeSampleDate,
  onChangeSampleResponse,
  onChangeSampleTiming,
  onChangeShowSample,
  onManageRubrics,
  prompt,
  promptPlaceholder,
  rubricId,
  rubricLabel,
  sampleDate,
  sampleResponse,
  sampleTiming,
  sampleTimingOptions,
  sectionClassName = 'space-y-4',
  showSampleToStudents,
  taskLabel,
}: WritingTaskSectionProps) {
  const htmlIdPrefix = taskLabel.toLowerCase().replace(/\s+/g, '');

  return (
    <div className={sectionClassName}>
      <div className="flex items-center gap-2">
        <Badge>{taskLabel}</Badge>
        <span className="text-sm text-muted-foreground">{minimumWords} words minimum</span>
      </div>
      <div className="space-y-2">
        <Label>{taskLabel} Prompt</Label>
        <Textarea
          value={stripHtml(prompt)}
          onChange={(event) => onChangePrompt(stripHtml(event.target.value))}
          placeholder={promptPlaceholder}
          rows={4}
        />
      </div>
      <div className="space-y-2">
        <Label>Student Response</Label>
        <RichTextEditor value="" onChange={() => {}} placeholder="Students will write their response here..." />
      </div>
      {children}
      <div className="mt-4 space-y-3">
        <RubricSelector
          courseId={courseId}
          value={rubricId}
          onChange={onChangeRubric}
          label={rubricLabel}
          onManageRubrics={onManageRubrics}
        />
      </div>
      <WritingSampleResponsePanel
        date={sampleDate}
        htmlIdPrefix={htmlIdPrefix}
        onChangeDate={onChangeSampleDate}
        onChangeResponse={onChangeSampleResponse}
        onChangeShowToStudents={onChangeShowSample}
        onChangeTiming={onChangeSampleTiming}
        sampleResponse={sampleResponse}
        sampleTiming={sampleTiming}
        sampleTimingOptions={sampleTimingOptions}
        showToStudents={showSampleToStudents}
      />
    </div>
  );
}

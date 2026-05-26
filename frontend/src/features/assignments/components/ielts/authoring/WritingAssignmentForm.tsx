/**
 * Location: features/assignments/components/ielts/authoring/WritingAssignmentForm.tsx
 * Purpose: Orchestrate the writing authoring form per Figma layout.
 * Why: Keeps Task 1/Task 2 state updates together while child files render repeated UI.
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { Label } from '@components/ui/label';
import type { IeltsWritingConfig, IeltsWritingTask1Type, ShowSampleTiming } from '@lib/ielts';
import {
  useEnabledSampleTimingOptions,
  useEnabledWritingTaskTypes,
} from '@features/ielts-config/api';
import { WritingTaskSection } from './WritingTaskSection';
import { WritingVisualUpload } from './WritingVisualUpload';

type WritingAssignmentFormProps = {
  value: IeltsWritingConfig;
  onChange: (value: IeltsWritingConfig) => void;
  onImageSelect: (file: File | null) => void;
  selectedImageFile?: File | null;
  courseId: string;
  onManageRubrics?: () => void;
};

export function WritingAssignmentForm({
  value,
  onChange,
  onImageSelect,
  selectedImageFile,
  courseId,
  onManageRubrics,
}: WritingAssignmentFormProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const {
    data: task1Types,
    isLoading: isLoadingTask1Types,
    error: task1TypesError,
  } = useEnabledWritingTaskTypes(1);
  const {
    data: sampleTimingOptions,
    isLoading: isLoadingTimingOptions,
    error: timingOptionsError,
  } = useEnabledSampleTimingOptions();

  useEffect(() => {
    if (!selectedImageFile) {
      setPreviewUrl(null);
      setFileName(null);
      return undefined;
    }

    const url = URL.createObjectURL(selectedImageFile);
    setPreviewUrl(url);
    setFileName(selectedImageFile.name);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [selectedImageFile]);

  const handleRemoveImage = () => {
    onImageSelect(null);
    setPreviewUrl(null);
    setFileName(null);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onImageSelect(event.target.files?.[0] ?? null);
  };

  if (isLoadingTask1Types || isLoadingTimingOptions) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">Loading IELTS configuration...</p>
        </CardContent>
      </Card>
    );
  }

  if (task1TypesError || timingOptionsError) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-destructive">Failed to load IELTS configuration</p>
          <p className="text-sm text-muted-foreground mt-2">
            Please refresh the page or contact support if the problem persists.
          </p>
        </CardContent>
      </Card>
    );
  }

  const task1TypeOptions = task1Types?.map((type) => ({ value: type.id, label: type.label })) ?? [];
  const sampleTimingOptionOptions =
    sampleTimingOptions?.map((option) => ({ value: option.id, label: option.label })) ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Writing Tasks</CardTitle>
        <CardDescription>Create Task 1 and Task 2 prompts</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <WritingTaskSection
          courseId={courseId}
          minimumWords={150}
          onChangePrompt={(prompt) => onChange({ ...value, task1: { ...value.task1, prompt } })}
          onChangeRubric={(rubricId) => onChange({ ...value, task1: { ...value.task1, rubricId } })}
          onChangeSampleDate={(showSampleDate) =>
            onChange({ ...value, task1: { ...value.task1, showSampleDate } })
          }
          onChangeSampleResponse={(sampleResponse) =>
            onChange({ ...value, task1: { ...value.task1, sampleResponse } })
          }
          onChangeSampleTiming={(showSampleTiming: ShowSampleTiming) =>
            onChange({ ...value, task1: { ...value.task1, showSampleTiming } })
          }
          onChangeShowSample={(showSampleToStudents) =>
            onChange({ ...value, task1: { ...value.task1, showSampleToStudents } })
          }
          onManageRubrics={onManageRubrics}
          prompt={value.task1.prompt}
          promptPlaceholder="The chart below shows... / You should spend about 20 minutes on this task..."
          rubricId={value.task1.rubricId}
          rubricLabel="Task 1 Rubric (Optional)"
          sampleDate={value.task1.showSampleDate}
          sampleResponse={value.task1.sampleResponse}
          sampleTiming={value.task1.showSampleTiming}
          sampleTimingOptions={sampleTimingOptionOptions}
          showSampleToStudents={value.task1.showSampleToStudents}
          taskLabel="Task 1"
        >
          <div className="space-y-2">
            <Label>Visual (Optional - Chart/Graph/Diagram)</Label>
            <WritingVisualUpload
              fileName={fileName}
              onFileChange={handleFileChange}
              onRemoveImage={handleRemoveImage}
              onVisualTypeChange={(visualType: IeltsWritingTask1Type) =>
                onChange({ ...value, task1: { ...value.task1, visualType } })
              }
              previewUrl={previewUrl}
              task1TypeOptions={task1TypeOptions}
              visualType={value.task1.visualType}
            />
          </div>
        </WritingTaskSection>

        <WritingTaskSection
          courseId={courseId}
          minimumWords={250}
          onChangePrompt={(prompt) => onChange({ ...value, task2: { ...value.task2, prompt } })}
          onChangeRubric={(rubricId) => onChange({ ...value, task2: { ...value.task2, rubricId } })}
          onChangeSampleDate={(showSampleDate) =>
            onChange({ ...value, task2: { ...value.task2, showSampleDate } })
          }
          onChangeSampleResponse={(sampleResponse) =>
            onChange({ ...value, task2: { ...value.task2, sampleResponse } })
          }
          onChangeSampleTiming={(showSampleTiming: ShowSampleTiming) =>
            onChange({ ...value, task2: { ...value.task2, showSampleTiming } })
          }
          onChangeShowSample={(showSampleToStudents) =>
            onChange({ ...value, task2: { ...value.task2, showSampleToStudents } })
          }
          onManageRubrics={onManageRubrics}
          prompt={value.task2.prompt}
          promptPlaceholder="Some people believe that... Discuss both views and give your opinion..."
          rubricId={value.task2.rubricId}
          rubricLabel="Task 2 Rubric (Optional)"
          sampleDate={value.task2.showSampleDate}
          sampleResponse={value.task2.sampleResponse}
          sampleTiming={value.task2.showSampleTiming}
          sampleTimingOptions={sampleTimingOptionOptions}
          sectionClassName="space-y-4 pt-6 border-t"
          showSampleToStudents={value.task2.showSampleToStudents}
          taskLabel="Task 2"
        />
      </CardContent>
    </Card>
  );
}

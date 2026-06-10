/**
 * Location: features/assignments/components/TeacherIeltsAssignmentEditor.tsx
 * Purpose: Render the selected IELTS assignment authoring editor.
 * Why: Keeps the create route focused on state, autosave, uploads, and submit behavior.
 */

import { IeltsAuthoringActionsCard } from './ielts/authoring/IeltsAuthoringActionsCard';
import { IeltsAuthoringBasicDetailsCard } from './ielts/authoring/IeltsAuthoringBasicDetailsCard';
import { ListeningAssignmentForm } from './ielts/authoring/ListeningAssignmentForm';
import { ReadingAssignmentForm } from './ielts/authoring/ReadingAssignmentForm';
import { SpeakingAssignmentForm } from './ielts/authoring/SpeakingAssignmentForm';
import { WritingAssignmentForm } from './ielts/authoring/WritingAssignmentForm';
import { AiPolicyControls } from '@features/ai-feedback/AiPolicyControls';
import type {
  IeltsAssignmentConfig,
  IeltsAssignmentType,
  IeltsListeningConfig,
  IeltsReadingConfig,
  IeltsSpeakingConfig,
  IeltsWritingConfig,
} from '@lib/ielts';
import type { Course } from '@domain';

type TeacherIeltsAssignmentEditorProps = {
  assignmentTitle: string;
  canSave: boolean;
  courseId: string;
  courses: Course[];
  dueDate: string;
  durationMinutes: number;
  enforceTime: boolean;
  instructions: string;
  isLoading: boolean;
  listeningConfig: IeltsListeningConfig | null;
  onAssignmentConfigChange: (config: IeltsAssignmentConfig) => void;
  onAssignmentTitleChange: (title: string) => void;
  onAudioSelect: (sectionId: string, file: File | null) => void;
  onCourseChange: (courseId: string) => void;
  onDueDateChange: (dueDate: string) => void;
  onDurationMinutesChange: (duration: number) => void;
  onEnforceTimeChange: (enforce: boolean) => void;
  onInstructionsChange: (instructions: string) => void;
  onManageRubrics: () => void;
  onPublish: () => void;
  onSaveDraft: () => void;
  onTimingEnabledChange: (enabled: boolean) => void;
  onWritingImageSelect: (file: File | null) => void;
  readingConfig: IeltsReadingConfig | null;
  selectedType: IeltsAssignmentType;
  speakingConfig: IeltsSpeakingConfig | null;
  timingEnabled: boolean;
  writingConfig: IeltsWritingConfig | null;
  writingTask1File: File | null;
};

export function TeacherIeltsAssignmentEditor({
  assignmentTitle,
  canSave,
  courseId,
  courses,
  dueDate,
  durationMinutes,
  enforceTime,
  instructions,
  isLoading,
  listeningConfig,
  onAssignmentConfigChange,
  onAssignmentTitleChange,
  onAudioSelect,
  onCourseChange,
  onDueDateChange,
  onDurationMinutesChange,
  onEnforceTimeChange,
  onInstructionsChange,
  onManageRubrics,
  onPublish,
  onSaveDraft,
  onTimingEnabledChange,
  onWritingImageSelect,
  readingConfig,
  selectedType,
  speakingConfig,
  timingEnabled,
  writingConfig,
  writingTask1File,
}: TeacherIeltsAssignmentEditorProps) {
  const selectedConfig = readingConfig ?? listeningConfig ?? writingConfig ?? speakingConfig;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="space-y-6">
        <IeltsAuthoringBasicDetailsCard
          courses={courses}
          assignmentTitle={assignmentTitle}
          onAssignmentTitleChange={onAssignmentTitleChange}
          courseId={courseId}
          onCourseChange={onCourseChange}
          instructions={instructions}
          onInstructionsChange={onInstructionsChange}
          timingEnabled={timingEnabled}
          onTimingEnabledChange={onTimingEnabledChange}
          durationMinutes={durationMinutes}
          onDurationMinutesChange={onDurationMinutesChange}
          enforceTime={enforceTime}
          onEnforceTimeChange={onEnforceTimeChange}
          dueDate={dueDate}
          onDueDateChange={onDueDateChange}
        />

        {selectedConfig && (
          <AiPolicyControls
            type={selectedType}
            value={selectedConfig}
            onChange={onAssignmentConfigChange}
          />
        )}

        {selectedType === 'reading' && readingConfig && (
          <ReadingAssignmentForm value={readingConfig} onChange={onAssignmentConfigChange} />
        )}
        {selectedType === 'listening' && listeningConfig && (
          <ListeningAssignmentForm
            value={listeningConfig}
            onChange={onAssignmentConfigChange}
            onAudioSelect={onAudioSelect}
          />
        )}
        {selectedType === 'writing' && writingConfig && (
          <WritingAssignmentForm
            value={writingConfig}
            onChange={onAssignmentConfigChange}
            onImageSelect={onWritingImageSelect}
            selectedImageFile={writingTask1File}
            courseId={courseId}
            onManageRubrics={onManageRubrics}
          />
        )}
        {selectedType === 'speaking' && speakingConfig && (
          <SpeakingAssignmentForm value={speakingConfig} onChange={onAssignmentConfigChange} />
        )}

        <IeltsAuthoringActionsCard
          canSave={canSave}
          isLoading={isLoading}
          onSaveDraft={onSaveDraft}
          onPublish={onPublish}
        />
      </div>
    </div>
  );
}

/**
 * Location: features/assignments/components/TeacherIeltsAssignmentCreatePage.tsx
 * Purpose: Render the IELTS assignment authoring flow per Figma design.
 * Why: Matches the dedicated create experience for IELTS reading/listening/writing/speaking.
 */

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Eye } from 'lucide-react';
import { toast } from 'sonner@2.0.3';

import { Button } from '@components/ui/button';
import { PageHeader } from '@components/common/PageHeader';
import { useRouter } from '@lib/router';
import {
  createIeltsAssignmentConfig,
  type IeltsAssignmentConfig,
  type IeltsAssignmentType,
} from '@lib/ielts';
import { useAssignmentResources, useCreateAssignmentMutation } from '@features/assignments/api';
import { uploadFileWithProgress } from '@features/files/fileUpload';
import { IeltsTypeSelection } from './ielts/authoring/IeltsTypeSelection';
import { ReadingAssignmentForm } from './ielts/authoring/ReadingAssignmentForm';
import { ListeningAssignmentForm } from './ielts/authoring/ListeningAssignmentForm';
import { WritingAssignmentForm } from './ielts/authoring/WritingAssignmentForm';
import { SpeakingAssignmentForm } from './ielts/authoring/SpeakingAssignmentForm';
import { IeltsAuthoringBasicDetailsCard } from './ielts/authoring/IeltsAuthoringBasicDetailsCard';
import { IeltsAuthoringActionsCard } from './ielts/authoring/IeltsAuthoringActionsCard';

type UploadMap = Record<string, File | null>;

export function TeacherIeltsAssignmentCreatePage() {
  const { navigate } = useRouter();
  const { courses } = useAssignmentResources();
  const createAssignmentMutation = useCreateAssignmentMutation();

  const [selectedType, setSelectedType] = useState<IeltsAssignmentType | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [assignmentConfig, setAssignmentConfig] = useState<IeltsAssignmentConfig | null>(null);

  const [assignmentTitle, setAssignmentTitle] = useState('');
  const [courseId, setCourseId] = useState('');
  const [instructions, setInstructions] = useState('');
  const [timingEnabled, setTimingEnabled] = useState(true);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [enforceTime, setEnforceTime] = useState(true);
  const [dueDate, setDueDate] = useState('');

  const [listeningFiles, setListeningFiles] = useState<UploadMap>({});
  const [writingTask1File, setWritingTask1File] = useState<File | null>(null);

  useEffect(() => {
    if (!courseId && courses.length > 0) {
      setCourseId(courses[0].id);
    }
  }, [courseId, courses]);

  const handleSelectType = (type: IeltsAssignmentType) => {
    const nextConfig = createIeltsAssignmentConfig(type);
    setSelectedType(type);
    setAssignmentConfig(nextConfig);
    setInstructions(nextConfig.instructions);
    setTimingEnabled(nextConfig.timing.enabled);
    setDurationMinutes(nextConfig.timing.durationMinutes);
    setEnforceTime(nextConfig.timing.enforce);
  };

  useEffect(() => {
    if (!assignmentConfig) {
      return;
    }
    setAssignmentConfig({
      ...assignmentConfig,
      instructions,
      timing: {
        ...assignmentConfig.timing,
        enabled: timingEnabled,
        durationMinutes,
        enforce: enforceTime,
      },
    });
  }, [instructions, timingEnabled, durationMinutes, enforceTime]);

  const canSave = useMemo(
    () => assignmentTitle.trim().length > 0 && courseId.length > 0,
    [assignmentTitle, courseId],
  );

  const handleAudioSelect = (sectionId: string, file: File | null) => {
    setListeningFiles((current) => ({ ...current, [sectionId]: file }));
  };

  const uploadAudioFiles = async (config: IeltsAssignmentConfig) => {
    if (config && selectedType === 'listening') {
      const listeningConfig = config as Extract<IeltsAssignmentConfig, { sections: any[] }>;
      const nextSections = await Promise.all(
        listeningConfig.sections.map(async (section) => {
          const file = listeningFiles[section.id];
          if (!file) {
            return section;
          }
          const uploaded = await uploadFileWithProgress({
            file,
            onProgress: () => undefined,
          });
          return {
            ...section,
            audioFileId: uploaded.id,
          };
        }),
      );
      return { ...listeningConfig, sections: nextSections } as IeltsAssignmentConfig;
    }
    return config;
  };

  const uploadWritingImage = async (config: IeltsAssignmentConfig) => {
    if (config && selectedType === 'writing' && writingTask1File) {
      const uploaded = await uploadFileWithProgress({
        file: writingTask1File,
        onProgress: () => undefined,
      });
      const writingConfig = config as Extract<IeltsAssignmentConfig, { task1: any }>;
      return {
        ...writingConfig,
        task1: {
          ...writingConfig.task1,
          imageFileId: uploaded.id,
        },
      } as IeltsAssignmentConfig;
    }
    return config;
  };

  const handleSubmit = async (publish: boolean) => {
    if (!selectedType || !assignmentConfig) {
      toast.error('Select an IELTS assignment type to continue.');
      return;
    }
    if (!canSave) {
      toast.error('Please fill in title and select a course');
      return;
    }
    if (publish && !dueDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      let config = assignmentConfig;
      config = await uploadAudioFiles(config);
      config = await uploadWritingImage(config);

      await createAssignmentMutation.mutateAsync({
        courseId,
        payload: {
          title: assignmentTitle.trim(),
          descriptionMd: instructions.trim() || undefined,
          type: selectedType,
          dueAt: dueDate ? new Date(dueDate).toISOString() : undefined,
          assignmentConfig: config,
          publishedAt: publish ? new Date().toISOString() : undefined,
        },
      });
      toast.success(
        publish ? 'Assignment published successfully' : 'Assignment draft saved successfully',
      );
      navigate('/teacher/assignments');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save assignment.');
    }
  };

  if (!selectedType) {
    return (
      <div>
        <PageHeader
          title="Create IELTS Assignment"
          description="Choose the type of assignment you want to create"
          actions={
            <Button variant="outline" onClick={() => navigate('/teacher/assignments')}>
              <ArrowLeft className="mr-2 size-4" />
              Cancel
            </Button>
          }
        />
        <div className="p-4 sm:p-6 lg:p-8">
          <IeltsTypeSelection onSelect={handleSelectType} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`Create ${selectedType.charAt(0).toUpperCase()}${selectedType.slice(1)} Assignment`}
        description="Configure your IELTS assignment"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setSelectedType(null)}>
              <ArrowLeft className="mr-2 size-4" />
              Change Type
            </Button>
            <Button variant="outline" onClick={() => setShowPreview(!showPreview)}>
              <Eye className="mr-2 size-4" />
              {showPreview ? 'Edit' : 'Preview'}
            </Button>
          </div>
        }
      />

      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
        <div className="space-y-6">
          <IeltsAuthoringBasicDetailsCard
            courses={courses}
            assignmentTitle={assignmentTitle}
            onAssignmentTitleChange={setAssignmentTitle}
            courseId={courseId}
            onCourseChange={setCourseId}
            instructions={instructions}
            onInstructionsChange={setInstructions}
            timingEnabled={timingEnabled}
            onTimingEnabledChange={setTimingEnabled}
            durationMinutes={durationMinutes}
            onDurationMinutesChange={setDurationMinutes}
            enforceTime={enforceTime}
            onEnforceTimeChange={setEnforceTime}
            dueDate={dueDate}
            onDueDateChange={setDueDate}
          />

          {assignmentConfig && selectedType === 'reading' && (
            <ReadingAssignmentForm
              value={assignmentConfig as Extract<IeltsAssignmentConfig, { sections: any[] }>}
              onChange={setAssignmentConfig}
            />
          )}
          {assignmentConfig && selectedType === 'listening' && (
            <ListeningAssignmentForm
              value={assignmentConfig as Extract<IeltsAssignmentConfig, { sections: any[] }>}
              onChange={setAssignmentConfig}
              onAudioSelect={handleAudioSelect}
            />
          )}
          {assignmentConfig && selectedType === 'writing' && (
            <WritingAssignmentForm
              value={assignmentConfig as Extract<IeltsAssignmentConfig, { task1: any }>}
              onChange={setAssignmentConfig}
              onImageSelect={setWritingTask1File}
            />
          )}
          {assignmentConfig && selectedType === 'speaking' && (
            <SpeakingAssignmentForm
              value={assignmentConfig as Extract<IeltsAssignmentConfig, { part1: any }>}
              onChange={setAssignmentConfig}
            />
          )}

          <IeltsAuthoringActionsCard
            canSave={canSave}
            isLoading={createAssignmentMutation.isLoading}
            onSaveDraft={() => handleSubmit(false)}
            onPublish={() => handleSubmit(true)}
          />
        </div>
      </div>
    </div>
  );
}

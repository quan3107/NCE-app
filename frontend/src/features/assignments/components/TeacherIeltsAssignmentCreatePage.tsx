/**
 * Location: features/assignments/components/TeacherIeltsAssignmentCreatePage.tsx
 * Purpose: Render the IELTS assignment authoring flow per Figma design.
 * Why: Matches the dedicated create experience for IELTS reading/listening/writing/speaking.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Eye } from 'lucide-react';
import { toast } from 'sonner@2.0.3';

import { Button } from '@components/ui/button';
import { PageHeader } from '@components/common/PageHeader';
import { AutoSaveIndicator } from '@components/ui/auto-save-indicator';
import { useRouter } from '@lib/router';
import { useAutoSave } from '@lib/use-auto-save';
import { useMutationLifetime } from '@lib/useMutationLifetime';
import { createIeltsAssignmentConfig, type IeltsAssignmentConfig, type IeltsAssignmentType } from '@lib/ielts';
import type { AssignmentType } from '@domain';
import { useAssignmentResources, useCreateAssignmentMutation } from '@features/assignments/api';
import { IeltsTypeSelection } from './ielts/authoring/IeltsTypeSelection';
import { GenericAssignmentTypeSelection, type GenericAssignmentType } from './GenericAssignmentTypeSelection';
import { TeacherGenericAssignmentCreatePage } from './TeacherGenericAssignmentCreatePage';
import { TeacherIeltsAssignmentEditor } from './TeacherIeltsAssignmentEditor';
import {
  formatTimeAgo,
  getInitialStateFromDraft,
  isListeningConfig,
  isReadingConfig,
  isSpeakingConfig,
  isWritingConfig,
  uploadListeningAudioFiles,
  uploadWritingTaskImage,
  type UploadMap,
} from './teacherIeltsCreate.logic';

export function TeacherIeltsAssignmentCreatePage() {
  const { navigate } = useRouter();
  const { courses, isLoading, error, refetch } = useAssignmentResources();
  const [isRetrying, setIsRetrying] = useState(false);
  const createAssignmentMutation = useCreateAssignmentMutation();
  const submitLock = useRef(false);
  const captureLifetime = useMutationLifetime();
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const draft = getInitialStateFromDraft();
  const didRestore = !!draft;

  const [selectedType, setSelectedType] = useState<IeltsAssignmentType | null>(draft?.type || null);
  const [selectedGenericType, setSelectedGenericType] = useState<GenericAssignmentType | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [assignmentConfig, setAssignmentConfig] = useState<IeltsAssignmentConfig | null>(
    draft?.data?.assignmentConfig || null,
  );

  const [assignmentTitle, setAssignmentTitle] = useState(draft?.data?.assignmentTitle || '');
  const [courseId, setCourseId] = useState(draft?.data?.courseId || '');
  const [instructions, setInstructions] = useState(draft?.data?.instructions || '');
  const [timingEnabled, setTimingEnabled] = useState(draft?.data?.timingEnabled ?? true);
  const [durationMinutes, setDurationMinutes] = useState(draft?.data?.durationMinutes || 60);
  const [enforceTime, setEnforceTime] = useState(draft?.data?.enforceTime ?? true);
  const [dueDate, setDueDate] = useState(draft?.data?.dueDate || '');

  const [listeningFiles, setListeningFiles] = useState<UploadMap>({});
  const [writingTask1File, setWritingTask1File] = useState<File | null>(null);

  const [isRestoring, setIsRestoring] = useState(didRestore);

  const autoSaveKey = useMemo(() => {
    if (selectedType) {
      return `ielts_${selectedType}`;
    }
    return 'ielts_create';
  }, [selectedType]);

  const autoSaveData = useMemo(
    () => ({
      selectedType,
      assignmentConfig,
      assignmentTitle,
      courseId,
      instructions,
      timingEnabled,
      durationMinutes,
      enforceTime,
      dueDate,
    }),
    [
      selectedType,
      assignmentConfig,
      assignmentTitle,
      courseId,
      instructions,
      timingEnabled,
      durationMinutes,
      enforceTime,
      dueDate,
    ],
  );

  const {
    status: autoSaveStatus,
    lastSaved,
    clearDraft,
    draftTimestamp,
  } = useAutoSave(autoSaveData, {
    key: autoSaveKey,
    debounceMs: 1000,
  });

  useEffect(() => {
    if (draft && didRestore) {
      const timeAgo = formatTimeAgo(new Date(draft.timestamp));
      toast.success(`Draft restored from ${timeAgo}`);

      setTimeout(() => {
        setIsRestoring(false);
      }, 1500);
    }
  }, []); // Empty deps - only run on mount

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

  useEffect(() => {
    if (!selectedType) {
      return;
    }
    if (!assignmentConfig) {
      setAssignmentConfig(createIeltsAssignmentConfig(selectedType));
      return;
    }
    const isValid =
      (selectedType === 'reading' && isReadingConfig(assignmentConfig)) ||
      (selectedType === 'listening' && isListeningConfig(assignmentConfig)) ||
      (selectedType === 'writing' && isWritingConfig(assignmentConfig)) ||
      (selectedType === 'speaking' && isSpeakingConfig(assignmentConfig));
    if (!isValid) {
      setAssignmentConfig(createIeltsAssignmentConfig(selectedType));
    }
  }, [selectedType, assignmentConfig]);

  const canSave = useMemo(() => assignmentTitle.trim().length > 0 && courseId.length > 0, [assignmentTitle, courseId]);

  const handleAudioSelect = (sectionId: string, file: File | null) => {
    setListeningFiles((current) => ({ ...current, [sectionId]: file }));
  };

  const handleManageRubrics = () => {
    navigate('/teacher/rubrics');
  };

  const readingConfig = assignmentConfig && isReadingConfig(assignmentConfig) ? assignmentConfig : null;
  const listeningConfig = assignmentConfig && isListeningConfig(assignmentConfig) ? assignmentConfig : null;
  const writingConfig = assignmentConfig && isWritingConfig(assignmentConfig) ? assignmentConfig : null;
  const speakingConfig = assignmentConfig && isSpeakingConfig(assignmentConfig) ? assignmentConfig : null;

  const handleSubmit = async (publish: boolean) => {
    // The mutation becomes pending only after uploads. Lock the entire operation,
    // synchronously, so two clicks cannot upload/create the same assignment twice.
    if (submitLock.current) return;
    setSaveError(null);
    if (!selectedType || !assignmentConfig) {
      toast.error('Select an IELTS assignment type to continue.');
      return;
    }
    if (!canSave) {
      toast.error('Please fill in title and select a course');
      return;
    }
    if (publish && !dueDate) {
      setSaveError('Choose a due date before publishing.');
      toast.error('Please fill in all required fields');
      return;
    }

    submitLock.current = true;
    const isCurrent = captureLifetime();
    let uploadedCount = isListeningConfig(assignmentConfig)
      ? assignmentConfig.sections.filter((section) => section.audioFileId && !listeningFiles[section.id]).length
      : isWritingConfig(assignmentConfig) && assignmentConfig.task1.imageFileId && !writingTask1File ? 1 : 0;
    setIsSaving(true);
    try {
      let config = assignmentConfig;
      config = await uploadListeningAudioFiles(config, selectedType, listeningFiles, (sectionId, fileId) => {
        uploadedCount += 1;
        if (!isCurrent()) return;
        // Retain completed media so a later failure only retries unfinished work.
        setAssignmentConfig((current) => current && isListeningConfig(current) ? {
          ...current,
          sections: current.sections.map((section) => section.id === sectionId ? { ...section, audioFileId: fileId } : section),
        } : current);
        setListeningFiles((current) => current[sectionId] === listeningFiles[sectionId] ? { ...current, [sectionId]: null } : current);
      });
      if (!isCurrent()) return;
      config = await uploadWritingTaskImage(config, selectedType, writingTask1File);
      if (!isCurrent()) return;
      if (selectedType === 'writing' && writingTask1File) {
        uploadedCount += 1;
        setAssignmentConfig(config);
        setWritingTask1File(null);
      }

      await createAssignmentMutation.mutateAsync({
        courseId,
        payload: {
          title: assignmentTitle.trim(),
          descriptionMd: instructions.trim() || undefined,
          type: selectedType as AssignmentType,
          dueAt: dueDate ? new Date(dueDate).toISOString() : undefined,
          assignmentConfig: config,
          publishedAt: publish ? new Date().toISOString() : undefined,
        },
      });
      if (!isCurrent()) return;
      toast.success(publish ? 'Assignment published successfully' : 'Assignment draft saved successfully');
      clearDraft();
      navigate('/teacher/assignments');
    } catch (error) {
      if (!isCurrent()) return;
      const message = error instanceof Error ? error.message : 'Unable to save assignment.';
      const failure = uploadedCount > 0 ? `${uploadedCount} file(s) uploaded, but the assignment was not saved. ${message}` : message;
      setSaveError(failure);
      toast.error(failure);
    } finally {
      submitLock.current = false;
      if (isCurrent()) setIsSaving(false);
    }
  };

  const resourcesUnavailable = isLoading || Boolean(error) || courses.length === 0;
  const resourceState = resourcesUnavailable ? (
      <div>
        {!selectedGenericType && <PageHeader title="Create Assignment" actions={
          <Button variant="outline" onClick={() => navigate('/teacher/assignments')}>Back to Assignments</Button>
        } />}
        <div className="p-4 sm:p-6 lg:p-8 space-y-4" role={error ? 'alert' : 'status'}>
          <p>{error ? `Unable to load assignment resources: ${error.message}` : isLoading
            ? 'Loading assignment resources...' : 'No courses are available. A course is required to create an assignment.'}</p>
          {!isLoading && <Button disabled={isRetrying} onClick={async () => {
            setIsRetrying(true);
            try { await refetch(); } finally { setIsRetrying(false); }
          }}>Retry</Button>}
        </div>
      </div>
    ) : null;

  // Keep the generic draft owner mounted through background query failures.
  // Its controls and submit handler remain blocked until resources recover.
  if (selectedGenericType) {
    return (
      <>
        {resourceState}
        <TeacherGenericAssignmentCreatePage
          courses={courses}
          resourcesUnavailable={resourcesUnavailable}
          initialType={selectedGenericType}
          onCancel={() => setSelectedGenericType(null)}
          onCreated={() => navigate('/teacher/assignments')}
        />
      </>
    );
  }

  if (resourcesUnavailable) return resourceState;

  if (!selectedType) {
    return (
      <div>
        <PageHeader
          title="Create Assignment"
          description="Choose the type of assignment you want to create"
          actions={
            <Button variant="outline" onClick={() => navigate('/teacher/assignments')}>
              <ArrowLeft className="mr-2 size-4" />
              Cancel
            </Button>
          }
        />
        <div className="space-y-8 p-4 sm:p-6 lg:p-8">
          <section className="space-y-4" aria-labelledby="generic-assignment-types">
            <div>
              <h2 id="generic-assignment-types">General Assignments</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Collect a text response, a web link, or uploaded files.
              </p>
            </div>
            <GenericAssignmentTypeSelection onSelect={setSelectedGenericType} />
          </section>
          <section className="space-y-4" aria-labelledby="ielts-assignment-types">
            <div>
              <h2 id="ielts-assignment-types">IELTS Assignments</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Build a structured Reading, Listening, Writing, or Speaking assignment.
              </p>
            </div>
            <IeltsTypeSelection onSelect={handleSelectType} />
          </section>
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
          <div className="flex flex-wrap items-center gap-4">
            <AutoSaveIndicator
              status={autoSaveStatus}
              lastSaved={lastSaved}
              draftTimestamp={draftTimestamp}
              isRestoring={isRestoring}
            />
            <div className="flex gap-2">
              <Button variant="outline" disabled={isSaving} onClick={() => setSelectedType(null)}>
                <ArrowLeft className="mr-2 size-4" />
                Change Type
              </Button>
              <Button variant="outline" disabled={isSaving} onClick={() => setShowPreview(!showPreview)}>
                <Eye className="mr-2 size-4" />
                {showPreview ? 'Edit' : 'Preview'}
              </Button>
            </div>
          </div>
        }
      />

      {saveError && <p id="ielts-save-error" role="alert" className="px-4 py-3 text-destructive">{saveError}</p>}
      <TeacherIeltsAssignmentEditor
        assignmentTitle={assignmentTitle}
        canSave={canSave}
        courseId={courseId}
        courses={courses}
        dueDate={dueDate}
        dueDateErrorId={saveError === 'Choose a due date before publishing.' && !dueDate ? 'ielts-save-error' : undefined}
        durationMinutes={durationMinutes}
        enforceTime={enforceTime}
        instructions={instructions}
        isLoading={isSaving || createAssignmentMutation.isPending}
        showPreview={showPreview}
        listeningConfig={listeningConfig}
        onAssignmentConfigChange={setAssignmentConfig}
        onAssignmentTitleChange={setAssignmentTitle}
        onAudioSelect={handleAudioSelect}
        onCourseChange={setCourseId}
        onDueDateChange={setDueDate}
        onDurationMinutesChange={setDurationMinutes}
        onEnforceTimeChange={setEnforceTime}
        onInstructionsChange={setInstructions}
        onManageRubrics={handleManageRubrics}
        onPublish={() => handleSubmit(true)}
        onSaveDraft={() => handleSubmit(false)}
        onTimingEnabledChange={setTimingEnabled}
        onWritingImageSelect={setWritingTask1File}
        readingConfig={readingConfig}
        selectedType={selectedType}
        speakingConfig={speakingConfig}
        timingEnabled={timingEnabled}
        writingConfig={writingConfig}
        writingTask1File={writingTask1File}
      />
    </div>
  );
}

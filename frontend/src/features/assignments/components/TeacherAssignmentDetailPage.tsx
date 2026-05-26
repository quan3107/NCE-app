/**
 * Location: features/assignments/components/TeacherAssignmentDetailPage.tsx
 * Purpose: Render the teacher-facing assignment detail view aligned to the Figma Make design.
 * Why: Provides a read-only overview page that keeps editing in the dedicated edit screen.
 */

import { useMemo, useState, useCallback } from 'react';
import { Card, CardContent } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { PageHeader } from '@components/common/PageHeader';
import { useRouter } from '@lib/router';
import { useAssignmentResources, useUpdateAssignmentMutation } from '@features/assignments/api';
import { useCourseRubricsQuery } from '@features/rubrics/api';
import {
  isIeltsAssignmentType,
  normalizeIeltsAssignmentConfig,
  type IeltsAssignmentType,
  type IeltsAssignmentConfig,
} from '@lib/ielts';
import { TeacherAssignmentDetailTabs } from './TeacherAssignmentDetailTabs';
import { TeacherAssignmentDetailHeaderActions } from './TeacherAssignmentDetailHeaderActions';
import { RubricManagementOverlay } from '@features/rubrics/components/RubricManagementOverlay';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileText,
  Users,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import type { Assignment } from '@domain';

export function TeacherAssignmentDetailPage({ assignmentId }: { assignmentId: string }) {
  const { navigate } = useRouter();
  const { assignments, submissions, courses, isLoading, error } = useAssignmentResources();
  const updateAssignmentMutation = useUpdateAssignmentMutation();

  const [isEditing, setIsEditing] = useState(false);
  const [draftConfig, setDraftConfig] = useState<IeltsAssignmentConfig | null>(null);
  const [draftAssignment, setDraftAssignment] = useState<Assignment | null>(null);

  const [isRubricModalOpen, setIsRubricModalOpen] = useState(false);

  const assignment = assignments.find(item => item.id === assignmentId) ?? null;

  const rubricsQuery = useCourseRubricsQuery(assignment?.courseId ?? '');
  const rubrics = rubricsQuery.data ?? [];

  const course = courses.find(item => item.id === assignment?.courseId) ?? null;
  const assignmentSubmissions = useMemo(
    () => submissions.filter(item => item.assignmentId === assignmentId),
    [assignmentId, submissions],
  );

  const submittedCount = assignmentSubmissions.filter(item =>
    ['submitted', 'late', 'graded'].includes(item.status),
  ).length;
  const gradedCount = assignmentSubmissions.filter(item => item.status === 'graded').length;
  const pendingCount = assignmentSubmissions.filter(item =>
    ['submitted', 'late'].includes(item.status),
  ).length;
  const lateCount = assignmentSubmissions.filter(item => item.status === 'late').length;
  const totalStudents = course?.enrolled ?? Math.max(assignmentSubmissions.length, 0);
  const submissionRate =
    totalStudents > 0 ? Math.round((submittedCount / totalStudents) * 100) : 0;
  const onTimeRate =
    submittedCount > 0 ? Math.round(((submittedCount - lateCount) / submittedCount) * 100) : 0;

  const ieltsConfig = useMemo(() => {
    if (!assignment || !isIeltsAssignmentType(assignment.type)) {
      return null;
    }
    return normalizeIeltsAssignmentConfig(
      assignment.type as IeltsAssignmentType,
      assignment.assignmentConfig,
    );
  }, [assignment]);

  const activeConfig = isEditing && draftConfig ? draftConfig : ieltsConfig;

  const statsCards = [
    { label: 'Total Students', value: totalStudents, icon: <Users className="size-5 text-blue-600" /> },
    { label: 'Submitted', value: submittedCount, icon: <FileText className="size-5 text-green-600" /> },
    { label: 'Pending Grading', value: pendingCount, icon: <Clock className="size-5 text-orange-600" /> },
    { label: 'Graded', value: gradedCount, icon: <CheckCircle2 className="size-5 text-purple-600" /> },
  ];

  const handleEnterEditMode = useCallback(() => {
    if (ieltsConfig && assignment) {
      setDraftConfig(ieltsConfig);
      setDraftAssignment({ ...assignment });
      setIsEditing(true);
    }
  }, [ieltsConfig, assignment]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setDraftConfig(null);
    setDraftAssignment(null);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!assignment) return;

    try {
      const payload: Record<string, unknown> = {};
      
      if (draftAssignment) {
        payload.title = draftAssignment.title;
        payload.descriptionMd = draftAssignment.description;
        payload.dueAt = draftAssignment.dueAt?.toISOString();
        payload.assignmentConfig = {
          ...assignment.assignmentConfig,
          maxScore: draftAssignment.maxScore,
        };
      }
      
      if (draftConfig) {
        payload.assignmentConfig = draftConfig;
      }

      await updateAssignmentMutation.mutateAsync({
        courseId: assignment.courseId,
        assignmentId: assignment.id,
        payload,
      });
      
      setIsEditing(false);
      setDraftConfig(null);
      setDraftAssignment(null);
      toast.success('Assignment updated successfully.');
    } catch (errorValue) {
      toast.error(
        errorValue instanceof Error ? errorValue.message : 'Failed to update assignment.',
      );
    }
  }, [assignment, draftAssignment, draftConfig, updateAssignmentMutation]);

  const handleDraftConfigChange = useCallback((updated: IeltsAssignmentConfig) => {
    setDraftConfig(updated);
  }, []);

  const handleAssignmentChange = useCallback((updates: Partial<Assignment>) => {
    setDraftAssignment(prev => prev ? { ...prev, ...updates } : null);
  }, []);

  const handleAutoSave = useCallback(async () => {
    if (!assignment || !isEditing) return;

    try {
      const payload: Record<string, unknown> = {};
      
      if (draftAssignment) {
        payload.title = draftAssignment.title;
        payload.descriptionMd = draftAssignment.description;
        payload.dueAt = draftAssignment.dueAt?.toISOString();
      }
      
      if (draftConfig) {
        payload.assignmentConfig = draftConfig;
      }

      await updateAssignmentMutation.mutateAsync({
        courseId: assignment.courseId,
        assignmentId: assignment.id,
        payload,
      });
      
      toast.success('Changes saved automatically.');
    } catch (errorValue) {
      toast.error(
        errorValue instanceof Error ? errorValue.message : 'Failed to auto-save changes.',
      );
    }
  }, [assignment, isEditing, draftAssignment, draftConfig, updateAssignmentMutation]);

  const handleManageRubrics = useCallback(() => {
    setIsRubricModalOpen(true);
  }, []);

  const handleUnpublish = async () => {
    if (!assignment || assignment.status !== 'published') {
      return;
    }

    try {
      await updateAssignmentMutation.mutateAsync({
        courseId: assignment.courseId,
        assignmentId: assignment.id,
        payload: { publishedAt: null },
      });
      toast.success('Assignment unpublished.');
    } catch (errorValue) {
      toast.error(
        errorValue instanceof Error ? errorValue.message : 'Unable to unpublish assignment.',
      );
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Loading assignment...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-destructive font-medium">Unable to load assignment.</p>
            <p className="text-sm text-muted-foreground mt-2">{error.message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Assignment not found</p>
          <Button onClick={() => navigate('/teacher/assignments')}>
            <ArrowLeft className="mr-2 size-4" />
            Back to Assignments
          </Button>
        </div>
      </div>
    );
  }

  const activeAssignment = isEditing && draftAssignment ? draftAssignment : assignment;
  const canEditAssignment = isIeltsAssignmentType(assignment.type) && Boolean(ieltsConfig);

  return (
    <div>
      <PageHeader
        title={assignment.title}
        description={assignment.courseName}
        actions={
          <TeacherAssignmentDetailHeaderActions
            canEdit={canEditAssignment}
            isEditing={isEditing}
            isPending={updateAssignmentMutation.isPending}
            isPublished={assignment.status === 'published'}
            onBack={() => navigate('/teacher/assignments')}
            onCancelEdit={handleCancelEdit}
            onEnterEdit={handleEnterEditMode}
            onSaveEdit={handleSaveEdit}
            onUnpublish={handleUnpublish}
          />
        }
      />

      <div className="p-4 sm:p-6 lg:p-8">
        <div className="w-full space-y-6">
          <TeacherAssignmentDetailTabs
            assignment={activeAssignment}
            courseTitle={course?.title ?? activeAssignment.courseName}
            submissions={assignmentSubmissions}
            statsCards={statsCards}
            statsSummary={{
              totalStudents,
              submittedCount,
              pendingCount,
              gradedCount,
              submissionRate,
              onTimeRate,
            }}
            ieltsConfig={activeConfig}
            isEditing={isEditing}
            onDraftConfigChange={handleDraftConfigChange}
            onAssignmentChange={handleAssignmentChange}
            rubrics={rubrics}
            courseId={assignment.courseId}
            onManageRubrics={handleManageRubrics}
          />
        </div>
      </div>

      {assignment?.courseId && (
        <RubricManagementOverlay
          isOpen={isRubricModalOpen}
          onClose={() => {
            setIsRubricModalOpen(false);
            if (isEditing) {
              handleAutoSave();
            }
          }}
          courseId={assignment.courseId}
        />
      )}
    </div>
  );
}

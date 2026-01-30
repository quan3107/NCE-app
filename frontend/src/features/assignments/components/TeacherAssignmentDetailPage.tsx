/**
 * Location: features/assignments/components/TeacherAssignmentDetailPage.tsx
 * Purpose: Render the teacher-facing assignment detail view aligned to the Figma Make design.
 * Why: Provides a read-only overview page that keeps editing in the dedicated edit screen.
 */

import { useMemo } from 'react';
import { Card, CardContent } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { PageHeader } from '@components/common/PageHeader';
import { useRouter } from '@lib/router';
import { useAssignmentResources, useUpdateAssignmentMutation } from '@features/assignments/api';
import {
  isIeltsAssignmentType,
  normalizeIeltsAssignmentConfig,
  type IeltsAssignmentType,
} from '@lib/ielts';
import { TeacherAssignmentDetailTabs } from './TeacherAssignmentDetailTabs';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Edit,
  FileText,
  Send,
  Users,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';

export function TeacherAssignmentDetailPage({ assignmentId }: { assignmentId: string }) {
  const { navigate } = useRouter();
  const { assignments, submissions, courses, isLoading, error } = useAssignmentResources();
  const updateAssignmentMutation = useUpdateAssignmentMutation();

  const assignment = assignments.find(item => item.id === assignmentId) ?? null;
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

  const statsCards = [
    { label: 'Total Students', value: totalStudents, icon: <Users className="size-5 text-blue-600" /> },
    { label: 'Submitted', value: submittedCount, icon: <FileText className="size-5 text-green-600" /> },
    { label: 'Pending Grading', value: pendingCount, icon: <Clock className="size-5 text-orange-600" /> },
    { label: 'Graded', value: gradedCount, icon: <CheckCircle2 className="size-5 text-purple-600" /> },
  ];

  const handlePublish = async () => {
    if (!assignment || assignment.status === 'published') {
      return;
    }

    try {
      await updateAssignmentMutation.mutateAsync({
        courseId: assignment.courseId,
        assignmentId: assignment.id,
        payload: { publishedAt: new Date().toISOString() },
      });
      toast.success('Assignment published.');
    } catch (errorValue) {
      toast.error(
        errorValue instanceof Error ? errorValue.message : 'Unable to publish assignment.',
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

  const publishLabel = assignment.status === 'published' ? 'Published' : 'Publish';

  return (
    <div>
      <PageHeader
        title={assignment.title}
        description={assignment.courseName}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/teacher/assignments')}>
              <ArrowLeft className="mr-2 size-4" />
              Back
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate(`/teacher/assignments/${assignment.id}/edit`)}
            >
              <Edit className="mr-2 size-4" />
              Edit
            </Button>
            <Button
              onClick={handlePublish}
              variant={assignment.status === 'published' ? 'secondary' : 'default'}
              disabled={assignment.status === 'published' || updateAssignmentMutation.isLoading}
            >
              <Send className="mr-2 size-4" />
              {updateAssignmentMutation.isLoading ? 'Publishing...' : publishLabel}
            </Button>
          </div>
        }
      />

      <div className="p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-[736px] space-y-6">
          <TeacherAssignmentDetailTabs
            assignment={assignment}
            courseTitle={course?.title ?? assignment.courseName}
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
            ieltsConfig={ieltsConfig}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Location: features/assignments/api.ts
 * Purpose: Expose assignment-centric data fetchers and hooks backed by React Query.
 * Why: Aligns assignment data access with the live API while keeping UI types stable.
 */

import { useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

import { apiClient } from '@lib/apiClient';
import { useAuth } from '@lib/auth';
import type { Assignment, Enrollment, Submission, SubmissionFile } from '@types/domain';
import { queryClient } from '@lib/queryClient';
import { useCoursesQuery } from '@features/courses/api';

const ASSIGNMENTS_KEY = 'assignments:list';
const SUBMISSIONS_KEY = 'assignments:submissions';
const ENROLLMENTS_KEY = 'assignments:enrollments';

type ApiAssignment = {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  type: Assignment['type'];
  dueAt: string | null;
  latePolicy: Record<string, unknown> | null;
  publishedAt: string | null;
  assignmentConfig?: Record<string, unknown> | string | null;
};

type ApiSubmission = {
  id: string;
  assignmentId: string;
  studentId: string;
  status: 'draft' | 'submitted' | 'late' | 'graded';
  submittedAt: string | null;
  payload: Record<string, unknown>;
};

type ApiMeResponse = {
  profile: {
    id: string;
  };
  enrollments: Array<{
    id: string;
    courseId: string;
    enrolledAt: string;
  }>;
};

type CreateAssignmentRequest = {
  title: string;
  descriptionMd?: string;
  type: Assignment['type'];
  dueAt?: string;
  latePolicy?: Record<string, unknown>;
  assignmentConfig?: Record<string, unknown>;
  publishedAt?: string | null;
};

type UpdateAssignmentRequest = Partial<CreateAssignmentRequest>;

type CreateSubmissionRequest = {
  studentId: string;
  payload: Record<string, unknown>;
  submittedAt?: string;
  status?: 'draft' | 'submitted' | 'late';
};

const safeParseJson = (value: string): Record<string, unknown> | null => {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const toAssignment = (assignment: ApiAssignment, courseName: string): Assignment => {
  const latePolicy = assignment.latePolicy
    ? typeof assignment.latePolicy === 'string'
      ? assignment.latePolicy
      : JSON.stringify(assignment.latePolicy)
    : '';

  const assignmentConfig =
    typeof assignment.assignmentConfig === 'string'
      ? safeParseJson(assignment.assignmentConfig)
      : assignment.assignmentConfig ?? null;

  return {
    id: assignment.id,
    title: assignment.title,
    description: assignment.description ?? '',
    type: assignment.type,
    courseId: assignment.courseId,
    courseName,
    dueAt: assignment.dueAt ? new Date(assignment.dueAt) : new Date(),
    publishedAt: assignment.publishedAt ? new Date(assignment.publishedAt) : undefined,
    status: assignment.publishedAt ? 'published' : 'draft',
    latePolicy,
    maxScore: 100,
    assignmentConfig,
  };
};

const toSubmission = (submission: ApiSubmission): Submission => {
  const payload = submission.payload ?? {};
  const payloadRecord = payload as Record<string, unknown>;
  const files = Array.isArray(payloadRecord.files)
    ? payloadRecord.files
        .map((item) => {
          if (typeof item === 'string') {
            return {
              id: item,
              name: item,
              size: 0,
              mime: 'application/octet-stream',
              checksum: '',
              bucket: '',
              objectKey: '',
            };
          }

          if (item && typeof item === 'object') {
            const record = item as Record<string, unknown>;
            const name = typeof record.name === 'string' ? record.name : 'Uploaded file';
            const id = typeof record.id === 'string' ? record.id : name;
            const size = typeof record.size === 'number' ? record.size : 0;
            const mime =
              typeof record.mime === 'string' ? record.mime : 'application/octet-stream';
            const checksum = typeof record.checksum === 'string' ? record.checksum : '';
            const bucket = typeof record.bucket === 'string' ? record.bucket : '';
            const objectKey = typeof record.objectKey === 'string' ? record.objectKey : '';

            return { id, name, size, mime, checksum, bucket, objectKey };
          }

          return null;
        })
        .filter((item): item is SubmissionFile => Boolean(item))
    : undefined;

  return {
    id: submission.id,
    assignmentId: submission.assignmentId,
    studentId: submission.studentId,
    studentName:
      typeof payloadRecord.studentName === 'string' ? payloadRecord.studentName : 'Student',
    status: submission.status,
    submittedAt: submission.submittedAt ? new Date(submission.submittedAt) : undefined,
    content: typeof payloadRecord.content === 'string' ? payloadRecord.content : undefined,
    files,
    version: typeof payloadRecord.version === 'number' ? payloadRecord.version : 1,
  };
};

const fetchAssignments = async (courseIds: string[]): Promise<ApiAssignment[]> => {
  if (courseIds.length === 0) {
    return [];
  }

  const results = await Promise.all(
    courseIds.map(courseId =>
      apiClient<ApiAssignment[]>(`/api/v1/courses/${courseId}/assignments`),
    ),
  );

  return results.flat();
};

const createAssignment = async (
  courseId: string,
  payload: CreateAssignmentRequest,
): Promise<ApiAssignment> => {
  return apiClient<ApiAssignment, CreateAssignmentRequest>(
    `/api/v1/courses/${courseId}/assignments`,
    {
      method: 'POST',
      body: payload,
    },
  );
};

const updateAssignment = async (
  courseId: string,
  assignmentId: string,
  payload: UpdateAssignmentRequest,
): Promise<ApiAssignment> => {
  return apiClient<ApiAssignment, UpdateAssignmentRequest>(
    `/api/v1/courses/${courseId}/assignments/${assignmentId}`,
    {
      method: 'PATCH',
      body: payload,
    },
  );
};

const fetchSubmissions = async (assignmentIds: string[]): Promise<ApiSubmission[]> => {
  if (assignmentIds.length === 0) {
    return [];
  }

  const results = await Promise.all(
    assignmentIds.map(assignmentId =>
      apiClient<ApiSubmission[]>(`/api/v1/assignments/${assignmentId}/submissions`),
    ),
  );

  return results.flat();
};

const createSubmission = async (
  assignmentId: string,
  payload: CreateSubmissionRequest,
): Promise<ApiSubmission> => {
  return apiClient<ApiSubmission, CreateSubmissionRequest>(
    `/api/v1/assignments/${assignmentId}/submissions`,
    {
      method: 'POST',
      body: payload,
    },
  );
};

const fetchEnrollments = async (): Promise<ApiMeResponse> => {
  return apiClient<ApiMeResponse>('/api/v1/me');
};

function useAssignmentsQuery(courseIds: string[], enabled: boolean) {
  return useQuery({
    queryKey: [ASSIGNMENTS_KEY, ...courseIds],
    queryFn: () => fetchAssignments(courseIds),
    enabled: enabled && courseIds.length > 0,
  });
}

function useSubmissionsQuery(assignmentIds: string[], enabled: boolean) {
  return useQuery({
    queryKey: [SUBMISSIONS_KEY, ...assignmentIds],
    queryFn: () => fetchSubmissions(assignmentIds),
    enabled: enabled && assignmentIds.length > 0,
  });
}

function useEnrollmentsQuery(userId: string | undefined) {
  return useQuery({
    queryKey: [ENROLLMENTS_KEY, userId],
    queryFn: fetchEnrollments,
    enabled: Boolean(userId),
  });
}

export function useCreateAssignmentMutation() {
  return useMutation({
    mutationFn: ({ courseId, payload }: { courseId: string; payload: CreateAssignmentRequest }) =>
      createAssignment(courseId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ASSIGNMENTS_KEY] });
    },
  });
}

export function useUpdateAssignmentMutation() {
  return useMutation({
    mutationFn: ({
      courseId,
      assignmentId,
      payload,
    }: {
      courseId: string;
      assignmentId: string;
      payload: UpdateAssignmentRequest;
    }) => updateAssignment(courseId, assignmentId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ASSIGNMENTS_KEY] });
    },
  });
}

export function useCreateSubmissionMutation() {
  return useMutation({
    mutationFn: ({
      assignmentId,
      payload,
    }: {
      assignmentId: string;
      payload: CreateSubmissionRequest;
    }) => createSubmission(assignmentId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SUBMISSIONS_KEY] });
    },
  });
}

export function markSubmissionAsGraded(submissionId: string) {
  queryClient.setQueriesData<ApiSubmission[]>(
    { queryKey: [SUBMISSIONS_KEY], exact: false },
    (data) => {
      if (!data) {
        return data;
      }
      return data.map((submission) =>
        submission.id === submissionId
          ? { ...submission, status: 'graded' }
          : submission,
      );
    },
  );
}

export function useAssignmentResources() {
  const { currentUser } = useAuth();
  const coursesQuery = useCoursesQuery();

  const courseMap = useMemo(() => {
    const courses = coursesQuery.data ?? [];
    return new Map(courses.map(course => [course.id, course.title]));
  }, [coursesQuery.data]);

  const courseIds = useMemo(
    () => (coursesQuery.data ? coursesQuery.data.map(course => course.id) : []),
    [coursesQuery.data],
  );

  const isAuthenticated = currentUser.role !== 'public' && currentUser.id.length > 0;
  const assignmentsQuery = useAssignmentsQuery(courseIds, isAuthenticated);
  const assignments = useMemo(() => {
    const data = assignmentsQuery.data ?? [];
    return data.map(assignment =>
      toAssignment(assignment, courseMap.get(assignment.courseId) ?? 'Unknown Course'),
    );
  }, [assignmentsQuery.data, courseMap]);

  const assignmentIds = useMemo(
    () => (assignmentsQuery.data ? assignmentsQuery.data.map(item => item.id) : []),
    [assignmentsQuery.data],
  );

  // Submissions list supports students (scoped to their own submissions) and staff.
  const canViewSubmissions =
    currentUser.role === 'admin' ||
    currentUser.role === 'teacher' ||
    currentUser.role === 'student';
  const submissionsQuery = useSubmissionsQuery(assignmentIds, canViewSubmissions);
  const submissions = useMemo(
    () => (submissionsQuery.data ?? []).map(toSubmission),
    [submissionsQuery.data],
  );

  const enrollmentsQuery = useEnrollmentsQuery(currentUser.id || undefined);
  const enrollments = useMemo(() => {
    const data = enrollmentsQuery.data;
    if (!data) {
      return [] as Enrollment[];
    }

    return data.enrollments.map(enrollment => ({
      id: enrollment.id,
      userId: data.profile.id,
      courseId: enrollment.courseId,
      enrolledAt: new Date(enrollment.enrolledAt),
    }));
  }, [enrollmentsQuery.data]);

  const isLoading =
    coursesQuery.isLoading ||
    assignmentsQuery.isLoading ||
    submissionsQuery.isLoading ||
    enrollmentsQuery.isLoading;
  const error =
    coursesQuery.error ??
    assignmentsQuery.error ??
    submissionsQuery.error ??
    enrollmentsQuery.error ??
    null;

  return useMemo(
    () => ({
      assignments,
      submissions,
      enrollments,
      courses: coursesQuery.data ?? [],
      isLoading,
      error,
      refetch: async () => {
        await Promise.all([
          coursesQuery.refetch(),
          assignmentsQuery.refetch(),
          submissionsQuery.refetch(),
          enrollmentsQuery.refetch(),
        ]);
      },
    }),
    [
      assignments,
      submissions,
      enrollments,
      coursesQuery.data,
      coursesQuery.refetch,
      assignmentsQuery.refetch,
      submissionsQuery.refetch,
      enrollmentsQuery.refetch,
      isLoading,
      error,
    ],
  );
}

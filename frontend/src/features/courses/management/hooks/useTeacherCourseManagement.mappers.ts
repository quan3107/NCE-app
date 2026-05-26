/**
 * Location: features/courses/management/hooks/useTeacherCourseManagement.mappers.ts
 * Purpose: Convert course management API responses into UI view-model shapes.
 * Why: Keeps mapping and error translation out of the stateful management hook.
 */

import { ApiError } from '@lib/apiClient';
import type { Assignment } from '@domain';
import type {
  CourseAssignmentResponse,
  CourseDetailResponse,
  CourseStudentResponse,
} from '../api';
import type { EnrollmentState, ManagedCourse, RubricCriterion } from '../types';

export const defaultRubric: RubricCriterion[] = [
  { name: 'Task Achievement', weight: 25, description: 'How well the task requirements are met' },
  { name: 'Coherence & Cohesion', weight: 25, description: 'Logical organization and flow' },
  { name: 'Lexical Resource', weight: 25, description: 'Vocabulary range and accuracy' },
  { name: 'Grammatical Range', weight: 25, description: 'Grammar variety and accuracy' },
];

export const toCourseRubricCriteria = (
  criteria: Array<{
    name: string;
    weight: number;
    description?: string;
  }>,
): RubricCriterion[] => {
  const mapped = criteria.map((item) => ({
    name: item.name,
    weight: item.weight,
    description: item.description ?? '',
  }));

  return mapped.length > 0 ? mapped : defaultRubric;
};

export const toManagedCourse = (input: CourseDetailResponse): ManagedCourse => ({
  id: input.id,
  title: input.title,
  description: input.description,
  scheduleLabel: input.schedule?.label ?? null,
  level: input.metadata.level,
  duration: input.metadata.duration,
  price: input.metadata.price,
  teacherName: input.owner.fullName,
  teacherEmail: input.owner.email,
  teacherId: input.owner.id,
  metrics: {
    ...input.metrics,
    completionRatePercent: Number.isFinite(input.metrics.completionRatePercent)
      ? input.metrics.completionRatePercent
      : 0,
  },
});

export const toEnrolledStudent = (
  input: CourseStudentResponse,
): EnrollmentState['students'][number] => ({
  id: input.id,
  name: input.fullName,
  email: input.email,
  status: input.status,
  enrolledAt: input.enrolledAt,
});

export const toAddStudentErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError) {
    if (error.status === 404) {
      return 'Student account not found';
    }
    if (error.status === 409) {
      return error.message || 'Student is already enrolled in this course';
    }
    if (error.status === 401 || error.status === 403) {
      return 'You do not have permission to manage enrollment for this course';
    }
    return error.message || 'Unable to add student right now';
  }

  return 'Unable to add student right now';
};

const toLatePolicy = (value: Record<string, unknown> | string | null): string => {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  return JSON.stringify(value);
};

const toAssignmentConfig = (
  value: CourseAssignmentResponse['assignmentConfig'],
): Record<string, unknown> | null => {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as Record<string, unknown>;
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  return value;
};

export const toManagedAssignment = (
  assignment: CourseAssignmentResponse,
  courseName: string,
): Assignment => ({
  id: assignment.id,
  title: assignment.title,
  description: assignment.description ?? '',
  type: assignment.type,
  courseId: assignment.courseId,
  courseName,
  dueAt: assignment.dueAt ? new Date(assignment.dueAt) : new Date(),
  publishedAt: assignment.publishedAt ? new Date(assignment.publishedAt) : undefined,
  status: assignment.publishedAt ? 'published' : 'draft',
  latePolicy: toLatePolicy(assignment.latePolicy),
  maxScore: 100,
  assignmentConfig: toAssignmentConfig(assignment.assignmentConfig),
});

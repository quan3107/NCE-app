/**
 * Location: features/assignments/api.types.ts
 * Purpose: Define assignment API DTOs and request payload types.
 * Why: Keeps React Query hooks separate from transport shape declarations.
 */

import type {
  CreateSubmissionStatus,
  SubmissionStatus as BackendSubmissionStatus,
} from '@lib/backend-schema';
import type { Assignment } from '@domain';

export const ASSIGNMENTS_KEY = 'assignments:list';
export const SUBMISSIONS_KEY = 'assignments:submissions';
export const ENROLLMENTS_KEY = 'assignments:enrollments';

export type ApiAssignment = {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  type: Assignment['type'];
  dueAt: string | null;
  latePolicy: Record<string, unknown> | string | null;
  publishedAt: string | null;
  assignmentConfig?: Record<string, unknown> | string | null;
};

export type ApiSubmission = {
  id: string;
  assignmentId: string;
  studentId: string;
  status: BackendSubmissionStatus;
  submittedAt: string | null;
  payload: Record<string, unknown>;
};

export type ApiMeResponse = {
  profile: {
    id: string;
  };
  enrollments: Array<{
    id: string;
    courseId: string;
    enrolledAt: string;
  }>;
};

export type CreateAssignmentRequest = {
  title: string;
  descriptionMd?: string;
  type: Assignment['type'];
  dueAt?: string;
  latePolicy?: Record<string, unknown>;
  assignmentConfig?: Record<string, unknown>;
  publishedAt?: string | null;
};

export type UpdateAssignmentRequest = Partial<CreateAssignmentRequest>;

export type CreateSubmissionRequest = {
  studentId: string;
  payload: Record<string, unknown>;
  submittedAt?: string;
  status?: CreateSubmissionStatus;
};

/**
 * Location: features/assignments/api.requests.ts
 * Purpose: Provide raw assignment API request functions.
 * Why: Keeps transport calls reusable and separate from React Query hook wiring.
 */

import { apiClient } from '@lib/apiClient';
import type {
  ApiAssignment,
  ApiMeResponse,
  ApiSubmission,
  CreateAssignmentRequest,
  CreateSubmissionRequest,
  UpdateAssignmentRequest,
} from './api.types';

export const fetchAssignments = async (courseIds: string[]): Promise<ApiAssignment[]> => {
  if (courseIds.length === 0) {
    return [];
  }

  const results = await Promise.all(
    courseIds.map(courseId =>
      apiClient<ApiAssignment[]>(`/api/v1/courses/${courseId}/assignments`, {
        auth: 'required',
      }),
    ),
  );

  return results.flat();
};

export const createAssignment = async (
  courseId: string,
  payload: CreateAssignmentRequest,
): Promise<ApiAssignment> => {
  return apiClient<ApiAssignment, CreateAssignmentRequest>(
    `/api/v1/courses/${courseId}/assignments`,
    {
      auth: 'required',
      method: 'POST',
      body: payload,
    },
  );
};

export const updateAssignment = async (
  courseId: string,
  assignmentId: string,
  payload: UpdateAssignmentRequest,
): Promise<ApiAssignment> => {
  return apiClient<ApiAssignment, UpdateAssignmentRequest>(
    `/api/v1/courses/${courseId}/assignments/${assignmentId}`,
    {
      auth: 'required',
      method: 'PATCH',
      body: payload,
    },
  );
};

export const fetchSubmissions = async (assignmentIds: string[]): Promise<ApiSubmission[]> => {
  if (assignmentIds.length === 0) {
    return [];
  }

  const results = await Promise.all(
    assignmentIds.map(assignmentId =>
      apiClient<ApiSubmission[]>(`/api/v1/assignments/${assignmentId}/submissions`, {
        auth: 'required',
      }),
    ),
  );

  return results.flat();
};

export const createSubmission = async (
  assignmentId: string,
  payload: CreateSubmissionRequest,
): Promise<ApiSubmission> => {
  return apiClient<ApiSubmission, CreateSubmissionRequest>(
    `/api/v1/assignments/${assignmentId}/submissions`,
    {
      auth: 'required',
      method: 'POST',
      body: payload,
    },
  );
};

export const fetchEnrollments = async (): Promise<ApiMeResponse> => {
  return apiClient<ApiMeResponse>('/api/v1/me', { auth: 'required' });
};

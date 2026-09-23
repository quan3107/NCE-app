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

// Detail opens must reach the server even when the assignment list is cached.
export const fetchAssignment = (courseId: string, assignmentId: string): Promise<ApiAssignment> =>
  apiClient<ApiAssignment>(`/api/v1/courses/${courseId}/assignments/${assignmentId}`, {
    auth: 'required',
  });

type CollectionPage<T> = { items: T[]; nextCursor: string | null };

async function fetchCollection<T>(path: string): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | null = null;

  do {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    const page: CollectionPage<T> = await apiClient<CollectionPage<T>>(`${path}${query}`, {
      auth: 'required',
    });
    items.push(...page.items);
    if (page.nextCursor === cursor && cursor !== null) {
      throw new Error('Collection pagination did not advance.');
    }
    cursor = page.nextCursor;
  } while (cursor);

  return items;
}

export const fetchAssignments = (): Promise<ApiAssignment[]> =>
  fetchCollection<ApiAssignment>('/api/v1/assignments/accessible');

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

export const fetchSubmissions = (): Promise<ApiSubmission[]> =>
  fetchCollection<ApiSubmission>('/api/v1/submissions/accessible');

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

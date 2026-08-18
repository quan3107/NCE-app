/**
 * Location: features/ai-feedback/api.ts
 * Purpose: Expose AI feedback API calls and React Query hooks.
 * Why: Keeps teacher review screens decoupled from transport details.
 */

import { useMutation, useQuery, type QueryClient } from '@tanstack/react-query';

import { ApiError, apiClient, type ApiClientOptions } from '@lib/apiClient';
import { queryClient } from '@lib/queryClient';
import type {
  WritingFeedbackApprovalRequest,
  WritingFeedbackBatchRequest,
  WritingFeedbackBatchResponse,
  WritingFeedbackHistoryResponse,
  WritingFeedbackRegenerateRequest,
  WritingFeedbackRejectRequest,
  WritingFeedbackResponse,
  WritingFeedbackReviewResponse,
} from './types';

const writingFeedbackKey = (submissionId: string) =>
  ['ai-feedback', 'writing', submissionId] as const;
const writingFeedbackHistoryKey = (submissionId: string) =>
  ['ai-feedback', 'writing', submissionId, 'drafts'] as const;
const assignmentWritingFeedbackBatchKey = (assignmentId: string) =>
  ['ai-feedback', 'writing', 'batch', assignmentId] as const;

const writingFeedbackStatuses = new Set<WritingFeedbackResponse['status']>([
  'queued',
  'running',
  'accepted',
  'review_required',
  'rejected',
  'failed',
  'approved',
  'finalized',
  'superseded',
]);
const writingFeedbackVisibilityModes = new Set<
  WritingFeedbackResponse['visibilityMode']
>(['teacher_reviewed', 'instant_student_visible', 'hidden']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isActiveDraft = (draft: WritingFeedbackResponse | null | undefined) =>
  draft?.status === 'queued' || draft?.status === 'running';

const isWritingFeedbackResponse = (
  value: unknown,
): value is WritingFeedbackResponse =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.status === 'string' &&
  writingFeedbackStatuses.has(value.status as WritingFeedbackResponse['status']) &&
  typeof value.visibilityMode === 'string' &&
  writingFeedbackVisibilityModes.has(
    value.visibilityMode as WritingFeedbackResponse['visibilityMode'],
  ) &&
  (value.pollingLocation === undefined ||
    typeof value.pollingLocation === 'string') &&
  (value.feedback === undefined || isRecord(value.feedback)) &&
  (value.failureCode === undefined || typeof value.failureCode === 'string') &&
  (value.failureMessage === undefined ||
    typeof value.failureMessage === 'string');

const getTerminalWritingFeedbackFromConflict = (
  error: unknown,
): WritingFeedbackResponse | null => {
  if (
    error instanceof ApiError &&
    error.status === 409 &&
    isWritingFeedbackResponse(error.details) &&
    !isActiveDraft(error.details)
  ) {
    return error.details;
  }

  return null;
};

const readWritingFeedback = async <TBody = unknown>(
  endpoint: string,
  options: ApiClientOptions<TBody>,
): Promise<WritingFeedbackResponse> => {
  try {
    return await apiClient<WritingFeedbackResponse, TBody>(endpoint, options);
  } catch (error) {
    const terminalResponse = getTerminalWritingFeedbackFromConflict(error);
    if (terminalResponse) {
      return terminalResponse;
    }
    throw error;
  }
};

export async function fetchWritingFeedbackStatus(
  submissionId: string,
): Promise<WritingFeedbackResponse | null> {
  try {
    return await readWritingFeedback(
      `/api/v1/submissions/${submissionId}/ai-feedback/writing`,
      { auth: 'required' },
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

async function fetchWritingFeedbackHistory(
  submissionId: string,
): Promise<WritingFeedbackReviewResponse[]> {
  const response = await apiClient<WritingFeedbackHistoryResponse>(
    `/api/v1/submissions/${submissionId}/ai-feedback/writing/drafts`,
    { auth: 'required' },
  );
  return response.drafts;
}

export async function requestWritingFeedback(
  submissionId: string,
): Promise<WritingFeedbackResponse> {
  return readWritingFeedback(
    `/api/v1/submissions/${submissionId}/ai-feedback/writing`,
    { auth: 'required', method: 'POST' },
  );
}

export async function requestAssignmentWritingFeedbackBatch({
  courseId,
  assignmentId,
  payload,
}: {
  courseId: string;
  assignmentId: string;
  payload: WritingFeedbackBatchRequest;
}): Promise<WritingFeedbackBatchResponse> {
  return apiClient<WritingFeedbackBatchResponse, WritingFeedbackBatchRequest>(
    `/api/v1/courses/${courseId}/assignments/${assignmentId}/ai-feedback/writing/batch`,
    {
      auth: 'required',
      method: 'POST',
      body: payload,
    },
  );
}

export async function regenerateWritingFeedback({
  submissionId,
  payload,
}: {
  submissionId: string;
  payload?: WritingFeedbackRegenerateRequest;
}): Promise<WritingFeedbackResponse> {
  return readWritingFeedback<WritingFeedbackRegenerateRequest>(
    `/api/v1/submissions/${submissionId}/ai-feedback/writing/regenerate`,
    {
      auth: 'required',
      method: 'POST',
      body: payload ?? {},
    },
  );
}

async function approveWritingFeedback({
  submissionId,
  draftId,
  payload,
}: {
  submissionId: string;
  draftId: string;
  payload: WritingFeedbackApprovalRequest;
}): Promise<WritingFeedbackReviewResponse> {
  return apiClient<WritingFeedbackReviewResponse, WritingFeedbackApprovalRequest>(
    `/api/v1/submissions/${submissionId}/ai-feedback/writing/drafts/${draftId}/approve`,
    {
      auth: 'required',
      method: 'POST',
      body: payload,
    },
  );
}

async function finalizeWritingFeedback({
  submissionId,
  draftId,
  payload,
}: {
  submissionId: string;
  draftId: string;
  payload: WritingFeedbackApprovalRequest;
}): Promise<WritingFeedbackReviewResponse> {
  return apiClient<WritingFeedbackReviewResponse, WritingFeedbackApprovalRequest>(
    `/api/v1/submissions/${submissionId}/ai-feedback/writing/drafts/${draftId}/finalize`,
    {
      auth: 'required',
      method: 'POST',
      body: payload,
    },
  );
}

async function rejectWritingFeedback({
  submissionId,
  draftId,
  payload,
}: {
  submissionId: string;
  draftId: string;
  payload?: WritingFeedbackRejectRequest;
}): Promise<WritingFeedbackReviewResponse> {
  return apiClient<WritingFeedbackReviewResponse, WritingFeedbackRejectRequest>(
    `/api/v1/submissions/${submissionId}/ai-feedback/writing/drafts/${draftId}/reject`,
    {
      auth: 'required',
      method: 'POST',
      body: payload ?? {},
    },
  );
}

function invalidateWritingFeedback(submissionId: string) {
  void queryClient.invalidateQueries({ queryKey: writingFeedbackKey(submissionId) });
  void queryClient.invalidateQueries({ queryKey: writingFeedbackHistoryKey(submissionId) });
  void queryClient.invalidateQueries({ queryKey: ['grades:list'] });
  void queryClient.invalidateQueries({ queryKey: ['assignments:submissions'] });
}

export function useWritingFeedbackStatusQuery(submissionId: string, enabled: boolean) {
  return useQuery({
    queryKey: writingFeedbackKey(submissionId),
    queryFn: () => fetchWritingFeedbackStatus(submissionId),
    enabled,
    refetchInterval: (query) => (isActiveDraft(query.state.data) ? 5000 : false),
  });
}

export function useWritingFeedbackHistoryQuery(submissionId: string, enabled: boolean) {
  return useQuery({
    queryKey: writingFeedbackHistoryKey(submissionId),
    queryFn: () => fetchWritingFeedbackHistory(submissionId),
    enabled,
  });
}

export function useRequestWritingFeedbackMutation(submissionId: string) {
  return useMutation({
    mutationFn: () => requestWritingFeedback(submissionId),
    onSuccess: () => invalidateWritingFeedback(submissionId),
  });
}

export function useRequestAssignmentWritingFeedbackBatchMutation({
  courseId,
  assignmentId,
}: {
  courseId: string;
  assignmentId: string;
}) {
  return useMutation({
    mutationKey: assignmentWritingFeedbackBatchKey(assignmentId),
    mutationFn: (payload: WritingFeedbackBatchRequest) =>
      requestAssignmentWritingFeedbackBatch({ courseId, assignmentId, payload }),
    onSuccess: () => invalidateAssignmentWritingFeedbackBatchQueries(),
  });
}

export function invalidateAssignmentWritingFeedbackBatchQueries(
  client: Pick<QueryClient, 'invalidateQueries'> = queryClient,
): void {
  void client.invalidateQueries({ queryKey: ['assignments:submissions'] });
  void client.invalidateQueries({
    queryKey: ['ai-feedback', 'writing'],
    exact: false,
  });
}

export function useRegenerateWritingFeedbackMutation(submissionId: string) {
  return useMutation({
    mutationFn: (payload?: WritingFeedbackRegenerateRequest) =>
      regenerateWritingFeedback({ submissionId, payload }),
    onSuccess: () => invalidateWritingFeedback(submissionId),
  });
}

export function useApproveWritingFeedbackMutation(submissionId: string) {
  return useMutation({
    mutationFn: ({
      draftId,
      payload,
    }: {
      draftId: string;
      payload: WritingFeedbackApprovalRequest;
    }) => approveWritingFeedback({ submissionId, draftId, payload }),
    onSuccess: () => invalidateWritingFeedback(submissionId),
  });
}

export function useFinalizeWritingFeedbackMutation(submissionId: string) {
  return useMutation({
    mutationFn: ({
      draftId,
      payload,
    }: {
      draftId: string;
      payload: WritingFeedbackApprovalRequest;
    }) => finalizeWritingFeedback({ submissionId, draftId, payload }),
    onSuccess: () => invalidateWritingFeedback(submissionId),
  });
}

export function useRejectWritingFeedbackMutation(submissionId: string) {
  return useMutation({
    mutationFn: ({
      draftId,
      payload,
    }: {
      draftId: string;
      payload?: WritingFeedbackRejectRequest;
    }) => rejectWritingFeedback({ submissionId, draftId, payload }),
    onSuccess: () => invalidateWritingFeedback(submissionId),
  });
}

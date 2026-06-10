/**
 * Location: features/ai-feedback/api.ts
 * Purpose: Expose AI feedback API calls and React Query hooks.
 * Why: Keeps teacher review screens decoupled from transport details.
 */

import { useMutation, useQuery } from '@tanstack/react-query';

import { ApiError, apiClient } from '@lib/apiClient';
import { queryClient } from '@lib/queryClient';
import type {
  WritingFeedbackApprovalRequest,
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

const isActiveDraft = (draft: WritingFeedbackResponse | null | undefined) =>
  draft?.status === 'queued' || draft?.status === 'running';

async function fetchWritingFeedbackStatus(
  submissionId: string,
): Promise<WritingFeedbackResponse | null> {
  try {
    return await apiClient<WritingFeedbackResponse>(
      `/api/v1/submissions/${submissionId}/ai-feedback/writing`,
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
  );
  return response.drafts;
}

async function requestWritingFeedback(submissionId: string): Promise<WritingFeedbackResponse> {
  return apiClient<WritingFeedbackResponse>(
    `/api/v1/submissions/${submissionId}/ai-feedback/writing`,
    { method: 'POST' },
  );
}

async function regenerateWritingFeedback({
  submissionId,
  payload,
}: {
  submissionId: string;
  payload?: WritingFeedbackRegenerateRequest;
}): Promise<WritingFeedbackResponse> {
  return apiClient<WritingFeedbackResponse, WritingFeedbackRegenerateRequest>(
    `/api/v1/submissions/${submissionId}/ai-feedback/writing/regenerate`,
    {
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

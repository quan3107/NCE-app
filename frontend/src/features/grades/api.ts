/**
 * Location: features/grades/api.ts
 * Purpose: Provide grade data hooks backed by React Query and the live API.
 * Why: Consolidates grade access paths ahead of richer grade UX.
 */

import { useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

import { ApiError, apiClient, type ApiClientOptions } from '@lib/apiClient';
import { useAuth } from '@lib/auth';
import type { Assignment, Grade, Submission } from '@domain';
import { queryClient } from '@lib/queryClient';

const GRADES_KEY = 'grades:list';

type ApiGrade = {
  id: string;
  submissionId: string;
  graderId?: string | null;
  rubricBreakdown?: Array<{ criterion: string; points: number }> | null;
  rawScore?: number | null;
  adjustments?: Array<{ reason: string; delta: number }> | null;
  finalScore?: number | null;
  band?: number | null;
  feedback?: string | null;
  provisionalOnly?: boolean;
  feedbackLabel?: Grade['feedbackLabel'];
  studentAiFeedback?: Grade['studentAiFeedback'];
  gradedAt?: string | null;
  graderName?: string | null;
};

export type ObjectiveExplanationStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'review_required'
  | 'rejected'
  | 'failed';

export type ObjectiveExplanationResponse = {
  id: string;
  status: ObjectiveExplanationStatus;
  cached: boolean;
  pollingLocation?: string;
  explanation?: Record<string, unknown>;
};

const objectiveExplanationStatuses = new Set<ObjectiveExplanationStatus>([
  'queued',
  'running',
  'completed',
  'review_required',
  'rejected',
  'failed',
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isActiveObjectiveExplanation = (
  explanation: ObjectiveExplanationResponse,
) => explanation.status === 'queued' || explanation.status === 'running';

const isObjectiveExplanationResponse = (
  value: unknown,
): value is ObjectiveExplanationResponse => {
  if (!isRecord(value)) {
    return false;
  }

  const explanation = value.explanation;

  return (
    typeof value.id === 'string' &&
    typeof value.status === 'string' &&
    objectiveExplanationStatuses.has(value.status as ObjectiveExplanationStatus) &&
    typeof value.cached === 'boolean' &&
    (value.pollingLocation === undefined || typeof value.pollingLocation === 'string') &&
    (explanation === undefined || isRecord(explanation))
  );
};

const getTerminalObjectiveExplanationFromConflict = (
  error: unknown,
): ObjectiveExplanationResponse | null => {
  if (
    error instanceof ApiError &&
    error.status === 409 &&
    isObjectiveExplanationResponse(error.details) &&
    !isActiveObjectiveExplanation(error.details)
  ) {
    return error.details;
  }

  return null;
};

type ObjectiveExplanationPollOptions = {
  intervalMs?: number;
  maxAttempts?: number;
  wait?: (intervalMs: number) => Promise<void>;
  fetcher?: (
    submissionId: string,
    questionId: string,
  ) => Promise<ObjectiveExplanationResponse>;
};

export class ObjectiveExplanationPollingTimeoutError extends Error {
  response: ObjectiveExplanationResponse;

  constructor(response: ObjectiveExplanationResponse) {
    super('Objective explanation is still running.');
    this.name = 'ObjectiveExplanationPollingTimeoutError';
    this.response = response;
  }
}

type UpsertGradeRequest = {
  rubricBreakdown?: Array<{ criterion: string; points: number }>;
  rawScore?: number;
  adjustments?: Array<{ reason: string; delta: number }>;
  finalScore?: number;
  band?: number;
  feedbackMd?: string;
};

export const toGrade = (
  grade: ApiGrade,
  submission: Submission,
  assignmentMap: Map<string, Assignment>,
): Grade => {
  const assignment = assignmentMap.get(submission.assignmentId);
  const rubricBreakdown = (grade.rubricBreakdown ?? []).map(item => ({
    criteria: item.criterion,
    points: item.points,
    maxPoints: item.points,
  }));
  const adjustments = (grade.adjustments ?? []).reduce(
    (total, item) => total + (item.delta ?? 0),
    0,
  );

  return {
    id: grade.id,
    submissionId: grade.submissionId,
    assignmentId: submission.assignmentId,
    studentId: submission.studentId,
    rubricBreakdown,
    rawScore: grade.rawScore ?? 0,
    adjustments,
    finalScore: grade.finalScore ?? grade.rawScore ?? 0,
    band: grade.band ?? undefined,
    maxScore: assignment?.maxScore ?? 100,
    feedback: grade.feedback ?? '',
    provisionalOnly: grade.provisionalOnly,
    feedbackLabel: grade.feedbackLabel ?? 'teacher feedback',
    studentAiFeedback: grade.studentAiFeedback,
    gradedAt: grade.gradedAt ? new Date(grade.gradedAt) : undefined,
    gradedBy: grade.graderName ?? grade.graderId ?? undefined,
  };
};

const fetchGrades = async (
  submissions: Submission[],
  assignmentMap: Map<string, Assignment>,
): Promise<Grade[]> => {
  if (submissions.length === 0) {
    return [];
  }

  const results = await Promise.all(
    submissions.map(async submission => {
      try {
        const grade = await apiClient<ApiGrade>(
          `/api/v1/submissions/${submission.id}/grade`,
        );
        return toGrade(grade, submission, assignmentMap);
      } catch (error) {
        // Missing grades are expected for ungraded submissions; skip them instead of failing the query.
        if (error instanceof ApiError && error.status === 404) {
          return null;
        }
        throw error;
      }
    }),
  );

  return results.filter((value): value is Grade => value !== null);
};

const upsertGrade = async (
  submissionId: string,
  payload: UpsertGradeRequest,
): Promise<ApiGrade> => {
  return apiClient<ApiGrade, UpsertGradeRequest>(
    `/api/v1/submissions/${submissionId}/grade`,
    {
      method: 'PUT',
      body: payload,
    },
  );
};

const objectiveExplanationEndpoint = (submissionId: string, questionId: string) =>
  `/api/v1/submissions/${encodeURIComponent(submissionId)}/questions/${encodeURIComponent(questionId)}/ai-explanation`;

const readObjectiveExplanation = async (
  endpoint: string,
  options: ApiClientOptions = {},
): Promise<ObjectiveExplanationResponse> => {
  try {
    return await apiClient<ObjectiveExplanationResponse>(endpoint, options);
  } catch (error) {
    const terminalResponse = getTerminalObjectiveExplanationFromConflict(error);

    if (terminalResponse) {
      return terminalResponse;
    }

    throw error;
  }
};

export const requestObjectiveExplanation = (
  submissionId: string,
  questionId: string,
): Promise<ObjectiveExplanationResponse> =>
  readObjectiveExplanation(objectiveExplanationEndpoint(submissionId, questionId), {
    method: 'POST',
  });

export const fetchObjectiveExplanation = (
  submissionId: string,
  questionId: string,
): Promise<ObjectiveExplanationResponse> =>
  readObjectiveExplanation(objectiveExplanationEndpoint(submissionId, questionId));

const waitFor = (intervalMs: number) =>
  new Promise<void>(resolve => {
    window.setTimeout(resolve, intervalMs);
  });

export async function pollObjectiveExplanationUntilSettled(
  submissionId: string,
  questionId: string,
  initial: ObjectiveExplanationResponse,
  options: ObjectiveExplanationPollOptions = {},
): Promise<ObjectiveExplanationResponse> {
  const intervalMs = options.intervalMs ?? 5000;
  const maxAttempts = options.maxAttempts ?? 24;
  const wait = options.wait ?? waitFor;
  const fetcher = options.fetcher ?? fetchObjectiveExplanation;
  let current = initial;

  for (let attempt = 0; attempt < maxAttempts && isActiveObjectiveExplanation(current); attempt += 1) {
    await wait(intervalMs);
    current = await fetcher(submissionId, questionId);
  }

  if (isActiveObjectiveExplanation(current)) {
    throw new ObjectiveExplanationPollingTimeoutError(current);
  }

  return current;
}

export function useGradesQuery(submissions: Submission[], assignments: Assignment[]) {
  const { currentUser } = useAuth();
  const assignmentMap = useMemo(
    () => new Map(assignments.map(assignment => [assignment.id, assignment])),
    [assignments],
  );

  const submissionIds = useMemo(
    () => submissions.map(submission => submission.id),
    [submissions],
  );
  const canViewGrades =
    currentUser.role === 'admin' ||
    currentUser.role === 'teacher' ||
    currentUser.role === 'student';

  return useQuery({
    queryKey: [GRADES_KEY, currentUser.id, currentUser.role, ...submissionIds],
    queryFn: () => fetchGrades(submissions, assignmentMap),
    enabled: canViewGrades && submissionIds.length > 0,
  });
}

export function useUpsertGradeMutation() {
  return useMutation({
    mutationFn: ({
      submissionId,
      payload,
    }: {
      submissionId: string;
      payload: UpsertGradeRequest;
    }) => upsertGrade(submissionId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [GRADES_KEY] });
    },
  });
}

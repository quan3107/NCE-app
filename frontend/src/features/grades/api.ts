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

type ApiNumericValue = number | string;

type ApiGrade = {
  id: string;
  submissionId: string;
  graderId?: string | null;
  rubricBreakdown?: Array<{
    criterion: string;
    points: ApiNumericValue;
  }> | null;
  rawScore?: ApiNumericValue | null;
  adjustments?: Array<{ reason: string; delta: number }> | null;
  finalScore?: ApiNumericValue | null;
  band?: ApiNumericValue | null;
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

const IELTS_BAND_ASSIGNMENT_TYPES = new Set<Assignment['type']>([
  'writing',
  'speaking',
]);
const IELTS_BAND_MAX = 9;

const isIeltsBandAssignment = (assignment: Assignment | undefined): boolean =>
  assignment ? IELTS_BAND_ASSIGNMENT_TYPES.has(assignment.type) : false;

const toFiniteNumber = (
  value: ApiNumericValue | null | undefined,
): number | undefined => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const numericValue = Number(value);

    return Number.isFinite(numericValue) ? numericValue : undefined;
  }

  return undefined;
};

const toHalfBand = (value: number): number =>
  Math.round(Math.min(IELTS_BAND_MAX, Math.max(0, value)) * 2) / 2;

const resolveGradeBand = (
  grade: ApiGrade,
  assignment: Assignment | undefined,
): number | undefined => {
  if (!isIeltsBandAssignment(assignment)) {
    return toFiniteNumber(grade.band);
  }

  const candidate =
    toFiniteNumber(grade.band) ??
    toFiniteNumber(grade.finalScore) ??
    toFiniteNumber(grade.rawScore);

  return typeof candidate === 'number' ? toHalfBand(candidate) : undefined;
};

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
    objectiveExplanationStatuses.has(
      value.status as ObjectiveExplanationStatus,
    ) &&
    typeof value.cached === 'boolean' &&
    (value.pollingLocation === undefined ||
      typeof value.pollingLocation === 'string') &&
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
  const isIeltsBand = isIeltsBandAssignment(assignment);
  const resolvedBand = resolveGradeBand(grade, assignment);
  const maxScore = isIeltsBand ? IELTS_BAND_MAX : (assignment?.maxScore ?? 100);
  const rawScoreValue = toFiniteNumber(grade.rawScore);
  const rawScore = rawScoreValue ?? 0;
  const finalScore =
    toFiniteNumber(grade.finalScore) ?? rawScoreValue ?? resolvedBand ?? 0;
  const rubricBreakdown = (grade.rubricBreakdown ?? []).map((item) => {
    const points = toFiniteNumber(item.points) ?? 0;

    return {
      criteria: item.criterion,
      points,
      maxPoints: isIeltsBand ? IELTS_BAND_MAX : points,
      scale: isIeltsBand ? ('ielts_band' as const) : ('points' as const),
    };
  });
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
    rawScore,
    adjustments,
    finalScore,
    band: resolvedBand,
    maxScore,
    scoreDisplay: isIeltsBand
      ? {
          kind: 'ielts_band',
          value: resolvedBand ?? finalScore,
          max: IELTS_BAND_MAX,
        }
      : { kind: 'points', value: finalScore, max: maxScore },
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
    submissions.map(async (submission) => {
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

const objectiveExplanationEndpoint = (
  submissionId: string,
  questionId: string,
) =>
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
  readObjectiveExplanation(
    objectiveExplanationEndpoint(submissionId, questionId),
    {
      method: 'POST',
    },
  );

export const fetchObjectiveExplanation = (
  submissionId: string,
  questionId: string,
): Promise<ObjectiveExplanationResponse> =>
  readObjectiveExplanation(
    objectiveExplanationEndpoint(submissionId, questionId),
  );

const waitFor = (intervalMs: number) =>
  new Promise<void>((resolve) => {
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

  for (
    let attempt = 0;
    attempt < maxAttempts && isActiveObjectiveExplanation(current);
    attempt += 1
  ) {
    await wait(intervalMs);
    current = await fetcher(submissionId, questionId);
  }

  if (isActiveObjectiveExplanation(current)) {
    throw new ObjectiveExplanationPollingTimeoutError(current);
  }

  return current;
}

export function useGradesQuery(
  submissions: Submission[],
  assignments: Assignment[],
) {
  const { currentUser } = useAuth();
  const assignmentMap = useMemo(
    () => new Map(assignments.map((assignment) => [assignment.id, assignment])),
    [assignments],
  );

  const submissionIds = useMemo(
    () => submissions.map((submission) => submission.id),
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

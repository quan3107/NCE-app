/**
 * Location: features/grades/api.ts
 * Purpose: Provide grade data hooks backed by React Query and the live API.
 * Why: Consolidates grade access paths ahead of richer grade UX.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { ApiError, apiClient } from '@lib/apiClient';
import { useAuth } from '@lib/auth';
import { Assignment, Grade, Submission } from '@lib/mock-data';

const GRADES_KEY = 'grades:list';

type ApiGrade = {
  id: string;
  submissionId: string;
  graderId: string;
  rubricBreakdown?: Array<{ criterion: string; points: number }> | null;
  rawScore?: number | null;
  adjustments?: Array<{ reason: string; delta: number }> | null;
  finalScore?: number | null;
  feedback?: string | null;
  gradedAt?: string | null;
};

const toGrade = (
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
    maxScore: assignment?.maxScore ?? 100,
    feedback: grade.feedback ?? '',
    gradedAt: grade.gradedAt ? new Date(grade.gradedAt) : new Date(),
    gradedBy: grade.graderId,
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
  const canViewGrades = currentUser.role === 'admin' || currentUser.role === 'teacher';

  return useQuery({
    queryKey: [GRADES_KEY, ...submissionIds],
    queryFn: () => fetchGrades(submissions, assignmentMap),
    enabled: canViewGrades && submissionIds.length > 0,
  });
}

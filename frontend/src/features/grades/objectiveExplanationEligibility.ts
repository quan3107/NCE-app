/**
 * Location: features/grades/objectiveExplanationEligibility.ts
 * Purpose: Derive objective explanation actions backed by submitted answers.
 * Why: File-only legacy submissions cannot produce deterministic question evidence.
 */
import { getStudentIeltsAnswerTargets } from '@features/assignments/components/ielts/student/studentIeltsAnswerTargets';
import {
  isIeltsAssignmentType,
  normalizeIeltsAssignmentConfig,
  type IeltsListeningConfig,
  type IeltsReadingConfig,
} from '@lib/ielts';
import type { Assignment, Submission } from '@domain';

const submittedQuestionIds = (payload: unknown): Set<string> => {
  if (!payload || typeof payload !== 'object') {
    return new Set();
  }

  const answers = (payload as Record<string, unknown>).answers;
  if (!Array.isArray(answers)) {
    return new Set();
  }

  return new Set(
    answers.flatMap((answer) => {
      if (!answer || typeof answer !== 'object') {
        return [];
      }
      const questionId = (answer as Record<string, unknown>).questionId;
      return typeof questionId === 'string' && questionId.trim()
        ? [questionId]
        : [];
    }),
  );
};

export const getEligibleObjectiveExplanationTargets = (
  assignment: Assignment,
  submission: Submission,
) => {
  if (
    !isIeltsAssignmentType(assignment.type) ||
    (assignment.type !== 'reading' && assignment.type !== 'listening')
  ) {
    return [];
  }

  const config = normalizeIeltsAssignmentConfig(
    assignment.type,
    assignment.assignmentConfig,
  );
  if (config.aiPolicy.objectiveExplanations !== 'on_demand_student_visible') {
    return [];
  }

  const answeredIds = submittedQuestionIds(submission.rawPayload);
  if (answeredIds.size === 0) {
    return [];
  }

  return getStudentIeltsAnswerTargets(
    config as IeltsReadingConfig | IeltsListeningConfig,
  ).filter((target) => answeredIds.has(target.id));
};

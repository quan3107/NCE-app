/**
 * File: src/modules/scoring/ieltsScoring.service.ts
 * Purpose: Auto-score IELTS reading/listening submissions and persist grades.
 * Why: Provides deterministic scoring for objective sections without manual grading.
 */
import { prisma } from "../../prisma/client.js";
import { upsertGrade } from "../grades/grades.service.js";
import {
  AUTO_SCORE_TYPES,
  scoreIeltsSubmission,
} from "./ieltsScoring.utils.js";

export async function autoScoreSubmission(
  submissionId: string,
) {
  const existingGrade = await prisma.grade.findUnique({
    where: { submissionId },
  });
  if (existingGrade) {
    return existingGrade;
  }

  const submission = await prisma.submission.findFirst({
    where: { id: submissionId, deletedAt: null },
    select: {
      id: true,
      status: true,
      payload: true,
      assignment: {
        select: {
          type: true,
          assignmentConfig: true,
          course: { select: { ownerId: true } },
        },
      },
    },
  });

  if (!submission) {
    return null;
  }

  const assignmentType = submission.assignment.type;
  if (!AUTO_SCORE_TYPES.has(assignmentType)) {
    return null;
  }

  if (submission.status !== "submitted" && submission.status !== "late") {
    return null;
  }

  if (!submission.assignment.assignmentConfig) {
    return null;
  }

  const score = scoreIeltsSubmission({
    assignmentType,
    assignmentConfig: submission.assignment.assignmentConfig,
    submissionPayload: submission.payload,
  });

  if (!score) {
    return null;
  }

  return upsertGrade(
    { submissionId },
    {
      graderId: submission.assignment.course.ownerId,
      rawScore: score.rawScore,
      finalScore: score.finalScore,
      band: score.band,
    },
  );
}

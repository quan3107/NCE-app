/**
 * File: src/modules/ai-feedback/ai-feedback.repository.integrity.ts
 * Purpose: Keep AI feedback repository integrity checks reusable and focused.
 * Why: Submission/assignment matching and cache races protect AI records from drift.
 */
import { prisma } from "../../prisma/client.js";
import { Prisma } from "../../prisma/index.js";
import {
  createHttpError,
  createNotFoundError,
} from "../../utils/httpError.js";

type SubmissionAssignment = {
  id: string;
  assignmentId: string;
};

export function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError ||
    (error instanceof Error && "code" in error)
  ) && (error as { code?: unknown }).code === "P2002";
}

export async function getActiveSubmissionAssignment(
  submissionId: string,
): Promise<SubmissionAssignment> {
  const submission = await prisma.submission.findFirst({
    where: {
      id: submissionId,
      deletedAt: null,
      assignment: {
        deletedAt: null,
      },
    },
    select: {
      id: true,
      assignmentId: true,
    },
  });

  if (!submission) {
    throw createNotFoundError("Submission", submissionId);
  }

  return submission;
}

export function assertSubmissionAssignmentMatches(
  submission: SubmissionAssignment,
  assignmentId: string,
): void {
  if (submission.assignmentId !== assignmentId) {
    throw createHttpError(
      409,
      "Assignment does not match the submission.",
      {
        submissionId: submission.id,
        assignmentId,
      },
    );
  }
}

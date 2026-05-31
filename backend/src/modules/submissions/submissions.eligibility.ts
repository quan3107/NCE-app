/**
 * File: src/modules/submissions/submissions.eligibility.ts
 * Purpose: Enforce assignment availability, enrollment, and late-policy rules.
 * Why: Keeps submission persistence separate from course and deadline eligibility.
 */
import { prisma } from "../../prisma/client.js";
import { createHttpError } from "../../utils/httpError.js";
import type { SubmissionStatus } from "./submissions.timing.js";

export type SubmissionEligibilityErrorCode =
  | "submission_unpublished"
  | "submission_unenrolled"
  | "submission_closed"
  | "submission_late_disallowed"
  | "submission_graded"
  | "submission_invalid_draft_transition";

type AssignmentEligibilityFields = {
  courseId: string;
  dueAt: Date | null;
  latePolicy: unknown;
  publishedAt: Date | null;
};

function createSubmissionEligibilityError(
  statusCode: number,
  message: string,
  code: SubmissionEligibilityErrorCode,
) {
  return createHttpError(statusCode, message, { code });
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function readPolicyType(latePolicy: unknown): string | undefined {
  const policyRecord = asRecord(latePolicy);
  return typeof policyRecord?.type === "string" ? policyRecord.type : undefined;
}

function isLateAllowed(latePolicy: unknown): boolean {
  const type = readPolicyType(latePolicy);
  return (
    type === "percent" ||
    type === "percent_penalty" ||
    type === "per_day" ||
    type === "per_day_penalty"
  );
}

function isClosedPolicy(latePolicy: unknown): boolean {
  const type = readPolicyType(latePolicy);
  return type === "closed" || type === "none" || type === "no_late";
}

export function assertAssignmentPublishedForSubmission(
  assignment: AssignmentEligibilityFields,
) {
  if (!assignment.publishedAt) {
    throw createSubmissionEligibilityError(
      403,
      "This assignment is not open for submissions.",
      "submission_unpublished",
    );
  }
}

export async function assertStudentEnrolledForSubmission(
  assignment: AssignmentEligibilityFields,
  studentId: string,
) {
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      courseId: assignment.courseId,
      userId: studentId,
      roleInCourse: "student",
      deletedAt: null,
    },
    select: { id: true },
  });

  if (!enrollment) {
    throw createSubmissionEligibilityError(
      403,
      "You must be enrolled in this course to submit work.",
      "submission_unenrolled",
    );
  }
}

export function applyAssignmentSubmissionPolicy(input: {
  assignment: AssignmentEligibilityFields;
  status: SubmissionStatus;
  submittedAt: Date | undefined;
  now?: Date;
}): { status: SubmissionStatus; submittedAt: Date | undefined } {
  const dueAt = input.assignment.dueAt;
  const now = input.now ?? new Date();

  if (input.status === "draft") {
    if (input.submittedAt || (dueAt && now.getTime() > dueAt.getTime())) {
      throw createSubmissionEligibilityError(
        409,
        "Draft submissions cannot be saved after the due date.",
        "submission_invalid_draft_transition",
      );
    }
    return { status: "draft", submittedAt: undefined };
  }

  const effectiveSubmittedAt = input.submittedAt ?? now;
  if (!dueAt || effectiveSubmittedAt.getTime() <= dueAt.getTime()) {
    return { status: "submitted", submittedAt: effectiveSubmittedAt };
  }

  if (isLateAllowed(input.assignment.latePolicy)) {
    return { status: "late", submittedAt: effectiveSubmittedAt };
  }

  if (isClosedPolicy(input.assignment.latePolicy)) {
    throw createSubmissionEligibilityError(
      409,
      "This assignment is closed for late submissions.",
      "submission_closed",
    );
  }

  throw createSubmissionEligibilityError(
    409,
    "Late submissions are not allowed for this assignment.",
    "submission_late_disallowed",
  );
}

export function assertExistingSubmissionCanTransition(input: {
  existingStatus: string;
  nextStatus: SubmissionStatus;
}) {
  if (input.existingStatus === "graded") {
    throw createSubmissionEligibilityError(
      409,
      "This submission has already been graded and cannot be resubmitted.",
      "submission_graded",
    );
  }

  if (input.nextStatus === "draft" && input.existingStatus !== "draft") {
    throw createSubmissionEligibilityError(
      409,
      "Submitted work cannot be changed back to draft.",
      "submission_invalid_draft_transition",
    );
  }
}

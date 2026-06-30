/**
 * File: src/modules/grades/grades.service.ts
 * Purpose: Implement grading persistence and retrieval via Prisma.
 * Why: Keeps scoring routines decoupled from controllers.
 */
import {
  AssignmentType,
  EnrollmentRole,
  NotificationChannel,
  Prisma,
  UserRole,
} from "../../prisma/index.js";

import { prisma } from "../../prisma/client.js";
import {
  createHttpError,
  createNotFoundError,
} from "../../utils/httpError.js";
import { enqueueNotification } from "../notifications/notifications.service.js";
import { writeAuditLogSafely } from "../audit-logs/audit-logs.service.js";
import { getStudentVisibleAiFeedbackDraft } from "../ai-feedback/ai-feedback.repository.js";
import {
  calculateIeltsManualBand,
  isIeltsManualAssignment,
  validateIeltsCriterionBreakdown,
  type IeltsCriterionScore,
} from "../scoring/ieltsManualGrading.js";
import {
  gradePayloadSchema,
  submissionScopedParamsSchema,
} from "./grades.schema.js";

type GradingActor = {
  id: string;
  role: UserRole;
};

type SubmissionForGrading = {
  assignment: {
    type: AssignmentType;
    course: {
      ownerId: string;
      enrollments: Array<{
        userId: string;
        roleInCourse: EnrollmentRole;
        deletedAt: Date | null;
      }>;
    } | null;
  };
};

type StudentAiFeedbackDraft = Awaited<
  ReturnType<typeof getStudentVisibleAiFeedbackDraft>
>;

const learnerFacingFeedbackKeys = new Set([
  "feedbackMd",
  "feedback",
  "content",
  "summary",
  "band_estimate",
  "rationale",
  "strengths",
  "improvement_areas",
  "next_steps",
]);

function buildGradeReadWhere(
  submissionId: string,
  actor: GradingActor | undefined,
): Prisma.GradeWhereInput {
  if (!actor) {
    throw createHttpError(401, "Authentication is required to view grades.");
  }

  const activeSubmission = {
    deletedAt: null,
    assignment: {
      deletedAt: null,
      course: {
        deletedAt: null,
      },
    },
  };

  if (actor.role === UserRole.admin) {
    return {
      submissionId,
      deletedAt: null,
      submission: activeSubmission,
    };
  }

  if (actor.role === UserRole.student) {
    return {
      submissionId,
      deletedAt: null,
      submission: {
        ...activeSubmission,
        studentId: actor.id,
      },
    };
  }

  if (actor.role === UserRole.teacher) {
    return {
      submissionId,
      deletedAt: null,
      submission: {
        deletedAt: null,
        assignment: {
          deletedAt: null,
          course: {
            deletedAt: null,
            OR: [
              { ownerId: actor.id },
              {
                enrollments: {
                  some: {
                    userId: actor.id,
                    roleInCourse: EnrollmentRole.teacher,
                    deletedAt: null,
                  },
                },
              },
            ],
          },
        },
      },
    };
  }

  throw createHttpError(403, "You do not have permission to view this grade.");
}

function assertCanGradeSubmission(
  submission: SubmissionForGrading,
  actor: GradingActor | undefined,
): asserts actor is GradingActor {
  if (!actor) {
    throw createHttpError(401, "Authentication is required to grade.");
  }

  if (actor.role === UserRole.admin) {
    return;
  }

  if (actor.role !== UserRole.teacher) {
    throw createHttpError(403, "Only teachers and admins can grade.");
  }

  const course = submission.assignment.course;
  const teachesCourse =
    course?.ownerId === actor.id ||
    course?.enrollments.some(
      (enrollment) =>
        enrollment.userId === actor.id &&
        enrollment.roleInCourse === EnrollmentRole.teacher &&
        enrollment.deletedAt === null,
    );

  if (!teachesCourse) {
    throw createHttpError(
      403,
      "You do not have permission to grade this submission.",
    );
  }
}

type GradePayload = ReturnType<typeof gradePayloadSchema.parse>;

function normalizeGradePayload(
  assignmentType: AssignmentType,
  data: GradePayload,
): GradePayload {
  if (!isIeltsManualAssignment(assignmentType)) {
    return data;
  }

  if (!data.rubricBreakdown || data.rubricBreakdown.length === 0) {
    throw createHttpError(
      400,
      "IELTS writing and speaking grades require criterion breakdowns.",
    );
  }

  try {
    validateIeltsCriterionBreakdown(
      assignmentType,
      data.rubricBreakdown as IeltsCriterionScore[],
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid IELTS grade breakdown.";
    throw createHttpError(400, message);
  }

  const band = calculateIeltsManualBand(
    data.rubricBreakdown as IeltsCriterionScore[],
  );
  return {
    ...data,
    rawScore: band,
    finalScore: band,
    band,
  };
}

function sanitizeLearnerFeedback(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const sanitized = Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(([key]) =>
      learnerFacingFeedbackKeys.has(key),
    ),
  );

  return Object.keys(sanitized).length > 0 ? sanitized : null;
}

function toStudentAiFeedback(draft: StudentAiFeedbackDraft) {
  if (!draft || draft.status !== "accepted") {
    return undefined;
  }

  const feedback = sanitizeLearnerFeedback(draft.generatedFeedback);
  if (!feedback) {
    return undefined;
  }

  return {
    label: "provisional AI feedback",
    status: draft.status,
    feedback,
  };
}

function toProvisionalOnlyGrade(
  draft: StudentAiFeedbackDraft,
  submissionId: string,
) {
  if (!draft) {
    return undefined;
  }

  const studentAiFeedback = toStudentAiFeedback(draft);

  if (!studentAiFeedback) {
    return undefined;
  }

  return {
    id: draft.id,
    submissionId,
    feedback: null,
    feedbackLabel: "teacher feedback",
    provisionalOnly: true,
    studentAiFeedback,
  };
}

async function writeGradeAuditLog(input: {
  actorId: string;
  entityId: string;
  submissionId: string;
  graderId: string;
  rawScore?: number | null;
  finalScore?: number | null;
  band?: number | null;
  feedbackMd?: string;
}) {
  await writeAuditLogSafely({
    actorId: input.actorId,
    action: "grade.upserted",
    entity: "grade",
    entityId: input.entityId,
    diff: {
      submissionId: input.submissionId,
      graderId: input.graderId,
      rawScore: input.rawScore,
      finalScore: input.finalScore,
      band: input.band,
      feedbackMd: input.feedbackMd,
    },
  });
}

function feedbackLabelForGrade(grade: {
  aiFeedbackDrafts?: Array<{
    status: string;
    visibilityMode: string;
  }>;
}): "teacher feedback" | "teacher-reviewed AI-assisted feedback" {
  const aiAssisted = grade.aiFeedbackDrafts?.some(
    (draft) =>
      (draft.status === "approved" || draft.status === "finalized") &&
      (draft.visibilityMode === "teacher_reviewed" ||
        draft.visibilityMode === "instant_student_visible"),
  );

  return aiAssisted
    ? "teacher-reviewed AI-assisted feedback"
    : "teacher feedback";
}

export async function upsertGrade(
  params: unknown,
  payload: unknown,
  actor?: GradingActor,
) {
  const { submissionId } = submissionScopedParamsSchema.parse(params);
  const data = gradePayloadSchema.parse(payload);
  const submission = await prisma.submission.findFirst({
    where: {
      id: submissionId,
      deletedAt: null,
      assignment: {
        deletedAt: null,
        course: {
          deletedAt: null,
        },
      },
    },
    include: {
      assignment: {
        select: {
          id: true,
          title: true,
          type: true,
          courseId: true,
          course: {
            select: {
              title: true,
              ownerId: true,
              enrollments: {
                where: actor
                  ? {
                      userId: actor.id,
                      roleInCourse: EnrollmentRole.teacher,
                      deletedAt: null,
                    }
                  : undefined,
                select: {
                  userId: true,
                  roleInCourse: true,
                  deletedAt: true,
                },
              },
            },
          },
        },
      },
      student: {
        select: {
          id: true,
        },
      },
    },
  });
  if (!submission) {
    throw createNotFoundError("Submission", submissionId);
  }
  assertCanGradeSubmission(submission, actor);
  const normalizedData = normalizeGradePayload(submission.assignment.type, data);

  // Cast arrays to Prisma JSON inputs because Zod cannot enforce JsonValue types.
  const rubricBreakdown = normalizedData.rubricBreakdown
    ? (normalizedData.rubricBreakdown as Prisma.InputJsonArray)
    : undefined;
  const adjustments = normalizedData.adjustments
    ? (normalizedData.adjustments as Prisma.InputJsonArray)
    : undefined;

  const gradedAt = new Date();
  const [grade] = await prisma.$transaction([
    prisma.grade.upsert({
      where: { submissionId },
      create: {
        submissionId,
        graderId: actor.id,
        rubricBreakdown,
        rawScore: normalizedData.rawScore,
        adjustments,
        finalScore: normalizedData.finalScore,
        band: normalizedData.band,
        feedback: normalizedData.feedbackMd,
        gradedAt,
      },
      update: {
        graderId: actor.id,
        rubricBreakdown,
        rawScore: normalizedData.rawScore,
        adjustments,
        finalScore: normalizedData.finalScore,
        band: normalizedData.band,
        feedback: normalizedData.feedbackMd,
        gradedAt,
      },
    }),
    // Keep grading + submission status update atomic for queue accuracy.
    prisma.submission.update({
      where: { id: submissionId },
      data: { status: "graded" },
    }),
  ]);
  await writeGradeAuditLog({
    actorId: actor.id,
    entityId: grade.id ?? submissionId,
    submissionId,
    graderId: actor.id,
    rawScore: normalizedData.rawScore,
    finalScore: normalizedData.finalScore,
    band: normalizedData.band,
    feedbackMd: normalizedData.feedbackMd,
  });

  const channels: NotificationChannel[] = ["inapp", "email"];
  const payloadJson: Prisma.InputJsonObject = {
    submissionId,
    assignmentId: submission.assignment.id,
    assignmentTitle: submission.assignment.title,
    courseId: submission.assignment.courseId,
    courseTitle: submission.assignment.course?.title ?? "",
    gradedAt: new Date().toISOString(),
  };

  await enqueueNotification({
    userId: submission.student.id,
    type: "graded",
    payload: payloadJson,
    channels,
  });

  return grade;
}

export async function getGrade(params: unknown, actor?: GradingActor) {
  const { submissionId } = submissionScopedParamsSchema.parse(params);
  const grade = await prisma.grade.findFirst({
    where: buildGradeReadWhere(submissionId, actor),
    include: {
      grader: {
        select: {
          fullName: true,
        },
      },
      aiFeedbackDrafts: {
        where: {
          deletedAt: null,
          status: {
            in: ["approved", "finalized"],
          },
          visibilityMode: {
            in: ["teacher_reviewed", "instant_student_visible"],
          },
        },
        select: {
          id: true,
          status: true,
          visibilityMode: true,
        },
        orderBy: [{ decidedAt: "desc" }, { createdAt: "desc" }],
        take: 1,
      },
    },
  });
  if (!grade) {
    if (actor?.role === UserRole.student) {
      const provisionalGrade = toProvisionalOnlyGrade(
        await getStudentVisibleAiFeedbackDraft({
          submissionId,
          studentId: actor.id,
        }),
        submissionId,
      );

      if (provisionalGrade) {
        return provisionalGrade;
      }
    }

    throw createNotFoundError("Grade", submissionId);
  }
  const studentAiFeedback =
    actor?.role === UserRole.student
      ? toStudentAiFeedback(
          await getStudentVisibleAiFeedbackDraft({
            submissionId,
            studentId: actor.id,
          }),
        )
      : undefined;
  const { grader, aiFeedbackDrafts, ...gradePayload } = grade;
  return {
    ...gradePayload,
    graderName: grader.fullName,
    feedbackLabel: feedbackLabelForGrade({ aiFeedbackDrafts }),
    ...(studentAiFeedback ? { studentAiFeedback } : {}),
  };
}

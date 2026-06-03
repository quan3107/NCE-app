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
    },
  });
  if (!grade) {
    throw createNotFoundError("Grade", submissionId);
  }
  const { grader, ...gradePayload } = grade;
  return {
    ...gradePayload,
    graderName: grader.fullName,
  };
}

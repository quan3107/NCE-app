/**
 * File: src/modules/assignments/assignments.service.ts
 * Purpose: Implement assignment data access and validation via Prisma.
 * Why: Keeps assignment-specific operations encapsulated away from controllers.
 */
import { Prisma, UserRole } from "../../prisma/generated/client/client.js";

import { prisma } from "../../prisma/client.js";
import {
  createHttpError,
  createNotFoundError,
} from "../../utils/httpError.js";
import {
  assignmentIdParamsSchema,
  courseScopedParamsSchema,
  type CreateAssignmentPayload,
  type UpdateAssignmentPayload,
} from "./assignments.schema.js";
import { parseAssignmentConfigForType } from "./ielts.schema.js";

function parseOptionalDate(
  value: string | undefined,
  fieldName: string,
): Date | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw createHttpError(400, `${fieldName} must be an ISO date string.`);
  }
  return parsed;
}

/**
 * Validate that rubricIds in writing assignment config exist and belong to the course
 */
async function validateWritingRubrics(
  config: unknown,
  courseId: string,
): Promise<void> {
  if (!config || typeof config !== 'object') {
    return;
  }

  const configRecord = config as Record<string, unknown>;
  const task1 = configRecord.task1 as Record<string, unknown> | undefined;
  const task2 = configRecord.task2 as Record<string, unknown> | undefined;

  const rubricIds: string[] = [];

  if (task1?.rubricId && typeof task1.rubricId === 'string') {
    rubricIds.push(task1.rubricId);
  }
  if (task2?.rubricId && typeof task2.rubricId === 'string') {
    rubricIds.push(task2.rubricId);
  }

  if (rubricIds.length === 0) {
    return;
  }

  // Check that all rubrics exist and belong to the course
  const rubrics = await prisma.rubric.findMany({
    where: {
      id: { in: rubricIds },
      courseId,
      deletedAt: null,
    },
    select: { id: true },
  });

  if (rubrics.length !== rubricIds.length) {
    throw createHttpError(
      400,
      "One or more selected rubrics are invalid or do not belong to this course",
    );
  }
}

export async function listAssignments(params: unknown) {
  const { courseId } = courseScopedParamsSchema.parse(params);
  return prisma.assignment.findMany({
    where: { courseId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Get count of pending assignments for a student.
 * Pending = published, not submitted, not past due date.
 */
export async function getPendingAssignmentsCount(studentId: string): Promise<number> {
  const now = new Date();

  const count = await prisma.assignment.count({
    where: {
      deletedAt: null,
      publishedAt: { not: null },
      dueAt: { gt: now },
      course: {
        enrollments: {
          some: {
            userId: studentId,
            deletedAt: null,
          },
        },
      },
      submissions: {
        none: {
          studentId,
          deletedAt: null,
        },
      },
    },
  });

  return count;
}

type AssignmentWithSubmissions = {
  type: string;
  id: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  title: string;
  description: string | null;
  courseId: string;
  dueAt: Date | null;
  latePolicy: unknown;
  assignmentConfig: unknown;
  publishedAt: Date | null;
  submissions?: Array<{
    id: string;
    status: string;
    grade?: {
      gradedAt: Date | null;
    } | null;
  }>;
};

export async function getAssignment(
  params: unknown,
  user?: { id: string; role: string }
) {
  const { assignmentId } = assignmentIdParamsSchema.parse(params);

  // For students, include their submission and grade info to check visibility
  const includeSubmissions = user?.role === UserRole.student;

  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, deletedAt: null },
    include: includeSubmissions
      ? {
          submissions: {
            where: { studentId: user!.id, deletedAt: null },
            select: {
              id: true,
              status: true,
              grade: {
                select: {
                  gradedAt: true,
                },
              },
            },
            take: 1,
          },
        }
      : undefined,
  }) as AssignmentWithSubmissions | null;

  if (!assignment) {
    throw createNotFoundError("Assignment", assignmentId);
  }

  // Role-based filtering for writing assignments
  if (assignment.type === 'writing' && user?.role === UserRole.student) {
    const config = assignment.assignmentConfig as Record<string, unknown>;
    const studentSubmission = assignment.submissions?.[0];

    const shouldShowSample = (task: Record<string, unknown>): boolean => {
      if (!task?.showSampleToStudents || !task?.sampleResponse) {
        return false;
      }

      const timing = task.showSampleTiming || 'immediate';

      switch (timing) {
        case 'immediate':
          return true;

        case 'after_submission':
          // Show if student has submitted
          return studentSubmission?.status === 'submitted' ||
                 studentSubmission?.status === 'graded';

        case 'after_grading':
          // Show if student's submission has been graded
          return studentSubmission?.grade?.gradedAt != null;

        case 'specific_date':
          if (!task.showSampleDate) return false;
          const showDate = new Date(task.showSampleDate as string);
          const now = new Date();
          return now >= showDate;

        default:
          return true;
      }
    };

    const task1 = (config.task1 as Record<string, unknown>) || {};
    const task2 = (config.task2 as Record<string, unknown>) || {};

    // Filter config for students - only include allowed fields
    const filteredConfig = {
      ...config,
      task1: {
        prompt: task1.prompt,
        imageFileId: task1.imageFileId,
        // Only include sample response if allowed by timing
        sampleResponse: shouldShowSample(task1)
          ? task1.sampleResponse
          : undefined,
      },
      task2: {
        prompt: task2.prompt,
        // Only include sample response if allowed by timing
        sampleResponse: shouldShowSample(task2)
          ? task2.sampleResponse
          : undefined,
      },
    };

    return {
      ...assignment,
      assignmentConfig: filteredConfig,
      submissions: undefined, // Don't expose submission data
    };
  }

  // Admins and teachers get full data (remove submissions from response)
  if ('submissions' in assignment) {
    const { submissions: _, ...rest } = assignment;
    return rest;
  }

  return assignment;
}

export async function createAssignment(
  params: unknown,
  payload: CreateAssignmentPayload,
) {
  const { courseId } = courseScopedParamsSchema.parse(params);
  const dueAt = parseOptionalDate(payload.dueAt, "dueAt");
  const publishedAt = parseOptionalDate(payload.publishedAt, "publishedAt");
  // Cast validated maps to Prisma JSON input, since Zod cannot enforce JsonValue types.
  const latePolicy = payload.latePolicy
    ? (payload.latePolicy as Prisma.InputJsonObject)
    : undefined;
  const validatedAssignmentConfig = parseAssignmentConfigForType(
    payload.type,
    payload.assignmentConfig,
  );

  // Validate rubric IDs for writing assignments
  if (payload.type === 'writing') {
    await validateWritingRubrics(validatedAssignmentConfig, courseId);
  }

  const assignmentConfig =
    validatedAssignmentConfig !== undefined
      ? (validatedAssignmentConfig as Prisma.InputJsonObject)
      : undefined;

  return prisma.assignment.create({
    data: {
      courseId,
      title: payload.title,
      description: payload.descriptionMd,
      type: payload.type,
      dueAt,
      latePolicy,
      assignmentConfig,
      publishedAt,
    },
  });
}

export async function updateAssignment(
  params: unknown,
  payload: UpdateAssignmentPayload,
) {
  const { assignmentId } = assignmentIdParamsSchema.parse(params);
  const { courseId } = courseScopedParamsSchema.parse(params);
  const dueAt = parseOptionalDate(payload.dueAt, "dueAt");
  const publishedAt = parseOptionalDate(payload.publishedAt, "publishedAt");
  const latePolicy = payload.latePolicy
    ? (payload.latePolicy as Prisma.InputJsonObject)
    : undefined;

  const existing = await prisma.assignment.findFirst({
    where: { id: assignmentId, courseId, deletedAt: null },
  });
  if (!existing) {
    throw createNotFoundError("Assignment", assignmentId);
  }

  const targetType = payload.type ?? existing.type;

  let assignmentConfig: Prisma.InputJsonObject | undefined;
  if (payload.assignmentConfig !== undefined) {
    const validatedConfig = parseAssignmentConfigForType(
      targetType,
      payload.assignmentConfig,
    );

    // Validate rubric IDs for writing assignments
    if (targetType === 'writing') {
      await validateWritingRubrics(validatedConfig, courseId);
    }

    assignmentConfig = validatedConfig as Prisma.InputJsonObject;
  }

  const updateData: Prisma.AssignmentUpdateInput = {};
  if (payload.title !== undefined) {
    updateData.title = payload.title;
  }
  if (payload.descriptionMd !== undefined) {
    updateData.description = payload.descriptionMd;
  }
  if (payload.type !== undefined) {
    updateData.type = payload.type;
  }
  if (payload.dueAt !== undefined) {
    updateData.dueAt = dueAt;
  }
  if (payload.latePolicy !== undefined) {
    updateData.latePolicy = latePolicy;
  }
  if (payload.assignmentConfig !== undefined) {
    updateData.assignmentConfig = assignmentConfig;
  }
  if (payload.publishedAt !== undefined) {
    updateData.publishedAt = publishedAt;
  }

  return prisma.assignment.update({
    where: { id: assignmentId },
    data: updateData,
  });
}

export async function deleteAssignment(params: unknown) {
  const { assignmentId } = assignmentIdParamsSchema.parse(params);
  const { courseId } = courseScopedParamsSchema.parse(params);

  const existing = await prisma.assignment.findFirst({
    where: { id: assignmentId, courseId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) {
    throw createNotFoundError("Assignment", assignmentId);
  }

  await prisma.assignment.update({
    where: { id: assignmentId },
    data: { deletedAt: new Date() },
  });
}

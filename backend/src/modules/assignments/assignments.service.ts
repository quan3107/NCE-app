/**
 * File: src/modules/assignments/assignments.service.ts
 * Purpose: Implement assignment data access and validation via Prisma.
 * Why: Keeps assignment-specific operations encapsulated away from controllers.
 */
import { Prisma, UserRole } from '../../prisma/index.js'

import { prisma } from '../../prisma/client.js'
import type { CourseManager } from '../courses/courses.types.js'
import { createHttpError, createNotFoundError } from '../../utils/httpError.js'
import {
  AI_FEEDBACK_AUDIT_ACTIONS,
  recordAiFeedbackAudit,
} from '../audit-logs/ai-feedback-audit.js'
import {
  assignmentAccessWhere,
  ensureCourseAssignmentAccess,
} from './assignments.authorization.js'
import {
  assignmentIdParamsSchema,
  courseScopedParamsSchema,
  type CreateAssignmentPayload,
  type UpdateAssignmentPayload,
} from './assignments.schema.js'
import {
  filterWritingAssignmentForStudent,
  shouldFilterWritingAssignmentForStudent,
  validateWritingRubrics,
} from './assignments.helpers.js'
import { parseAssignmentConfigForType } from './ielts.schema.js'

function parseOptionalDate(
  value: string | undefined,
  fieldName: string,
): Date | undefined {
  if (!value) {
    return undefined
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw createHttpError(400, `${fieldName} must be an ISO date string.`)
  }
  return parsed
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function aiPolicyFromConfig(value: unknown): Record<string, unknown> | null {
  return asRecord(asRecord(value)?.aiPolicy)
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(',')}}`
  }

  return JSON.stringify(value)
}

function hasAiPolicyChanged(before: unknown, after: unknown): boolean {
  return stableJson(aiPolicyFromConfig(before)) !== stableJson(aiPolicyFromConfig(after))
}

export async function listAssignments(params: unknown, actor: CourseManager) {
  const { courseId } = courseScopedParamsSchema.parse(params)
  return prisma.assignment.findMany({
    where: assignmentAccessWhere(courseId, actor, 'read'),
    orderBy: { createdAt: 'desc' },
  })
}

/**
 * Get count of pending assignments for a student.
 * Pending = published, not submitted, not past due date.
 */
export async function getPendingAssignmentsCount(studentId: string): Promise<number> {
  const now = new Date()

  const count = await prisma.assignment.count({
    where: {
      deletedAt: null,
      publishedAt: { not: null },
      dueAt: { gt: now },
      course: {
        deletedAt: null,
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
  })

  return count
}

type AssignmentWithSubmissions = {
  type: string
  id: string
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
  title: string
  description: string | null
  courseId: string
  dueAt: Date | null
  latePolicy: unknown
  assignmentConfig: unknown
  publishedAt: Date | null
  submissions?: Array<{
    id: string
    status: string
    grade?: {
      gradedAt: Date | null
    } | null
  }>
}

export async function getAssignment(params: unknown, user: CourseManager) {
  const { assignmentId } = assignmentIdParamsSchema.parse(params)
  const { courseId } = courseScopedParamsSchema.parse(params)

  // For students, include their submission and grade info to check visibility
  const includeSubmissions = user.role === UserRole.student

  const assignment = (await prisma.assignment.findFirst({
    where: assignmentAccessWhere(courseId, user, 'read', assignmentId),
    include: includeSubmissions
      ? {
          submissions: {
            where: { studentId: user.id, deletedAt: null },
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
  })) as AssignmentWithSubmissions | null

  if (!assignment) {
    throw createNotFoundError('Assignment', assignmentId)
  }

  if (shouldFilterWritingAssignmentForStudent(assignment, user)) {
    return filterWritingAssignmentForStudent(assignment)
  }

  // Admins and teachers get full data (remove submissions from response)
  if ('submissions' in assignment) {
    const { submissions: ignoredSubmissions, ...rest } = assignment
    return rest
  }

  return assignment
}

export async function createAssignment(
  params: unknown,
  payload: CreateAssignmentPayload,
  actor: CourseManager,
) {
  const { courseId } = courseScopedParamsSchema.parse(params)
  const dueAt = parseOptionalDate(payload.dueAt, 'dueAt')
  const publishedAt = parseOptionalDate(payload.publishedAt, 'publishedAt')
  // Cast validated maps to Prisma JSON input, since Zod cannot enforce JsonValue types.
  const latePolicy = payload.latePolicy
    ? (payload.latePolicy as Prisma.InputJsonObject)
    : undefined
  const validatedAssignmentConfig = parseAssignmentConfigForType(
    payload.type,
    payload.assignmentConfig,
  )

  await ensureCourseAssignmentAccess(courseId, actor)

  // Validate rubric IDs for writing assignments
  if (payload.type === 'writing') {
    await validateWritingRubrics(validatedAssignmentConfig, courseId)
  }

  const assignmentConfig =
    validatedAssignmentConfig !== undefined
      ? (validatedAssignmentConfig as Prisma.InputJsonObject)
      : undefined

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
  })
}

export async function updateAssignment(
  params: unknown,
  payload: UpdateAssignmentPayload,
  actor: CourseManager,
) {
  const { assignmentId } = assignmentIdParamsSchema.parse(params)
  const { courseId } = courseScopedParamsSchema.parse(params)
  const dueAt = parseOptionalDate(payload.dueAt, 'dueAt')
  const publishedAt = parseOptionalDate(payload.publishedAt, 'publishedAt')
  const latePolicy = payload.latePolicy
    ? (payload.latePolicy as Prisma.InputJsonObject)
    : undefined

  const existing = await prisma.assignment.findFirst({
    where: assignmentAccessWhere(courseId, actor, 'manage', assignmentId),
  })
  if (!existing) {
    throw createNotFoundError('Assignment', assignmentId)
  }

  const targetType = payload.type ?? existing.type

  let assignmentConfig: Prisma.InputJsonObject | undefined
  if (payload.assignmentConfig !== undefined) {
    const validatedConfig = parseAssignmentConfigForType(
      targetType,
      payload.assignmentConfig,
    )

    // Validate rubric IDs for writing assignments
    if (targetType === 'writing') {
      await validateWritingRubrics(validatedConfig, courseId)
    }

    assignmentConfig = validatedConfig as Prisma.InputJsonObject
  } else if (payload.type !== undefined && payload.type !== existing.type) {
    parseAssignmentConfigForType(targetType, existing.assignmentConfig)
  }

  const updateData: Prisma.AssignmentUpdateInput = {}
  if (payload.title !== undefined) {
    updateData.title = payload.title
  }
  if (payload.descriptionMd !== undefined) {
    updateData.description = payload.descriptionMd
  }
  if (payload.type !== undefined) {
    updateData.type = payload.type
  }
  if (payload.dueAt !== undefined) {
    updateData.dueAt = dueAt
  }
  if (payload.latePolicy !== undefined) {
    updateData.latePolicy = latePolicy
  }
  if (payload.assignmentConfig !== undefined) {
    updateData.assignmentConfig = assignmentConfig
  }
  if (payload.publishedAt !== undefined) {
    updateData.publishedAt = publishedAt
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.assignment.update({
      where: { id: assignmentId },
      data: updateData,
    })

    if (
      payload.assignmentConfig !== undefined &&
      hasAiPolicyChanged(existing.assignmentConfig, assignmentConfig)
    ) {
      await recordAiFeedbackAudit(
        {
          actorId: actor.id,
          action: AI_FEEDBACK_AUDIT_ACTIONS.policyChanged,
          entity: 'assignment',
          entityId: assignmentId,
          entityIds: { courseId, assignmentId },
          payload: {
            before: aiPolicyFromConfig(existing.assignmentConfig),
            after: aiPolicyFromConfig(assignmentConfig),
          },
        },
        tx,
      )
    }

    return updated
  })
}

export async function deleteAssignment(params: unknown, actor: CourseManager) {
  const { assignmentId } = assignmentIdParamsSchema.parse(params)
  const { courseId } = courseScopedParamsSchema.parse(params)

  const existing = await prisma.assignment.findFirst({
    where: assignmentAccessWhere(courseId, actor, 'manage', assignmentId),
    select: { id: true },
  })
  if (!existing) {
    throw createNotFoundError('Assignment', assignmentId)
  }

  await prisma.assignment.update({
    where: { id: assignmentId },
    data: { deletedAt: new Date() },
  })
}

/**
 * File: src/modules/assignments/assignments.update.ts
 * Purpose: Validate and build assignment update data from a locked current record.
 * Why: Type-dependent config validation must use the same baseline as the atomic update.
 */
import { Prisma, type Assignment } from '../../prisma/index.js'

import type { UpdateAssignmentPayload } from './assignments.schema.js'
import { validateWritingRubrics } from './assignments.helpers.js'
import { parseAssignmentConfigForType } from './ielts.schema.js'

type ParsedUpdateValues = {
  dueAt: Date | undefined
  publishedAt: Date | undefined
  latePolicy: Prisma.InputJsonObject | undefined
}

export async function buildAssignmentUpdateData(
  existing: Pick<Assignment, 'type' | 'assignmentConfig'>,
  payload: UpdateAssignmentPayload,
  courseId: string,
  parsed: ParsedUpdateValues,
): Promise<Prisma.AssignmentUpdateInput> {
  const targetType = payload.type ?? existing.type

  let assignmentConfig: Prisma.InputJsonObject | undefined
  if (payload.assignmentConfig !== undefined) {
    const validatedConfig = parseAssignmentConfigForType(
      targetType,
      payload.assignmentConfig,
    )

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
    updateData.dueAt = parsed.dueAt
  }
  if (payload.latePolicy !== undefined) {
    updateData.latePolicy = parsed.latePolicy
  }
  if (payload.assignmentConfig !== undefined) {
    updateData.assignmentConfig = assignmentConfig
  }
  if (payload.publishedAt !== undefined) {
    updateData.publishedAt = parsed.publishedAt
  }
  return updateData
}

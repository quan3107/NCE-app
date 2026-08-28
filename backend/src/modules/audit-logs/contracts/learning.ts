/**
 * File: src/modules/audit-logs/contracts/learning.ts
 * Purpose: Define strict assignment, submission, and grade audit event contracts.
 * Why: Educational records need operational markers without authored content or scores.
 */
import { z } from 'zod'

import {
  assignmentTypeSchema,
  auditIdSchema,
  changedMarkerSchema,
  submissionStatusSchema,
} from './common.js'

const submissionEventShape = {
  assignmentId: auditIdSchema,
  courseId: auditIdSchema,
  studentId: auditIdSchema,
  statusBefore: submissionStatusSchema.nullable(),
  statusAfter: submissionStatusSchema,
  submittedAtChanged: z.boolean(),
  submissionContentChanged: z.boolean(),
}

export const learningAuditContracts = {
  'nce.lesson.published': {
    entity: 'nce_lesson',
    schema: z.strictObject({
      courseId: auditIdSchema.nullable(),
      statusBefore: z.literal('draft'),
      statusAfter: z.literal('published'),
      publicationChanged: changedMarkerSchema,
    }),
  },
  'nce.lesson.unpublished': {
    entity: 'nce_lesson',
    schema: z.strictObject({
      courseId: auditIdSchema.nullable(),
      statusBefore: z.literal('published'),
      statusAfter: z.literal('draft'),
      publicationChanged: changedMarkerSchema,
    }),
  },
  'assignment.created': {
    entity: 'assignment',
    schema: z.strictObject({
      courseId: auditIdSchema,
      type: assignmentTypeSchema,
      published: z.boolean(),
    }),
  },
  'assignment.updated': {
    entity: 'assignment',
    schema: z.strictObject({
      courseId: auditIdSchema,
      titleChanged: changedMarkerSchema.optional(),
      descriptionChanged: changedMarkerSchema.optional(),
      typeChanged: changedMarkerSchema.optional(),
      dueAtChanged: changedMarkerSchema.optional(),
      latePolicyChanged: changedMarkerSchema.optional(),
      assignmentConfigChanged: changedMarkerSchema.optional(),
      publishedAtChanged: changedMarkerSchema.optional(),
    }),
  },
  'assignment.deleted': {
    entity: 'assignment',
    schema: z.strictObject({
      courseId: auditIdSchema,
      lifecycleChanged: changedMarkerSchema,
    }),
  },
  'submission.created': {
    entity: 'submission',
    schema: z.strictObject(submissionEventShape),
  },
  'submission.updated': {
    entity: 'submission',
    schema: z.strictObject(submissionEventShape),
  },
  'submission.submitted': {
    entity: 'submission',
    schema: z.strictObject(submissionEventShape),
  },
  'grade.upserted': {
    entity: 'grade',
    schema: z.strictObject({
      submissionId: auditIdSchema,
      graderId: auditIdSchema,
      scoreChanged: z.boolean(),
      feedbackChanged: z.boolean(),
    }),
  },
} as const

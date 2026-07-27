/**
 * File: src/modules/audit-logs/contracts/ai-feedback.ts
 * Purpose: Define strict AI feedback audit event contracts.
 * Why: AI prompts, submissions, explanations, answers, and provider output must never be stored.
 */
import { z } from 'zod'

import { auditIdSchema, auditLabelSchema } from './common.js'

const providerShape = {
  routeKey: z.enum(['low_cost', 'premium']),
  provider: z.literal('openai-compatible'),
  model: auditLabelSchema,
  promptVersion: auditLabelSchema,
}
const writingIdsShape = {
  submissionId: auditIdSchema,
  assignmentId: auditIdSchema,
  gradeId: auditIdSchema.optional(),
}
const explanationIdsShape = {
  submissionId: auditIdSchema,
  assignmentId: auditIdSchema,
}
const writingStatusSchema = z.enum([
  'queued',
  'running',
  'accepted',
  'review_required',
  'rejected',
  'failed',
  'approved',
  'finalized',
  'superseded',
])
const explanationStatusSchema = z.enum([
  'queued',
  'running',
  'completed',
  'review_required',
  'rejected',
  'failed',
])
const visibilityModeSchema = z.enum([
  'teacher_reviewed',
  'instant_student_visible',
  'hidden',
])

export const aiFeedbackAuditContracts = {
  'ai_feedback.policy_changed': {
    entity: 'assignment',
    schema: z.strictObject({
      courseId: auditIdSchema,
      assignmentId: auditIdSchema,
      writingFeedbackModeChanged: z.boolean(),
      objectiveExplanationsChanged: z.boolean(),
      providerTierChanged: z.boolean(),
    }),
  },
  'ai_feedback.writing_requested': {
    entity: 'ai_feedback_draft',
    schema: z.strictObject({
      ...writingIdsShape,
      ...providerShape,
      status: writingStatusSchema,
      visibilityMode: visibilityModeSchema,
      promptUsed: z.literal(true),
      submissionContentUsed: z.literal(true),
    }),
  },
  'ai_feedback.writing_generated': {
    entity: 'ai_feedback_draft',
    schema: z.strictObject({
      ...writingIdsShape,
      ...providerShape,
      status: writingStatusSchema,
      outputGenerated: z.literal(true),
    }),
  },
  'ai_feedback.writing_failed': {
    entity: 'ai_feedback_draft',
    schema: z.strictObject({
      ...writingIdsShape,
      ...providerShape,
      status: writingStatusSchema,
      failureCode: auditLabelSchema.optional(),
      outputGenerated: z.literal(false),
    }),
  },
  'ai_feedback.writing_approved': {
    entity: 'ai_feedback_draft',
    schema: z.strictObject({
      ...writingIdsShape,
      teacherDecision: z.literal('approved'),
      feedbackChanged: z.boolean(),
    }),
  },
  'ai_feedback.writing_rejected': {
    entity: 'ai_feedback_draft',
    schema: z.strictObject({
      ...writingIdsShape,
      teacherDecision: z.literal('rejected'),
      feedbackChanged: z.boolean(),
    }),
  },
  'ai_feedback.writing_finalized': {
    entity: 'ai_feedback_draft',
    schema: z.strictObject({
      ...writingIdsShape,
      teacherDecision: z.literal('finalized'),
      feedbackChanged: z.boolean(),
    }),
  },
  'ai_feedback.explanation_requested': {
    entity: 'ai_objective_explanation',
    schema: z.strictObject({
      ...explanationIdsShape,
      ...providerShape,
      status: explanationStatusSchema,
      promptUsed: z.literal(true),
      sourceEvidenceUsed: z.literal(true),
    }),
  },
  'ai_feedback.explanation_generated': {
    entity: 'ai_objective_explanation',
    schema: z.strictObject({
      ...explanationIdsShape,
      ...providerShape,
      status: explanationStatusSchema,
      outputGenerated: z.literal(true),
    }),
  },
  'ai_feedback.explanation_failed': {
    entity: 'ai_objective_explanation',
    schema: z.strictObject({
      ...explanationIdsShape,
      ...providerShape,
      status: explanationStatusSchema,
      failureCode: auditLabelSchema.optional(),
      outputGenerated: z.literal(false),
    }),
  },
  'ai_feedback.grade_feedback_updated': {
    entity: 'grade',
    schema: z.strictObject({
      submissionId: auditIdSchema,
      assignmentId: auditIdSchema,
      draftId: auditIdSchema,
      teacherDecision: z.enum(['approved', 'finalized']),
      feedbackChanged: z.literal(true),
    }),
  },
} as const

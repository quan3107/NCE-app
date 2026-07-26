/**
 * File: src/modules/audit-logs/contracts/common.ts
 * Purpose: Share bounded primitives across versioned audit event contracts.
 * Why: Audit schemas should approve values explicitly without accepting arbitrary metadata.
 */
import { z } from 'zod'

export const AUDIT_ID_MAX_LENGTH = 160
export const AUDIT_LABEL_MAX_LENGTH = 120

export const auditEntityIdSchema = z.string().min(1).max(AUDIT_ID_MAX_LENGTH)
export const auditIdSchema = z.string().trim().min(1).max(AUDIT_ID_MAX_LENGTH)
export const auditLabelSchema = z.string().trim().min(1).max(AUDIT_LABEL_MAX_LENGTH)
export const auditTimestampSchema = z.string().datetime({ offset: true })

export const userRoleSchema = z.enum(['admin', 'teacher', 'student'])
export const userStatusSchema = z.enum(['active', 'pending', 'invited', 'suspended'])
export const enrollmentRoleSchema = z.enum(['teacher', 'student'])
export const assignmentTypeSchema = z.enum([
  'file',
  'link',
  'text',
  'quiz',
  'reading',
  'listening',
  'writing',
  'speaking',
])
export const submissionStatusSchema = z.enum(['draft', 'submitted', 'late', 'graded'])

export const changedMarkerSchema = z.literal(true)

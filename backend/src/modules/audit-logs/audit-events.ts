/**
 * File: src/modules/audit-logs/audit-events.ts
 * Purpose: Register and validate every versioned audit action/data pair.
 * Why: A finite registry makes the persistence boundary compile-time checked and runtime strict.
 */
import { z } from 'zod'

import { aiFeedbackAuditContracts } from './contracts/ai-feedback.js'
import { authUserAuditContracts } from './contracts/auth-users.js'
import { auditEntityIdSchema, auditIdSchema } from './contracts/common.js'
import { courseEnrollmentAuditContracts } from './contracts/courses-enrollments.js'
import { learningAuditContracts } from './contracts/learning.js'
import { operationsAuditContracts } from './contracts/operations.js'

export const AUDIT_SCHEMA_VERSION = 1 as const

export const auditEventRegistry = {
  ...authUserAuditContracts,
  ...courseEnrollmentAuditContracts,
  ...learningAuditContracts,
  ...aiFeedbackAuditContracts,
  ...operationsAuditContracts,
} as const

type AuditEventRegistry = typeof auditEventRegistry
export type AuditAction = keyof AuditEventRegistry

type AuditInputForAction<Action extends AuditAction> = {
  actorId?: string | null
  action: Action
  entity: AuditEventRegistry[Action]['entity']
  entityId: string
  eventData: z.input<AuditEventRegistry[Action]['schema']>
}

export type AuditLogWriteInput = {
  [Action in AuditAction]: AuditInputForAction<Action>
}[AuditAction]

const auditEnvelopeSchema = z.strictObject({
  actorId: auditIdSchema.nullable().optional(),
  action: z.string().trim().min(1).max(120),
  entity: z.string().trim().min(1).max(120),
  entityId: auditEntityIdSchema,
  eventData: z.unknown(),
})

export type ParsedAuditEvent = {
  actorId?: string | null
  action: AuditAction
  entity: string
  entityId: string
  eventData: Record<string, unknown>
  schemaVersion: typeof AUDIT_SCHEMA_VERSION
}

export function parseAuditEvent(input: unknown): ParsedAuditEvent {
  const envelope = auditEnvelopeSchema.parse(input)
  const action = envelope.action as AuditAction
  const contract = auditEventRegistry[action]

  if (!contract) {
    throw new Error(`Unregistered audit action: ${envelope.action}`)
  }
  if (envelope.entity !== contract.entity) {
    throw new Error(
      `Audit entity ${envelope.entity} does not match ${contract.entity} for ${action}`,
    )
  }

  return {
    actorId: envelope.actorId,
    action,
    entity: contract.entity,
    entityId: envelope.entityId,
    eventData: contract.schema.parse(envelope.eventData) as Record<string, unknown>,
    schemaVersion: AUDIT_SCHEMA_VERSION,
  }
}

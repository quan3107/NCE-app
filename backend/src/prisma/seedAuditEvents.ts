/**
 * File: src/prisma/seedAuditEvents.ts
 * Purpose: Build validated audit events for database seed fixtures.
 * Why: Seed relations should use the same typed boundary as runtime audit writes.
 */
import { parseAuditEvent } from '../modules/audit-logs/audit-events.js'

export function buildSeedAuditEvent(input: unknown) {
  return parseAuditEvent(input)
}

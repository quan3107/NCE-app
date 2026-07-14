/**
 * File: src/modules/auth/auth.audit.ts
 * Purpose: Persist auth audit events under the trusted database role.
 * Why: Public auth routes have no request role context of their own.
 */
import { withRoleContext } from '../../prisma/client.js'
import {
  writeAuditLogSafely,
  type AuditLogWriteInput,
} from '../audit-logs/audit-logs.service.js'

export async function writeAuthAuditLogSafely(input: AuditLogWriteInput): Promise<void> {
  await withRoleContext({ role: 'service_role' }, () => writeAuditLogSafely(input))
}

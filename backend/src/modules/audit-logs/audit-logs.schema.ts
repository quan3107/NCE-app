/**
 * File: src/modules/audit-logs/audit-logs.schema.ts
 * Purpose: Validate query parameters for audit log retrieval.
 * Why: Ensures pagination inputs are well-formed before hitting Prisma.
 */
import { z } from "zod";

export const DEFAULT_AUDIT_LOG_LIMIT = 50;
const MAX_AUDIT_LOG_LIMIT = 100;

export const auditLogQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(MAX_AUDIT_LOG_LIMIT).optional(),
    offset: z.coerce.number().int().min(0).optional(),
  })
  .strict();

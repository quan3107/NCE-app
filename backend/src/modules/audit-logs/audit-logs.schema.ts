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
    actorId: z.string().uuid().optional(),
    action: z.string().trim().min(1).max(120).optional(),
    entity: z.string().trim().min(1).max(80).optional(),
    entityId: z.string().trim().min(1).max(120).optional(),
    createdFrom: z.coerce.date().optional(),
    createdTo: z.coerce.date().optional(),
    limit: z.coerce.number().int().min(1).max(MAX_AUDIT_LOG_LIMIT).optional(),
    offset: z.coerce.number().int().min(0).optional(),
  })
  .strict();

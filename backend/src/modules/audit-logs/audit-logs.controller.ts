/**
 * File: src/modules/audit-logs/audit-logs.controller.ts
 * Purpose: Handle audit log HTTP requests for admin reporting.
 * Why: Keeps routing thin while audit log logic stays in services.
 */
import { type Request, type Response } from "express";

import {
  auditLogQuerySchema,
  DEFAULT_AUDIT_LOG_LIMIT,
} from "./audit-logs.schema.js";
import { listAuditLogs } from "./audit-logs.service.js";

export async function getAuditLogs(
  req: Request,
  res: Response,
): Promise<void> {
  const { limit, cursor } = auditLogQuerySchema.parse(req.query);
  const payload = await listAuditLogs({
    limit: limit ?? DEFAULT_AUDIT_LOG_LIMIT,
    cursor,
  });
  res.status(200).json(payload);
}

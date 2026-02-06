/**
 * File: src/modules/audit-logs/audit-logs.routes.ts
 * Purpose: Register admin-only audit log endpoints.
 * Why: Exposes immutable audit history for compliance views.
 */
import { UserRole } from "../../prisma/index.js";
import { Router } from "express";

import { authGuard } from "../../middleware/authGuard.js";
import { roleGuard } from "../../middleware/roleGuard.js";
import { getAuditLogs } from "./audit-logs.controller.js";

export const auditLogRouter = Router();

auditLogRouter.use(authGuard);
auditLogRouter.use(roleGuard([UserRole.admin]));

auditLogRouter.get("/", getAuditLogs);

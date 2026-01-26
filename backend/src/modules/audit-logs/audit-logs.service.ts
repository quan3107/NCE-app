/**
 * File: src/modules/audit-logs/audit-logs.service.ts
 * Purpose: Provide admin audit log queries backed by Prisma.
 * Why: Surfaces immutable change history for admin oversight.
 */
import { prisma } from "../../prisma/client.js";
import { DEFAULT_AUDIT_LOG_LIMIT } from "./audit-logs.schema.js";

const auditLogSelect = {
  id: true,
  actorId: true,
  action: true,
  entity: true,
  entityId: true,
  diff: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  actor: {
    select: {
      id: true,
      fullName: true,
    },
  },
};

type AuditLogQuery = {
  limit?: number;
  offset?: number;
};

export async function listAuditLogs(params: AuditLogQuery) {
  const limit = params.limit ?? DEFAULT_AUDIT_LOG_LIMIT;
  const offset = params.offset ?? 0;

  const logs = await prisma.auditLog.findMany({
    where: { deletedAt: null },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    skip: offset,
    select: auditLogSelect,
  });

  const hasMore = logs.length > limit;
  const items = hasMore ? logs.slice(0, limit) : logs;
  const nextOffset = hasMore ? offset + limit : null;

  return {
    data: items,
    nextOffset,
  };
}

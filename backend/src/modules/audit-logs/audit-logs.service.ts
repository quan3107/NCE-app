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
  cursor?: string;
};

export async function listAuditLogs(params: AuditLogQuery) {
  const limit = params.limit ?? DEFAULT_AUDIT_LOG_LIMIT;
  const cursor = params.cursor;

  const logs = await prisma.auditLog.findMany({
    where: { deletedAt: null },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor
      ? {
          cursor: { id: cursor },
          skip: 1,
        }
      : {}),
    select: auditLogSelect,
  });

  const hasMore = logs.length > limit;
  const items = hasMore ? logs.slice(0, limit) : logs;
  const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

  return {
    data: items,
    nextCursor,
  };
}

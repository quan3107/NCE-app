/**
 * File: src/modules/audit-logs/audit-logs.service.ts
 * Purpose: Persist typed audit events and provide admin audit log queries.
 * Why: Runtime validation keeps unregistered or private data out of audit storage.
 */
import { logger } from '../../config/logger.js'
import { prisma } from '../../prisma/client.js'
import { Prisma } from '../../prisma/index.js'
import { parseAuditEvent, type AuditLogWriteInput } from './audit-events.js'
import { DEFAULT_AUDIT_LOG_LIMIT } from './audit-logs.schema.js'

const auditLogSelect = {
  id: true,
  actorId: true,
  action: true,
  entity: true,
  entityId: true,
  eventData: true,
  schemaVersion: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  actor: {
    select: {
      id: true,
      fullName: true,
    },
  },
}

type AuditLogQuery = {
  actorId?: string
  entity?: string
  entityId?: string
  action?: string
  from?: Date
  to?: Date
  limit?: number
  offset?: number
}

type AuditLogClient = {
  auditLog: {
    create: typeof prisma.auditLog.create
  }
}

export type { AuditLogWriteInput } from './audit-events.js'

async function persistAuditEvent(
  event: ReturnType<typeof parseAuditEvent>,
  client: AuditLogClient = prisma,
): Promise<void> {
  await client.auditLog.create({
    data: {
      actorId: event.actorId ?? undefined,
      action: event.action,
      entity: event.entity,
      entityId: event.entityId,
      eventData: event.eventData as Prisma.InputJsonObject,
      schemaVersion: event.schemaVersion,
    },
    select: { id: true },
  })
}

export async function writeAuditLogSafely(
  input: AuditLogWriteInput,
  client: AuditLogClient = prisma,
): Promise<void> {
  let event: ReturnType<typeof parseAuditEvent>

  try {
    event = parseAuditEvent(input)
  } catch {
    logger.warn({ code: 'audit_log_validation_failed' }, 'Audit log write rejected.')
    return
  }

  try {
    await persistAuditEvent(event, client)
  } catch {
    logger.warn({ code: 'audit_log_persistence_failed' }, 'Audit log write failed.')
  }
}

export async function writeAuditLog(
  input: AuditLogWriteInput,
  client: AuditLogClient = prisma,
): Promise<void> {
  await persistAuditEvent(parseAuditEvent(input), client)
}

export async function listAuditLogs(params: AuditLogQuery) {
  const limit = params.limit ?? DEFAULT_AUDIT_LOG_LIMIT
  const offset = params.offset ?? 0
  const createdAt: Prisma.DateTimeFilter = {}
  if (params.from) {
    createdAt.gte = params.from
  }
  if (params.to) {
    createdAt.lte = params.to
  }
  const where: Prisma.AuditLogWhereInput = {
    deletedAt: null,
    ...(params.actorId ? { actorId: params.actorId } : {}),
    ...(params.entity ? { entity: params.entity } : {}),
    ...(params.entityId ? { entityId: params.entityId } : {}),
    ...(params.action ? { action: params.action } : {}),
    ...(params.from || params.to ? { createdAt } : {}),
  }

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    skip: offset,
    select: auditLogSelect,
  })

  const hasMore = logs.length > limit
  const items = hasMore ? logs.slice(0, limit) : logs
  const nextOffset = hasMore ? offset + limit : null

  return {
    data: items,
    nextOffset,
  }
}

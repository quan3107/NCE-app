/**
 * File: src/modules/audit-logs/audit-logs.service.ts
 * Purpose: Provide admin audit log queries backed by Prisma.
 * Why: Surfaces immutable change history for admin oversight.
 */
import { createHash } from 'node:crypto'

import { logger } from '../../config/logger.js'
import { prisma } from '../../prisma/client.js'
import { Prisma } from '../../prisma/index.js'
import { DEFAULT_AUDIT_LOG_LIMIT } from './audit-logs.schema.js'

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

type JsonRecord = Record<string, unknown>

type AuditLogClient = {
  auditLog: {
    create: typeof prisma.auditLog.create
  }
}

export type AuditLogWriteInput = {
  actorId?: string | null
  action: string
  entity: string
  entityId: string
  before?: unknown
  after?: unknown
  diff?: JsonRecord | null
  redactedDiff?: Prisma.InputJsonObject
  requestMetadata?: JsonRecord | null
}

const sensitiveKeyPattern =
  /(authorization|body|content|cookie|essay|feedback|filekey|hash|key|oauth|password|payload|prompt|response|secret|submission|text|token)/i
const secretKeyPattern = /(authorization|cookie|hash|key|oauth|password|secret|token)/i
const largeStringLimit = 200

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`
  }

  if (value && typeof value === 'object') {
    const record = value as JsonRecord
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(',')}}`
  }

  return JSON.stringify(value)
}

function hashValue(value: unknown): string {
  return `sha256:${createHash('sha256').update(stableJson(value)).digest('hex')}`
}

function redactValue(reason: string, value?: unknown) {
  const redacted: JsonRecord = {
    redacted: true,
    reason,
  }

  if (value !== undefined && !secretKeyPattern.test(reason)) {
    const serialized = typeof value === 'string' ? value : stableJson(value)
    redacted.hash = hashValue(value)
    redacted.length = serialized.length
  }

  return redacted
}

function sanitizeAuditValue(key: string, value: unknown): unknown {
  if (value === undefined) {
    return undefined
  }

  if (secretKeyPattern.test(key)) {
    return redactValue('sensitive-key')
  }

  if (typeof value === 'string') {
    if (sensitiveKeyPattern.test(key) || value.length > largeStringLimit) {
      return redactValue('sensitive-value', value)
    }
    return value
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeAuditValue(key, entry))
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (value && typeof value === 'object') {
    return sanitizeAuditRecord(value as JsonRecord)
  }

  return value
}

function sanitizeAuditRecord(record: JsonRecord): JsonRecord {
  return Object.fromEntries(
    Object.entries(record)
      .map(([key, value]) => [key, sanitizeAuditValue(key, value)] as const)
      .filter(([, value]) => value !== undefined),
  )
}

function buildAuditDiff(input: AuditLogWriteInput): Prisma.InputJsonObject {
  if (input.redactedDiff) {
    return input.redactedDiff
  }

  const diff: JsonRecord = {}

  if (input.before !== undefined) {
    diff.before = sanitizeAuditValue('before', input.before)
  }
  if (input.after !== undefined) {
    diff.after = sanitizeAuditValue('after', input.after)
  }
  if (input.diff) {
    diff.changes = sanitizeAuditRecord(input.diff)
  }
  if (input.requestMetadata) {
    diff.request = sanitizeAuditRecord(input.requestMetadata)
  }

  return diff as Prisma.InputJsonObject
}

export async function writeAuditLog(
  input: AuditLogWriteInput,
  client: AuditLogClient = prisma,
): Promise<void> {
  await client.auditLog.create({
    data: {
      actorId: input.actorId ?? undefined,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      diff: buildAuditDiff(input),
    },
  })
}

export async function writeAuditLogSafely(
  input: AuditLogWriteInput,
  client: AuditLogClient = prisma,
): Promise<void> {
  try {
    await writeAuditLog(input, client)
  } catch (error) {
    logger.warn(
      {
        err: error,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
      },
      'Audit log write failed.',
    )
  }
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

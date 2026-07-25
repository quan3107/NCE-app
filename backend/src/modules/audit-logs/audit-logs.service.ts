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
type AuditLogClient = { auditLog: Pick<typeof prisma.auditLog, 'create'> }
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

const sensitiveValueKeyPattern =
  /(body|content|essay|feedback|payload|prompt|response|submission|text)/i
const secretNamePattern =
  /(authorization|codeverifier|cookie|credentials?|hash|oauth|password|privatepem|secret|signature|token)/i
const sensitiveNormalizedKeyPattern =
  /^(?:auth(?:entication)?(?:data|header|info|value)?|bearer.*|jwt.*|session.*)$/
const sensitiveUrlParameterNames = new Set(['code', 'sig'])
const sensitivePathOrUrlNamePattern =
  /paths?$|(?:file|object|storage).*paths?|(?:presigned|signed).*(?:uri|url)/
const authorizationValuePattern = /^\s*(?:basic|bearer|digest|negotiate)\s+\S+/i
// These exact Phase 5 identifiers are operational labels, never storage or credential keys.
const benignOperationalIdentifierNames = new Set([
  'itemKey',
  'pageKey',
  'sectionKey',
  'widgetKey',
])
const largeStringLimit = 200
const normalizedKeyName = (key: string) => key.replace(/[^a-z0-9]/gi, '').toLowerCase()

function isSensitiveKeyName(key: string): boolean {
  if (benignOperationalIdentifierNames.has(key)) {
    return false
  }
  const normalized = normalizedKeyName(key)
  return (
    sensitiveNormalizedKeyPattern.test(normalized) ||
    secretNamePattern.test(normalized) ||
    normalized.includes('key') ||
    sensitivePathOrUrlNamePattern.test(normalized)
  )
}

function isSensitiveUrlValue(value: string): boolean {
  try {
    const url = new URL(value)
    const parameterNames = [
      ...url.searchParams.keys(),
      ...new URLSearchParams(url.hash.slice(1)).keys(),
    ]
    return (
      Boolean(url.username || url.password) ||
      parameterNames.some(
        (key) =>
          isSensitiveKeyName(key) ||
          sensitiveUrlParameterNames.has(normalizedKeyName(key)),
      )
    )
  } catch {
    return false
  }
}

function containsSensitiveDescendant(value: unknown): boolean {
  if (typeof value === 'string') {
    return authorizationValuePattern.test(value) || isSensitiveUrlValue(value)
  }
  if (Array.isArray(value)) {
    return value.some(containsSensitiveDescendant)
  }
  if (!value || typeof value !== 'object' || value instanceof Date) {
    return false
  }
  return Object.entries(value as JsonRecord).some(
    ([key, nested]) => isSensitiveKeyName(key) || containsSensitiveDescendant(nested),
  )
}

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

  if (value !== undefined && reason !== 'sensitive-key') {
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

  if (isSensitiveKeyName(key)) {
    return redactValue('sensitive-key')
  }

  if (sensitiveValueKeyPattern.test(key)) {
    return containsSensitiveDescendant(value)
      ? redactValue('sensitive-value')
      : redactValue('sensitive-value', value)
  }

  if (typeof value === 'string') {
    if (authorizationValuePattern.test(value) || isSensitiveUrlValue(value)) {
      return redactValue('sensitive-value')
    }
    if (value.length > largeStringLimit) {
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
    select: { id: true },
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

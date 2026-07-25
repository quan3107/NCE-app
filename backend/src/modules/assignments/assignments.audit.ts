/**
 * File: src/modules/assignments/assignments.audit.ts
 * Purpose: Derive assignment audit markers from semantic before/after snapshots.
 * Why: Payload presence and newly materialized defaults do not necessarily mean values changed.
 */

type AssignmentAuditSnapshot = {
  title?: unknown
  description?: unknown
  type?: unknown
  dueAt?: unknown
  latePolicy?: unknown
  assignmentConfig?: unknown
  publishedAt?: unknown
}

type AiPolicy = {
  writingFeedbackMode: unknown
  objectiveExplanations: unknown
  providerTier: unknown
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`
  }

  if (value instanceof Date) {
    return JSON.stringify(value.toISOString())
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(',')}}`
  }

  return JSON.stringify(value) ?? 'undefined'
}

function normalizedAiPolicy(value: unknown): AiPolicy {
  const policy = asRecord(asRecord(value)?.aiPolicy)
  return {
    writingFeedbackMode: policy?.writingFeedbackMode ?? 'off',
    objectiveExplanations: policy?.objectiveExplanations ?? 'off',
    providerTier: policy?.providerTier ?? 'auto',
  }
}

function normalizedAssignmentConfig(value: unknown, type: unknown): unknown {
  const config = asRecord(value)
  if (
    !config ||
    !['reading', 'listening', 'writing', 'speaking'].includes(String(type))
  ) {
    return value
  }
  return {
    ...config,
    aiPolicy: normalizedAiPolicy(config),
  }
}

function changed(before: unknown, after: unknown): boolean {
  return stableJson(before) !== stableJson(after)
}

export function buildAssignmentUpdateAuditEventData(
  before: AssignmentAuditSnapshot,
  after: AssignmentAuditSnapshot,
  courseId: string,
) {
  return {
    courseId,
    ...(changed(before.title, after.title) ? { titleChanged: true as const } : {}),
    ...(changed(before.description, after.description)
      ? { descriptionChanged: true as const }
      : {}),
    ...(changed(before.type, after.type) ? { typeChanged: true as const } : {}),
    ...(changed(before.dueAt, after.dueAt) ? { dueAtChanged: true as const } : {}),
    ...(changed(before.latePolicy, after.latePolicy)
      ? { latePolicyChanged: true as const }
      : {}),
    ...(changed(
      normalizedAssignmentConfig(before.assignmentConfig, before.type),
      normalizedAssignmentConfig(after.assignmentConfig, after.type),
    )
      ? { assignmentConfigChanged: true as const }
      : {}),
    ...(changed(before.publishedAt, after.publishedAt)
      ? { publishedAtChanged: true as const }
      : {}),
  }
}

export function buildAiPolicyChangeAuditEventData(
  beforeConfig: unknown,
  afterConfig: unknown,
  courseId: string,
  assignmentId: string,
) {
  const before = normalizedAiPolicy(beforeConfig)
  const after = normalizedAiPolicy(afterConfig)
  return {
    courseId,
    assignmentId,
    writingFeedbackModeChanged: changed(
      before.writingFeedbackMode,
      after.writingFeedbackMode,
    ),
    objectiveExplanationsChanged: changed(
      before.objectiveExplanations,
      after.objectiveExplanations,
    ),
    providerTierChanged: changed(before.providerTier, after.providerTier),
  }
}

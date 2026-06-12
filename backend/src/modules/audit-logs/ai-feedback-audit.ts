/**
 * File: src/modules/audit-logs/ai-feedback-audit.ts
 * Purpose: Build and persist redacted audit entries for AI feedback workflows.
 * Why: AI feedback audit trails need traceability without retaining student work or provider payloads.
 */
import { createHash } from "node:crypto";

import { prisma } from "../../prisma/client.js";
import { Prisma } from "../../prisma/index.js";

export const AI_FEEDBACK_AUDIT_ACTIONS = {
  policyChanged: "ai_feedback.policy_changed",
  writingRequested: "ai_feedback.writing_requested",
  writingGenerated: "ai_feedback.writing_generated",
  writingFailed: "ai_feedback.writing_failed",
  writingApproved: "ai_feedback.writing_approved",
  writingRejected: "ai_feedback.writing_rejected",
  writingFinalized: "ai_feedback.writing_finalized",
  explanationRequested: "ai_feedback.explanation_requested",
  explanationGenerated: "ai_feedback.explanation_generated",
  explanationFailed: "ai_feedback.explanation_failed",
  gradeFeedbackUpdated: "ai_feedback.grade_feedback_updated",
} as const;

export type AiFeedbackAuditAction =
  (typeof AI_FEEDBACK_AUDIT_ACTIONS)[keyof typeof AI_FEEDBACK_AUDIT_ACTIONS];

type JsonRecord = Record<string, unknown>;

type AiFeedbackAuditDiffInput = {
  routeKey?: string | null;
  provider?: string | null;
  model?: string | null;
  promptVersion?: string | null;
  teacherDecision?: string | null;
  payload?: JsonRecord | null;
};

type RecordAiFeedbackAuditInput = AiFeedbackAuditDiffInput & {
  actorId?: string | null;
  action: AiFeedbackAuditAction;
  entity: string;
  entityId: string;
  entityIds?: JsonRecord;
};

type AuditLogClient = {
  auditLog: {
    create: typeof prisma.auditLog.create;
  };
};

const sensitiveKeyPattern =
  /(answer|body|explanation|failure|feedback|message|output|prompt|reason|response|secret|submission|text|token|key)/i;
const secretKeyPattern = /(secret|token|key|authorization|password)/i;
const safePolicyKeys = new Set([
  "writingFeedbackMode",
  "objectiveExplanations",
  "providerTier",
]);

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const record = value as JsonRecord;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function hashValue(value: unknown): string {
  return `sha256:${createHash("sha256").update(stableJson(value)).digest("hex")}`;
}

function summarizeSensitiveValue(value: unknown) {
  const serialized = typeof value === "string" ? value : stableJson(value);

  return {
    redacted: true,
    hash: hashValue(value),
    length: serialized.length,
  };
}

function summarizePayloadValue(key: string, value: unknown): unknown {
  if (value === undefined) {
    return undefined;
  }

  if (safePolicyKeys.has(key)) {
    return value;
  }

  if (secretKeyPattern.test(key)) {
    return { redacted: true, reason: "secret" };
  }

  if (sensitiveKeyPattern.test(key)) {
    return summarizeSensitiveValue(value);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => summarizePayloadValue(key, entry));
  }

  if (value && typeof value === "object") {
    return summarizePayload(value as JsonRecord);
  }

  return value;
}

function summarizePayload(payload: JsonRecord): JsonRecord {
  return Object.fromEntries(
    Object.entries(payload)
      .map(([key, value]) => [key, summarizePayloadValue(key, value)] as const)
      .filter(([, value]) => value !== undefined),
  );
}

export function buildAiFeedbackAuditDiff(
  input: AiFeedbackAuditDiffInput,
): Prisma.InputJsonObject {
  return {
    ...(input.routeKey ? { routeKey: input.routeKey } : {}),
    ...(input.provider ? { provider: input.provider } : {}),
    ...(input.model ? { model: input.model } : {}),
    ...(input.promptVersion ? { promptVersion: input.promptVersion } : {}),
    ...(input.teacherDecision ? { teacherDecision: input.teacherDecision } : {}),
    payloadSummary: summarizePayload(input.payload ?? {}),
  } as Prisma.InputJsonObject;
}

export async function recordAiFeedbackAudit(
  input: RecordAiFeedbackAuditInput,
  client: AuditLogClient = prisma,
): Promise<void> {
  await client.auditLog.create({
    data: {
      actorId: input.actorId ?? undefined,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      diff: {
        entityIds: input.entityIds ?? {},
        ...buildAiFeedbackAuditDiff(input),
      } as Prisma.InputJsonObject,
    },
  });
}

/**
 * File: src/modules/audit-logs/ai-feedback-audit.ts
 * Purpose: Persist typed audit entries for AI feedback workflows.
 * Why: AI feedback audit trails need traceability without any content-bearing escape hatch.
 */
import { prisma } from "../../prisma/client.js";
import type { AuditAction, AuditLogWriteInput } from "./audit-events.js";
import { writeAuditLog, writeAuditLogSafely } from "./audit-logs.service.js";

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

type RegisteredAiFeedbackAction = Extract<AuditAction, AiFeedbackAuditAction>;
type RecordAiFeedbackAuditInput = Extract<
  AuditLogWriteInput,
  { action: RegisteredAiFeedbackAction }
>;

type AuditLogClient = {
  auditLog: {
    create: typeof prisma.auditLog.create;
  };
};

export async function recordAiFeedbackAudit(
  input: RecordAiFeedbackAuditInput,
  client: AuditLogClient = prisma,
  safe = false,
): Promise<void> {
  if (safe) {
    await writeAuditLogSafely(input, client);
    return;
  }

  await writeAuditLog(input, client);
}

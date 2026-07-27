/**
 * File: tests/modules/ai-feedback/ai-feedback.audit.test.ts
 * Purpose: Verify AI feedback audit event contracts.
 * Why: Audit rows must reject student work, prompts, answers, and model output.
 */
import { describe, expect, it } from "vitest";

import { AI_FEEDBACK_AUDIT_ACTIONS } from "../../../src/modules/audit-logs/ai-feedback-audit.js";
import { parseAuditEvent } from "../../../src/modules/audit-logs/audit-events.js";

describe("AI feedback audit contracts", () => {
  it.each([
    ["prompt", "SYSTEM PROMPT: explain the answer."],
    ["submissionText", "My private essay submission."],
    ["acceptedAnswer", "B: private answer text"],
    ["providerOutput", '{"short_explanation":"private output"}'],
    ["explanation", "The full generated explanation."],
    ["apiKey", "sk-should-not-be-logged"],
  ])("rejects the private %s field", (field, value) => {
    expect(() =>
      parseAuditEvent({
        actorId: "7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2",
        action: AI_FEEDBACK_AUDIT_ACTIONS.explanationGenerated,
        entity: "ai_objective_explanation",
        entityId: "6c986d3c-5d72-40d4-96b5-b5e3725c9811",
        eventData: {
          submissionId: "11111111-1111-4111-8111-111111111111",
          assignmentId: "22222222-2222-4222-8222-222222222222",
          questionId: "question-1",
          routeKey: "low_cost",
          provider: "openai-compatible",
          model: "gpt-5.4-nano",
          promptVersion: "objective-explanation-v2",
          status: "completed",
          outputGenerated: true,
          [field]: value,
        },
      }),
    ).toThrow();
  });

  it("exposes stable action names for every AI feedback audit event", () => {
    expect(AI_FEEDBACK_AUDIT_ACTIONS).toEqual({
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
    });
  });
});

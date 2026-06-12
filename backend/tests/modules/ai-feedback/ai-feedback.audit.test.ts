/**
 * File: tests/modules/ai-feedback/ai-feedback.audit.test.ts
 * Purpose: Verify AI feedback audit payload redaction.
 * Why: Audit rows must be traceable without storing student work, prompts, or model output.
 */
import { describe, expect, it } from "vitest";

import {
  AI_FEEDBACK_AUDIT_ACTIONS,
  buildAiFeedbackAuditDiff,
} from "../../../src/modules/audit-logs/ai-feedback-audit.js";

describe("AI feedback audit redaction", () => {
  it("summarizes sensitive prompt, response, submission, answer, and explanation text", () => {
    const diff = buildAiFeedbackAuditDiff({
      routeKey: "low_cost",
      provider: "openai-compatible",
      model: "gpt-5.4-nano",
      promptVersion: "objective-explanation-v1",
      teacherDecision: "approved",
      payload: {
        prompt:
          "SYSTEM PROMPT: explain why the IELTS reading answer is correct.",
        submissionText:
          "My name is Minh and my full essay submission includes private details.",
        acceptedAnswer: "B: the private answer text",
        providerResponseBody:
          '{"short_explanation":"The answer is B because of paragraph two."}',
        explanation:
          "The full explanation includes the student's misconception.",
        apiKey: "sk-should-not-be-logged",
        providerRequestId: "req_123",
      },
    });

    expect(diff).toMatchObject({
      routeKey: "low_cost",
      provider: "openai-compatible",
      model: "gpt-5.4-nano",
      promptVersion: "objective-explanation-v1",
      teacherDecision: "approved",
      payloadSummary: {
        prompt: expect.objectContaining({
          redacted: true,
          hash: expect.stringMatching(/^sha256:/),
        }),
        submissionText: expect.objectContaining({ redacted: true }),
        acceptedAnswer: expect.objectContaining({ redacted: true }),
        providerResponseBody: expect.objectContaining({ redacted: true }),
        explanation: expect.objectContaining({ redacted: true }),
        providerRequestId: "req_123",
      },
    });
    expect(JSON.stringify(diff)).not.toContain("SYSTEM PROMPT");
    expect(JSON.stringify(diff)).not.toContain("Minh");
    expect(JSON.stringify(diff)).not.toContain("private answer text");
    expect(JSON.stringify(diff)).not.toContain("short_explanation");
    expect(JSON.stringify(diff)).not.toContain("sk-should-not-be-logged");
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

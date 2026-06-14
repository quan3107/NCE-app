/**
 * File: src/modules/ai-feedback/authenticity/index.ts
 * Purpose: Define advisory authenticity signal contracts for teacher review.
 * Why: Similarity and off-task signals must never become punitive or student-facing by default.
 */
export type AuthenticitySignalKind =
  | "copied_prompt_text"
  | "copied_sample_text"
  | "off_task_answer"
  | "suspicious_similarity";

export type AuthenticitySignalInput = {
  kind: AuthenticitySignalKind;
  confidence: number;
  evidence: string;
};

export type AuthenticitySignal = AuthenticitySignalInput & {
  visibility: "teacher_only";
  severity: "advisory";
  punitive: false;
};

export function createAuthenticitySignal(
  input: AuthenticitySignalInput,
): AuthenticitySignal {
  return {
    ...input,
    visibility: "teacher_only",
    severity: "advisory",
    punitive: false,
  };
}

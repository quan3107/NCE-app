/**
 * File: src/modules/ai-feedback/harness/index.ts
 * Purpose: Re-export AI feedback harness contracts and helpers.
 * Why: Queue workers and development tests should import the harness from one stable module boundary.
 */
export {
  evaluateAiFeedbackHarness,
  runAiFeedbackHarness,
} from './harness.service.js'
export {
  buildAiFeedbackHarnessReport,
  serializeAiFeedbackHarnessReport,
} from './harness.reporter.js'
export type {
  AiFeedbackHarnessInput,
  AiFeedbackHarnessReasonCode,
  AiFeedbackHarnessReport,
  AiFeedbackHarnessReportRow,
  AiFeedbackHarnessRequestAudit,
  AiFeedbackHarnessResult,
  AiFeedbackHarnessStatus,
  AiFeedbackHarnessTokenEstimate,
  ObjectiveExplanationHarnessInput,
  WritingFeedbackHarnessInput,
} from './harness.types.js'

/**
 * File: src/modules/ai-feedback/harness/harness.reporter.ts
 * Purpose: Build scrubbed machine-readable AI feedback harness reports.
 * Why: Harness failures must be debuggable without logging submissions or provider responses.
 */
import type {
  AiFeedbackHarnessReport,
  AiFeedbackHarnessResult,
} from './harness.types.js'

export function buildAiFeedbackHarnessReport(
  results: AiFeedbackHarnessResult[],
): AiFeedbackHarnessReport {
  const summary: AiFeedbackHarnessReport['summary'] = {
    accepted: 0,
    review_required: 0,
    rejected: 0,
    failed: 0,
  }

  for (const result of results) {
    summary[result.status] += 1
  }

  return {
    summary,
    rows: results.map((result) => ({
      fixtureId: result.fixtureId,
      taskType: result.taskType,
      status: result.status,
      reasonCode: result.reasonCode,
      promptVersion: result.promptVersion,
      ...(result.criteriaVersion ? { criteriaVersion: result.criteriaVersion } : {}),
      routeKey: result.routeKey,
      validationErrors: result.validationErrors,
      tokenEstimate: result.tokenEstimate,
      requestAudit: result.requestAudit,
    })),
  }
}

export function serializeAiFeedbackHarnessReport(
  report: AiFeedbackHarnessReport,
): string {
  return JSON.stringify(report, null, 2)
}

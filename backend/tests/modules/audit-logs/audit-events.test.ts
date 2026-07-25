/**
 * File: tests/modules/audit-logs/audit-events.test.ts
 * Purpose: Lock the reviewed inventory of registered audit actions.
 * Why: Adding, removing, or renaming an action must be an explicit contract review.
 */
import { describe, expect, it } from "vitest";

import { auditEventRegistry } from "../../../src/modules/audit-logs/audit-events.js";

const reviewedActions = [
  "ai_feedback.explanation_failed",
  "ai_feedback.explanation_generated",
  "ai_feedback.explanation_requested",
  "ai_feedback.grade_feedback_updated",
  "ai_feedback.policy_changed",
  "ai_feedback.writing_approved",
  "ai_feedback.writing_failed",
  "ai_feedback.writing_finalized",
  "ai_feedback.writing_generated",
  "ai_feedback.writing_rejected",
  "ai_feedback.writing_requested",
  "assignment.created",
  "assignment.deleted",
  "assignment.updated",
  "auth.google_login_succeeded",
  "auth.login_succeeded",
  "auth.registered",
  "auth.session_refreshed",
  "auth.session_revoked",
  "cleanup.retention_executed",
  "cms.draft_updated",
  "cms.homepage_stats_refreshed",
  "cms.published",
  "cms.rolled_back",
  "course.archived",
  "course.created",
  "course.restored",
  "course.student_added",
  "course.student_removed",
  "course.teacher_added",
  "course.teacher_removed",
  "course.updated",
  "dashboard_config.reset",
  "dashboard_config.saved",
  "enrollment.created",
  "enrollment.deleted",
  "grade.upserted",
  "submission.created",
  "submission.submitted",
  "submission.updated",
  "user.created",
  "user.invited",
  "user.teacher_approved",
  "user.teacher_rejected",
] as const;

describe("audit event registry", () => {
  it("registers every reviewed action exactly once", () => {
    expect(Object.keys(auditEventRegistry).sort()).toEqual(reviewedActions);
  });
});

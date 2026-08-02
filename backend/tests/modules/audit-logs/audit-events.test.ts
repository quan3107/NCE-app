/**
 * File: tests/modules/audit-logs/audit-events.test.ts
 * Purpose: Lock the reviewed inventory of registered audit actions.
 * Why: Adding, removing, or renaming an action must be an explicit contract review.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  auditEventRegistry,
  parseAuditEvent,
} from '../../../src/modules/audit-logs/audit-events.js'

const reviewedActions = [
  'ai_feedback.explanation_failed',
  'ai_feedback.explanation_generated',
  'ai_feedback.explanation_requested',
  'ai_feedback.grade_feedback_updated',
  'ai_feedback.policy_changed',
  'ai_feedback.writing_approved',
  'ai_feedback.writing_failed',
  'ai_feedback.writing_finalized',
  'ai_feedback.writing_generated',
  'ai_feedback.writing_rejected',
  'ai_feedback.writing_requested',
  'assignment.created',
  'assignment.deleted',
  'assignment.updated',
  'auth.google_login_succeeded',
  'auth.login_succeeded',
  'auth.registered',
  'auth.session_refreshed',
  'auth.session_revoked',
  'cleanup.retention_executed',
  'cms.draft_updated',
  'cms.homepage_stats_refreshed',
  'cms.published',
  'cms.rolled_back',
  'course.archived',
  'course.created',
  'course.restored',
  'course.student_added',
  'course.student_removed',
  'course.teacher_added',
  'course.teacher_removed',
  'course.updated',
  'dashboard_config.reset',
  'dashboard_config.saved',
  'enrollment.created',
  'enrollment.deleted',
  'grade.upserted',
  'settings.file_upload_limits_updated',
  'submission.created',
  'submission.submitted',
  'submission.updated',
  'user.created',
  'user.invited',
  'user.profile_updated',
  'user.teacher_approved',
  'user.teacher_rejected',
] as const

describe('audit event registry', () => {
  it('registers every reviewed action exactly once', () => {
    expect(Object.keys(auditEventRegistry).sort()).toEqual(reviewedActions)
  })

  it('accepts a no-change CMS publish marker', () => {
    expect(() =>
      parseAuditEvent({
        action: 'cms.published',
        entity: 'cms_page_content',
        entityId: '6c986d3c-5d72-40d4-96b5-b5e3725c9811',
        eventData: {
          pageKey: 'homepage',
          revisionId: '7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2',
          revisionNumber: 2,
          publishedContentChanged: false,
        },
      }),
    ).not.toThrow()
  })

  it('documents the strict profile update contract', () => {
    const contracts = readFileSync(
      resolve(process.cwd(), '../docs/audit-event-contracts.md'),
      'utf8',
    )
    expect(contracts).toMatch(
      /\| `user\.profile_updated` \| `user` \| `fullNameChanged` \| Strict \|/,
    )
  })
})

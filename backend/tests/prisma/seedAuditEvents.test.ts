/**
 * File: tests/prisma/seedAuditEvents.test.ts
 * Purpose: Verify seeded grade audit events target grades and satisfy shared contracts.
 * Why: Submission IDs are valid strings but semantically wrong identifiers for grade entities.
 */
import { describe, expect, it } from 'vitest'

import { buildSeedAuditEvent } from '../../src/prisma/seedAuditEvents.js'

describe('seed audit events', () => {
  it('uses the created grade ID as the grade entity identifier', () => {
    const event = buildSeedAuditEvent({
      actorId: 'teacher-1',
      action: 'grade.upserted',
      entity: 'grade',
      entityId: 'grade-1',
      eventData: {
        submissionId: 'submission-1',
        graderId: 'teacher-1',
        scoreChanged: true,
        feedbackChanged: true,
      },
    })

    expect(event).toEqual(
      expect.objectContaining({
        actorId: 'teacher-1',
        action: 'grade.upserted',
        entity: 'grade',
        entityId: 'grade-1',
        eventData: {
          submissionId: 'submission-1',
          graderId: 'teacher-1',
          scoreChanged: true,
          feedbackChanged: true,
        },
        schemaVersion: 1,
      }),
    )
  })
})

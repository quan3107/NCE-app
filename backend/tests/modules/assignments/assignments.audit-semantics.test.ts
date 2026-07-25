/**
 * File: tests/modules/assignments/assignments.audit-semantics.test.ts
 * Purpose: Verify update audits describe committed semantic assignment changes.
 * Why: Full-form payloads and newly materialized defaults must not create false markers.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { UserRole } from '../../../src/prisma/index.js'

vi.mock('../../../src/prisma/client.js', () => ({
  prisma: {
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
    assignment: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}))

const prismaModule = await import('../../../src/prisma/client.js')
const prisma = vi.mocked(prismaModule.prisma, true)

const { updateAssignment } =
  await import('../../../src/modules/assignments/assignments.service.js')

const courseId = '7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2'
const assignmentId = '6c986d3c-5d72-40d4-96b5-b5e3725c9811'
const ownerTeacher = { id: 'teacher-owner', role: UserRole.teacher }
const dueAt = new Date('2026-07-25T14:17:00.000Z')

const configWithoutMaterializedPolicy = {
  version: 1,
  timing: { enabled: true, durationMinutes: 60, enforce: false },
  instructions: 'Read and answer all questions.',
  attempts: { maxAttempts: null },
  sections: [],
}

const configWithObjectiveExplanations = {
  ...configWithoutMaterializedPolicy,
  aiPolicy: {
    writingFeedbackMode: 'off',
    objectiveExplanations: 'on_demand_student_visible',
    providerTier: 'auto',
  },
}

const configWithDefaultPolicy = {
  ...configWithoutMaterializedPolicy,
  aiPolicy: {
    writingFeedbackMode: 'off',
    objectiveExplanations: 'off',
    providerTier: 'auto',
  },
}

describe('assignments.service.updateAssignment audit semantics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prisma.$transaction.mockImplementation(async (callback) => callback(prisma))
  })

  it('marks only the semantic assignment and AI policy changes', async () => {
    const existing = {
      id: assignmentId,
      courseId,
      title: 'Reading Practice',
      description: 'Read carefully.',
      type: 'reading',
      dueAt,
      latePolicy: {},
      assignmentConfig: configWithoutMaterializedPolicy,
      publishedAt: null,
    }
    const updated = {
      ...existing,
      assignmentConfig: configWithObjectiveExplanations,
    }
    prisma.assignment.findFirst.mockResolvedValueOnce(existing as never)
    prisma.assignment.update.mockResolvedValueOnce(updated as never)

    await updateAssignment(
      { courseId, assignmentId },
      {
        title: existing.title,
        descriptionMd: existing.description,
        type: existing.type,
        dueAt: dueAt.toISOString(),
        latePolicy: {},
        assignmentConfig: configWithObjectiveExplanations,
      },
      ownerTeacher,
    )

    const assignmentEvent = prisma.auditLog.create.mock.calls.find(
      ([call]) => call.data.action === 'assignment.updated',
    )?.[0].data
    expect(assignmentEvent?.eventData).toEqual({
      courseId,
      assignmentConfigChanged: true,
    })

    const policyEvent = prisma.auditLog.create.mock.calls.find(
      ([call]) => call.data.action === 'ai_feedback.policy_changed',
    )?.[0].data
    expect(policyEvent?.eventData).toEqual({
      courseId,
      assignmentId,
      writingFeedbackModeChanged: false,
      objectiveExplanationsChanged: true,
      providerTierChanged: false,
    })
  })

  it('does not audit materialized AI policy defaults as changes', async () => {
    const existing = {
      id: assignmentId,
      courseId,
      title: 'Reading Practice',
      description: 'Read carefully.',
      type: 'reading',
      dueAt,
      latePolicy: {},
      assignmentConfig: configWithoutMaterializedPolicy,
      publishedAt: null,
    }
    prisma.assignment.findFirst.mockResolvedValueOnce(existing as never)
    prisma.assignment.update.mockResolvedValueOnce({
      ...existing,
      assignmentConfig: configWithDefaultPolicy,
    } as never)

    await updateAssignment(
      { courseId, assignmentId },
      {
        title: existing.title,
        descriptionMd: existing.description,
        type: existing.type,
        dueAt: dueAt.toISOString(),
        latePolicy: {},
        assignmentConfig: configWithDefaultPolicy,
      },
      ownerTeacher,
    )

    expect(prisma.auditLog.create).not.toHaveBeenCalled()
  })
})

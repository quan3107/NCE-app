/**
 * File: tests/modules/ai-feedback/ai-feedback.teacher-review.audit-semantics.test.ts
 * Purpose: Verify semantic grade-feedback markers during AI draft decisions.
 * Why: Approval lifecycle events must not claim unchanged grade feedback was updated.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AssignmentType, UserRole, UserStatus } from '../../../src/prisma/index.js'

vi.mock('../../../src/prisma/client.js', () => ({
  prisma: {
    auditLog: { create: vi.fn() },
    aiFeedbackDraft: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    grade: { update: vi.fn() },
    $transaction: vi.fn(),
  },
}))

const prismaModule = await import('../../../src/prisma/client.js')
const prisma = vi.mocked(prismaModule.prisma, true)
const { approveAiWritingFeedbackDraft, finalizeAiWritingFeedbackDraft } =
  await import('../../../src/modules/ai-feedback/ai-feedback.service.js')

const submissionId = '11111111-1111-4111-8111-111111111111'
const draftId = '22222222-2222-4222-8222-222222222222'
const gradeId = '33333333-3333-4333-8333-333333333333'
const teacherId = '44444444-4444-4444-8444-444444444444'
const unchangedFeedback = 'Existing teacher feedback.'
const actor = {
  id: teacherId,
  role: UserRole.teacher,
  status: UserStatus.active,
}

function draft(visibilityMode: 'teacher_reviewed' | 'instant_student_visible') {
  return {
    id: draftId,
    submissionId,
    assignmentId: '66666666-6666-4666-8666-666666666666',
    status: 'accepted',
    visibilityMode,
    generatedFeedback: {},
    teacherEditedFeedback: null,
    normalizedCriterionSuggestions: null,
    decision: null,
    decisionActorId: null,
    decidedAt: null,
    finalizedAt: null,
    failureCode: null,
    failureMessage: null,
    createdAt: new Date('2026-06-01T10:00:00.000Z'),
    updatedAt: new Date('2026-06-01T10:01:00.000Z'),
    gradeId,
    submission: {
      id: submissionId,
      grade: {
        id: gradeId,
        feedback: unchangedFeedback,
        deletedAt: null,
      },
      assignment: {
        type: AssignmentType.writing,
        course: {
          ownerId: teacherId,
          enrollments: [],
        },
      },
    },
  }
}

describe('AI teacher review audit semantics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prisma.$transaction.mockImplementation(async (callback) => callback(prisma))
    prisma.aiFeedbackDraft.updateMany.mockResolvedValue({ count: 1 } as never)
    prisma.grade.update.mockResolvedValue({ id: gradeId } as never)
  })

  it.each([
    {
      name: 'approval',
      visibilityMode: 'teacher_reviewed' as const,
      decide: approveAiWritingFeedbackDraft,
      writingAction: 'ai_feedback.writing_approved',
      status: 'approved',
    },
    {
      name: 'finalization',
      visibilityMode: 'instant_student_visible' as const,
      decide: finalizeAiWritingFeedbackDraft,
      writingAction: 'ai_feedback.writing_finalized',
      status: 'finalized',
    },
  ])('omits the grade feedback event for unchanged $name', async (scenario) => {
    const existingDraft = draft(scenario.visibilityMode)
    prisma.aiFeedbackDraft.findFirst.mockResolvedValue(existingDraft as never)
    prisma.aiFeedbackDraft.findUnique.mockResolvedValue({
      ...existingDraft,
      status: scenario.status,
      decision: scenario.status,
    } as never)

    await scenario.decide(
      { submissionId, draftId },
      { feedbackMd: unchangedFeedback },
      actor,
    )

    const events = prisma.auditLog.create.mock.calls.map((call) => call[0].data)
    expect(events).toContainEqual(
      expect.objectContaining({
        action: scenario.writingAction,
        eventData: expect.objectContaining({ feedbackChanged: false }),
      }),
    )
    expect(events.map((event) => event.action)).not.toContain(
      'ai_feedback.grade_feedback_updated',
    )
  })
})

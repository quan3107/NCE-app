/**
 * File: tests/modules/ai-feedback/ai-feedback.review-rejections.test.ts
 * Purpose: Verify teacher review and override decisions for AI writing feedback.
 * Why: AI-generated feedback must stay draft-only until an authorized teacher publishes it to a grade.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AssignmentType, UserRole, UserStatus } from '../../../src/prisma/index.js'

vi.mock('../../../src/prisma/client.js', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    auditLog: {
      create: vi.fn(),
    },
    aiFeedbackDraft: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    grade: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

const prismaModule = await import('../../../src/prisma/client.js')
const prisma = vi.mocked(prismaModule.prisma, true)
const transactionAuditLogCreate = vi.fn()

const { listAiWritingFeedbackDrafts, rejectAiWritingFeedbackDraft } =
  await import('../../../src/modules/ai-feedback/ai-feedback.service.js')

const submissionId = '11111111-1111-4111-8111-111111111111'
const draftId = '22222222-2222-4222-8222-222222222222'
const gradeId = '33333333-3333-4333-8333-333333333333'
const teacherId = '44444444-4444-4444-8444-444444444444'

const teacherActor = {
  id: teacherId,
  role: UserRole.teacher,
  status: UserStatus.active,
}

const baseDraft = {
  id: draftId,
  submissionId,
  assignmentId: '66666666-6666-4666-8666-666666666666',
  status: 'accepted',
  visibilityMode: 'teacher_reviewed',
  generatedFeedback: {
    summary: 'Good task response with uneven cohesion.',
  },
  teacherEditedFeedback: null,
  normalizedCriterionSuggestions: [
    { criterion: 'Task Response', points: 6.5 },
    { criterion: 'Coherence and Cohesion', points: 6 },
    { criterion: 'Lexical Resource', points: 6.5 },
    { criterion: 'Grammatical Range and Accuracy', points: 6 },
  ],
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
      feedback: 'Original teacher feedback.',
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

describe('AI writing feedback teacher review service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    transactionAuditLogCreate.mockReset()
    prisma.$transaction.mockImplementation(async (callback) => callback(prisma))
    prisma.grade.findFirst.mockResolvedValue(baseDraft.submission.grade as never)
    prisma.grade.update.mockResolvedValue({ id: gradeId } as never)
    prisma.aiFeedbackDraft.updateMany.mockResolvedValue({ count: 1 } as never)
    prisma.aiFeedbackDraft.findUnique.mockImplementation(
      async () =>
        ({
          ...baseDraft,
          status: 'approved',
          decision: 'approved',
          decisionActorId: teacherId,
          teacherEditedFeedback: {
            feedbackMd: 'Teacher-edited final feedback.',
          },
        }) as never,
    )
    prisma.aiFeedbackDraft.update.mockImplementation(
      async (args) =>
        ({
          ...baseDraft,
          ...args.data,
        }) as never,
    )
  })

  it('keeps rejected drafts for audit without updating grade feedback', async () => {
    prisma.$transaction.mockImplementation(async (callback) =>
      callback({
        ...prisma,
        auditLog: {
          create: transactionAuditLogCreate,
        },
      }),
    )
    prisma.aiFeedbackDraft.findFirst.mockResolvedValueOnce(baseDraft as never)
    prisma.aiFeedbackDraft.findUnique.mockResolvedValueOnce({
      ...baseDraft,
      status: 'rejected',
      decision: 'rejected',
      teacherEditedFeedback: {
        rejectionReason: 'Feedback overstated coherence.',
      },
    } as never)

    const response = await rejectAiWritingFeedbackDraft(
      { submissionId, draftId },
      { reason: 'Feedback overstated coherence.' },
      teacherActor,
    )

    expect(prisma.grade.update).not.toHaveBeenCalled()
    expect(prisma.aiFeedbackDraft.updateMany).toHaveBeenCalledWith({
      where: {
        id: draftId,
        deletedAt: null,
        decision: null,
        status: {
          in: ['accepted', 'review_required', 'failed'],
        },
      },
      data: expect.objectContaining({
        status: 'rejected',
        decision: 'rejected',
        decisionActorId: teacherId,
        teacherEditedFeedback: {
          rejectionReason: 'Feedback overstated coherence.',
        },
      }),
    })
    expect(transactionAuditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: teacherId,
        action: 'ai_feedback.writing_rejected',
        entity: 'ai_feedback_draft',
        entityId: draftId,
        eventData: expect.objectContaining({
          teacherDecision: 'rejected',
          feedbackChanged: true,
        }),
      }),
      select: { id: true },
    })
    expect(prisma.auditLog.create).not.toHaveBeenCalled()
    expect(JSON.stringify(transactionAuditLogCreate.mock.calls)).not.toContain(
      'Feedback overstated coherence.',
    )
    expect(response).toMatchObject({
      id: draftId,
      status: 'rejected',
    })
  })

  it('rejects drafts without requiring a request body', async () => {
    prisma.aiFeedbackDraft.findFirst.mockResolvedValueOnce(baseDraft as never)
    prisma.aiFeedbackDraft.findUnique.mockResolvedValueOnce({
      ...baseDraft,
      status: 'rejected',
      decision: 'rejected',
    } as never)

    await rejectAiWritingFeedbackDraft({ submissionId, draftId }, undefined, teacherActor)

    expect(prisma.aiFeedbackDraft.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'rejected',
          decision: 'rejected',
        }),
      }),
    )
  })

  it('keeps provider feedback visible in rejected draft history', async () => {
    prisma.aiFeedbackDraft.findMany.mockResolvedValueOnce([
      {
        ...baseDraft,
        status: 'rejected',
        decision: 'rejected',
        teacherEditedFeedback: {
          rejectionReason: 'Feedback overstated coherence.',
        },
      },
    ] as never)

    const drafts = await listAiWritingFeedbackDrafts({ submissionId }, teacherActor)

    expect(drafts[0]).toMatchObject({
      status: 'rejected',
      feedback: baseDraft.generatedFeedback,
      teacherEditedFeedback: {
        rejectionReason: 'Feedback overstated coherence.',
      },
    })
  })
})

/**
 * File: tests/modules/grades/grades.audit-semantics.test.ts
 * Purpose: Verify grade audit markers describe committed semantic changes.
 * Why: Re-submitting an unchanged grade must not produce a false score/feedback event.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AssignmentType, UserRole } from '../../../src/prisma/index.js'

vi.mock('../../../src/prisma/client.js', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
    submission: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    grade: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
    },
  },
}))
vi.mock('../../../src/modules/notifications/notifications.service.js', () => ({
  enqueueNotification: vi.fn(),
}))
vi.mock('../../../src/modules/ai-feedback/ai-feedback.repository.js', () => ({
  getStudentVisibleAiFeedbackDraft: vi.fn(),
}))
vi.mock('../../../src/modules/audit-logs/audit-logs.service.js', () => ({
  writeAuditLogSafely: vi.fn(),
}))

const prismaModule = await import('../../../src/prisma/client.js')
const prisma = vi.mocked(prismaModule.prisma, true)
const auditModule = await import('../../../src/modules/audit-logs/audit-logs.service.js')
const writeAuditLogSafely = vi.mocked(auditModule.writeAuditLogSafely)
const { upsertGrade } = await import('../../../src/modules/grades/grades.service.js')

const submissionId = '2520f0dd-918a-4c2b-9544-b922eac066e5'
const teacherId = 'db2b572b-ef7d-44b3-96c6-a61c498cf673'
const secondTeacherId = 'de54dc98-bc9f-41df-9ec0-5b719d8fab61'
const studentId = '4335e34e-7ecb-4a31-ae53-b04c44cd7c09'
const existingGrade = {
  id: 'grade-1',
  submissionId,
  graderId: teacherId,
  rubricBreakdown: [{ criterion: 'Accuracy', points: 8 }],
  rawScore: 8,
  adjustments: [{ reason: 'None', delta: 0 }],
  finalScore: 8,
  band: 8,
  feedback: 'Clear work.',
}

describe('grades.service.upsertGrade audit semantics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prisma.$transaction.mockImplementation(async (callback) => callback(prisma))
    prisma.submission.findFirst.mockResolvedValue({
      id: submissionId,
      assignment: {
        id: '7a7510e2-5fac-46e6-a2d1-6d30c87bcc0c',
        title: 'Writing Task',
        type: AssignmentType.text,
        courseId: '87ab2f6a-016b-4f4d-ab68-bc574ae3a660',
        course: { title: 'Course', ownerId: secondTeacherId, enrollments: [] },
      },
      student: { id: studentId },
    } as never)
    prisma.submission.update.mockResolvedValue({ id: submissionId } as never)
  })

  it('preserves attribution when another teacher submits an unchanged grade', async () => {
    prisma.grade.findFirst.mockResolvedValueOnce(existingGrade as never)
    prisma.grade.upsert.mockResolvedValueOnce(existingGrade as never)

    await upsertGrade(
      { submissionId },
      {
        rubricBreakdown: existingGrade.rubricBreakdown,
        rawScore: existingGrade.rawScore,
        adjustments: existingGrade.adjustments,
        finalScore: existingGrade.finalScore,
        band: existingGrade.band,
        feedbackMd: existingGrade.feedback,
      },
      { id: secondTeacherId, role: UserRole.teacher },
    )

    expect(prisma.grade.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.not.objectContaining({
          graderId: expect.anything(),
          gradedAt: expect.anything(),
        }),
      }),
    )
    expect(writeAuditLogSafely).not.toHaveBeenCalled()
  })
})

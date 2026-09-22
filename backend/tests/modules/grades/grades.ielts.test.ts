/**
 * File: tests/modules/grades/grades.ielts.test.ts
 * Purpose: Verify grade writes derive grader identity from authenticated actors.
 * Why: Prevents clients from spoofing grading ownership or grading outside-course submissions.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AssignmentType, UserRole } from '../../../src/prisma/index.js'

vi.mock('../../../src/prisma/client.js', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    submission: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    grade: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
    },
    $transaction: vi.fn(),
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

const { upsertGrade } = await import('../../../src/modules/grades/grades.service.js')

const submissionId = '2520f0dd-918a-4c2b-9544-b922eac066e5'
const teacherId = 'db2b572b-ef7d-44b3-96c6-a61c498cf673'
const studentId = '4335e34e-7ecb-4a31-ae53-b04c44cd7c09'

function buildSubmission(overrides: Record<string, unknown> = {}) {
  return {
    id: submissionId,
    assignment: {
      id: '7a7510e2-5fac-46e6-a2d1-6d30c87bcc0c',
      title: 'Writing Task',
      type: AssignmentType.text,
      courseId: '87ab2f6a-016b-4f4d-ab68-bc574ae3a660',
      course: {
        title: 'IELTS Writing',
        ownerId: teacherId,
        enrollments: [],
      },
    },
    student: {
      id: studentId,
    },
    ...overrides,
  }
}

describe('grades.service.upsertGrade', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prisma.submission.findUnique.mockImplementation(
      async () => await prisma.submission.findFirst.mock.results.at(-1)?.value,
    )
    prisma.grade.findFirst.mockResolvedValue(null)
    prisma.grade.upsert.mockResolvedValue({ id: 'grade-1' } as never)
    prisma.submission.update.mockResolvedValue({ id: submissionId } as never)
    prisma.$transaction.mockImplementation(async (callback) => callback(prisma))
  })

  it('derives IELTS writing band grades from valid criterion breakdowns', async () => {
    prisma.submission.findFirst.mockResolvedValueOnce(
      buildSubmission({
        assignment: {
          id: '7a7510e2-5fac-46e6-a2d1-6d30c87bcc0c',
          title: 'Writing Task 2',
          type: AssignmentType.writing,
          courseId: '87ab2f6a-016b-4f4d-ab68-bc574ae3a660',
          course: {
            title: 'IELTS Writing',
            ownerId: teacherId,
            enrollments: [],
          },
        },
      }) as never,
    )

    await upsertGrade(
      { submissionId },
      {
        rubricBreakdown: [
          { criterion: 'Task Response', points: 6.5 },
          { criterion: 'Coherence and Cohesion', points: 7 },
          { criterion: 'Lexical Resource', points: 7.5 },
          { criterion: 'Grammatical Range and Accuracy', points: 6.5 },
        ],
        finalScore: 1,
        band: 1,
        feedbackMd: 'Clear response with occasional grammar issues.',
      },
      { id: teacherId, role: UserRole.teacher },
    )

    expect(prisma.grade.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          rubricBreakdown: [
            { criterion: 'Task Response', points: 6.5 },
            { criterion: 'Coherence and Cohesion', points: 7 },
            { criterion: 'Lexical Resource', points: 7.5 },
            { criterion: 'Grammatical Range and Accuracy', points: 6.5 },
          ],
          rawScore: 7,
          finalScore: 7,
          band: 7,
          feedback: 'Clear response with occasional grammar issues.',
        }),
      }),
    )
  })

  it('derives IELTS writing band grades from task-specific criterion breakdowns', async () => {
    prisma.submission.findFirst.mockResolvedValueOnce(
      buildSubmission({
        assignment: {
          id: '7a7510e2-5fac-46e6-a2d1-6d30c87bcc0c',
          title: 'Writing Full Test',
          type: AssignmentType.writing,
          courseId: '87ab2f6a-016b-4f4d-ab68-bc574ae3a660',
          course: {
            title: 'IELTS Writing',
            ownerId: teacherId,
            enrollments: [],
          },
        },
      }) as never,
    )

    await upsertGrade(
      { submissionId },
      {
        rubricBreakdown: [
          { criterion: 'Task 1 - Task Achievement', points: 6 },
          { criterion: 'Task 1 - Coherence and Cohesion', points: 6.5 },
          { criterion: 'Task 1 - Lexical Resource', points: 6.5 },
          {
            criterion: 'Task 1 - Grammatical Range and Accuracy',
            points: 6,
          },
          { criterion: 'Task 2 - Task Response', points: 7 },
          { criterion: 'Task 2 - Coherence and Cohesion', points: 7 },
          { criterion: 'Task 2 - Lexical Resource', points: 7.5 },
          {
            criterion: 'Task 2 - Grammatical Range and Accuracy',
            points: 7,
          },
        ],
      },
      { id: teacherId, role: UserRole.teacher },
    )

    expect(prisma.grade.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          band: 7,
          finalScore: 7,
          rawScore: 7,
        }),
      }),
    )
  })

  it('rejects IELTS writing grades with non-half-step bands', async () => {
    prisma.submission.findFirst.mockResolvedValueOnce(
      buildSubmission({
        assignment: {
          id: '7a7510e2-5fac-46e6-a2d1-6d30c87bcc0c',
          title: 'Writing Task 1',
          type: AssignmentType.writing,
          courseId: '87ab2f6a-016b-4f4d-ab68-bc574ae3a660',
          course: {
            title: 'IELTS Writing',
            ownerId: teacherId,
            enrollments: [],
          },
        },
      }) as never,
    )

    await expect(
      upsertGrade(
        { submissionId },
        {
          rubricBreakdown: [
            { criterion: 'Task Achievement', points: 6.25 },
            { criterion: 'Coherence and Cohesion', points: 7 },
            { criterion: 'Lexical Resource', points: 7 },
            { criterion: 'Grammatical Range and Accuracy', points: 7 },
          ],
        },
        { id: teacherId, role: UserRole.teacher },
      ),
    ).rejects.toThrow(/0\.5 increments/)

    expect(prisma.grade.upsert).not.toHaveBeenCalled()
  })

  it('rejects IELTS speaking grades with non-speaking criteria', async () => {
    prisma.submission.findFirst.mockResolvedValueOnce(
      buildSubmission({
        assignment: {
          id: '7a7510e2-5fac-46e6-a2d1-6d30c87bcc0c',
          title: 'Speaking Interview',
          type: AssignmentType.speaking,
          courseId: '87ab2f6a-016b-4f4d-ab68-bc574ae3a660',
          course: {
            title: 'IELTS Speaking',
            ownerId: teacherId,
            enrollments: [],
          },
        },
      }) as never,
    )

    await expect(
      upsertGrade(
        { submissionId },
        {
          rubricBreakdown: [
            { criterion: 'Task Response', points: 7 },
            { criterion: 'Coherence and Cohesion', points: 7 },
            { criterion: 'Lexical Resource', points: 7 },
            { criterion: 'Grammatical Range and Accuracy', points: 7 },
          ],
        },
        { id: teacherId, role: UserRole.teacher },
      ),
    ).rejects.toThrow(/IELTS speaking criteria/)

    expect(prisma.grade.upsert).not.toHaveBeenCalled()
  })
})

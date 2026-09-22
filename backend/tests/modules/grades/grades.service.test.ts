/**
 * File: tests/modules/grades/grades.service.test.ts
 * Purpose: Verify grade writes derive grader identity from authenticated actors.
 * Why: Prevents clients from spoofing grading ownership or grading outside-course submissions.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AssignmentType, EnrollmentRole, UserRole } from '../../../src/prisma/index.js'

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
const notificationsModule =
  await import('../../../src/modules/notifications/notifications.service.js')
const enqueueNotification = vi.mocked(notificationsModule.enqueueNotification, true)
const auditLogsModule =
  await import('../../../src/modules/audit-logs/audit-logs.service.js')
const writeAuditLogSafely = vi.mocked(auditLogsModule.writeAuditLogSafely, true)

const { upsertGrade } = await import('../../../src/modules/grades/grades.service.js')
const { gradePayloadSchema } =
  await import('../../../src/modules/grades/grades.schema.js')

const submissionId = '2520f0dd-918a-4c2b-9544-b922eac066e5'
const teacherId = 'db2b572b-ef7d-44b3-96c6-a61c498cf673'
const adminId = 'd5ef35a6-6907-47e8-9c34-5849656d827f'
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

  it('rejects a grade calculated for content replaced while waiting for the lock', async () => {
    prisma.submission.findFirst.mockResolvedValueOnce(
      buildSubmission({ payload: { version: 1 } }) as never,
    )
    prisma.submission.findUnique.mockResolvedValueOnce({
      payload: { version: 2 },
    } as never)
    await expect(
      upsertGrade(
        { submissionId },
        { rawScore: 80, finalScore: 80 },
        { id: teacherId, role: UserRole.teacher },
      ),
    ).rejects.toMatchObject({ statusCode: 409 })
    expect(prisma.grade.upsert).not.toHaveBeenCalled()
  })

  it('rejects feedback from a form opened before an already-completed replacement', async () => {
    prisma.submission.findFirst.mockResolvedValueOnce(
      buildSubmission({ payload: { version: 2 } }) as never,
    )
    await expect(
      upsertGrade(
        { submissionId },
        { expectedSubmissionVersion: 1, rawScore: 80, finalScore: 80 },
        { id: teacherId, role: UserRole.teacher },
      ),
    ).rejects.toMatchObject({ statusCode: 409 })
    expect(prisma.grade.upsert).not.toHaveBeenCalled()
  })

  it('persists the authenticated teacher as grader without a graderId payload', async () => {
    prisma.submission.findFirst.mockResolvedValueOnce(buildSubmission() as never)

    const grade = await upsertGrade(
      { submissionId },
      {
        finalScore: 7,
        feedbackMd: 'Clear organization.',
      },
      { id: teacherId, role: UserRole.teacher },
    )

    expect(prisma.grade.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          submissionId,
          graderId: teacherId,
          finalScore: 7,
          feedback: 'Clear organization.',
        }),
        update: expect.objectContaining({
          graderId: teacherId,
          finalScore: 7,
          feedback: 'Clear organization.',
        }),
      }),
    )
    expect(enqueueNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: studentId,
        type: 'graded',
      }),
      prisma,
    )
    expect(grade).toEqual({ id: 'grade-1' })
  })

  it('writes a grade.upserted audit log with grading fields', async () => {
    prisma.submission.findFirst.mockResolvedValueOnce(buildSubmission() as never)
    prisma.grade.upsert.mockResolvedValueOnce({
      id: 'grade-audit-1',
      submissionId,
      graderId: teacherId,
      rawScore: 6,
      finalScore: 7,
      band: 7,
      feedback: 'Detailed private feedback.',
    } as never)

    await upsertGrade(
      { submissionId },
      {
        rawScore: 6,
        finalScore: 7,
        band: 7,
        feedbackMd: 'Detailed private feedback.',
      },
      { id: teacherId, role: UserRole.teacher },
    )

    expect(writeAuditLogSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: teacherId,
        action: 'grade.upserted',
        entity: 'grade',
        entityId: 'grade-audit-1',
        eventData: expect.objectContaining({
          submissionId,
          graderId: teacherId,
          scoreChanged: true,
          feedbackChanged: true,
        }),
      }),
    )
  })

  it('marks rubric-only grade mutations as score changes', async () => {
    prisma.submission.findFirst.mockResolvedValueOnce(buildSubmission() as never)
    prisma.grade.upsert.mockResolvedValueOnce({
      id: 'grade-1',
      rubricBreakdown: [{ criterion: 'Accuracy', points: 8 }],
    } as never)

    await upsertGrade(
      { submissionId },
      {
        rubricBreakdown: [{ criterion: 'Accuracy', points: 8 }],
      },
      { id: teacherId, role: UserRole.teacher },
    )

    expect(writeAuditLogSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventData: expect.objectContaining({
          scoreChanged: true,
          feedbackChanged: false,
        }),
      }),
    )
  })

  it('marks adjustment-only grade mutations as score changes', async () => {
    prisma.submission.findFirst.mockResolvedValueOnce(buildSubmission() as never)
    prisma.grade.upsert.mockResolvedValueOnce({
      id: 'grade-1',
      adjustments: [{ reason: 'Late penalty', delta: -1 }],
    } as never)

    await upsertGrade(
      { submissionId },
      {
        adjustments: [{ reason: 'Late penalty', delta: -1 }],
      },
      { id: teacherId, role: UserRole.teacher },
    )

    expect(writeAuditLogSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventData: expect.objectContaining({
          scoreChanged: true,
          feedbackChanged: false,
        }),
      }),
    )
  })

  it('loads grade targets only from active assignments and courses', async () => {
    prisma.submission.findFirst.mockResolvedValueOnce(buildSubmission() as never)

    await upsertGrade(
      { submissionId },
      { finalScore: 7 },
      { id: teacherId, role: UserRole.teacher },
    )

    expect(prisma.submission.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: submissionId,
          deletedAt: null,
          assignment: {
            deletedAt: null,
            course: {
              deletedAt: null,
            },
          },
        },
      }),
    )
  })

  it('rejects client-supplied grader identity fields', () => {
    expect(() =>
      gradePayloadSchema.parse({
        graderId: '7498e33b-e545-40c1-9bc4-64167065dd73',
        finalScore: 7,
      }),
    ).toThrow()
  })

  it('persists an authenticated admin as grader', async () => {
    prisma.submission.findFirst.mockResolvedValueOnce(buildSubmission() as never)

    await upsertGrade(
      { submissionId },
      { finalScore: 8 },
      { id: adminId, role: UserRole.admin },
    )

    expect(prisma.grade.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          graderId: adminId,
        }),
        update: expect.objectContaining({
          graderId: adminId,
        }),
      }),
    )
  })

  it('allows enrolled co-teachers to grade', async () => {
    const coTeacherId = 'e7e2ca20-84b8-492a-bb63-c567d26daf13'
    prisma.submission.findFirst.mockResolvedValueOnce(
      buildSubmission({
        assignment: {
          id: '7a7510e2-5fac-46e6-a2d1-6d30c87bcc0c',
          title: 'Writing Task',
          courseId: '87ab2f6a-016b-4f4d-ab68-bc574ae3a660',
          course: {
            title: 'IELTS Writing',
            ownerId: teacherId,
            enrollments: [
              {
                userId: coTeacherId,
                roleInCourse: EnrollmentRole.teacher,
                deletedAt: null,
              },
            ],
          },
        },
      }) as never,
    )

    await upsertGrade(
      { submissionId },
      { finalScore: 7 },
      { id: coTeacherId, role: UserRole.teacher },
    )

    expect(prisma.grade.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          graderId: coTeacherId,
        }),
      }),
    )
  })

  it('rejects outside-course teachers', async () => {
    prisma.submission.findFirst.mockResolvedValueOnce(buildSubmission() as never)

    await expect(
      upsertGrade(
        { submissionId },
        { finalScore: 7 },
        {
          id: 'a5e5e576-db88-49b9-a301-a7db36b1d195',
          role: UserRole.teacher,
        },
      ),
    ).rejects.toMatchObject({ statusCode: 403 })

    expect(prisma.grade.upsert).not.toHaveBeenCalled()
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})

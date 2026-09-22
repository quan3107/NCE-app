/**
 * File: tests/modules/submissions/submissions.service.test.ts
 * Purpose: Validate IELTS submission payload handling in the service layer.
 * Why: Ensures valid payloads persist once assignment types are verified.
 */
import { describe, expect, it, beforeEach, vi } from 'vitest'
import type { Assignment, Submission } from '../../../src/prisma/index.js'

vi.mock('../../../src/prisma/client.js', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
    aiFeedbackDraft: { updateMany: vi.fn() },
    aiObjectiveExplanation: { updateMany: vi.fn() },
    grade: { findFirst: vi.fn(), update: vi.fn() },
    assignment: {
      findFirst: vi.fn(),
    },
    enrollment: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    submission: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))
vi.mock('../../../src/modules/scoring/ieltsScoring.service.js', () => ({
  autoScoreSubmission: vi.fn(),
}))
vi.mock('../../../src/modules/ai-feedback/ai-feedback.service.js', () => ({
  enqueueAiWritingFeedbackForSubmission: vi.fn(),
}))
vi.mock(
  '../../../src/modules/notification-preferences/notification-preferences.service.js',
  () => ({
    resolveNotificationTypeEnabledForUsers: vi.fn(),
  }),
)
vi.mock('../../../src/modules/notifications/notifications.service.js', () => ({
  enqueueNotification: vi.fn(),
}))
vi.mock('../../../src/modules/audit-logs/audit-logs.service.js', () => ({
  writeAuditLogSafely: vi.fn(),
}))

const prismaModule = await import('../../../src/prisma/client.js')
const prisma = vi.mocked(prismaModule.prisma, true)
const notificationPreferencesModule =
  await import('../../../src/modules/notification-preferences/notification-preferences.service.js')
const resolveNotificationTypeEnabledForUsers = vi.mocked(
  notificationPreferencesModule.resolveNotificationTypeEnabledForUsers,
  true,
)
const auditLogsModule =
  await import('../../../src/modules/audit-logs/audit-logs.service.js')
const writeAuditLogSafely = vi.mocked(auditLogsModule.writeAuditLogSafely, true)

const { createSubmission, listSubmissions } =
  await import('../../../src/modules/submissions/submissions.service.js')
const { createSubmissionSchema } =
  await import('../../../src/modules/submissions/submissions.schema.js')

const assignmentId = '4c67e29f-7a7b-4c3e-8d56-52e5487e59a1'
const studentId = 'b9a2031b-9eac-4c77-9f11-4e7fbf3b5c2b'

describe('submissions.service.createSubmission', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    prisma.$queryRaw.mockImplementation(async (query) =>
      String(query.sql).includes('clock_timestamp')
        ? [{ now: new Date() }]
        : [{ id: 'enrolled' }],
    )
    prisma.grade.findFirst.mockResolvedValue(null)
    prisma.$transaction.mockImplementation(async (callback) => callback(prisma))
    prisma.enrollment.findFirst.mockResolvedValue({
      id: 'a0c0fb2e-f9ef-4b4c-8c7e-69235fd247c8',
    })
    prisma.enrollment.findMany.mockResolvedValue([])
    resolveNotificationTypeEnabledForUsers.mockResolvedValue(new Map())
  })

  it('persists valid IELTS submission payloads for the authenticated student', async () => {
    const assignmentRecord: Assignment = {
      id: assignmentId,
      courseId: '8a7c1b41-2a1c-4f6d-9f6d-3f2a0e8e2c15',
      title: 'Reading Practice',
      description: null,
      type: 'reading',
      dueAt: null,
      latePolicy: null,
      assignmentConfig: null,
      publishedAt: new Date('2026-01-01T00:00:00.000Z'),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      deletedAt: null,
    }

    prisma.assignment.findFirst.mockResolvedValue(assignmentRecord)
    prisma.submission.findUnique.mockResolvedValueOnce(null)
    const record = { id: 'submission-1' } as Submission
    prisma.submission.create.mockResolvedValueOnce(record)

    const payload = {
      payload: {
        version: 1,
        answers: [{ questionId: 'q1', value: 'A' }],
      },
    }

    const result = await createSubmission({ assignmentId }, payload, {
      id: studentId,
      role: 'student',
    })

    expect(prisma.submission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assignmentId,
          studentId,
          status: 'draft',
          payload: expect.objectContaining({
            version: 1,
          }),
        }),
      }),
    )
    expect(result).toBe(record)
  })

  it('writes a submission.created audit log with summarized payload details', async () => {
    const assignmentRecord = {
      id: assignmentId,
      courseId: '8a7c1b41-2a1c-4f6d-9f6d-3f2a0e8e2c15',
      title: 'Writing Practice',
      type: 'writing',
      assignmentConfig: null,
      dueAt: null,
      latePolicy: null,
      publishedAt: new Date('2026-01-01T00:00:00.000Z'),
      course: {
        title: 'IELTS Writing',
      },
    }
    const submission = {
      id: 'submission-audit-created',
      payload: { task1: { text: 'A'.repeat(5000) }, task2: { text: 'B'.repeat(5000) } },
      status: 'draft',
      submittedAt: null,
    } as Submission

    prisma.assignment.findFirst.mockResolvedValue(assignmentRecord)
    prisma.submission.findUnique.mockResolvedValueOnce(null)
    prisma.submission.create.mockResolvedValueOnce(submission)

    await createSubmission(
      { assignmentId },
      {
        payload: {
          version: 1,
          task1: { text: 'A'.repeat(5000) },
          task2: { text: 'B'.repeat(5000) },
        },
      },
      { id: studentId, role: 'student' },
    )

    expect(writeAuditLogSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: studentId,
        action: 'submission.created',
        entity: 'submission',
        entityId: submission.id,
        eventData: expect.objectContaining({
          assignmentId,
          courseId: assignmentRecord.courseId,
          studentId,
          statusBefore: null,
          statusAfter: 'draft',
          submittedAtChanged: false,
          submissionContentChanged: true,
        }),
      }),
    )
    expect(JSON.stringify(writeAuditLogSafely.mock.calls[0])).not.toContain('AAAA')
  })

  it('writes submission.submitted audit logs for draft-to-submitted updates', async () => {
    const submittedAt = new Date('2026-02-09T10:00:00.000Z')
    const assignmentRecord = {
      id: assignmentId,
      courseId: 'course-audit-submit',
      title: 'Reading Practice',
      type: 'reading',
      assignmentConfig: null,
      dueAt: null,
      latePolicy: null,
      publishedAt: new Date('2026-01-01T00:00:00.000Z'),
      course: {
        title: 'IELTS Reading',
      },
    }
    const existingSubmission = {
      id: 'submission-audit-submitted',
      status: 'draft',
      submittedAt: null,
      payload: { version: 1 },
    } as Submission
    const updatedSubmission = {
      id: existingSubmission.id,
      status: 'submitted',
      submittedAt,
    } as Submission

    prisma.assignment.findFirst.mockResolvedValue(assignmentRecord)
    prisma.submission.findUnique.mockResolvedValue(existingSubmission)
    prisma.submission.update.mockResolvedValueOnce(updatedSubmission)

    await createSubmission(
      { assignmentId },
      {
        submittedAt: submittedAt.toISOString(),
        status: 'submitted',
        payload: {
          version: 1,
          answers: [{ questionId: 'q1', value: 'A' }],
        },
      },
      { id: studentId, role: 'student' },
    )

    expect(writeAuditLogSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: studentId,
        action: 'submission.submitted',
        entity: 'submission',
        entityId: existingSubmission.id,
        eventData: expect.objectContaining({
          assignmentId,
          courseId: assignmentRecord.courseId,
          studentId,
          statusBefore: 'draft',
          statusAfter: 'submitted',
          submittedAtChanged: true,
          submissionContentChanged: true,
        }),
      }),
    )
  })

  it('writes submission.updated audit logs for existing draft saves', async () => {
    const assignmentRecord = {
      id: assignmentId,
      courseId: 'course-audit-update',
      title: 'Reading Practice',
      type: 'reading',
      assignmentConfig: null,
      dueAt: null,
      latePolicy: null,
      publishedAt: new Date('2026-01-01T00:00:00.000Z'),
      course: {
        title: 'IELTS Reading',
      },
    }
    const existingSubmission = {
      id: 'submission-audit-updated',
      status: 'draft',
      submittedAt: null,
      payload: { version: 1 },
    } as Submission
    const updatedSubmission = {
      id: existingSubmission.id,
      status: 'draft',
      submittedAt: null,
    } as Submission

    prisma.assignment.findFirst.mockResolvedValue(assignmentRecord)
    prisma.submission.findUnique.mockResolvedValue(existingSubmission)
    prisma.submission.update.mockResolvedValueOnce(updatedSubmission)

    await createSubmission(
      { assignmentId },
      {
        status: 'draft',
        payload: {
          version: 1,
          answers: [{ questionId: 'q1', value: 'B' }],
        },
      },
      { id: studentId, role: 'student' },
    )

    expect(writeAuditLogSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: studentId,
        action: 'submission.updated',
        entity: 'submission',
        entityId: existingSubmission.id,
        eventData: expect.objectContaining({
          assignmentId,
          courseId: assignmentRecord.courseId,
          studentId,
          statusBefore: 'draft',
          statusAfter: 'draft',
          submittedAtChanged: false,
          submissionContentChanged: true,
        }),
      }),
    )
  })

  it('suppresses an unchanged existing draft audit', async () => {
    const assignmentRecord = {
      id: assignmentId,
      courseId: 'course-audit-noop',
      title: 'Reading Practice',
      type: 'reading',
      assignmentConfig: null,
      dueAt: null,
      latePolicy: null,
      publishedAt: new Date('2026-01-01T00:00:00.000Z'),
      course: { title: 'IELTS Reading' },
    }
    const payload = {
      version: 1,
      answers: [{ questionId: 'q1', value: 'B' }],
    }
    const existingSubmission = {
      id: 'submission-audit-noop',
      status: 'draft',
      submittedAt: null,
      payload,
    } as Submission
    prisma.assignment.findFirst.mockResolvedValue(assignmentRecord)
    prisma.submission.findUnique.mockResolvedValue(existingSubmission)
    prisma.submission.update.mockResolvedValueOnce(existingSubmission)

    await createSubmission(
      { assignmentId },
      { status: 'draft', payload },
      { id: studentId, role: 'student' },
    )

    expect(writeAuditLogSafely).not.toHaveBeenCalled()
  })

  it('does not create submissions for assignments in archived courses', async () => {
    prisma.assignment.findFirst.mockImplementationOnce(async (args) =>
      args?.where?.course?.deletedAt === null ? null : ({} as Assignment),
    )

    await expect(
      createSubmission(
        { assignmentId },
        {
          payload: {
            version: 1,
            answers: [{ questionId: 'q1', value: 'A' }],
          },
        },
        { id: studentId, role: 'student' },
      ),
    ).rejects.toMatchObject({ statusCode: 404 })

    expect(prisma.submission.create).not.toHaveBeenCalled()
  })

  it('lists submissions only for assignments in active courses', async () => {
    prisma.submission.findMany.mockResolvedValueOnce([])

    await listSubmissions({ assignmentId }, {}, { id: studentId, role: 'student' })

    expect(prisma.submission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          assignment: {
            course: {
              deletedAt: null,
            },
          },
        }),
      }),
    )
  })

  it('rejects client-supplied student identity fields', () => {
    expect(() =>
      createSubmissionSchema.parse({
        studentId: 'b5eb3d3c-b13f-4b3b-a93f-910fbb2a3c13',
        payload: {
          version: 1,
          answers: [{ questionId: 'q1', value: 'A' }],
        },
      }),
    ).toThrow()
  })
})

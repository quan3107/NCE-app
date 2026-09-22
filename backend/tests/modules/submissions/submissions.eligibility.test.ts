/**
 * File: tests/modules/submissions/submissions.eligibility.test.ts
 * Purpose: Verify publication and enrollment guards before persistence.
 * Why: Prevents students from submitting unavailable or closed assignment work.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Assignment, Enrollment, Submission } from '../../../src/prisma/index.js'

vi.mock('../../../src/prisma/client.js', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
    assignment: {
      findFirst: vi.fn(),
    },
    enrollment: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    submission: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))
vi.mock('../../../src/modules/scoring/ieltsScoring.service.js', () => ({
  autoScoreSubmission: vi.fn(),
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

const prismaModule = await import('../../../src/prisma/client.js')
const prisma = vi.mocked(prismaModule.prisma, true)
const { createSubmission } =
  await import('../../../src/modules/submissions/submissions.service.js')

const assignmentId = '4c67e29f-7a7b-4c3e-8d56-52e5487e59a1'
const courseId = '8a7c1b41-2a1c-4f6d-9f6d-3f2a0e8e2c15'
const studentId = 'b9a2031b-9eac-4c77-9f11-4e7fbf3b5c2b'

function buildAssignment(overrides: Partial<Assignment> = {}): Assignment & {
  course: { title: string }
} {
  return {
    id: assignmentId,
    courseId,
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
    course: { title: 'IELTS Reading' },
    ...overrides,
  }
}

function buildEnrollment(): Pick<Enrollment, 'id'> {
  return { id: '5d8b7104-28cb-468c-80d1-7352b41a4653' }
}

async function submit(payload = {}) {
  return createSubmission(
    { assignmentId },
    {
      payload: {
        version: 1,
        answers: [{ questionId: 'q1', value: 'A' }],
      },
      ...payload,
    },
    { id: studentId, role: 'student' },
  )
}

describe('submissions.service eligibility', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    prisma.$transaction.mockImplementation(async (callback) => callback(prisma))
    prisma.assignment.findFirst.mockResolvedValue(buildAssignment())
    prisma.enrollment.findFirst.mockResolvedValue(buildEnrollment())
    prisma.enrollment.findMany.mockResolvedValue([])
    prisma.submission.findUnique.mockResolvedValue(null)
    prisma.submission.create.mockResolvedValue({
      id: 'submission-1',
      submittedAt: new Date('2026-01-01T10:00:00.000Z'),
    } as Submission)
  })

  it('rejects submissions for unpublished assignments with a typed code', async () => {
    prisma.assignment.findFirst.mockResolvedValueOnce(
      buildAssignment({ publishedAt: null }),
    )

    await expect(
      submit({ submittedAt: '2026-01-01T10:00:00.000Z' }),
    ).rejects.toMatchObject({
      statusCode: 403,
      details: { code: 'submission_unpublished' },
    })
    expect(prisma.submission.create).not.toHaveBeenCalled()
  })

  it('rejects submissions from students not actively enrolled in the course', async () => {
    prisma.enrollment.findFirst.mockResolvedValueOnce(null)

    await expect(
      submit({ submittedAt: '2026-01-01T10:00:00.000Z' }),
    ).rejects.toMatchObject({
      statusCode: 403,
      details: { code: 'submission_unenrolled' },
    })
    expect(prisma.submission.create).not.toHaveBeenCalled()
  })
})

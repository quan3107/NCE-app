/**
 * File: tests/modules/assignments/assignments.service.test.ts
 * Purpose: Validate IELTS assignment config handling in the service layer.
 * Why: Ensures valid configs persist while invalid configs are rejected.
 */
import { describe, expect, it, beforeEach, vi } from 'vitest'
import type { Assignment } from '../../../src/prisma/index.js'
import { UserRole } from '../../../src/prisma/index.js'
import { ZodError } from 'zod'

vi.mock('../../../src/prisma/client.js', () => ({
  prisma: {
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
    assignment: {
      create: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    course: {
      findFirst: vi.fn(),
    },
  },
}))

const prismaModule = await import('../../../src/prisma/client.js')
const prisma = vi.mocked(prismaModule.prisma, true)
const transactionAuditLogCreate = vi.fn()

const { createAssignment, getPendingAssignmentsCount, updateAssignment } =
  await import('../../../src/modules/assignments/assignments.service.js')

const courseId = '7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2'
const assignmentId = '6c986d3c-5d72-40d4-96b5-b5e3725c9811'
const ownerTeacher = { id: 'teacher-owner', role: UserRole.teacher }

const readingConfig = {
  version: 1,
  timing: { enabled: true, durationMinutes: 60, enforce: false },
  instructions: 'Read and answer all questions.',
  attempts: { maxAttempts: null },
  sections: [],
}

const readingConfigWithAiOff = {
  ...readingConfig,
  aiPolicy: {
    writingFeedbackMode: 'off',
    objectiveExplanations: 'off',
    providerTier: 'auto',
  },
}

describe('assignments.service.createAssignment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    transactionAuditLogCreate.mockReset()
    prisma.$transaction.mockImplementation(async (callback) => callback(prisma))
  })

  it('persists valid IELTS assignment configs', async () => {
    const record = { id: 'assignment-1' } as Assignment
    prisma.course.findFirst.mockResolvedValueOnce({ id: courseId })
    prisma.assignment.create.mockResolvedValueOnce(record)

    const result = await createAssignment(
      { courseId },
      {
        title: 'Reading Practice',
        type: 'reading',
        assignmentConfig: readingConfig,
      },
      ownerTeacher,
    )

    expect(prisma.assignment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          courseId,
          title: 'Reading Practice',
          type: 'reading',
          assignmentConfig: readingConfigWithAiOff,
        }),
      }),
    )
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: ownerTeacher.id,
        action: 'assignment.created',
        entity: 'assignment',
        entityId: 'assignment-1',
        diff: expect.objectContaining({
          changes: expect.objectContaining({
            courseId,
            type: 'reading',
          }),
        }),
      }),
    })
    expect(result).toBe(record)
  })

  it('rejects IELTS assignments without assignment_config', async () => {
    await expect(
      createAssignment(
        { courseId },
        {
          title: 'Reading Practice',
          type: 'reading',
        } as never,
        ownerTeacher,
      ),
    ).rejects.toBeInstanceOf(ZodError)
  })
})

describe('assignments.service.updateAssignment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects type-only IELTS updates when the stored AI policy is invalid for the target type', async () => {
    prisma.assignment.findFirst.mockResolvedValueOnce({
      id: assignmentId,
      type: 'writing',
      assignmentConfig: {
        version: 1,
        task1: { prompt: 'Summarize the chart.' },
        task2: { prompt: 'Discuss both views.' },
        aiPolicy: {
          writingFeedbackMode: 'teacher_reviewed',
          objectiveExplanations: 'off',
          providerTier: 'auto',
        },
      },
    })

    await expect(
      updateAssignment(
        { courseId, assignmentId },
        { type: 'reading' },
        ownerTeacher,
      ),
    ).rejects.toBeInstanceOf(ZodError)

    expect(prisma.assignment.update).not.toHaveBeenCalled()
  })

  it('audits AI policy changes without storing the full assignment config', async () => {
    prisma.$transaction.mockImplementation(async (callback) =>
      callback({
        ...prisma,
        auditLog: {
          create: transactionAuditLogCreate,
        },
      }),
    )
    prisma.assignment.findFirst.mockResolvedValueOnce({
      id: assignmentId,
      courseId,
      type: 'reading',
      assignmentConfig: readingConfigWithAiOff,
    })
    prisma.assignment.update.mockResolvedValueOnce({
      id: assignmentId,
      courseId,
      type: 'reading',
      assignmentConfig: {
        ...readingConfig,
        aiPolicy: {
          writingFeedbackMode: 'off',
          objectiveExplanations: 'on_demand_student_visible',
          providerTier: 'low_cost',
        },
      },
    } as never)

    await updateAssignment(
      { courseId, assignmentId },
      {
        assignmentConfig: {
          ...readingConfig,
          aiPolicy: {
            writingFeedbackMode: 'off',
            objectiveExplanations: 'on_demand_student_visible',
            providerTier: 'low_cost',
          },
        },
      },
      ownerTeacher,
    )

    expect(transactionAuditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: ownerTeacher.id,
        action: 'ai_feedback.policy_changed',
        entity: 'assignment',
        entityId: assignmentId,
        diff: expect.objectContaining({
          entityIds: { courseId, assignmentId },
          payloadSummary: {
            before: {
              writingFeedbackMode: 'off',
              objectiveExplanations: 'off',
              providerTier: 'auto',
            },
            after: {
              writingFeedbackMode: 'off',
              objectiveExplanations: 'on_demand_student_visible',
              providerTier: 'low_cost',
            },
          },
        }),
      }),
    })
    expect(prisma.auditLog.create).not.toHaveBeenCalled()
    expect(JSON.stringify(transactionAuditLogCreate.mock.calls)).not.toContain(
      'Read and answer all questions.',
    )
  })

  it('keeps assignment updates successful when audit writing fails', async () => {
    prisma.$transaction.mockImplementation(async (callback) =>
      callback({
        ...prisma,
        auditLog: {
          create: transactionAuditLogCreate,
        },
      }),
    )
    transactionAuditLogCreate.mockRejectedValueOnce(new Error('audit failed'))
    prisma.assignment.findFirst.mockResolvedValueOnce({
      id: assignmentId,
      courseId,
      type: 'reading',
      assignmentConfig: readingConfigWithAiOff,
    })
    prisma.assignment.update.mockResolvedValueOnce({
      id: assignmentId,
      courseId,
      type: 'reading',
      assignmentConfig: {
        ...readingConfig,
        aiPolicy: {
          writingFeedbackMode: 'off',
          objectiveExplanations: 'on_demand_student_visible',
          providerTier: 'low_cost',
        },
      },
    } as never)

    const result = await updateAssignment(
      { courseId, assignmentId },
      {
        assignmentConfig: {
          ...readingConfig,
          aiPolicy: {
            writingFeedbackMode: 'off',
            objectiveExplanations: 'on_demand_student_visible',
            providerTier: 'low_cost',
          },
        },
      },
      ownerTeacher,
    )

    expect(result.id).toBe(assignmentId)
    expect(transactionAuditLogCreate).toHaveBeenCalled()
  })

  it('audits deleted assignments', async () => {
    prisma.assignment.findFirst.mockResolvedValueOnce({ id: assignmentId })
    prisma.assignment.update.mockResolvedValueOnce({
      id: assignmentId,
      deletedAt: new Date('2026-06-29T00:00:00.000Z'),
    } as never)

    const { deleteAssignment } = await import(
      '../../../src/modules/assignments/assignments.service.js'
    )

    await deleteAssignment({ courseId, assignmentId }, ownerTeacher)

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: ownerTeacher.id,
        action: 'assignment.deleted',
        entity: 'assignment',
        entityId: assignmentId,
        diff: expect.objectContaining({
          changes: expect.objectContaining({
            courseId,
            deletedAt: expect.objectContaining({
              from: null,
              to: expect.any(String),
            }),
          }),
        }),
      }),
    })
  })
})

describe('assignments.service.getPendingAssignmentsCount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('counts only pending assignments in active courses', async () => {
    prisma.assignment.count.mockResolvedValueOnce(0)

    await getPendingAssignmentsCount('student-1')

    expect(prisma.assignment.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          course: expect.objectContaining({
            deletedAt: null,
          }),
        }),
      }),
    )
  })
})

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

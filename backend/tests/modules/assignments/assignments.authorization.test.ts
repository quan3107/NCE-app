/**
 * File: tests/modules/assignments/assignments.authorization.test.ts
 * Purpose: Validate course-scoped authorization for assignment service operations.
 * Why: Prevents role-only guards from exposing assignment data across courses.
 */
import { describe, expect, it, beforeEach, vi } from 'vitest'
import type { Assignment } from '../../../src/prisma/index.js'
import { EnrollmentRole, UserRole } from '../../../src/prisma/index.js'

vi.mock('../../../src/prisma/client.js', () => ({
  prisma: {
    $transaction: vi.fn(),
    assignment: {
      create: vi.fn(),
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

const {
  createAssignment,
  deleteAssignment,
  getAssignment,
  listAssignments,
  updateAssignment,
} = await import('../../../src/modules/assignments/assignments.service.js')

const courseId = '7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2'
const assignmentId = '4c67e29f-7a7b-4c3e-8d56-52e5487e59a2'
const ownerTeacher = { id: 'teacher-owner', role: UserRole.teacher }
const coTeacher = { id: 'teacher-co', role: UserRole.teacher }
const outsideTeacher = { id: 'teacher-outside', role: UserRole.teacher }
const student = { id: 'student-1', role: UserRole.student }

const readingConfig = {
  version: 1,
  timing: { enabled: true, durationMinutes: 60, enforce: false },
  instructions: 'Read and answer all questions.',
  attempts: { maxAttempts: null },
  sections: [],
}

const teacherCourseFilter = (teacherId: string) => ({
  deletedAt: null,
  OR: [
    { ownerId: teacherId },
    {
      enrollments: {
        some: {
          userId: teacherId,
          roleInCourse: EnrollmentRole.teacher,
          deletedAt: null,
        },
      },
    },
  ],
})

const studentCourseFilter = {
  deletedAt: null,
  enrollments: {
    some: {
      userId: student.id,
      roleInCourse: EnrollmentRole.student,
      deletedAt: null,
    },
  },
}

describe('assignments.service course authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prisma.$transaction.mockImplementation(async (callback) => callback(prisma))
  })

  it('rejects assignment creation for a teacher outside the course', async () => {
    prisma.course.findFirst.mockResolvedValueOnce(null)

    await expect(
      createAssignment(
        { courseId },
        {
          title: 'Reading Practice',
          type: 'reading',
          assignmentConfig: readingConfig,
        },
        outsideTeacher,
      ),
    ).rejects.toMatchObject({ statusCode: 403 })

    expect(prisma.course.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: courseId,
          ...teacherCourseFilter(outsideTeacher.id),
        },
      }),
    )
    expect(prisma.assignment.create).not.toHaveBeenCalled()
  })

  it('lists only published assignments for students enrolled in the course', async () => {
    prisma.assignment.findMany.mockResolvedValueOnce([])

    await listAssignments({ courseId }, student)

    expect(prisma.assignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          courseId,
          deletedAt: null,
          publishedAt: { not: null },
          course: studentCourseFilter,
        },
      }),
    )
  })

  it('lists assignments for a co-teacher enrolled in the course', async () => {
    prisma.assignment.findMany.mockResolvedValueOnce([])

    await listAssignments({ courseId }, coTeacher)

    expect(prisma.assignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          courseId,
          deletedAt: null,
          course: teacherCourseFilter(coTeacher.id),
        },
      }),
    )
  })

  it('fails closed when a student reads an unpublished assignment', async () => {
    prisma.assignment.findFirst.mockResolvedValueOnce(null)

    await expect(
      getAssignment({ courseId, assignmentId }, student),
    ).rejects.toMatchObject({ statusCode: 404 })

    expect(prisma.assignment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: assignmentId,
          courseId,
          deletedAt: null,
          publishedAt: { not: null },
          course: studentCourseFilter,
        },
      }),
    )
  })

  it('allows a co-teacher to publish assignments in their course', async () => {
    const record = { id: assignmentId, type: 'reading' } as Assignment
    prisma.assignment.findFirst.mockResolvedValueOnce(record)
    prisma.assignment.update.mockResolvedValueOnce({
      ...record,
      publishedAt: new Date('2026-01-01T00:00:00.000Z'),
    } as Assignment)

    await updateAssignment(
      { courseId, assignmentId },
      { publishedAt: '2026-01-01T00:00:00.000Z' },
      coTeacher,
    )

    expect(prisma.assignment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: assignmentId,
          courseId,
          deletedAt: null,
          course: teacherCourseFilter(coTeacher.id),
        },
      }),
    )
  })

  it('soft deletes an assignment scoped to the owner teacher course', async () => {
    prisma.assignment.findFirst.mockResolvedValueOnce({
      id: assignmentId,
    } as Assignment)
    prisma.assignment.update.mockResolvedValueOnce({
      id: assignmentId,
    } as Assignment)

    await deleteAssignment({ courseId, assignmentId }, ownerTeacher)

    expect(prisma.assignment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: assignmentId,
          courseId,
          deletedAt: null,
          course: teacherCourseFilter(ownerTeacher.id),
        },
      }),
    )
    expect(prisma.assignment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: assignmentId },
        data: { deletedAt: expect.any(Date) },
      }),
    )
  })

  it('fails closed before deleting for a teacher outside the course', async () => {
    prisma.assignment.findFirst.mockResolvedValueOnce(null)

    await expect(
      deleteAssignment({ courseId, assignmentId }, outsideTeacher),
    ).rejects.toMatchObject({ statusCode: 404 })

    expect(prisma.assignment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: assignmentId,
          courseId,
          deletedAt: null,
          course: teacherCourseFilter(outsideTeacher.id),
        },
      }),
    )
    expect(prisma.assignment.update).not.toHaveBeenCalled()
  })
})

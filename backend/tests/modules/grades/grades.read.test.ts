/**
 * File: tests/modules/grades/grades.read.test.ts
 * Purpose: Verify grade writes derive grader identity from authenticated actors.
 * Why: Prevents clients from spoofing grading ownership or grading outside-course submissions.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EnrollmentRole, UserRole } from '../../../src/prisma/index.js'

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
const aiFeedbackRepositoryModule =
  await import('../../../src/modules/ai-feedback/ai-feedback.repository.js')
const getStudentVisibleAiFeedbackDraft = vi.mocked(
  aiFeedbackRepositoryModule.getStudentVisibleAiFeedbackDraft,
)

const { getGrade } = await import('../../../src/modules/grades/grades.service.js')

const submissionId = '2520f0dd-918a-4c2b-9544-b922eac066e5'
const teacherId = 'db2b572b-ef7d-44b3-96c6-a61c498cf673'
const adminId = 'd5ef35a6-6907-47e8-9c34-5849656d827f'
const studentId = '4335e34e-7ecb-4a31-ae53-b04c44cd7c09'
const otherStudentId = '153c2d0e-1b97-47c5-9644-5d2f2fd52929'

describe('grades.service.getGrade', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getStudentVisibleAiFeedbackDraft.mockResolvedValue(null as never)
  })

  it('allows students to read grades for their own active submissions', async () => {
    const gradeRecord = {
      id: 'b82c0f6c-73ac-4c42-bc4f-a6c2d507f612',
      submissionId,
      graderId: teacherId,
      grader: {
        fullName: 'Teacher One',
      },
      aiFeedbackDrafts: [],
    }
    prisma.grade.findFirst.mockResolvedValueOnce(gradeRecord as never)

    const grade = await getGrade(
      { submissionId },
      { id: studentId, role: UserRole.student },
    )

    expect(prisma.grade.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          submissionId,
          deletedAt: null,
          submission: expect.objectContaining({
            studentId,
            deletedAt: null,
            assignment: {
              deletedAt: null,
              course: {
                deletedAt: null,
              },
            },
          }),
        }),
        include: {
          grader: {
            select: {
              fullName: true,
            },
          },
          aiFeedbackDrafts: expect.any(Object),
        },
      }),
    )
    expect(getStudentVisibleAiFeedbackDraft).toHaveBeenCalledWith({
      submissionId,
      studentId,
    })
    expect(grade).toEqual(
      expect.objectContaining({
        id: gradeRecord.id,
        graderName: 'Teacher One',
        feedbackLabel: 'teacher feedback',
      }),
    )
  })

  it('adds sanitized provisional AI writing feedback to student grade responses', async () => {
    prisma.grade.findFirst.mockResolvedValueOnce({
      id: 'grade-with-ai',
      submissionId,
      graderId: teacherId,
      feedback: null,
      grader: {
        fullName: 'Teacher One',
      },
      aiFeedbackDrafts: [],
    } as never)
    getStudentVisibleAiFeedbackDraft.mockResolvedValueOnce({
      id: 'draft-1',
      status: 'accepted',
      visibilityMode: 'instant_student_visible',
      generatedFeedback: {
        feedbackMd: 'Strong overview; add sharper evidence.',
        provider: 'hidden-provider',
        prompt: 'hidden prompt',
      },
      model: 'hidden-model',
      promptVersion: 'hidden-version',
    } as never)

    const grade = await getGrade(
      { submissionId },
      { id: studentId, role: UserRole.student },
    )

    expect(grade).toEqual(
      expect.objectContaining({
        studentAiFeedback: {
          label: 'provisional AI feedback',
          status: 'accepted',
          feedback: {
            feedbackMd: 'Strong overview; add sharper evidence.',
          },
        },
      }),
    )
    expect(JSON.stringify(grade)).not.toContain('hidden-provider')
    expect(JSON.stringify(grade)).not.toContain('hidden-model')
    expect(JSON.stringify(grade)).not.toContain('hidden prompt')
  })

  it('returns provisional instant-visible AI feedback before a grade exists', async () => {
    prisma.grade.findFirst.mockResolvedValueOnce(null)
    getStudentVisibleAiFeedbackDraft.mockResolvedValueOnce({
      id: 'draft-before-grade',
      submissionId,
      status: 'accepted',
      visibilityMode: 'instant_student_visible',
      generatedFeedback: {
        feedbackMd: 'This provisional feedback is ready before teacher grading.',
      },
    } as never)

    const grade = await getGrade(
      { submissionId },
      { id: studentId, role: UserRole.student },
    )

    expect(grade).toEqual(
      expect.objectContaining({
        id: 'draft-before-grade',
        submissionId,
        provisionalOnly: true,
        feedbackLabel: 'teacher feedback',
        studentAiFeedback: {
          label: 'provisional AI feedback',
          status: 'accepted',
          feedback: {
            feedbackMd: 'This provisional feedback is ready before teacher grading.',
          },
        },
      }),
    )
  })

  it('labels grade feedback that came from teacher-reviewed AI assistance', async () => {
    prisma.grade.findFirst.mockResolvedValueOnce({
      id: 'grade-ai-assisted',
      submissionId,
      graderId: teacherId,
      feedback: 'Teacher-edited AI feedback.',
      grader: {
        fullName: 'Teacher One',
      },
      aiFeedbackDrafts: [
        {
          id: 'draft-2',
          status: 'approved',
          visibilityMode: 'teacher_reviewed',
        },
      ],
    } as never)

    const grade = await getGrade(
      { submissionId },
      { id: studentId, role: UserRole.student },
    )

    expect(grade).toEqual(
      expect.objectContaining({
        feedback: 'Teacher-edited AI feedback.',
        feedbackLabel: 'teacher-reviewed AI-assisted feedback',
      }),
    )
  })

  it("does not expose another student's grade to students", async () => {
    prisma.grade.findFirst.mockResolvedValueOnce(null)

    await expect(
      getGrade({ submissionId }, { id: otherStudentId, role: UserRole.student }),
    ).rejects.toMatchObject({ statusCode: 404 })

    expect(prisma.grade.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          submission: expect.objectContaining({
            studentId: otherStudentId,
          }),
        }),
      }),
    )
  })

  it('allows course teachers to read grades for submissions in their courses', async () => {
    prisma.grade.findFirst.mockResolvedValueOnce({
      id: 'grade-2',
      submissionId,
      graderId: teacherId,
      grader: {
        fullName: 'Teacher One',
      },
    } as never)

    await getGrade({ submissionId }, { id: teacherId, role: UserRole.teacher })

    expect(prisma.grade.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          submission: expect.objectContaining({
            assignment: {
              deletedAt: null,
              course: {
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
              },
            },
          }),
        }),
      }),
    )
  })

  it('allows admins to read active grades without course ownership filters', async () => {
    prisma.grade.findFirst.mockResolvedValueOnce({
      id: 'grade-3',
      submissionId,
      graderId: teacherId,
      grader: {
        fullName: 'Teacher One',
      },
    } as never)

    await getGrade({ submissionId }, { id: adminId, role: UserRole.admin })

    expect(prisma.grade.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          submissionId,
          deletedAt: null,
          submission: {
            deletedAt: null,
            assignment: {
              deletedAt: null,
              course: {
                deletedAt: null,
              },
            },
          },
        },
      }),
    )
  })
})

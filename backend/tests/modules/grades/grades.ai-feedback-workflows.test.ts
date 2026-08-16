/**
 * File: tests/modules/grades/grades.ai-feedback-workflows.test.ts
 * Purpose: Verify the student boundary after instant AI feedback finalization.
 * Why: Teacher-final feedback must replace, not duplicate, provisional wording.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UserRole } from '../../../src/prisma/index.js'

vi.mock('../../../src/prisma/client.js', () => ({
  prisma: { grade: { findFirst: vi.fn() } },
}))
vi.mock('../../../src/modules/ai-feedback/ai-feedback.repository.js', () => ({
  getStudentVisibleAiFeedbackDraft: vi.fn(),
}))

const prismaModule = await import('../../../src/prisma/client.js')
const repositoryModule =
  await import('../../../src/modules/ai-feedback/ai-feedback.repository.js')
const { getGrade } = await import('../../../src/modules/grades/grades.service.js')
const prisma = vi.mocked(prismaModule.prisma, true)
const getStudentVisibleAiFeedbackDraft = vi.mocked(
  repositoryModule.getStudentVisibleAiFeedbackDraft,
)

describe('finalized instant AI feedback visibility', () => {
  beforeEach(() => vi.clearAllMocks())

  it('replaces provisional wording with teacher-final grade feedback', async () => {
    const submissionId = '11111111-1111-4111-8111-111111111111'
    prisma.grade.findFirst.mockResolvedValueOnce({
      id: 'grade-finalized-ai',
      submissionId,
      graderId: 'teacher-1',
      feedback: 'Teacher final replacement.',
      grader: { fullName: 'Teacher One' },
      aiFeedbackDrafts: [
        {
          id: 'draft-finalized',
          status: 'finalized',
          visibilityMode: 'instant_student_visible',
        },
      ],
    } as never)
    getStudentVisibleAiFeedbackDraft.mockResolvedValueOnce({
      id: 'draft-finalized',
      status: 'finalized',
      visibilityMode: 'instant_student_visible',
      generatedFeedback: { feedbackMd: 'Stale provisional wording.' },
    } as never)

    const grade = await getGrade(
      { submissionId },
      { id: '22222222-2222-4222-8222-222222222222', role: UserRole.student },
    )

    expect(grade).toMatchObject({
      feedback: 'Teacher final replacement.',
      feedbackLabel: 'teacher-reviewed AI-assisted feedback',
    })
    expect(grade).not.toHaveProperty('studentAiFeedback')
    expect(JSON.stringify(grade)).not.toContain('Stale provisional wording.')
  })
})

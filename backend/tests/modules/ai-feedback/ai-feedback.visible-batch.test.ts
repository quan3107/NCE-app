/** Batch provisional feedback preserves ownership and the current assignment policy gate. */
import { expect, it, vi } from 'vitest'
vi.mock('../../../src/prisma/client.js', () => ({
  prisma: { submission: { findMany: vi.fn() } },
}))
const { prisma } = await import('../../../src/prisma/client.js')
const { getStudentVisibleAiFeedbackDrafts } =
  await import('../../../src/modules/ai-feedback/ai-feedback.draft-reads.js')
it('includes only a current instant-visible draft and never revives teacher-reviewed feedback', async () => {
  vi.mocked(prisma.submission.findMany).mockResolvedValue([
    {
      id: 'visible',
      assignment: {
        assignmentConfig: {
          aiPolicy: { writingFeedbackMode: 'instant_student_visible' },
        },
      },
      aiFeedbackDrafts: [{ id: 'draft', status: 'accepted' }],
    },
    {
      id: 'private',
      assignment: {
        assignmentConfig: { aiPolicy: { writingFeedbackMode: 'teacher_reviewed' } },
      },
      aiFeedbackDrafts: [{ id: 'secret', status: 'accepted' }],
    },
    { id: 'empty', assignment: { assignmentConfig: null }, aiFeedbackDrafts: [] },
  ] as never)
  const result = await getStudentVisibleAiFeedbackDrafts(
    ['visible', 'private', 'empty'],
    'student',
  )
  expect([...result.keys()]).toEqual(['visible'])
  expect(prisma.submission.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        id: { in: ['visible', 'private', 'empty'] },
        studentId: 'student',
        deletedAt: null,
        assignment: { deletedAt: null, course: { deletedAt: null } },
      },
      select: expect.objectContaining({
        aiFeedbackDrafts: {
          where: {
            deletedAt: null,
            visibilityMode: 'instant_student_visible',
            status: { in: ['accepted', 'approved', 'finalized'] },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      }),
    }),
  )
})

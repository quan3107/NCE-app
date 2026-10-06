/** Batch grade tests keep ownership, feedback privacy and single-read parity at the new boundary. */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UserRole } from '../../../src/prisma/index.js'
vi.mock('../../../src/prisma/client.js', () => ({
  prisma: { grade: { findMany: vi.fn(), findFirst: vi.fn() } },
}))
vi.mock('../../../src/modules/ai-feedback/ai-feedback.draft-reads.js', () => ({
  getStudentVisibleAiFeedbackDrafts: vi.fn(),
}))
vi.mock('../../../src/modules/ai-feedback/ai-feedback.repository.js', () => ({
  getStudentVisibleAiFeedbackDraft: vi.fn(),
}))
vi.mock('../../../src/modules/notifications/notifications.service.js', () => ({
  enqueueNotification: vi.fn(),
}))
vi.mock('../../../src/modules/audit-logs/audit-logs.service.js', () => ({
  writeAuditLogSafely: vi.fn(),
}))
const { prisma } = await import('../../../src/prisma/client.js')
const db = vi.mocked(prisma, true)
const { getStudentVisibleAiFeedbackDrafts } =
  await import('../../../src/modules/ai-feedback/ai-feedback.draft-reads.js')
const { getStudentVisibleAiFeedbackDraft } =
  await import('../../../src/modules/ai-feedback/ai-feedback.repository.js')
const { listGrades } = await import('../../../src/modules/grades/grades.batch-read.js')
const { getGrade } = await import('../../../src/modules/grades/grades.service.js')
const id = '4335e34e-7ecb-4a31-ae53-b04c44cd7c09'
const student = { id: '2520f0dd-918a-4c2b-9544-b922eac066e5', role: UserRole.student }
describe('grade batches', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    db.grade.findMany.mockResolvedValue([])
    vi.mocked(getStudentVisibleAiFeedbackDrafts).mockResolvedValue(new Map())
    vi.mocked(getStudentVisibleAiFeedbackDraft).mockResolvedValue(null)
  })
  it('matches the individual grade response and applies the same student ownership gate', async () => {
    const record = {
      id,
      submissionId: id,
      finalScore: '7',
      grader: { fullName: 'Teacher' },
      aiFeedbackDrafts: [{ status: 'approved', visibilityMode: 'teacher_reviewed' }],
    }
    db.grade.findFirst.mockResolvedValue(record as never)
    db.grade.findMany.mockResolvedValue([record] as never)
    expect(await listGrades({ submissionIds: [id, id] }, student)).toEqual([
      await getGrade({ submissionId: id }, student),
    ])
    expect(db.grade.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          submissionId: { in: [id] },
          deletedAt: null,
          submission: expect.objectContaining({
            studentId: student.id,
            deletedAt: null,
            assignment: { deletedAt: null, course: { deletedAt: null } },
          }),
        }),
      }),
    )
  })
  it('omits missing/inaccessible grades and returns only sanitized provisional feedback', async () => {
    const draft = {
      id,
      status: 'accepted',
      generatedFeedback: { feedbackMd: 'Useful feedback', secretPrompt: 'private' },
    }
    vi.mocked(getStudentVisibleAiFeedbackDrafts).mockResolvedValue(
      new Map([[id, draft]]) as never,
    )
    const grades = await listGrades({ submissionIds: [id] }, student)
    expect(grades).toHaveLength(1)
    expect(grades[0]).toMatchObject({
      provisionalOnly: true,
      studentAiFeedback: { feedback: { feedbackMd: 'Useful feedback' } },
    })
    expect(JSON.stringify(grades)).not.toContain('private')
    vi.mocked(getStudentVisibleAiFeedbackDrafts).mockResolvedValue(new Map())
    expect(await listGrades({ submissionIds: [id] }, student)).toEqual([])
  })
  it('keeps teacher scope and never adds student provisional drafts to staff responses', async () => {
    await listGrades({ submissionIds: [id] }, { ...student, role: UserRole.teacher })
    expect(getStudentVisibleAiFeedbackDrafts).not.toHaveBeenCalled()
    expect(db.grade.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          submission: {
            deletedAt: null,
            assignment: {
              deletedAt: null,
              course: expect.objectContaining({ deletedAt: null, OR: expect.any(Array) }),
            },
          },
        }),
      }),
    )
  })
  it('requires authentication and rejects more than 100 IDs or malformed input', async () => {
    await expect(listGrades({ submissionIds: [id] })).rejects.toMatchObject({
      statusCode: 401,
    })
    await expect(
      listGrades({ submissionIds: Array(101).fill(id) }, student),
    ).rejects.toThrow()
    await expect(listGrades({ submissionIds: ['invalid'] }, student)).rejects.toThrow()
    expect(db.grade.findMany).not.toHaveBeenCalled()
  })
})

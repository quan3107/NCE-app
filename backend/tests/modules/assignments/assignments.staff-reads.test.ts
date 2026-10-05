/** Staff summary tests protect course scopes, complete counts and small payload/page bounds. */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UserRole } from '../../../src/prisma/index.js'
vi.mock('../../../src/prisma/client.js', () => ({
  prisma: {
    assignment: { count: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
    submission: {
      count: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}))
const { prisma } = await import('../../../src/prisma/client.js')
const db = vi.mocked(prisma, true)
const {
  getStaffOverview,
  listStaffAssignments,
  listStaffSubmissions,
  getStaffAssignment,
  getStaffSubmission,
} = await import('../../../src/modules/assignments/assignments.staff-reads.js')
const teacher = { id: '2520f0dd-918a-4c2b-9544-b922eac066e5', role: UserRole.teacher }
const id = '4335e34e-7ecb-4a31-ae53-b04c44cd7c09'
describe('staff reads', () => {
  beforeEach(() => vi.resetAllMocks())
  it('counts all pending work while returning only three authorized summaries', async () => {
    db.assignment.count.mockResolvedValue(60)
    db.submission.count.mockResolvedValue(700)
    db.submission.findMany.mockResolvedValue([])
    expect(await getStaffOverview(teacher)).toEqual({
      activeAssignments: 60,
      pendingSubmissions: 700,
      recentSubmissions: [],
    })
    const args = db.submission.findMany.mock.calls[0]![0]!
    expect(args.take).toBe(3)
    expect(args.select).not.toHaveProperty('payload')
    expect(args.where).toMatchObject({
      deletedAt: null,
      status: { in: ['submitted', 'late'] },
      assignment: {
        deletedAt: null,
        course: {
          deletedAt: null,
          OR: [
            { ownerId: teacher.id },
            {
              enrollments: {
                some: { userId: teacher.id, roleInCourse: 'teacher', deletedAt: null },
              },
            },
          ],
        },
      },
    })
  })
  it('returns a disjoint cursor page without dropping the total count or exposing essays', async () => {
    db.submission.findFirst.mockResolvedValue({ id } as never)
    const rows = Array.from({ length: 51 }, (_, i) => ({
      id: `${i}`,
      assignmentId: id,
      studentId: id,
      status: 'submitted',
      submittedAt: null,
      student: { fullName: 'Student' },
      assignment: { title: 'Essay' },
    }))
    db.submission.findMany.mockResolvedValue(rows as never)
    db.submission.count.mockResolvedValue(700)
    const result = await listStaffSubmissions({ limit: 50, cursor: id }, teacher)
    expect(result.items).toHaveLength(50)
    expect(result.nextCursor).toBe('49')
    expect(result.total).toBe(700)
    expect(result.items[0]).toMatchObject({
      studentName: 'Student',
      assignmentTitle: 'Essay',
    })
    expect(db.submission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 51,
        cursor: { id },
        where: expect.objectContaining({ id: { not: id } }),
      }),
    )
    expect(db.submission.findMany.mock.calls[0]![0]).not.toHaveProperty('skip')
    expect(db.submission.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({
          status: expect.anything(),
          deletedAt: expect.anything(),
        }),
      }),
    )
  })
  it('rejects a cursor outside the current assignment/course scope before reading a page', async () => {
    db.submission.findFirst.mockResolvedValue(null)
    await expect(listStaffSubmissions({ cursor: id }, teacher)).rejects.toMatchObject({
      statusCode: 404,
    })
    expect(db.submission.findMany).not.toHaveBeenCalled()
    expect(db.submission.count).not.toHaveBeenCalled()
  })
  it('supports assignment-scoped pages including drafts/grades without pending filtering', async () => {
    db.submission.findMany.mockResolvedValue([])
    db.submission.count.mockResolvedValue(0)
    await listStaffSubmissions({ assignmentId: id, pending: 'false' }, teacher)
    const where = db.submission.findMany.mock.calls[0]![0]!.where
    expect(where).toMatchObject({ assignment: { id } })
    expect(where).not.toHaveProperty('status')
  })
  it('rejects student callers and invalid/unbounded page queries', async () => {
    await expect(
      getStaffOverview({ ...teacher, role: UserRole.student }),
    ).rejects.toMatchObject({ statusCode: 403 })
    await expect(listStaffAssignments({ limit: 101 }, teacher)).rejects.toThrow()
    await expect(listStaffSubmissions({ pending: 'anything' }, teacher)).rejects.toThrow()
    expect(db.submission.findMany).not.toHaveBeenCalled()
  })
  it('does not return inaccessible/deleted detail records or their counts', async () => {
    db.assignment.findFirst.mockResolvedValue(null)
    db.submission.findFirst.mockResolvedValue(null)
    await expect(getStaffAssignment(id, teacher)).rejects.toMatchObject({
      statusCode: 404,
    })
    await expect(getStaffSubmission(id, teacher)).rejects.toMatchObject({
      statusCode: 404,
    })
    expect(db.submission.groupBy).not.toHaveBeenCalled()
    expect(db.submission.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
          assignment: expect.objectContaining({ deletedAt: null }),
        }),
      }),
    )
  })
})

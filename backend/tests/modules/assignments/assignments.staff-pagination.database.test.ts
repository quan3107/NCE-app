/** Real PostgreSQL staff pagination regressions; all fixture mutations roll back. */
import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { Prisma, UserRole } from '../../../src/prisma/index.js'
import { withPrismaClient } from '../../../src/prisma/client.js'
import { listStaffAssignments } from '../../../src/modules/assignments/assignments.staff-reads.js'
import { runDatabaseTestTransaction } from '../../prisma/databaseTestClient.js'

const databaseDescribe =
  process.env.CI === 'true' || process.env.RUN_DATABASE_TESTS === 'true'
    ? describe.sequential
    : describe.skip
const rollback = new Error('ROLLBACK_STAFF_PAGINATION_FIXTURE')

async function fixture(tx: Prisma.TransactionClient) {
  const owner = { id: randomUUID(), role: UserRole.teacher }
  const coTeacher = { id: randomUUID(), role: UserRole.teacher }
  const foreignTeacher = { id: randomUUID(), role: UserRole.teacher }
  const admin = { id: randomUUID(), role: UserRole.admin }
  for (const actor of [owner, coTeacher, foreignTeacher, admin]) {
    await tx.user.create({
      data: {
        ...actor,
        email: `staff-cursor-${actor.id}@example.invalid`,
        fullName: 'Staff cursor fixture',
        status: 'active',
      },
    })
  }
  const course = await tx.course.create({
    data: { title: 'Staff cursor fixture', ownerId: owner.id },
  })
  const foreignCourse = await tx.course.create({
    data: { title: 'Foreign staff cursor fixture', ownerId: foreignTeacher.id },
  })
  const enrollment = await tx.enrollment.create({
    data: { courseId: course.id, userId: coTeacher.id, roleInCourse: 'teacher' },
  })
  for (let i = 0; i < 6; i++) {
    const row = await tx.assignment.create({
      data: { courseId: course.id, title: `Assignment ${i}`, type: 'text' },
    })
    // Native microseconds distinguish values that all collapse to one JS millisecond.
    // Two rows share a timestamp as well, exercising the native UUID tie-break.
    const microseconds = [6, 5, 4, 4, 2, 1][i]!
    await tx.$executeRaw`
      UPDATE assignments SET "createdAt" = '2100-01-01T00:00:00Z'::timestamptz
        + ${microseconds} * interval '1 microsecond' WHERE id = ${row.id}::uuid
    `
  }
  const foreign = await tx.assignment.create({
    data: { courseId: foreignCourse.id, title: 'Foreign assignment', type: 'text' },
  })
  const ordered = await tx.assignment.findMany({
    where: { courseId: course.id },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true, createdAt: true },
  })
  expect(new Set(ordered.map((row) => row.createdAt.getTime())).size).toBe(1)
  return {
    owner,
    coTeacher,
    foreignTeacher,
    admin,
    course,
    foreignCourse,
    foreign,
    enrollment,
    ordered,
  }
}

async function isolated(operation: (tx: Prisma.TransactionClient) => Promise<void>) {
  // Use the actual handler with the actual Prisma transaction, not mocked delegates.
  // Throwing only our sentinel rolls back successful assertions and all fixtures.
  try {
    await runDatabaseTestTransaction(async (tx) => {
      await withPrismaClient(tx, () => operation(tx))
      throw rollback
    })
  } catch (error) {
    if (error !== rollback) throw error
  }
}

databaseDescribe('staff assignment cursor continuity through PostgreSQL', () => {
  it.each(['owner', 'coTeacher'] as const)(
    'retains every next row when %s deletes the boundary between requests',
    async (role) => {
      await isolated(async (tx) => {
        const data = await fixture(tx)
        const actor = data[role]
        const first = await listStaffAssignments({ limit: 2 }, actor)
        const expectedIds = data.ordered.map((row) => row.id)
        expect(first.items.map((row) => row.id)).toEqual(expectedIds.slice(0, 2))
        expect(first.total).toBe(6)
        expect(first.nextCursor).toBe(expectedIds[1])
        await tx.assignment.update({
          where: { id: first.nextCursor! },
          data: { deletedAt: new Date() },
        })
        const seen = first.items.map((row) => row.id)
        let cursor = first.nextCursor
        let pages = 0
        do {
          const next = await listStaffAssignments({ limit: 2, cursor }, actor)
          expect(next.total).toBe(5)
          expect(next.items.length).toBeLessThanOrEqual(2)
          seen.push(...next.items.map((row) => row.id))
          cursor = next.nextCursor
          expect(++pages).toBeLessThanOrEqual(3)
        } while (cursor)
        expect(seen).toEqual(expectedIds)
        expect(new Set(seen).size).toBe(seen.length)
      })
    },
  )

  it('excludes an active boundary without dropping the following record', async () => {
    await isolated(async (tx) => {
      const data = await fixture(tx)
      const first = await listStaffAssignments({ limit: 2 }, data.owner)
      const next = await listStaffAssignments(
        { limit: 2, cursor: first.nextCursor },
        data.owner,
      )
      expect(next.items.map((row) => row.id)).toEqual(
        data.ordered.slice(2, 4).map((row) => row.id),
      )
      expect(next.total).toBe(6)
    })
  })

  it('rejects foreign, missing and revoked-course cursors while retaining admin scope', async () => {
    await isolated(async (tx) => {
      const data = await fixture(tx)
      for (const cursor of [data.foreign.id, randomUUID()]) {
        await expect(listStaffAssignments({ cursor }, data.owner)).rejects.toMatchObject({
          statusCode: 404,
        })
      }
      await expect(
        listStaffAssignments({ cursor: data.foreign.id }, data.admin),
      ).resolves.toHaveProperty('items')
      await tx.enrollment.update({
        where: { id: data.enrollment.id },
        data: { deletedAt: new Date() },
      })
      await expect(
        listStaffAssignments({ cursor: data.ordered[1]!.id }, data.coTeacher),
      ).rejects.toMatchObject({ statusCode: 404 })
      await tx.course.update({
        where: { id: data.course.id },
        data: { deletedAt: new Date() },
      })
      await expect(
        listStaffAssignments({ cursor: data.ordered[1]!.id }, data.owner),
      ).rejects.toMatchObject({ statusCode: 404 })
    })
  })
})

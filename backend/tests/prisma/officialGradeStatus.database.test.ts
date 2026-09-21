/**
 * File: tests/prisma/officialGradeStatus.database.test.ts
 * Purpose: Verify the historical grade status repair on PostgreSQL.
 * Why: Only active official grades should promote historical submission status.
 */
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { createDatabaseTestOwnerPool } from './databaseTestClient.js'

const databaseDescribe =
  process.env.CI === 'true' || process.env.RUN_DATABASE_TESTS === 'true'
    ? describe
    : describe.skip
const migration = readFileSync(
  'src/prisma/migrations/20260921120000_reconcile_official_grade_status/migration.sql',
  'utf8',
)

databaseDescribe('official grade status repair', () => {
  it('repairs active grades, preserves ungraded/deleted rows and is idempotent', async () => {
    const pool = createDatabaseTestOwnerPool()
    const db = await pool.connect()
    try {
      await db.query('BEGIN')
      const user = randomUUID(),
        course = randomUUID()
      await db.query(
        `INSERT INTO users (id,email,full_name,role,status,"updatedAt") VALUES ($1,$2,'Grade fixture','teacher','active',now())`,
        [user, `${user}@example.test`],
      )
      await db.query(
        `INSERT INTO courses (id,title,owner_teacher_id,"updatedAt") VALUES ($1,'Grade fixture',$2,now())`,
        [course, user],
      )
      const ids = Array.from({ length: 5 }, () => randomUUID())
      for (const [index, id] of ids.entries()) {
        const assignment = randomUUID()
        await db.query(
          `INSERT INTO assignments (id,course_id,title,type,"updatedAt") VALUES ($1,$2,'Grade fixture','file',now())`,
          [assignment, course],
        )
        await db.query(
          `INSERT INTO submissions (id,assignment_id,student_id,status,payload,"updatedAt","deletedAt") VALUES ($1,$2,$3,$4,'{}',now(),$5)`,
          [
            id,
            assignment,
            user,
            index === 1 ? 'late' : 'submitted',
            index === 4 ? new Date() : null,
          ],
        )
        if (index !== 2)
          await db.query(
            `INSERT INTO grades (id,submission_id,grader_id,final_score,"updatedAt","deletedAt") VALUES ($1,$2,$3,7.5,now(),$4)`,
            [randomUUID(), id, user, index === 3 ? new Date() : null],
          )
      }
      await db.query(migration)
      await db.query(migration)
      for (const [index, id] of ids.entries()) {
        const result = await db.query('SELECT status FROM submissions WHERE id=$1', [id])
        expect(result.rows[0].status).toBe(index < 2 ? 'graded' : 'submitted')
      }
    } finally {
      await db.query('ROLLBACK')
      db.release()
      await pool.end()
    }
  })
})

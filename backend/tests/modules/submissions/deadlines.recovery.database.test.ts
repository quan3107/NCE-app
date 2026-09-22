/** Real API/PostgreSQL deadline acceptance; isolated fixtures never send email. */
import { randomUUID } from 'node:crypto'
import bcrypt from 'bcrypt'
import request from 'supertest'
import { beforeAll, afterAll, describe, it, expect } from 'vitest'
import { app } from '../../../src/app.js'
import { handlePasswordLogin } from '../../../src/modules/auth/auth.service.js'
import { createDatabaseTestOwnerPool } from '../../prisma/databaseTestClient.js'

const databaseDescribe =
  process.env.CI === 'true' || process.env.RUN_DATABASE_TESTS === 'true'
    ? describe.sequential
    : describe.skip
databaseDescribe('deadline and course reminders through the real API', () => {
  const users = Array.from({ length: 4 }, () => randomUUID())
  const course = randomUUID()
  const otherCourse = randomUUID()
  const assignments: string[] = []
  const tokens: string[] = []
  let owner: ReturnType<typeof createDatabaseTestOwnerPool>
  const auth = (index = 1) => `Bearer ${tokens[index]}`
  const submit = (id: string, content = 'Original', index = 1) =>
    request(app)
      .post(`/api/v1/assignments/${id}/submissions`)
      .set('Authorization', auth(index))
      .send({
        status: 'submitted',
        submittedAt: '2000-01-01T00:00:00Z',
        payload: { content },
      })
  async function assignment(
    dueHours: number | null,
    type = 'text',
    config: unknown = { version: 1, maxScore: 100 },
  ) {
    const id = randomUUID()
    assignments.push(id)
    await owner.query(
      `INSERT INTO assignments(id,course_id,title,type,due_at,published_at,assignment_config,late_policy,"updatedAt")
      VALUES($1,$2,'Deadline fixture',$3,CASE WHEN $4::float IS NULL THEN NULL ELSE clock_timestamp()+$4*interval '1 hour' END,now(),$5,'{"type":"closed"}',now())`,
      [id, course, type, dueHours, JSON.stringify(config)],
    )
    return id
  }
  beforeAll(async () => {
    owner = createDatabaseTestOwnerPool()
    const password = 'Deadline-fixture-2026'
    const hash = await bcrypt.hash(password, 4)
    for (let i = 0; i < users.length; i++) {
      const email = `deadline-${users[i]}@example.invalid`
      await owner.query(
        `INSERT INTO users(id,email,password_hash,full_name,role,status,"updatedAt") VALUES($1,$2,$3,'Deadline fixture',$4,'active',now())`,
        [users[i], email, hash, i === 0 ? 'teacher' : 'student'],
      )
      tokens.push((await handlePasswordLogin({ email, password }, {})).accessToken)
    }
    for (const id of [course, otherCourse])
      await owner.query(
        `INSERT INTO courses(id,title,owner_teacher_id,"updatedAt") VALUES($1,'Deadline course',$2,now())`,
        [id, users[0]],
      )
    for (const userId of users.slice(1, 3))
      await owner.query(
        `INSERT INTO enrollments(id,course_id,user_id,role_in_course,"updatedAt") VALUES($1,$2,$3,'student',now())`,
        [randomUUID(), course, userId],
      )
  })
  afterAll(async () => {
    await owner.query('DELETE FROM notifications WHERE user_id=ANY($1::uuid[])', [users])
    await owner.query('DELETE FROM course_announcements WHERE course_id=$1', [course])
    await owner.query(
      'DELETE FROM grades WHERE submission_id IN (SELECT id FROM submissions WHERE assignment_id=ANY($1::uuid[]))',
      [assignments],
    )
    await owner.query('DELETE FROM submissions WHERE assignment_id=ANY($1::uuid[])', [
      assignments,
    ])
    await owner.query('DELETE FROM assignments WHERE id=ANY($1::uuid[])', [assignments])
    await owner.query('DELETE FROM enrollments WHERE course_id=$1', [course])
    await owner.query('DELETE FROM courses WHERE id=ANY($1::uuid[])', [
      [course, otherCourse],
    ])
    await owner.query('DELETE FROM audit_logs WHERE actor_user_id=ANY($1::uuid[])', [
      users,
    ])
    await owner.query('DELETE FROM auth_sessions WHERE user_id=ANY($1::uuid[])', [users])
    await owner.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [users])
    await owner.end()
  })

  it('keeps earned late scores and rejects missing or stale reviewed versions', async () => {
    const id = await assignment(-1)
    const first = await submit(id)
    const path = `/api/v1/submissions/${first.body.id}/grade`
    const grade = (version?: number) =>
      request(app)
        .put(path)
        .set('Authorization', auth(0))
        .send({ expectedSubmissionVersion: version, rawScore: 80, finalScore: 80 })
    expect((await grade()).status).toBe(400)
    expect((await grade(1)).body.finalScore).toBe('80')
    expect((await submit(id, 'Replacement after teacher opened form')).status).toBe(201)
    expect((await grade(1)).status).toBe(409)
    expect(
      (
        await owner.query('SELECT "deletedAt" FROM grades WHERE submission_id=$1', [
          first.body.id,
        ])
      ).rows[0].deletedAt,
    ).not.toBeNull()
    expect((await grade(2)).body.finalScore).toBe('80')
  })

  it('recovers real scoring failures on an identical retry without duplicate grade or teacher notifications', async () => {
    const id = await assignment(-1, 'reading', {
      version: 1,
      sections: [
        {
          id: 's',
          title: 'Passage',
          passage: 'Read.',
          questions: [{ id: 'q1', type: 'multiple_choice', answer: 'B' }],
        },
      ],
    })
    await owner.query(
      `INSERT INTO enrollments(id,course_id,user_id,role_in_course,"updatedAt") VALUES($1,$2,$3,'teacher',now())`,
      [randomUUID(), course, users[0]],
    )
    const send = () =>
      request(app)
        .post(`/api/v1/assignments/${id}/submissions`)
        .set('Authorization', auth())
        .send({
          status: 'submitted',
          payload: { answers: [{ questionId: 'q1', value: 'B' }] },
        })
    // Only this fixture's grade writes fail; no response or scoring adapter is mocked.
    await owner.query(
      `CREATE FUNCTION deadline_review_fail_grade() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF EXISTS (SELECT 1 FROM submissions WHERE id=NEW.submission_id AND assignment_id='${id}') THEN RAISE EXCEPTION 'controlled scoring failure'; END IF; RETURN NEW; END $$`,
    )
    await owner.query(
      'CREATE TRIGGER deadline_review_fail_grade BEFORE INSERT OR UPDATE ON grades FOR EACH ROW EXECUTE FUNCTION deadline_review_fail_grade()',
    )
    try {
      expect((await send()).status).toBe(500)
      expect(
        (
          await owner.query('SELECT payload FROM submissions WHERE assignment_id=$1', [
            id,
          ])
        ).rows[0].payload.version,
      ).toBe(1)
    } finally {
      await owner.query('DROP TRIGGER deadline_review_fail_grade ON grades')
      await owner.query('DROP FUNCTION deadline_review_fail_grade()')
    }
    await owner.query(
      `CREATE FUNCTION deadline_review_fail_notice() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.type='new_submission' AND NEW.user_id='${users[0]}' THEN RAISE EXCEPTION 'controlled teacher queue failure'; END IF; RETURN NEW; END $$`,
    )
    await owner.query(
      'CREATE TRIGGER deadline_review_fail_notice BEFORE INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION deadline_review_fail_notice()',
    )
    try {
      expect((await send()).status).toBe(201)
      expect(
        (
          await owner.query(
            `SELECT id FROM notifications WHERE user_id=$1 AND type='new_submission'`,
            [users[0]],
          )
        ).rows,
      ).toHaveLength(0)
    } finally {
      await owner.query('DROP TRIGGER deadline_review_fail_notice ON notifications')
      await owner.query('DROP FUNCTION deadline_review_fail_notice()')
    }
    const retry = await send()
    expect(retry.status).toBe(201)
    expect(retry.body.payload.version).toBe(1)
    expect((await send()).status).toBe(201)
    const grades = await owner.query(
      'SELECT raw_score FROM grades WHERE submission_id=$1 AND "deletedAt" IS NULL',
      [retry.body.id],
    )
    expect(grades.rows).toHaveLength(1)
    expect(Number(grades.rows[0].raw_score)).toBe(1)
    const notifications = await owner.query(
      `SELECT type,channel FROM notifications WHERE payload->>'submissionId'=$1`,
      [retry.body.id],
    )
    expect(notifications.rows.filter((x) => x.type === 'graded')).toHaveLength(2)
    expect(notifications.rows.filter((x) => x.type === 'new_submission')).toHaveLength(2)
    await owner.query(
      `UPDATE notifications SET next_attempt_at=now()+interval '1 year' WHERE channel='email' AND user_id=ANY($1::uuid[])`,
      [users],
    )
  })
})

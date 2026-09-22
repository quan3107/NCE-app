/** Real API/PostgreSQL deadline acceptance; isolated fixtures never send email. */
import { randomUUID } from 'node:crypto'
import bcrypt from 'bcrypt'
import request from 'supertest'
import { beforeAll, afterAll, describe, it, expect } from 'vitest'
import { app } from '../../../src/app.js'
import { handlePasswordLogin } from '../../../src/modules/auth/auth.service.js'
import { createDatabaseTestOwnerPool } from '../../prisma/databaseTestClient.js'
import { withRoleContext } from '../../../src/prisma/client.js'
import {
  handleDueSoonJob,
  handleWeeklyDigestJob,
} from '../../../src/jobs/notificationHandlers.js'
import { handleDeliverQueuedJob } from '../../../src/jobs/notificationDelivery.js'

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
  const reminders = `/api/v1/courses/${course}/reminders`
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
  const job = (fn: () => Promise<void>) => withRoleContext({ role: 'service_role' }, fn)
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

  it('accepts on-time, marks late without penalty, preserves grades/history on replacement, and deduplicates concurrent requests', async () => {
    const id = await assignment(1)
    const initial = await Promise.all([submit(id), submit(id), submit(id)])
    expect(initial.map((x) => x.status)).toEqual([201, 201, 201])
    expect(new Set(initial.map((x) => x.body.id)).size).toBe(1)
    expect(initial[0].body.status).toBe('submitted')
    const submissionId = initial[0].body.id
    await owner.query(
      `INSERT INTO grades(id,submission_id,grader_id,raw_score,final_score,feedback_md,graded_at,"updatedAt") VALUES($1,$2,$3,91,91,'Keep this feedback',now(),now())`,
      [randomUUID(), submissionId, users[0]],
    )
    await owner.query(`UPDATE submissions SET status='graded' WHERE id=$1`, [
      submissionId,
    ])
    await owner.query(
      `UPDATE assignments SET due_at=clock_timestamp()-interval '1 hour' WHERE id=$1`,
      [id],
    )
    const replaced = await submit(id, 'Replacement')
    expect(replaced.status).toBe(201)
    expect(replaced.body.status).toBe('late')
    expect(replaced.body.payload.version).toBe(2)
    expect(replaced.body.revisionHistory).toBeUndefined()
    const saved = (
      await owner.query('SELECT revision_history FROM submissions WHERE id=$1', [
        submissionId,
      ])
    ).rows[0]
    expect(saved.revision_history[0].payload.content).toBe('Original')
    expect(saved.revision_history[0].grade.finalScore).toBe('91')
    expect(
      (
        await owner.query('SELECT "deletedAt" FROM grades WHERE submission_id=$1', [
          submissionId,
        ])
      ).rows[0].deletedAt,
    ).not.toBeNull()
    const grade = await request(app)
      .put(`/api/v1/submissions/${submissionId}/grade`)
      .set('Authorization', auth(0))
      .send({ expectedSubmissionVersion: 2, rawScore: 87, finalScore: 87 })
    expect(grade.status).toBe(200)
    expect(Number(grade.body.finalScore)).toBe(87)
  })

  it('rejects at/after cutoff without partial mutation and rejects forged enrollment', async () => {
    const id = await assignment(-23)
    expect((await submit(id)).status).toBe(201)
    await owner.query(
      `UPDATE assignments SET due_at=clock_timestamp()-interval '24 hours' WHERE id=$1`,
      [id],
    )
    const before = (
      await owner.query('SELECT * FROM submissions WHERE assignment_id=$1', [id])
    ).rows
    expect((await submit(id, 'Must not persist')).status).toBe(409)
    expect(
      (await owner.query('SELECT * FROM submissions WHERE assignment_id=$1', [id])).rows,
    ).toEqual(before)
    expect((await submit(await assignment(1), 'Outsider', 3)).status).toBe(403)
  })

  it('applies the cutoff to every supported type and regrades objective replacements beyond legacy attempt caps', async () => {
    const audio = randomUUID()
    await owner.query(
      `INSERT INTO files(id,owner_user_id,bucket,key,mime,size,checksum,"updatedAt") VALUES($1,$2,'fixture','recording.ogg','audio/ogg',10,'fixture',now())`,
      [audio, users[1]],
    )
    try {
      for (const [type, payload] of [
        ['link', { link: 'https://example.org/work' }],
        ['file', { files: [{ id: audio }] }],
        ['writing', { task1: { text: 'Task one' }, task2: { text: 'Task two' } }],
        [
          'speaking',
          { recordings: [{ part: 'part1', fileId: audio, durationSeconds: 10 }] },
        ],
        ['reading', { answers: [{ questionId: 'q1', value: 'B' }] }],
        ['listening', { answers: [{ questionId: 'q1', value: 'B' }] }],
      ] as const) {
        const id = await assignment(-1, type, null)
        const send = () =>
          request(app)
            .post(`/api/v1/assignments/${id}/submissions`)
            .set('Authorization', auth())
            .send({ status: 'submitted', payload })
        expect((await send()).status, type).toBe(201)
        await owner.query(
          `UPDATE assignments SET due_at=now()-interval '24 hours' WHERE id=$1`,
          [id],
        )
        expect((await send()).status, type).toBe(409)
      }
      const id = await assignment(-1, 'reading', {
        version: 1,
        attempts: { maxAttempts: 1 },
        sections: [
          {
            id: 'section',
            title: 'Passage',
            passage: 'Read this.',
            questions: [{ id: 'q1', type: 'multiple_choice', answer: 'B' }],
          },
        ],
      })
      const send = (value: string) =>
        request(app)
          .post(`/api/v1/assignments/${id}/submissions`)
          .set('Authorization', auth())
          .send({
            status: 'submitted',
            payload: { answers: [{ questionId: 'q1', value }] },
          })
      const first = await send('A')
      expect(first.status).toBe(201)
      const next = await send('B')
      expect(next.status).toBe(201)
      expect(next.body.payload.version).toBe(2)
      const grade = (
        await owner.query(
          'SELECT raw_score,final_score,band,"deletedAt" FROM grades WHERE submission_id=$1',
          [first.body.id],
        )
      ).rows[0]
      expect(Number(grade.raw_score)).toBe(1)
      expect(Number(grade.final_score)).toBe(Number(grade.band))
      expect(grade.deletedAt).toBeNull()
    } finally {
      await owner.query('DELETE FROM files WHERE id=$1', [audio])
    }
  })

  it('persists self-only course muting and enforces course/role boundaries', async () => {
    expect((await request(app).get(reminders)).status).toBe(401)
    for (const index of [0, 3])
      expect(
        (
          await request(app)
            .put(reminders)
            .set('Authorization', auth(index))
            .send({ muted: true })
        ).status,
      ).toBe(403)
    expect(
      (
        await request(app)
          .put(`/api/v1/courses/${otherCourse}/reminders`)
          .set('Authorization', auth())
          .send({ muted: true })
      ).status,
    ).toBe(403)
    expect(
      (
        await request(app)
          .put(reminders)
          .set('Authorization', auth())
          .send({ muted: true, userId: users[2] })
      ).status,
    ).toBe(400)
    expect(
      (
        await request(app)
          .put(reminders)
          .set('Authorization', auth())
          .send({ muted: true })
      ).body,
    ).toEqual({ muted: true })
    expect((await request(app).get(reminders).set('Authorization', auth())).body).toEqual(
      { muted: true },
    )
    expect(
      (await request(app).get(reminders).set('Authorization', auth(2))).body,
    ).toEqual({ muted: false })
    const announcement = await request(app)
      .post(`/api/v1/courses/${course}/announcements`)
      .set('Authorization', auth(0))
      .send({
        requestId: randomUUID(),
        title: 'Course news',
        body: 'Still enabled',
        publish: true,
      })
    expect(announcement.status).toBe(201)
    expect(
      (
        await owner.query(
          'SELECT channel FROM notifications WHERE announcement_id=$1 AND user_id=$2 ORDER BY channel',
          [announcement.body.id, users[1]],
        )
      ).rows,
    ).toHaveLength(2)
    await owner.query(
      `UPDATE notifications SET next_attempt_at=now()+interval '1 year' WHERE channel='email' AND user_id=ANY($1::uuid[])`,
      [users],
    )
    expect(
      (
        await request(app)
          .put(reminders)
          .set('Authorization', auth())
          .send({ muted: false })
      ).body,
    ).toEqual({ muted: false })
  })

  it('rechecks the deadline after waiting for a concurrent assignment change', async () => {
    const id = await assignment(1)
    const lock = await owner.connect()
    await lock.query('BEGIN')
    try {
      await lock.query(
        `UPDATE assignments SET due_at=now()-interval '24 hours' WHERE id=$1`,
        [id],
      )
      const pending = submit(id).then((response) => response)
      let blocked = false
      for (let i = 0; i < 100; i++) {
        blocked =
          (
            await owner.query(
              `SELECT 1 FROM pg_locks WHERE NOT granted AND pid IN (SELECT pid FROM pg_locks WHERE relation='assignments'::regclass)`,
            )
          ).rowCount! > 0
        if (blocked) break
        await new Promise((resolve) => setTimeout(resolve, 10))
      }
      expect(blocked).toBe(true)
      await lock.query('COMMIT')
      expect((await pending).status).toBe(409)
      expect(
        (await owner.query('SELECT id FROM submissions WHERE assignment_id=$1', [id]))
          .rows,
      ).toEqual([])
    } finally {
      await lock.query('ROLLBACK')
      lock.release()
    }
  })

  it('queues both channels once per deadline, suppresses revoked/muted/stale queued work, and excludes digests', async () => {
    const id = await assignment(23.99)
    await Promise.all([job(handleDueSoonJob), job(handleDueSoonJob)])
    const rows = () =>
      owner.query(
        `SELECT * FROM notifications WHERE payload->>'assignmentId'=$1 AND type='due_soon'`,
        [id],
      )
    expect((await rows()).rows).toHaveLength(4)
    await job(handleDueSoonJob)
    expect((await rows()).rows).toHaveLength(4)
    // Prevent every email fixture from reaching a provider; only exercise real in-app delivery here.
    await owner.query(
      `UPDATE notifications SET next_attempt_at=now()+interval '1 year' WHERE channel='email' AND user_id=ANY($1::uuid[])`,
      [users],
    )
    await request(app).put(reminders).set('Authorization', auth()).send({ muted: true })
    await owner.query(
      `UPDATE enrollments SET "deletedAt"=now() WHERE user_id=$1 AND course_id=$2`,
      [users[2], course],
    )
    await job(handleDeliverQueuedJob)
    expect(
      (await rows()).rows
        .filter((x) => x.channel === 'inapp')
        .every((x) => x.status === 'suppressed'),
    ).toBe(true)
    await request(app).put(reminders).set('Authorization', auth()).send({ muted: false })
    await owner.query(
      `UPDATE enrollments SET "deletedAt"=NULL WHERE user_id=$1 AND course_id=$2`,
      [users[2], course],
    )
    await owner.query(
      `UPDATE assignments SET due_at=due_at+interval '1 second' WHERE id=$1`,
      [id],
    )
    await job(handleDueSoonJob)
    expect((await rows()).rows).toHaveLength(8)
    await owner.query(
      `UPDATE notifications SET next_attempt_at=now()+interval '1 year' WHERE channel='email' AND user_id=ANY($1::uuid[])`,
      [users],
    )
    await job(handleDeliverQueuedJob)
    expect(
      (await rows()).rows.filter((x) => x.channel === 'inapp' && x.status === 'sent'),
    ).toHaveLength(2)
    const stale = await assignment(23)
    await job(handleDueSoonJob)
    await owner.query(
      `UPDATE notifications SET next_attempt_at=now()+interval '1 year' WHERE channel='email' AND user_id=ANY($1::uuid[])`,
      [users],
    )
    await owner.query(
      `UPDATE assignments SET due_at=due_at+interval '2 days' WHERE id=$1`,
      [stale],
    )
    await job(handleDeliverQueuedJob)
    expect(
      (
        await owner.query(
          `SELECT status FROM notifications WHERE payload->>'assignmentId'=$1 AND channel='inapp'`,
          [stale],
        )
      ).rows,
    ).toEqual([{ status: 'suppressed' }, { status: 'suppressed' }])
    await job(handleWeeklyDigestJob)
    expect(
      (
        await owner.query(
          `SELECT id FROM notifications WHERE type='weekly_digest' AND user_id=ANY($1::uuid[])`,
          [users],
        )
      ).rows,
    ).toEqual([])
  })
})

/** Real PostgreSQL/API announcement acceptance: permission boundaries, atomic fan-out, and retries. */
import { randomUUID } from 'node:crypto'
import bcrypt from 'bcrypt'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { app } from '../../../src/app.js'
import { handlePasswordLogin } from '../../../src/modules/auth/auth.service.js'
import { createDatabaseTestOwnerPool } from '../../prisma/databaseTestClient.js'

const databaseDescribe =
  process.env.CI === 'true' || process.env.RUN_DATABASE_TESTS === 'true'
    ? describe.sequential
    : describe.skip
databaseDescribe('course announcements through the real API and PostgreSQL', () => {
  let owner: ReturnType<typeof createDatabaseTestOwnerPool>
  const users = Array.from({ length: 7 }, () => randomUUID())
  const [, , student, , , coTeacher] = users
  const courses = [randomUUID(), randomUUID()]
  const tokens: string[] = []
  const path = `/api/v1/courses/${courses[0]}/announcements`
  const content = {
    title: 'Course update',
    body: 'Bring your course book.',
    publish: true,
  }
  beforeAll(async () => {
    owner = createDatabaseTestOwnerPool()
    const password = 'Announcement-fixture-2026'
    const hash = await bcrypt.hash(password, 4)
    for (let index = 0; index < users.length; index++) {
      const role = [
        'teacher',
        'teacher',
        'student',
        'student',
        'admin',
        'teacher',
        'student',
      ][index]
      const email = `announcement-${users[index]}@example.invalid`
      await owner.query(
        'INSERT INTO users(id,email,password_hash,full_name,role,status,"updatedAt") VALUES($1,$2,$3,$4,$5,\'active\',now())',
        [users[index], email, hash, `Announcement ${role}`, role],
      )
      tokens.push((await handlePasswordLogin({ email, password }, {})).accessToken)
    }
    for (let index = 0; index < courses.length; index++)
      await owner.query(
        'INSERT INTO courses(id,title,owner_teacher_id,"updatedAt") VALUES($1,$2,$3,now())',
        [courses[index], 'Announcement test', users[index]],
      )
    for (const [id, role] of [
      [student, 'student'],
      [users[6], 'student'],
      [coTeacher, 'teacher'],
    ])
      await owner.query(
        'INSERT INTO enrollments(id,course_id,user_id,role_in_course,"updatedAt") VALUES($1,$2,$3,$4,now())',
        [randomUUID(), courses[0], id, role],
      )
  })
  afterAll(async () => {
    await owner.query('DELETE FROM notifications WHERE user_id=ANY($1::uuid[])', [users])
    await owner.query(
      'DELETE FROM course_announcements WHERE course_id=ANY($1::uuid[])',
      [courses],
    )
    await owner.query('DELETE FROM enrollments WHERE course_id=ANY($1::uuid[])', [
      courses,
    ])
    await owner.query('DELETE FROM courses WHERE id=ANY($1::uuid[])', [courses])
    await owner.query('DELETE FROM audit_logs WHERE actor_user_id=ANY($1::uuid[])', [
      users,
    ])
    await owner.query('DELETE FROM auth_sessions WHERE user_id=ANY($1::uuid[])', [users])
    await owner.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [users])
    await owner.end()
  })
  const auth = (index: number) => `Bearer ${tokens[index]}`

  it('denies outsiders/students/admin authoring and cross-course teachers, while allowing co-teachers', async () => {
    expect((await request(app).get(path)).status).toBe(401)
    for (const index of [1, 2, 3, 4])
      expect(
        (
          await request(app)
            .post(path)
            .set('Authorization', auth(index))
            .send({ ...content, requestId: randomUUID() })
        ).status,
      ).toBe(403)
    expect((await request(app).get(path).set('Authorization', auth(3))).status).toBe(403)
    const created = await request(app)
      .post(path)
      .set('Authorization', auth(5))
      .send({ ...content, publish: false, requestId: randomUUID() })
    expect(created.status).toBe(201)
    expect(
      (
        await request(app)
          .patch(`${path}/${created.body.id}`)
          .set('Authorization', auth(1))
          .send({ ...content, revision: 1 })
      ).status,
    ).toBe(403)
    for (const index of [1, 2, 3])
      expect(
        (
          await request(app)
            .delete(`${path}/${created.body.id}`)
            .set('Authorization', auth(index))
        ).status,
      ).toBe(403)
    expect(
      (
        await request(app)
          .delete(`${path}/${created.body.id}`)
          .set('Authorization', auth(0))
      ).status,
    ).toBe(204)
  })

  it('deduplicates concurrent create/publish retries, hides drafts, edits silently, and revokes access', async () => {
    const input = { ...content, publish: false, requestId: randomUUID() }
    const responses = await Promise.all(
      [0, 1, 2].map(() =>
        request(app).post(path).set('Authorization', auth(0)).send(input),
      ),
    )
    expect(responses.map((res) => res.status)).toEqual([201, 201, 201])
    expect(new Set(responses.map((res) => res.body.id)).size).toBe(1)
    const id = responses[0].body.id
    expect(
      (await request(app).get(path).set('Authorization', auth(2))).body.data,
    ).toEqual([])
    expect(
      (
        await request(app)
          .post(path)
          .set('Authorization', auth(0))
          .send({ ...input, title: 'Different' })
      ).status,
    ).toBe(409)
    const publications = await Promise.all(
      [0, 1, 2].map(() =>
        request(app)
          .patch(`${path}/${id}`)
          .set('Authorization', auth(0))
          .send({ ...content, revision: 1 }),
      ),
    )
    expect(publications.map((res) => res.status)).toEqual([200, 200, 200])
    const deliveries = (
      await owner.query(
        'SELECT user_id,channel FROM notifications WHERE announcement_id=$1',
        [id],
      )
    ).rows
    expect(deliveries).toHaveLength(4)
    expect(new Set(deliveries.map((row) => row.user_id))).toEqual(
      new Set([student, users[6]]),
    )
    for (const recipient of [student, users[6]])
      expect(
        deliveries
          .filter((row) => row.user_id === recipient)
          .map((row) => row.channel)
          .sort(),
      ).toEqual(['email', 'inapp'])
    expect(
      (await request(app).get(path).set('Authorization', auth(2))).body.data[0].id,
    ).toBe(id)
    const edited = await request(app)
      .patch(`${path}/${id}`)
      .set('Authorization', auth(0))
      .send({ ...content, body: 'Updated message', publish: false, revision: 2 })
    expect(edited.status).toBe(200)
    expect(
      (
        await request(app)
          .patch(`${path}/${id}`)
          .set('Authorization', auth(0))
          .send({ ...content, title: 'Stale edit', revision: 1 })
      ).status,
    ).toBe(409)
    expect(
      (await owner.query('SELECT id FROM notifications WHERE announcement_id=$1', [id]))
        .rowCount,
    ).toBe(4)
    const visible = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', auth(2))
    expect(
      visible.body.filter((row: { type: string }) => row.type === 'announcement'),
    ).toHaveLength(1)
    await owner.query(
      'UPDATE enrollments SET "deletedAt"=now() WHERE course_id=$1 AND user_id=$2',
      [courses[0], student],
    )
    expect((await request(app).get(path).set('Authorization', auth(2))).status).toBe(403)
    expect(
      (await request(app).get('/api/v1/notifications').set('Authorization', auth(2)))
        .body,
    ).toEqual([])
    expect(
      (
        await request(app)
          .get(`/api/v1/notifications/${visible.body[0].id}`)
          .set('Authorization', auth(2))
      ).status,
    ).toBe(404)
    await owner.query(
      'UPDATE enrollments SET "deletedAt"=NULL WHERE course_id=$1 AND user_id=$2',
      [courses[0], student],
    )
    expect(
      (await request(app).delete(`${path}/${id}`).set('Authorization', auth(4))).status,
    ).toBe(204)
    expect(
      (await request(app).delete(`${path}/${id}`).set('Authorization', auth(4))).status,
    ).toBe(204)
    expect(
      (await request(app).post(path).set('Authorization', auth(0)).send(input)).status,
    ).toBe(409)
    expect(
      (
        await owner.query(
          'SELECT id FROM notifications WHERE announcement_id=$1 AND "deletedAt" IS NULL',
          [id],
        )
      ).rowCount,
    ).toBe(0)
  })

  it('rolls back publication when queuing a notification fails', async () => {
    const requestId = randomUUID()
    const trigger = `announcement_failure_${requestId.replaceAll('-', '')}`
    await owner.query(
      `CREATE FUNCTION public.${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.announcement_id IS NOT NULL AND NEW.user_id = '${student}'::uuid THEN RAISE EXCEPTION 'intentional announcement fixture failure'; END IF; RETURN NEW; END $$`,
    )
    await owner.query(
      `CREATE TRIGGER ${trigger} BEFORE INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION public.${trigger}()`,
    )
    try {
      const failed = await request(app)
        .post(path)
        .set('Authorization', auth(0))
        .send({ ...content, requestId })
      expect(failed.status).toBe(500)
      expect(
        (
          await owner.query('SELECT id FROM course_announcements WHERE request_id=$1', [
            requestId,
          ])
        ).rowCount,
      ).toBe(0)
    } finally {
      await owner.query(`DROP TRIGGER ${trigger} ON notifications`)
      await owner.query(`DROP FUNCTION public.${trigger}()`)
    }
    const retried = await request(app)
      .post(path)
      .set('Authorization', auth(0))
      .send({ ...content, requestId })
    expect(retried.status).toBe(201)
    expect(
      (
        await owner.query('SELECT id FROM notifications WHERE announcement_id=$1', [
          retried.body.id,
        ])
      ).rowCount,
    ).toBe(4)
  })

  it('does not retry an uncertain email delivery and blocks revoked co-teacher mutations', async () => {
    const created = await request(app)
      .post(path)
      .set('Authorization', auth(0))
      .send({ ...content, requestId: randomUUID() })
    expect(created.status).toBe(201)
    const result = await owner.query(
      "UPDATE notifications SET status='delivery_unknown' WHERE announcement_id=$1 AND channel='email' RETURNING id",
      [created.body.id],
    )
    expect(
      (
        await request(app)
          .post(`/api/v1/notifications/${result.rows[0].id}/resend`)
          .set('Authorization', auth(4))
      ).status,
    ).toBe(409)
    await owner.query('UPDATE enrollments SET "deletedAt"=now() WHERE user_id=$1', [
      coTeacher,
    ])
    expect(
      (
        await request(app)
          .patch(`${path}/${created.body.id}`)
          .set('Authorization', auth(5))
          .send({ ...content, title: 'Revoked', revision: 1 })
      ).status,
    ).toBe(403)
    // Verify browser/Data API roles cannot bypass the backend announcement service.
    const client = await owner.connect()
    try {
      await client.query('BEGIN')
      await client.query('SET LOCAL ROLE authenticated')
      await expect(client.query('SELECT * FROM course_announcements')).rejects.toThrow(
        /permission denied/,
      )
    } finally {
      await client.query('ROLLBACK')
      client.release()
    }
  })
})

// File: docs/performance/x07/fixture.mjs
// Purpose: Create 100 learners, four courses and a term-sized submission fixture.
// Why: Small demo fixtures cannot represent the confirmed launch population.
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const repo = resolve(import.meta.dirname, "../../..");
const require = createRequire(`${repo}/backend/package.json`);
const { Client } = require("pg");
const bcrypt = require("bcrypt");
const { buildReadingConfigOfficialFull } = await import(`${repo}/backend/dist/prisma/seeds/ieltsOfficialFixtures.js`);
const dir = "/tmp/nce-x07-performance-20260926";
const db = new Client({ connectionString: "postgres://postgres:x07-local-owner@127.0.0.1:55448/nce_x07" });
await db.connect();
const uid = (n) => `70000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const { password } = JSON.parse(readFileSync(`${dir}/credentials.json`));
const hash = await bcrypt.hash(password, 10);
const users = [
  ...Array.from({ length: 100 }, (_, i) => ({
    id: uid(i + 1),
    email: `student${i + 1}@x07.example.test`,
    name: `Performance Student ${i + 1}`,
    role: "student",
  })),
  ...[1, 2].map((i) => ({
    id: uid(100 + i),
    email: `teacher${i}@x07.example.test`,
    name: `Performance Teacher ${i}`,
    role: "teacher",
  })),
  { id: uid(103), email: "admin@x07.example.test", name: "Performance Admin", role: "admin" },
];
const courses = Array.from({ length: 4 }, (_, i) => ({
  id: uid(200 + i),
  owner: uid(101 + Math.floor(i / 2)),
  title: `Launch Course ${i + 1}`,
}));
const assignments = [];
const text =
  "Education provides opportunities to practise critical thinking. Students learn through regular feedback and revision. ".repeat(
    18,
  );
await db.query("BEGIN");
try {
  for (const u of users)
    await db.query(
      "INSERT INTO users (id,email,password_hash,full_name,role,status,\"updatedAt\") VALUES ($1,$2,$3,$4,$5,'active',now())",
      [u.id, u.email, hash, u.name, u.role],
    );
  for (const c of courses)
    await db.query(
      'INSERT INTO courses (id,title,description,owner_teacher_id,"updatedAt") VALUES ($1,$2,$3,$4,now())',
      [c.id, c.title, "Twelve-week English course with thirty assignments and fifty enrolled students.", c.owner],
    );
  for (let s = 0; s < 100; s++)
    for (const c of courses.slice(s < 50 ? 0 : 2, s < 50 ? 2 : 4))
      await db.query(
        "INSERT INTO enrollments (id,course_id,user_id,role_in_course,\"updatedAt\") VALUES ($1,$2,$3,'student',now())",
        [uid(1000 + s * 4 + courses.indexOf(c)), c.id, users[s].id],
      );
  for (let c = 0; c < 4; c++)
    for (let a = 0; a < 30; a++) {
      const id = uid(2000 + c * 30 + a);
      const reading = a === 29,
        upload = a === 28;
      const config = reading ? buildReadingConfigOfficialFull() : { version: 1, maxScore: 100 };
      assignments.push({
        id,
        courseId: courses[c].id,
        title: reading ? `Large Reading ${c + 1}` : upload ? `File Upload ${c + 1}` : `Course ${c + 1} Essay ${a + 1}`,
        type: reading ? "reading" : upload ? "file" : "text",
      });
      await db.query(
        'INSERT INTO assignments (id,course_id,title,type,due_at,assignment_config,published_at,"createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$7)',
        [
          id,
          courses[c].id,
          assignments.at(-1).title,
          assignments.at(-1).type,
          a < 24 ? "2026-09-20T12:00:00Z" : "2026-10-10T12:00:00Z",
          JSON.stringify(config),
          "2026-06-01T00:00:00Z",
        ],
      );
    }
  let n = 0;
  for (let s = 0; s < 100; s++)
    for (const a of assignments
      .filter((a) => courses.slice(s < 50 ? 0 : 2, s < 50 ? 2 : 4).some((c) => c.id === a.courseId))
      .slice(0, 24)
      .concat(assignments.filter((a) => a.courseId === courses[s < 50 ? 1 : 3].id).slice(0, 24))) {
      const id = uid(10000 + n++);
      const graded = Number(a.title.split(" ").at(-1)) <= 17;
      await db.query(
        'INSERT INTO submissions (id,assignment_id,student_id,status,submitted_at,payload,"updatedAt") VALUES ($1,$2,$3,$4,$5,$6,now())',
        [
          id,
          a.id,
          users[s].id,
          graded ? "graded" : "submitted",
          "2026-09-19T12:00:00Z",
          JSON.stringify({ content: text, version: 1 }),
        ],
      );
      if (graded)
        await db.query(
          'INSERT INTO grades (id,submission_id,grader_id,final_score,feedback_md,graded_at,"updatedAt") VALUES ($1,$2,$3,$4,$5,$6,now())',
          [
            uid(20000 + n),
            id,
            courses.find((c) => c.id === a.courseId).owner,
            65 + (s % 30),
            "Clear structure; develop evidence in the next revision.",
            "2026-09-20T12:00:00Z",
          ],
        );
    }
  for (let i = 0; i < 100; i++)
    await db.query("INSERT INTO learning_activity_days (student_id,course_id,day) VALUES ($1,$2,$3)", [
      users[i].id,
      courses[i < 50 ? 0 : 2].id,
      "2026-09-19",
    ]);
  await db.query("UPDATE learning_activity_coverage SET started_at='2026-06-01T00:00:00Z'");
  await db.query("COMMIT");
  await db.query("ANALYZE");
} catch (e) {
  await db.query("ROLLBACK");
  throw e;
}
const counts = {};
for (const table of [
  "users",
  "courses",
  "enrollments",
  "assignments",
  "submissions",
  "grades",
  "learning_activity_days",
])
  counts[table] = Number((await db.query(`SELECT count(*) FROM ${table}`)).rows[0].count);
writeFileSync(
  `${dir}/fixture.json`,
  JSON.stringify(
    {
      users,
      courses,
      assignments,
      counts,
      essayBytes: Buffer.byteLength(text),
      readingConfigBytes: Buffer.byteLength(JSON.stringify(buildReadingConfigOfficialFull())),
    },
    null,
    2,
  ),
);
console.log(JSON.stringify({ counts, essayBytes: Buffer.byteLength(text) }));
await db.end();

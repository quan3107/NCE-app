// File: docs/performance/x07/verify-fixes.mjs
// Purpose: Check new page/summary/grade contracts against real authenticated local data.
// Why: Bounded lists must retain all records, complete counts and the original visibility behavior.
import { readFileSync, writeFileSync } from 'node:fs';
import { deepStrictEqual, strictEqual, ok } from 'node:assert';
const dir = process.env.X07_EVIDENCE_DIR ?? '/tmp/nce-x07-performance-fixes-20260926';
const { password } = JSON.parse(readFileSync(`${dir}/credentials.json`));
const fixture = JSON.parse(readFileSync(`${dir}/fixture.json`));
async function call(path, token, body) {
  const response = await fetch(`http://127.0.0.1:4008/api/v1${path}`, {
    method: body ? 'POST' : 'GET', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, data: await response.json() };
}
async function login(email) {
  const response = await call('/auth/login', null, { email, password });
  strictEqual(response.status, 200); return response.data.accessToken;
}
async function pages(path, token, limit) {
  const items = [], cursors = new Set(), sizes = [];
  let cursor;
  do {
    const response = await call(`${path}${path.includes('?') ? '&' : '?'}limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`, token);
    strictEqual(response.status, 200); ok(response.data.items.length <= limit);
    if (response.data.total !== undefined) strictEqual(response.data.total, sizes.length ? sizes[0].total : response.data.total);
    sizes.push({ rows: response.data.items.length, total: response.data.total });
    items.push(...response.data.items); cursor = response.data.nextCursor;
    if (cursor) { ok(!cursors.has(cursor)); cursors.add(cursor); }
    ok(sizes.length <= 100);
  } while (cursor);
  strictEqual(new Set(items.map(item => item.id)).size, items.length);
  if (sizes[0].total !== undefined) strictEqual(items.length, sizes[0].total);
  return { items, sizes };
}
const result = { staff: [], grades: [], access: [] };
for (const email of ['teacher1@x07.example.test', 'teacher2@x07.example.test', 'admin@x07.example.test']) {
  const token = await login(email);
  const oldAssignments = await pages('/assignments/accessible', token, 100);
  const oldSubmissions = await pages('/submissions/accessible', token, 100);
  const assignments = await pages('/assignments/summaries', token, 50);
  const queue = await pages('/submissions/summaries', token, 50);
  deepStrictEqual(assignments.items.map(item => item.id), oldAssignments.items.map(item => item.id));
  const pending = oldSubmissions.items.filter(item => ['submitted', 'late'].includes(item.status));
  deepStrictEqual(queue.items.map(item => item.id), pending.map(item => item.id));
  // A graded boundary models a pending row disappearing between page requests.
  // It must not cause Prisma skip:1 to discard the first still-pending record.
  const boundaryIndex = oldSubmissions.items.findIndex((item, index) => item.status === 'graded' && ['submitted', 'late'].includes(oldSubmissions.items[index + 1]?.status));
  ok(boundaryIndex >= 0);
  const afterGrading = await call(`/submissions/summaries?limit=50&cursor=${oldSubmissions.items[boundaryIndex].id}`, token);
  strictEqual(afterGrading.status, 200);
  deepStrictEqual(afterGrading.data.items.map(item => item.id), oldSubmissions.items.slice(boundaryIndex + 1).filter(item => ['submitted', 'late'].includes(item.status)).slice(0, 50).map(item => item.id));
  ok(queue.items.every(item => !('payload' in item) && !('revisionHistory' in item)));
  ok(assignments.items.every(item => !('assignmentConfig' in item)));
  for (const assignment of assignments.items) {
    strictEqual(assignment.submissionCount, oldSubmissions.items.filter(item => item.assignmentId === assignment.id).length);
  }
  const overview = await call('/assignments/overview', token);
  strictEqual(overview.data.activeAssignments, oldAssignments.items.filter(item => item.publishedAt).length);
  strictEqual(overview.data.pendingSubmissions, pending.length);
  deepStrictEqual(overview.data.recentSubmissions.map(item => item.id), pending.slice(0, 3).map(item => item.id));
  const assignment = oldAssignments.items.find(item => item.type === 'text' && item.title.endsWith(' 1'));
  const detail = await call(`/assignments/${assignment.id}/overview`, token);
  const submissions = oldSubmissions.items.filter(item => item.assignmentId === assignment.id);
  const count = statuses => submissions.filter(item => statuses.includes(item.status)).length;
  deepStrictEqual(detail.data.counts, { total: submissions.length, submitted: count(['submitted', 'late', 'graded']), pending: count(['submitted', 'late']), graded: count(['graded']), late: count(['late']) });
  const scopedPage = await pages(`/submissions/summaries?assignmentId=${assignment.id}&pending=false`, token, 50);
  deepStrictEqual(scopedPage.items.map(item => item.id), submissions.map(item => item.id));
  const full = await call(`/submissions/${submissions[0].id}/detail`, token);
  strictEqual(full.status, 200); deepStrictEqual(full.data.submission.payload, submissions[0].payload);
  result.staff.push({ role: email.split('@')[0], assignments: assignments.items.length, assignmentPages: assignments.sizes, pending: queue.items.length, queuePages: queue.sizes, countParity: true, detailParity: true, gradedCursorSkipsNoPendingRows: true });
}
for (const email of ['student1@x07.example.test', 'student100@x07.example.test']) {
  const token = await login(email);
  const { items } = await pages('/submissions/accessible', token, 100);
  const individual = [];
  for (const item of items) {
    const grade = await call(`/submissions/${item.id}/grade`, token);
    ok([200, 404].includes(grade.status)); if (grade.status === 200) individual.push(grade.data);
  }
  const batch = await call('/submissions/grades', token, { submissionIds: items.map(item => item.id) });
  strictEqual(batch.status, 200); deepStrictEqual(batch.data.items, individual);
  strictEqual((await call('/assignments/overview', token)).status, 403);
  strictEqual((await call('/submissions/summaries', token)).status, 403);
  result.grades.push({ student: email.split('@')[0], submissions: items.length, grades: individual.length, batchMatchesIndividual: true, staffDenied: true });
}
const teacher = await login('teacher1@x07.example.test');
const student = await login('student100@x07.example.test');
const foreignAssignment = fixture.assignments.find(item => item.courseId === fixture.courses[2].id);
strictEqual((await call(`/assignments/${foreignAssignment.id}/overview`, teacher)).status, 404);
const teacherSubmissions = (await pages('/submissions/accessible', teacher, 100)).items;
const foreignId = teacherSubmissions[0].id;
deepStrictEqual((await call('/submissions/grades', student, { submissionIds: [foreignId] })).data.items, []);
strictEqual((await call('/submissions/summaries')).status, 401);
strictEqual((await call('/submissions/summaries?limit=101', teacher)).status, 400);
strictEqual((await call('/submissions/grades', student, { submissionIds: Array(101).fill(foreignId) })).status, 400);
result.access.push({ anonymousDenied: true, teacherForeignCourseDenied: true, studentForeignGradeOmitted: true, oversizedRequestsDenied: true });
writeFileSync(`${dir}/fix-contracts.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));

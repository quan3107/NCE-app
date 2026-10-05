// File: docs/performance/x07/load.mjs
// Purpose: Measure 50 paced authenticated actors against the local API.
// Why: Activity-level timing must stay separate from request timing and SLO decisions.
import http from "node:http";
import { readFileSync, writeFileSync, createWriteStream } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const dir = process.env.X07_EVIDENCE_DIR ?? "/tmp/nce-x07-performance-20260926";
const legacy = process.argv.includes('--legacy');
const fixture = JSON.parse(readFileSync(`${dir}/fixture.json`));
const { password } = JSON.parse(readFileSync(`${dir}/credentials.json`));
// This owner read only describes the task-owned fixture; all measured HTTP uses normal auth/RLS.
const require = createRequire(`${resolve(import.meta.dirname, "../../..")}/backend/package.json`);
const { Client } = require("pg");
const db = new Client({ connectionString: "postgres://postgres:x07-local-owner@127.0.0.1:55448/nce_x07" });
await db.connect();
const datasetAtStart = {};
for (const table of ["users", "courses", "enrollments", "assignments", "submissions", "grades"])
  datasetAtStart[table] = Number((await db.query(`SELECT count(*) FROM ${table}`)).rows[0].count);
datasetAtStart.drafts = Number((await db.query("SELECT count(*) FROM submissions WHERE status='draft'")).rows[0].count);
await db.end();
const students = fixture.users.filter((u) => u.role === "student").slice(0, 48);
const users = students.concat(fixture.users.filter((u) => u.role === "teacher"));
const warmupMs = 60_000,
  measurementMs = 300_000,
  rampMs = 30_000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let origin = 0,
  phase = "setup",
  inflight = 0,
  peakInflight = 0;
const rows = [],
  activities = [],
  actors = [];
const raw = createWriteStream(`${dir}/api-requests.jsonl`);
const agents = users.map(
  (_, i) => new http.Agent({ keepAlive: true, maxSockets: 8, localAddress: `127.0.0.${10 + i}` }),
);
async function request(vu, path, method = "GET", body, expected = [200, 201]) {
  const start = performance.now();
  const capturedPhase = phase;
  inflight++;
  peakInflight = Math.max(peakInflight, inflight);
  let status = 0,
    bytes = 0,
    data = null,
    reason = null;
  try {
    const response = await new Promise((resolve, reject) => {
      const payload = body ? JSON.stringify(body) : null;
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: 4008,
          path: `/api/v1${path}`,
          method,
          agent: agents[vu.index],
          headers: {
            ...(vu.token ? { authorization: `Bearer ${vu.token}` } : {}),
            ...(payload ? { "content-type": "application/json", "content-length": Buffer.byteLength(payload) } : {}),
          },
        },
        (res) => {
          const chunks = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => resolve({ status: res.statusCode, body: Buffer.concat(chunks) }));
        },
      );
      req.setTimeout(30_000, () => req.destroy(new Error("timeout")));
      req.on("error", reject);
      req.end(payload);
    });
    status = response.status;
    bytes = response.body.length;
    try {
      data = JSON.parse(response.body.toString());
    } catch {}
    if (!expected.includes(status)) reason = `HTTP ${status}`;
  } catch (e) {
    reason = e.message;
  }
  inflight--;
  const row = {
    phase: capturedPhase,
    atMs: Math.round(performance.now() - origin),
    vu: vu.index,
    role: vu.user.role,
    path: path.split("?")[0].replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/g, ":id"),
    method,
    status,
    bytes,
    ms: performance.now() - start,
    error: reason,
  };
  rows.push(row);
  raw.write(JSON.stringify(row) + "\n");
  if (reason) throw new Error(reason);
  return data;
}
async function drain(vu, path) {
  const items = [];
  let cursor = null,
    pages = 0;
  do {
    const page = await request(vu, path + (cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""));
    if (!Array.isArray(page.items)) throw new Error("Invalid collection");
    items.push(...page.items);
    pages++;
    if (cursor && page.nextCursor === cursor) throw new Error("Cursor did not advance");
    cursor = page.nextCursor;
    if (pages > 100) throw new Error("Bound exceeded");
  } while (cursor);
  return { items, pages };
}
async function dashboard(vu) {
  if (vu.user.role === 'teacher' && !legacy) {
    const [overview] = await Promise.all([
      request(vu, '/assignments/overview'),
      ...['/me', '/courses', '/me/dashboard-config', '/config/dashboard-widgets', '/notifications', '/analytics/teacher'].map(path => request(vu, path)),
    ]);
    // Fixture navigation chooses a known accessible historical assignment; the dashboard does not fetch its history.
    const courseIds = fixture.courses.filter(course => course.owner === vu.user.id).map(course => course.id);
    vu.assignments = fixture.assignments.filter(assignment => courseIds.includes(assignment.courseId));
    return { pendingSubmissions: overview.pendingSubmissions, recentRows: overview.recentSubmissions.length, submissionPages: 0 };
  }
  const [a, s] = await Promise.all([
    drain(vu, "/assignments/accessible"),
    drain(vu, "/submissions/accessible"),
    ...[
      "/me",
      "/courses",
      "/me/dashboard-config",
      "/config/dashboard-widgets",
      "/notifications",
      vu.user.role === "teacher" ? "/analytics/teacher" : "/assignments/pending-count",
    ].map((p) => request(vu, p)),
  ]);
  vu.assignments = a.items;
  vu.submissions = s.items;
  return {
    assignmentRows: a.items.length,
    submissionRows: s.items.length,
    assignmentPages: a.pages,
    submissionPages: s.pages,
  };
}
function quantile(values, q) {
  const sorted = values.toSorted((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(q * sorted.length) - 1)] ?? null;
}
function stats(values) {
  return {
    n: values.length,
    p50: quantile(values, 0.5),
    p95: quantile(values, 0.95),
    p99: quantile(values, 0.99),
    max: values.length ? Math.max(...values) : null,
  };
}
async function action(vu, step) {
  const teacher = vu.user.role === "teacher";
  const seq = step % 6;
  let name, detail;
  // Choose a populated historical assignment, rather than the newest empty future assignment.
  const a = vu.assignments?.find((a) => a.type === "text" && a.title.endsWith(" 1"));
  const s = vu.submissions?.[step % (vu.submissions?.length || 1)];
  const begin = performance.now(),
    currentPhase = phase;
  try {
    if (seq === 0 || !a) {
      name = "dashboard";
      detail = await dashboard(vu);
    } else if (seq === 1) {
      name = "assignment-detail";
      await request(vu, teacher && !legacy ? `/assignments/${a.id}/overview` : `/courses/${a.courseId}/assignments/${a.id}`);
    } else if (seq === 2) {
      name = "submission-page";
      const response = await request(vu, teacher && !legacy
        ? `/submissions/summaries?assignmentId=${a.id}&pending=false&limit=50`
        : `/assignments/${a.id}/submissions?limit=50&offset=0`);
      const page = teacher && !legacy ? response.items : response;
      if (teacher && !legacy) vu.submissionCursor = page[24]?.id;
      detail = { rows: page.length };
      if (page.length !== (teacher ? 50 : 1)) throw new Error("Expected populated historical submission page");
    } else if (seq === 3 && teacher) {
      name = "analytics-filter";
      await request(vu, `/analytics/teacher?courseId=${a.courseId}&from=2026-06-01&to=2026-09-26`);
    } else if (seq === 3) {
      name = "grade-detail";
      await request(vu, `/submissions/${s.id}/grade`, "GET", null, [200, 404]);
    } else if (seq === 4 && teacher) {
      name = "submission-next-page";
      const response = await request(vu, !legacy
        ? `/submissions/summaries?assignmentId=${a.id}&pending=false&limit=25&cursor=${vu.submissionCursor}`
        : `/assignments/${a.id}/submissions?limit=25&offset=25`);
      const page = !legacy ? response.items : response;
      detail = { rows: page.length };
      if (page.length !== 25) throw new Error("Expected 25 rows on scoped page");
    } else if (seq === 4) {
      name = "draft-save";
      const draft = vu.assignments.find((a) => a.type === "text" && a.title.endsWith(" 25"));
      await request(vu, `/assignments/${draft.id}/submissions`, "POST", {
        status: "draft",
        payload: { version: 1, content: `Performance draft revision ${step}. ${"A considered answer. ".repeat(100)}` },
      });
    } else {
      name = "assignment-list";
      if (teacher && !legacy) await request(vu, '/assignments/summaries?limit=50');
      else await drain(vu, "/assignments/accessible");
    }
    activities.push({
      phase: currentPhase,
      vu: vu.index,
      role: vu.user.role,
      name,
      ms: performance.now() - begin,
      error: null,
      ...detail,
    });
  } catch (e) {
    activities.push({
      phase: currentPhase,
      vu: vu.index,
      role: vu.user.role,
      name,
      ms: performance.now() - begin,
      error: e.message,
    });
  }
}
for (let i = 0; i < users.length; i++) {
  const vu = { index: i, user: users[i] };
  const auth = await request(vu, "/auth/login", "POST", { email: vu.user.email, password });
  if (!auth.accessToken) throw new Error("Login missing access token");
  vu.token = auth.accessToken;
  actors.push(vu);
}
// Tokens never enter logs or committed evidence. Login warmup is deliberately outside timed traffic.
console.log("Authenticated 50 distinct users at 50 loopback client addresses; starting 30s ramp + 60s warmup.");
origin = performance.now();
phase = "warmup";
const measurementStart = origin + rampMs + warmupMs,
  measurementEnd = measurementStart + measurementMs;
const phaseTimer = setTimeout(() => {
  phase = "measurement";
  console.log("All 50 paced users active; 300s measurement started.");
}, rampMs + warmupMs);
const heartbeat = setInterval(
  () =>
    console.log(
      JSON.stringify({
        elapsedSeconds: Math.round((performance.now() - origin) / 1000),
        phase,
        requests: rows.filter((r) => r.phase === phase).length,
        inflight,
      }),
    ),
  30_000,
);
await Promise.all(
  actors.map(async (vu) => {
    await sleep((vu.index * rampMs) / (users.length - 1));
    let step = 0;
    while (performance.now() < measurementEnd) {
      // Closed-loop activity with deterministic 3–8s reading/thinking pauses, not 50 simultaneous GETs.
      await action(vu, step++);
      const pacing = 3000 + ((vu.index * 997 + step * 1543) % 5001);
      await sleep(Math.min(pacing, Math.max(0, measurementEnd - performance.now())));
    }
  }),
);
clearTimeout(phaseTimer);
clearInterval(heartbeat);
const measured = rows.filter((r) => r.phase === "measurement"),
  measuredActivities = activities.filter((r) => r.phase === "measurement");
const group = {};
for (const r of measured) {
  const key = `${r.method} ${r.path}`;
  (group[key] ??= []).push(r);
}
const actionGroup = {};
for (const r of measuredActivities) {
  const key = `${r.role}:${r.name}`;
  (actionGroup[key] ??= []).push(r);
}
const summary = {
  conditions: {
    staffReads: legacy ? 'legacy collections and offset pages' : 'aggregate dashboard, bounded summaries and cursor pages',
    users: 50,
    students: 48,
    teachers: 2,
    rampMs,
    warmupMs,
    measurementMs,
    pacing: "3–8 seconds after each completed activity",
    network:
      "HTTP keepalive loopback, no synthetic network latency or CPU throttle; same host generator/API/PostgreSQL",
    pool: "API pg.Pool default 10; transaction maxWait default 5000ms; no application tuning",
    login:
      "separate loopback source addresses; all authentication defaults retained; password login uses failure counters",
  },
  fixtureHistorical: fixture.counts,
  datasetAtStart,
  requests: measured.length,
  errors: measured.filter((r) => r.error).length,
  requestsPerSecond: measured.length / (measurementMs / 1000),
  bytes: measured.reduce((sum, r) => sum + r.bytes, 0),
  latencyMs: stats(measured.map((r) => r.ms)),
  peakInflight,
  actions: measuredActivities.length,
  actionsPerSecond: measuredActivities.length / (measurementMs / 1000),
  activityErrors: measuredActivities.filter((r) => r.error).length,
  endpoints: Object.fromEntries(
    Object.entries(group).map(([k, v]) => [
      k,
      {
        ...stats(v.map((r) => r.ms)),
        errors: v.filter((r) => r.error).length,
        bytes: v.reduce((s, r) => s + r.bytes, 0),
        statuses: v.reduce((o, r) => ((o[r.status] = (o[r.status] || 0) + 1), o), {}),
      },
    ]),
  ),
  activities: Object.fromEntries(
    Object.entries(actionGroup).map(([k, v]) => [
      k,
      { ...stats(v.map((r) => r.ms)), errors: v.filter((r) => r.error).length },
    ]),
  ),
  measurementStartedAt: new Date(Date.now() - (performance.now() - measurementStart)).toISOString(),
  drainTailMs: Math.max(0, performance.now() - measurementEnd),
};
writeFileSync(`${dir}/api-summary.json`, JSON.stringify(summary, null, 2));
writeFileSync(`${dir}/api-activities.json`, JSON.stringify(activities, null, 2));
raw.end();
for (const agent of agents) agent.destroy();
console.log(JSON.stringify(summary, null, 2));

// File: docs/performance/x07/supplement.mjs
// Purpose: Verify cursor bounds, a shared-IP login burst and authoritative local state.
// Why: API timing alone does not establish pagination bounds or mutation persistence.
import http from "node:http";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { deepStrictEqual } from "node:assert";
const repo = resolve(import.meta.dirname, "../../.."),
  dir = process.env.X07_EVIDENCE_DIR ?? "/tmp/nce-x07-performance-20260926";
const { password } = JSON.parse(readFileSync(`${dir}/credentials.json`));
const fixture = JSON.parse(readFileSync(`${dir}/fixture.json`));
async function call(path, body, token, agent) {
  const start = performance.now();
  const result = await new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const request = http.request(
      {
        hostname: "127.0.0.1",
        port: 4008,
        path: `/api/v1${path}`,
        method: body ? "POST" : "GET",
        agent,
        headers: {
          ...(data ? { "content-type": "application/json", "content-length": Buffer.byteLength(data) } : {}),
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
      },
      (response) => {
        const chunks = [];
        response.on("data", (b) => chunks.push(b));
        response.on("end", () => {
          const buffer = Buffer.concat(chunks);
          resolve({ status: response.statusCode, bytes: buffer.length, data: JSON.parse(buffer.toString()) });
        });
      },
    );
    request.on("error", reject);
    request.end(data);
  });
  return { ...result, ms: performance.now() - start };
}
const result = { collections: [], uploads: [] };
for (const role of ["admin", "teacher"]) {
  const email = role === "admin" ? "admin@x07.example.test" : "teacher1@x07.example.test";
  const auth = await call("/auth/login", { email, password });
  if (auth.status !== 200) throw new Error(`Diagnostic login HTTP ${auth.status}`);
  for (const name of ["assignments", "submissions"]) {
    const start = performance.now(),
      ids = [],
      pageSizes = [],
      pageMs = [];
    let cursor = null,
      bytes = 0;
    do {
      const response = await call(
        `/${name}/accessible${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
        null,
        auth.data.accessToken,
      );
      if (response.status !== 200 || response.data.items.length > 100) throw new Error("Collection contract failed");
      pageSizes.push(response.data.items.length);
      pageMs.push(response.ms);
      bytes += response.bytes;
      ids.push(...response.data.items.map((x) => x.id));
      cursor = response.data.nextCursor;
      if (pageSizes.length > 100) throw new Error("Page bound exceeded");
    } while (cursor);
    result.collections.push({
      role,
      name,
      pages: pageSizes.length,
      rows: ids.length,
      uniqueRows: new Set(ids).size,
      pageSizes,
      pageMs,
      bytes,
      drainMs: performance.now() - start,
    });
  }
  if (role === "teacher")
    for (const [fileName, mime, size] of [
      ["essay.pdf", "application/pdf", 2 * 1024 * 1024],
      ["recording.wav", "audio/wav", 10 * 1024 * 1024],
    ]) {
      const response = await call(
        "/files/sign",
        { fileName, mime, size, checksum: "a".repeat(64) },
        auth.data.accessToken,
      );
      result.uploads.push({
        fileName,
        mime,
        size,
        status: response.status,
        ms: response.ms,
        message: response.data.message ?? response.data.error?.message ?? null,
      });
    }
}
// A class behind one NAT may share a rate-limit key. Measure valid logins with unchanged defaults.
const agent = new http.Agent({ localAddress: "127.0.0.80", maxSockets: 50 });
const burst = await Promise.all(
  fixture.users
    .filter((u) => u.role === "student")
    .slice(50, 100)
    .map(async (u) => {
      const response = await call("/auth/login", { email: u.email, password }, null, agent);
      return { status: response.status, ms: response.ms };
    }),
);
agent.destroy();
result.sharedIpLoginBurst = {
  users: 50,
  source: "127.0.0.80",
  defaultLimit: "Password login uses failure counters; other auth routes use 30 attempts/IP/minute",
  results: burst,
  statuses: burst.reduce((o, r) => ((o[r.status] = (o[r.status] || 0) + 1), o), {}),
};
const require = createRequire(`${repo}/backend/package.json`);
const { Client } = require("pg");
const db = new Client({ connectionString: "postgres://postgres:x07-local-owner@127.0.0.1:55448/nce_x07" });
await db.connect();
result.database = (
  await db.query(`SELECT (SELECT count(*) FROM submissions) AS submissions,
  (SELECT count(*) FROM submissions WHERE status='draft') AS drafts,
  (SELECT count(*) FROM grades) AS grades,
  (SELECT count(*) FROM audit_logs) AS audit_rows,
  (SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL) AS migrations,
  (SELECT count(*) FROM files) AS files`)
).rows[0];
result.drafts = (
  await db.query(
    "SELECT min((payload->>'version')::int) AS min_version,max((payload->>'version')::int) AS max_version,count(DISTINCT student_id) AS students,count(*) FILTER (WHERE payload->>'content' LIKE 'Performance draft revision %') AS workload_drafts FROM submissions WHERE status='draft'",
  )
).rows[0];
const { buildReadingConfigOfficialFull } = await import(`${repo}/backend/dist/prisma/seeds/ieltsOfficialFixtures.js`);
const reading = (await db.query("SELECT assignment_config FROM assignments WHERE type='reading'")).rows;
for (const row of reading) deepStrictEqual(row.assignment_config, buildReadingConfigOfficialFull());
result.authoring = { readingAssignments: reading.length, configsUnchanged: true };
await db.end();
writeFileSync(`${dir}/supplement.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));

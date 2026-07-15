/// <reference lib="dom" />
/**
 * Location: tests/analytics.test.ts
 * Purpose: Verify analytics filter query keys, request params, export, and UI wiring.
 * Why: Keeps displayed and downloaded analytics synchronized with URL-backed selections.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { before, test } from "node:test";

const API_BASE_URL = "http://localhost:4000/api/v1";
const frontendRoot = path.resolve(import.meta.dirname, "..");
const pagePath = path.join(
  frontendRoot,
  "src/features/analytics/components/TeacherAnalyticsPage.tsx",
);
const filtersPath = path.join(
  frontendRoot,
  "src/features/analytics/components/AnalyticsFiltersPanel.tsx",
);

let analyticsApi: typeof import("../src/features/analytics/api");

before(async () => {
  process.env.VITE_API_BASE_URL = API_BASE_URL;
  analyticsApi = await import("../src/features/analytics/api");
});

test("analytics filters are stable in query keys and request params", () => {
  const filters = {
    from: "2026-06-01",
    to: "2026-06-30",
    courseId: "22222222-2222-4222-8222-222222222222",
    cohort: "Evening Cohort",
    role: "coTeacher" as const,
  };

  assert.deepEqual(analyticsApi.teacherAnalyticsQueryKey(filters), [
    "analytics",
    "teacher",
    filters,
  ]);
  assert.deepEqual(analyticsApi.buildAnalyticsParams(filters), filters);
  assert.deepEqual(
    analyticsApi.buildAnalyticsParams({ from: "", cohort: "  " }),
    {},
  );
});

test("CSV export sends the same filters with format=csv", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = async (input) => {
    requestedUrl = input.toString();
    return new Response("row_type,teacher_id\r\noverall,teacher-1\r\n", {
      status: 200,
      headers: { "content-type": "text/csv; charset=utf-8" },
    });
  };

  try {
    const blob = await analyticsApi.fetchTeacherAnalyticsCsv({
      from: "2026-06-01",
      cohort: "Evening Cohort",
      role: "owner",
    });

    const url = new URL(requestedUrl);
    assert.equal(
      url.origin + url.pathname,
      `${API_BASE_URL}/analytics/teacher`,
    );
    assert.equal(url.searchParams.get("from"), "2026-06-01");
    assert.equal(url.searchParams.get("cohort"), "Evening Cohort");
    assert.equal(url.searchParams.get("role"), "owner");
    assert.equal(url.searchParams.get("format"), "csv");
    assert.match(await blob.text(), /row_type,teacher_id/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("teacher analytics page exposes URL-backed filters and CSV export", async () => {
  const source = `${await readFile(pagePath, "utf8")}\n${await readFile(filtersPath, "utf8")}`;

  assert.match(source, /useSearchParams/);
  assert.match(source, /type="date"/);
  assert.match(source, /Course ID/);
  assert.match(source, /Cohort/);
  assert.match(source, /Course role/);
  assert.match(source, /Export CSV/);
  assert.match(source, /fetchTeacherAnalyticsCsv/);
});

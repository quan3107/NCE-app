/**
 * File: tests/prisma/legacyDisplayNameMigration.database.test.ts
 * Purpose: Verify upgraded databases quarantine unsafe historical identity names.
 * Why: API presentation must never expose control characters stored before validation.
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createDatabaseTestOwnerPool } from "./databaseTestClient.js";

const migrationPath = resolve(
  process.cwd(),
  "src/prisma/migrations/20260801110000_quarantine_legacy_display_names/migration.sql",
);
const databaseDescribe =
  process.env.CI === "true" || process.env.RUN_DATABASE_TESTS === "true"
    ? describe
    : describe.skip;
const createdUserIds: string[] = [];

afterEach(async () => {
  if (createdUserIds.length === 0) return;
  const pool = createDatabaseTestOwnerPool();
  try {
    await pool.query("DELETE FROM public.users WHERE id = ANY($1::uuid[])", [
      createdUserIds.splice(0),
    ]);
  } finally {
    await pool.end();
  }
});

describe("legacy display-name quarantine migration", () => {
  it("scans Unicode code points and replaces unsafe persisted names", () => {
    const migration = readFileSync(migrationPath, "utf8");

    expect(migration).toContain("generate_series(1, char_length(users.full_name))");
    expect(migration).toContain("8232 AND 8238");
    expect(migration).toContain("8294 AND 8303");
    expect(migration).toContain("positions.index IN (1, char_length(users.full_name))");
    expect(migration).toMatch(/SET\s+full_name = 'User ' \|\| LEFT\(/);
  });
});

databaseDescribe("upgraded legacy display names", () => {
  it("quarantines controls for every role and preserves safe graphemes", async () => {
    const pool = createDatabaseTestOwnerPool();
    const unsafeIds = [randomUUID(), randomUUID(), randomUUID()];
    const safeId = randomUUID();
    createdUserIds.push(...unsafeIds, safeId);
    const unsafeRoles = ["admin", "teacher", "student"];
    const safeName = "N\u0303 Nguyễn";

    try {
      for (const [index, id] of unsafeIds.entries()) {
        await pool.query(
          `INSERT INTO public.users (
            id, email, full_name, role, status, "updatedAt"
          ) VALUES ($1, $2, $3, $4, 'active', NOW())`,
          [
            id,
            `legacy-name-${id}@example.com`,
            `Visible \u202E${unsafeRoles[index]}`,
            unsafeRoles[index],
          ],
        );
      }
      await pool.query(
        `INSERT INTO public.users (
          id, email, full_name, role, status, "updatedAt"
        ) VALUES ($1, $2, $3, 'student', 'active', NOW())`,
        [safeId, `safe-name-${safeId}@example.com`, safeName],
      );

      await pool.query(readFileSync(migrationPath, "utf8"));

      const result = await pool.query<{ id: string; full_name: string }>(
        "SELECT id, full_name FROM public.users WHERE id = ANY($1::uuid[])",
        [[...unsafeIds, safeId]],
      );
      const names = new Map(result.rows.map((row) => [row.id, row.full_name]));
      for (const id of unsafeIds) {
        expect(names.get(id)).toBe(`User ${id.replaceAll("-", "").slice(0, 12)}`);
      }
      expect(names.get(safeId)).toBe(safeName);
    } finally {
      await pool.end();
    }
  });
});

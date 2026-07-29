/**
 * File: tests/prisma/settingsCanonicalUpgrade.database.test.ts
 * Purpose: Exercise canonical upload-policy repair against real PostgreSQL.
 * Why: Existing corrupt and incomplete policy state must remain upgradeable.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { createDatabaseTestOwnerPool } from "./databaseTestClient.js";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "src/prisma/migrations/20260729150000_repair_upload_policy_storage/migration.sql",
  ),
  "utf8",
)
  .replace(/^\s*BEGIN;\s*/i, "")
  .replace(/\s*COMMIT;\s*$/i, "");

const databaseDescribe =
  process.env.CI === "true" || process.env.RUN_DATABASE_TESTS === "true"
    ? describe
    : describe.skip;

async function withRolledBackUpgrade(
  operation: (query: (sql: string) => Promise<{ rows: unknown[] }>) => Promise<void>,
) {
  const pool = createDatabaseTestOwnerPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "ALTER TABLE public.file_upload_policies DROP CONSTRAINT IF EXISTS file_upload_policies_max_file_size_canonical_check",
    );
    await operation((sql) => client.query(sql));
  } finally {
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
  }
}

databaseDescribe("canonical upload policy upgrade", () => {
  it("normalizes fractional and out-of-range stored sizes", async () => {
    await withRolledBackUpgrade(async (query) => {
      await query(`
        UPDATE public.file_upload_policies
        SET max_file_size = CASE role
          WHEN 'student'::"UserRole" THEN 10485761
          WHEN 'teacher'::"UserRole" THEN 1
          ELSE 209715200
        END
      `);
      await query(migration);
      const result = await query(`
        SELECT role::text, max_file_size
        FROM public.file_upload_policies
        ORDER BY role::text
      `);
      expect(result.rows).toEqual([
        { role: "admin", max_file_size: 104857600 },
        { role: "student", max_file_size: 10485760 },
        { role: "teacher", max_file_size: 1048576 },
      ]);
    });
  });

  it("restores a missing role with its complete default policy", async () => {
    await withRolledBackUpgrade(async (query) => {
      await query(`
        DELETE FROM public.file_upload_policies
        WHERE role = 'teacher'::"UserRole"
      `);
      await query(migration);
      const result = await query(`
        SELECT p.max_file_size, COUNT(t.id)::integer AS allowed_type_count
        FROM public.file_upload_policies p
        LEFT JOIN public.file_upload_allowed_types t ON t.policy_id = p.id
        WHERE p.role = 'teacher'::"UserRole"
        GROUP BY p.id
      `);
      expect(result.rows).toEqual([
        { max_file_size: 26214400, allowed_type_count: 5 },
      ]);
    });
  });
});

/**
 * File: tests/prisma/uploadPolicyTypeIntegrity.database.test.ts
 * Purpose: Exercise upload-policy type repair and constraints in PostgreSQL.
 * Why: Runtime validation needs persisted rows to remain canonical after upgrades.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { createDatabaseTestOwnerPool } from "./databaseTestClient.js";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "src/prisma/migrations/20260802100000_validate_upload_policy_types/migration.sql",
  ),
  "utf8",
)
  .replace(/^\s*BEGIN;\s*/i, "")
  .replace(/\s*COMMIT;\s*$/i, "");

const databaseDescribe =
  process.env.CI === "true" || process.env.RUN_DATABASE_TESTS === "true"
    ? describe
    : describe.skip;

databaseDescribe("upload policy type integrity", () => {
  it("repairs legacy rows and rejects new invalid values", async () => {
    const pool = createDatabaseTestOwnerPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const constraint of [
        "file_upload_allowed_types_mime_type_check",
        "file_upload_allowed_types_extensions_check",
        "file_upload_allowed_types_label_check",
        "file_upload_allowed_types_accept_token_check",
      ]) {
        await client.query(
          `ALTER TABLE public.file_upload_allowed_types DROP CONSTRAINT IF EXISTS ${constraint}`,
        );
      }
      await client.query(`
        INSERT INTO public.file_upload_allowed_types (
          policy_id, mime_type, extensions, label, accept_token, sort_order
        )
        SELECT id, 'application/pdf', ARRAY['.pdf'], 'PDF duplicate', ' .PDF ', 99
        FROM public.file_upload_policies
        WHERE role = 'student'::"UserRole"
      `);
      await client.query(`
        UPDATE public.file_upload_allowed_types
        SET mime_type = '   ', extensions = ARRAY[' ', '.'], label = ' ', accept_token = ' '
        WHERE id = (
          SELECT t.id
          FROM public.file_upload_allowed_types t
          JOIN public.file_upload_policies p ON p.id = t.policy_id
          WHERE p.role = 'student'::"UserRole"
            AND t.accept_token = '.doc'
          LIMIT 1
        )
      `);

      await client.query(migration);
      const invalidCount = await client.query<{ count: number }>(`
        SELECT COUNT(*)::integer AS count
        FROM public.file_upload_allowed_types
        WHERE mime_type = '' OR label = '' OR accept_token = ''
      `);
      expect(invalidCount.rows).toEqual([{ count: 0 }]);
      const pdfCount = await client.query<{ count: number }>(`
        SELECT COUNT(*)::integer AS count
        FROM public.file_upload_allowed_types t
        JOIN public.file_upload_policies p ON p.id = t.policy_id
        WHERE p.role = 'student'::"UserRole" AND t.accept_token = '.pdf'
      `);
      expect(pdfCount.rows).toEqual([{ count: 1 }]);

      await expect(
        client.query(`
          INSERT INTO public.file_upload_allowed_types (
            policy_id, mime_type, extensions, label, accept_token
          )
          SELECT id, ' ', ARRAY['.bad'], 'Bad', '.bad'
          FROM public.file_upload_policies
          WHERE role = 'student'::"UserRole"
        `),
      ).rejects.toMatchObject({ code: "23514" });
    } finally {
      await client.query("ROLLBACK");
      client.release();
      await pool.end();
    }
  });
});

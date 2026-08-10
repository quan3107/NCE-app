/**
 * File: tests/prisma/uploadPolicyTypeIntegrity.database.test.ts
 * Purpose: Exercise upload-policy type repair and constraints in PostgreSQL.
 * Why: Runtime validation needs persisted rows to remain canonical after upgrades.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { createDatabaseTestOwnerPool } from './databaseTestClient.js'

const migrationNames = [
  '20260802100000_validate_upload_policy_types',
  '20260802120000_validate_upload_policy_extension_elements',
]
const migrations = migrationNames.map((migrationName) =>
  readFileSync(
    resolve(process.cwd(), `src/prisma/migrations/${migrationName}/migration.sql`),
    'utf8',
  )
    .replace(/^\s*BEGIN;\s*/i, '')
    .replace(/\s*COMMIT;\s*$/i, ''),
)

const databaseDescribe =
  process.env.CI === 'true' || process.env.RUN_DATABASE_TESTS === 'true'
    ? describe
    : describe.skip

databaseDescribe('upload policy type integrity', () => {
  it('repairs legacy rows and rejects new invalid values', async () => {
    const pool = createDatabaseTestOwnerPool()
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      for (const constraint of [
        'file_upload_allowed_types_mime_type_check',
        'file_upload_allowed_types_extensions_check',
        'file_upload_allowed_types_label_check',
        'file_upload_allowed_types_accept_token_check',
      ]) {
        await client.query(
          `ALTER TABLE public.file_upload_allowed_types DROP CONSTRAINT IF EXISTS ${constraint}`,
        )
      }
      await client.query(`
        INSERT INTO public.file_upload_allowed_types (
          policy_id, mime_type, extensions, label, accept_token, sort_order
        )
        SELECT id, ' ', ARRAY['.pdf'], 'Corrupt PDF', ' .PDF ', 0
        FROM public.file_upload_policies
        WHERE role = 'student'::"UserRole"
      `)
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
      `)

      await client.query(migrations[0])
      await client.query(`
        INSERT INTO public.file_upload_allowed_types (
          policy_id, mime_type, extensions, label, accept_token, sort_order
        )
        SELECT id, 'application/x-invalid', invalid.extensions, 'Bad',
          invalid.accept_token, 20 + invalid.sort_order
        FROM public.file_upload_policies
        CROSS JOIN (VALUES
          (ARRAY['.pdf,.doc']::text[], '.bad0', 0),
          (ARRAY['.pdf', NULL]::text[], '.bad1', 1),
          (ARRAY[['.pdf']]::text[], '.bad2', 2)
        ) AS invalid(extensions, accept_token, sort_order)
        WHERE role = 'student'::"UserRole"
      `)
      await client.query(migrations[1])
      const invalidCount = await client.query<{ count: number }>(`
        SELECT COUNT(*)::integer AS count
        FROM public.file_upload_allowed_types
        WHERE mime_type = '' OR label = '' OR accept_token = ''
      `)
      expect(invalidCount.rows).toEqual([{ count: 0 }])
      const pdfCount = await client.query<{ count: number }>(`
        SELECT COUNT(*)::integer AS count
        FROM public.file_upload_allowed_types t
        JOIN public.file_upload_policies p ON p.id = t.policy_id
        WHERE p.role = 'student'::"UserRole" AND t.accept_token = '.pdf'
      `)
      expect(pdfCount.rows).toEqual([{ count: 1 }])
      const malformedCount = await client.query<{ count: number }>(`
        SELECT COUNT(*)::integer AS count
        FROM public.file_upload_allowed_types
        WHERE accept_token IN ('.bad0', '.bad1', '.bad2')
          AND NOT app.file_upload_extensions_are_valid(extensions)
      `)
      expect(malformedCount.rows).toEqual([{ count: 0 }])

      await client.query('SAVEPOINT invalid_value')
      try {
        await expect(
          client.query(`
            INSERT INTO public.file_upload_allowed_types (
              policy_id, mime_type, extensions, label, accept_token
            )
            SELECT id, ' ', ARRAY['.bad'], 'Bad', '.bad'
            FROM public.file_upload_policies
            WHERE role = 'student'::"UserRole"
          `),
        ).rejects.toMatchObject({ code: '23514' })
      } finally {
        await client.query('ROLLBACK TO SAVEPOINT invalid_value')
        await client.query('RELEASE SAVEPOINT invalid_value')
      }
      for (const [index, extensions] of [
        "ARRAY['.pdf,.doc']::text[]",
        "ARRAY['.pdf', NULL]::text[]",
        "ARRAY[['.pdf']]::text[]",
      ].entries()) {
        await client.query('SAVEPOINT invalid_extension')
        try {
          await expect(
            client.query(`
              INSERT INTO public.file_upload_allowed_types (
                policy_id, mime_type, extensions, label, accept_token
              )
              SELECT id, 'application/x-invalid', ${extensions}, 'Bad', '.bad${index}'
              FROM public.file_upload_policies
              WHERE role = 'student'::"UserRole"
            `),
          ).rejects.toMatchObject({ code: '23514' })
        } finally {
          await client.query('ROLLBACK TO SAVEPOINT invalid_extension')
          await client.query('RELEASE SAVEPOINT invalid_extension')
        }
      }
    } finally {
      await client.query('ROLLBACK')
      client.release()
      await pool.end()
    }
  })
})

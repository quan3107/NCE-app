/**
 * File: tests/prisma/uploadPolicyTypeIntegrityMigration.test.ts
 * Purpose: Lock repair and constraints for normalized upload policy types.
 * Why: Blank or malformed policy rows must never become runtime allow-list entries.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "src/prisma/migrations/20260802100000_validate_upload_policy_types/migration.sql",
  ),
  "utf8",
);

describe("upload policy type integrity migration", () => {
  it("normalizes repairable rows and removes invalid rows", () => {
    expect(migration).toMatch(/ROW_NUMBER\(\)[\s\S]*duplicate_rank > 1/);
    expect(migration).toMatch(/ORDER BY\s+is_valid DESC/);
    expect(migration).toMatch(
      /UPDATE public\.file_upload_allowed_types[\s\S]*LOWER\(BTRIM\(mime_type\)\)/,
    );
    expect(migration).toMatch(
      /DELETE FROM public\.file_upload_allowed_types[\s\S]*mime_type !~/,
    );
  });

  it("constrains every field used to build an upload allow list", () => {
    for (const constraint of [
      "file_upload_allowed_types_mime_type_check",
      "file_upload_allowed_types_extensions_check",
      "file_upload_allowed_types_label_check",
      "file_upload_allowed_types_accept_token_check",
    ]) {
      expect(migration).toContain(constraint);
    }
  });
});

/**
 * File: tests/prisma/settingsWriteBoundaryMigration.test.ts
 * Purpose: Review the least-privilege database boundary for upload-limit writes.
 * Why: Runtime requests must not gain direct UPDATE access to policy tables.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "src/prisma/migrations/20260729111500_secure_file_upload_policy_updates/migration.sql",
  ),
  "utf8",
);
const canonicalMigration = readFileSync(
  resolve(
    process.cwd(),
    "src/prisma/migrations/20260729133000_require_canonical_upload_policy_sizes/migration.sql",
  ),
  "utf8",
);

describe("secure file upload policy update migration", () => {
  it("uses an admin-checked security-definer function", () => {
    expect(migration).toContain("SECURITY DEFINER");
    expect(migration).toContain(
      "current_setting('app.current_user_role', true) IS DISTINCT FROM 'admin'",
    );
    expect(migration).toContain("UPDATE public.file_upload_policies");
  });

  it("grants only function execution to the authenticated runtime role", () => {
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION app\.update_file_upload_policy[\s\S]*FROM PUBLIC;/,
    );
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION app\.update_file_upload_policy[\s\S]*TO nce_app_authenticated;/,
    );
    expect(migration).not.toMatch(
      /GRANT\s+UPDATE\s+ON\s+public\.file_upload_policies/i,
    );
  });

  it("rejects byte values that are not exact whole MiB", () => {
    expect(canonicalMigration).toMatch(
      /p_expected_max_file_size\s*%\s*1048576\s*<>\s*0/,
    );
    expect(canonicalMigration).toMatch(
      /p_max_file_size\s*%\s*1048576\s*<>\s*0/,
    );
  });
});

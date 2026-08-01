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
const repairMigration = readFileSync(
  resolve(
    process.cwd(),
    "src/prisma/migrations/20260729150000_repair_upload_policy_storage/migration.sql",
  ),
  "utf8",
);
const actorAuthorizationMigration = readFileSync(
  resolve(
    process.cwd(),
    "src/prisma/migrations/20260731160000_lock_upload_policy_admin_actor/migration.sql",
  ),
  "utf8",
);
const equalValueMigration = readFileSync(
  resolve(
    process.cwd(),
    "src/prisma/migrations/20260801170000_preserve_equal_upload_policy_cas/migration.sql",
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

  it("repairs existing rows before enforcing a table-level invariant", () => {
    const normalization = repairMigration.indexOf(
      "UPDATE public.file_upload_policies",
    );
    const constraint = repairMigration.indexOf(
      "ADD CONSTRAINT file_upload_policies_max_file_size_canonical_check",
    );

    expect(repairMigration).toContain("INSERT INTO public.file_upload_policies");
    expect(repairMigration).toContain("ON CONFLICT (role) DO NOTHING");
    expect(normalization).toBeGreaterThan(-1);
    expect(constraint).toBeGreaterThan(normalization);
    expect(repairMigration).toMatch(
      /CHECK\s*\([\s\S]*max_file_size BETWEEN 1048576 AND 104857600[\s\S]*max_file_size % 1048576 = 0/i,
    );
  });

  it("locks and authorizes the persisted active administrator", () => {
    expect(actorAuthorizationMigration).toContain(
      "current_setting('app.current_user_id', true)",
    );
    expect(actorAuthorizationMigration).toMatch(
      /FROM public\.users[\s\S]*role = 'admin'[\s\S]*status = 'active'[\s\S]*users\."deletedAt" IS NULL[\s\S]*FOR SHARE/i,
    );
    expect(actorAuthorizationMigration).not.toContain("users.deleted_at");
    expect(actorAuthorizationMigration).not.toContain(
      "current_setting('app.current_user_role'",
    );
  });

  it("keeps the administrator lookup on the UUID primary key", () => {
    expect(actorAuthorizationMigration).toMatch(
      /users\.id\s*=\s*current_setting\('app\.current_user_id', true\)::UUID/i,
    );
    expect(actorAuthorizationMigration).not.toMatch(/users\.id::TEXT/i);
  });

  it("checks equal values inside the security-definer boundary", () => {
    expect(equalValueMigration).toContain("SECURITY DEFINER");
    expect(equalValueMigration).toMatch(
      /IF p_expected_max_file_size = p_max_file_size[\s\S]*PERFORM 1[\s\S]*FOR SHARE[\s\S]*RETURN FOUND/i,
    );
    expect(equalValueMigration).toMatch(
      /GRANT EXECUTE ON FUNCTION app\.update_file_upload_policy[\s\S]*TO nce_app_authenticated;/,
    );
    expect(equalValueMigration).not.toMatch(
      /GRANT\s+UPDATE\s+ON\s+public\.file_upload_policies/i,
    );
  });
});

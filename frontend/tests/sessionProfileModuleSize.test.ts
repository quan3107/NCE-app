/**
 * Location: tests/sessionProfileModuleSize.test.ts
 * Purpose: Keep session restoration and profile-save modules within the project limit.
 * Why: Focused lifecycle modules should not regress into oversized mixed concerns.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

const frontendRoot = path.resolve(import.meta.dirname, "..");
const limitedFiles = [
  "src/lib/auth-session.ts",
  "src/lib/auth-restoration-baseline.ts",
  "src/features/profile/components/ProfileDetailsCard.tsx",
  "src/features/profile/hooks/useProfileSaveLifecycle.ts",
];

test("session and profile lifecycle modules stay within 300 lines", async () => {
  for (const relativePath of limitedFiles) {
    const source = await readFile(path.join(frontendRoot, relativePath), "utf8");
    assert.ok(
      source.split(/\r?\n/).length <= 300,
      `${relativePath} must stay within 300 lines`,
    );
  }
});

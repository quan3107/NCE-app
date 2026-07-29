/**
 * File: tests/prisma/adminProfileNavigation.test.ts
 * Purpose: Lock the production bootstrap default for the admin profile route.
 * Why: Existing deployments receive navigation additions through reference bootstrap.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { UserRole } from "../../src/prisma/generated.js";
import { navigationDefaults } from "../../src/prisma/seeds/referenceBootstrap.data.js";

describe("admin profile navigation default", () => {
  it("includes the authenticated admin profile route", () => {
    expect(navigationDefaults).toContainEqual([
      UserRole.admin,
      "Profile",
      "/admin/profile",
      "user",
      "profile:view",
      null,
      7,
    ]);
  });

  it("backfills the route through an idempotent forward migration", () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "src/prisma/migrations/20260729170000_add_admin_profile_navigation/migration.sql",
      ),
      "utf8",
    );

    expect(migration).toContain("'/admin/profile'");
    expect(migration).toMatch(/WHERE NOT EXISTS/i);
    expect(migration).toMatch(/role\s*=\s*'admin'/i);
  });
});

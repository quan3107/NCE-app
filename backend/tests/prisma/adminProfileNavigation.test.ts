/**
 * File: tests/prisma/adminProfileNavigation.test.ts
 * Purpose: Lock the production bootstrap default for the admin profile route.
 * Why: Existing deployments receive navigation additions through reference bootstrap.
 */
import { describe, expect, it } from "vitest";

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
});

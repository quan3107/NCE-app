/**
 * File: tests/modules/ielts-config/ielts-config.readiness.test.ts
 * Purpose: Verify readiness database work assumes an explicit trusted role.
 * Why: Startup and health checks run outside request-scoped RLS middleware.
 */
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runWithRole: vi.fn(async (_options: unknown, operation: () => Promise<unknown>) =>
    operation(),
  ),
}));

vi.mock("../../../src/prisma/client.js", () => ({
  prisma: {
    ieltsConfigVersion: {
      findMany: vi.fn(async () => []),
    },
  },
  runWithRole: mocks.runWithRole,
}));

describe("IELTS config readiness", () => {
  it("runs the complete probe as the least-privilege anonymous role", async () => {
    const { getIeltsConfigReadinessReport } =
      await import("../../../src/modules/ielts-config/ielts-config.readiness.js");

    await getIeltsConfigReadinessReport();

    expect(mocks.runWithRole).toHaveBeenCalledOnce();
    expect(mocks.runWithRole).toHaveBeenCalledWith(
      { role: "nce_app_anon" },
      expect.any(Function),
    );
  });
});

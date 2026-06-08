/**
 * File: tests/server.test.ts
 * Purpose: Verify backend startup sequencing.
 * Why: The API must not accept queue-producing traffic before job enqueueing is ready.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const events: string[] = [];
  const server = {
    listen: vi.fn((_: number, callback?: () => void) => {
      events.push("listen");
      callback?.();
      return server;
    }),
    close: vi.fn(),
  };

  return {
    events,
    server,
    startJobRunner: vi.fn(async () => {
      events.push("jobs");
    }),
  };
});

vi.mock("node:http", () => ({
  createServer: vi.fn(() => mocks.server),
}));

vi.mock("../src/app.js", () => ({
  app: {},
}));

vi.mock("../src/config/env.js", () => ({
  config: {
    databaseUrl: "postgres://example.test/nce",
    nodeEnv: "production",
    port: 4010,
  },
}));

vi.mock("../src/config/logger.js", () => ({
  logger: {
    error: vi.fn(),
    fatal: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("../src/jobs/jobRunner.js", () => ({
  startJobRunner: mocks.startJobRunner,
}));

vi.mock("../src/modules/ielts-config/ielts-config.readiness.js", () => ({
  getIeltsConfigReadinessReport: vi.fn(async () => ({
    activeVersion: "test",
    counts: {},
    ready: true,
  })),
}));

vi.mock("../src/prisma/client.js", () => ({
  shutdownPrisma: vi.fn(),
}));

describe("server startup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mocks.events.length = 0;
  });

  it("starts the job runner before accepting HTTP traffic", async () => {
    await import("../src/server.js");

    await vi.waitFor(() => {
      expect(mocks.server.listen).toHaveBeenCalled();
    });

    expect(mocks.events).toEqual(["jobs", "listen"]);
  });
});

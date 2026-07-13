/**
 * File: tests/jobs/jobRunner.test.ts
 * Purpose: Verify pg-boss uses its dedicated database identity.
 * Why: The NOINHERIT application login must never access owner-only job tables.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  boss: {
    createQueue: vi.fn(),
    on: vi.fn(),
    schedule: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    work: vi.fn(),
  },
  constructor: vi.fn(),
}));

vi.mock("pg-boss", () => ({
  default: class PgBoss {
    constructor(options: unknown) {
      mocks.constructor(options);
      return mocks.boss;
    }
  },
}));

vi.mock("../../src/config/env.js", () => ({
  config: {
    databaseUrl: "postgres://nce_runtime:runtime@localhost/nce",
    jobDatabaseUrl: "postgres://nce_job_runner:jobs@localhost/nce",
  },
}));

vi.mock("../../src/config/logger.js", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("../../src/jobs/aiFeedbackJob.js", () => ({
  registerAiFeedbackJobs: vi.fn(),
}));

vi.mock("../../src/jobs/cleanupJob.js", () => ({
  registerCleanupJobs: vi.fn(),
}));

vi.mock("../../src/jobs/notificationJob.js", () => ({
  registerNotificationJobs: vi.fn(),
}));

vi.mock("../../src/jobs/aiFeedbackJob.enqueue.js", () => ({
  clearJobRunnerBoss: vi.fn(),
  setJobRunnerBoss: vi.fn(),
}));

describe("job runner database identity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mocks.boss.start.mockResolvedValue(mocks.boss);
  });

  it("connects with the worker URL and cannot migrate the pgboss schema", async () => {
    const { startJobRunner } = await import("../../src/jobs/jobRunner.js");

    await startJobRunner();

    expect(mocks.constructor).toHaveBeenCalledWith({
      application_name: "nce-app-jobs",
      connectionString: "postgres://nce_job_runner:jobs@localhost/nce",
      migrate: false,
    });
    expect(mocks.constructor).not.toHaveBeenCalledWith(
      expect.objectContaining({
        connectionString: "postgres://nce_runtime:runtime@localhost/nce",
      }),
    );
  });
});

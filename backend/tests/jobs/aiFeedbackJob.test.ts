/**
 * File: tests/jobs/aiFeedbackJob.test.ts
 * Purpose: Verify queued AI feedback job workers and registration.
 * Why: AI generation must run outside HTTP routes while preserving deterministic guardrails.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AiProviderError } from "../../src/modules/ai-feedback/provider.errors.js";
import type {
  AiProviderRequest,
  AiProviderResult,
} from "../../src/modules/ai-feedback/provider.types.js";
import {
  objectiveHarnessFixtures,
  writingHarnessFixtures,
} from "../fixtures/ai-feedback/harness/harness.fixtures.js";

vi.mock("../../src/prisma/client.js", () => ({
  prisma: {
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
    aiFeedbackDraft: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    aiObjectiveExplanation: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("../../src/config/logger.js", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const prismaModule = await import("../../src/prisma/client.js");
const prisma = vi.mocked(prismaModule.prisma, true);

const {
  AI_FEEDBACK_JOB_NAMES,
  enqueueAiFeedbackDraftJob,
  enqueueObjectiveExplanationJob,
  handleGenerateObjectiveExplanationJob,
  handleGenerateWritingDraftJob,
  registerAiFeedbackJobs,
} = await import("../../src/jobs/aiFeedbackJob.js");

function providerResult(
  request: AiProviderRequest,
  rawText: string,
  routeKey = "low_cost",
): AiProviderResult {
  return {
    rawText,
    model: "gpt-test",
    routeKey,
    latencyMs: 10,
    request,
  };
}

describe("jobs.aiFeedbackJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.auditLog.create.mockReset();
    prisma.auditLog.create.mockResolvedValue({ id: "audit-1" } as never);
    prisma.$transaction.mockImplementation(async (callback) => callback(prisma));
  });

  it("registers AI queues without disturbing notification jobs", async () => {
    const boss = {
      createQueue: vi.fn(),
      work: vi.fn(),
    };

    await registerAiFeedbackJobs(boss as never);

    expect(boss.createQueue).toHaveBeenCalledWith(
      AI_FEEDBACK_JOB_NAMES.generateWritingDraft,
    );
    expect(boss.createQueue).toHaveBeenCalledWith(
      AI_FEEDBACK_JOB_NAMES.generateObjectiveExplanation,
    );
    expect(boss.work).toHaveBeenCalledWith(
      AI_FEEDBACK_JOB_NAMES.generateWritingDraft,
      handleGenerateWritingDraftJob,
    );
    expect(boss.work).toHaveBeenCalledWith(
      AI_FEEDBACK_JOB_NAMES.generateObjectiveExplanation,
      handleGenerateObjectiveExplanationJob,
    );
  });

  it("enqueues writing drafts and objective explanations with bounded retries", async () => {
    const boss = {
      send: vi.fn().mockResolvedValue("job-1"),
    };

    await enqueueAiFeedbackDraftJob(boss as never, {
      draftId: "b10d2a30-87bd-465f-8a5e-f23ca65be272",
      harnessInput: writingHarnessFixtures[0],
    });
    await enqueueObjectiveExplanationJob(boss as never, {
      explanationId: "38c79cf6-88bf-4dd6-8639-d6db3dd3b4a5",
      harnessInput: objectiveHarnessFixtures[0],
    });

    expect(boss.send).toHaveBeenCalledWith(
      AI_FEEDBACK_JOB_NAMES.generateWritingDraft,
      expect.objectContaining({
        draftId: "b10d2a30-87bd-465f-8a5e-f23ca65be272",
      }),
      expect.objectContaining({
        retryLimit: 3,
        retryBackoff: true,
      }),
    );
    expect(boss.send).toHaveBeenCalledWith(
      AI_FEEDBACK_JOB_NAMES.generateObjectiveExplanation,
      expect.objectContaining({
        explanationId: "38c79cf6-88bf-4dd6-8639-d6db3dd3b4a5",
      }),
      expect.objectContaining({
        retryLimit: 3,
        retryBackoff: true,
      }),
    );
  });

  it("processes accepted writing output through provider routing and the harness", async () => {
    const fixture = writingHarnessFixtures[0];
    const providerRouter = {
      generate: vi.fn(async (request: AiProviderRequest) =>
        providerResult(request, fixture.providerOutput),
      ),
    };

    prisma.aiFeedbackDraft.findUnique.mockResolvedValue({
      id: "b10d2a30-87bd-465f-8a5e-f23ca65be272",
      status: "queued",
      retryCount: 0,
      deletedAt: null,
    } as never);
    prisma.aiFeedbackDraft.updateMany.mockResolvedValue({ count: 1 } as never);

    await handleGenerateWritingDraftJob(
      {
        id: "job-1",
        name: AI_FEEDBACK_JOB_NAMES.generateWritingDraft,
        data: {
          draftId: "b10d2a30-87bd-465f-8a5e-f23ca65be272",
          harnessInput: fixture,
        },
        expireInSeconds: 60,
      },
      { providerRouter },
    );

    expect(providerRouter.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        taskType: "writing_feedback",
        expectJson: true,
      }),
    );
    expect(prisma.aiFeedbackDraft.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "b10d2a30-87bd-465f-8a5e-f23ca65be272",
          status: "queued",
          deletedAt: null,
        },
        data: expect.objectContaining({
          status: "running",
          lastAttemptAt: expect.any(Date),
          failureCode: null,
          failureMessage: null,
        }),
      }),
    );
    expect(prisma.aiFeedbackDraft.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          id: "b10d2a30-87bd-465f-8a5e-f23ca65be272",
          status: "running",
          deletedAt: null,
        },
        data: expect.objectContaining({
          status: "accepted",
          routeKey: "low_cost",
          model: "gpt-test",
          failureCode: null,
          nextRetryAt: null,
        }),
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "ai_feedback.writing_generated",
        entity: "ai_feedback_draft",
        entityId: "b10d2a30-87bd-465f-8a5e-f23ca65be272",
        diff: expect.objectContaining({
          routeKey: "low_cost",
          model: "gpt-test",
          payloadSummary: expect.objectContaining({
            providerOutput: expect.objectContaining({ redacted: true }),
          }),
        }),
      }),
    });
    expect(JSON.stringify(prisma.auditLog.create.mock.calls)).not.toContain(
      fixture.providerOutput,
    );
  });

  it("audits parse-valid writing output below harness confidence as failed", async () => {
    const fixture = writingHarnessFixtures[0];
    const lowConfidenceOutput = JSON.stringify({
      ...JSON.parse(fixture.providerOutput),
      confidence: 0.4,
    });
    const providerRouter = {
      generate: vi.fn(async (request: AiProviderRequest) =>
        providerResult(request, lowConfidenceOutput),
      ),
    };

    prisma.aiFeedbackDraft.findUnique.mockResolvedValue({
      id: "b10d2a30-87bd-465f-8a5e-f23ca65be272",
      status: "queued",
      retryCount: 0,
      deletedAt: null,
    } as never);
    prisma.aiFeedbackDraft.updateMany.mockResolvedValue({ count: 1 } as never);

    await handleGenerateWritingDraftJob(
      {
        id: "job-1",
        name: AI_FEEDBACK_JOB_NAMES.generateWritingDraft,
        data: {
          draftId: "b10d2a30-87bd-465f-8a5e-f23ca65be272",
          harnessInput: fixture,
        },
        expireInSeconds: 60,
      },
      { providerRouter },
    );

    expect(prisma.aiFeedbackDraft.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "review_required",
          failureCode: "low_confidence",
        }),
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "ai_feedback.writing_failed",
        entity: "ai_feedback_draft",
        entityId: "b10d2a30-87bd-465f-8a5e-f23ca65be272",
      }),
    });
  });

  it("does not convert generated writing records into failed audits when the success audit insert fails", async () => {
    const fixture = writingHarnessFixtures[0];
    const providerRouter = {
      generate: vi.fn(async (request: AiProviderRequest) =>
        providerResult(request, fixture.providerOutput),
      ),
    };

    prisma.auditLog.create
      .mockRejectedValueOnce(new Error("Audit insert failed."))
      .mockResolvedValueOnce({ id: "audit-failed" } as never);
    prisma.aiFeedbackDraft.findUnique.mockResolvedValue({
      id: "b10d2a30-87bd-465f-8a5e-f23ca65be272",
      status: "queued",
      retryCount: 0,
      deletedAt: null,
    } as never);
    prisma.aiFeedbackDraft.updateMany.mockResolvedValue({ count: 1 } as never);

    await expect(
      handleGenerateWritingDraftJob(
        {
          id: "job-1",
          name: AI_FEEDBACK_JOB_NAMES.generateWritingDraft,
          data: {
            draftId: "b10d2a30-87bd-465f-8a5e-f23ca65be272",
            harnessInput: fixture,
          },
          expireInSeconds: 60,
        },
        { providerRouter },
      ),
    ).rejects.toThrow("Audit insert failed.");

    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "ai_feedback.writing_generated",
      }),
    });
    expect(prisma.aiFeedbackDraft.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          id: "b10d2a30-87bd-465f-8a5e-f23ca65be272",
          status: "running",
          deletedAt: null,
        },
        data: expect.objectContaining({
          status: "failed",
          failureCode: "worker_finalization_failed",
          failureMessage: "Audit insert failed.",
          retryCount: { increment: 1 },
          nextRetryAt: null,
        }),
      }),
    );
  });

  it("marks retryable provider failures with retry metadata", async () => {
    const now = new Date("2026-06-08T07:00:00.000Z");
    const providerRouter = {
      generate: vi.fn(async () => {
        throw new AiProviderError({
          code: "timeout",
          message: "Provider timed out.",
        });
      }),
    };

    prisma.aiFeedbackDraft.findUnique.mockResolvedValue({
      id: "b10d2a30-87bd-465f-8a5e-f23ca65be272",
      status: "queued",
      retryCount: 0,
      deletedAt: null,
    } as never);
    prisma.aiFeedbackDraft.updateMany.mockResolvedValue({ count: 1 } as never);

    await expect(
      handleGenerateWritingDraftJob(
        {
          id: "job-1",
          name: AI_FEEDBACK_JOB_NAMES.generateWritingDraft,
          data: {
            draftId: "b10d2a30-87bd-465f-8a5e-f23ca65be272",
            harnessInput: writingHarnessFixtures[0],
          },
          expireInSeconds: 60,
        },
        { providerRouter, now: () => now },
      ),
    ).rejects.toMatchObject({ code: "timeout" });

    expect(prisma.aiFeedbackDraft.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          id: "b10d2a30-87bd-465f-8a5e-f23ca65be272",
          status: "running",
          deletedAt: null,
        },
        data: expect.objectContaining({
          status: "queued",
          failureCode: "timeout",
          retryCount: { increment: 1 },
          nextRetryAt: new Date("2026-06-08T07:01:00.000Z"),
        }),
      }),
    );
  });

  it("keeps the final configured retry active before exhaustion", async () => {
    const now = new Date("2026-06-08T07:00:00.000Z");
    const providerRouter = {
      generate: vi.fn(async () => {
        throw new AiProviderError({
          code: "timeout",
          message: "Provider timed out.",
        });
      }),
    };

    prisma.aiFeedbackDraft.findUnique.mockResolvedValue({
      id: "b10d2a30-87bd-465f-8a5e-f23ca65be272",
      status: "queued",
      retryCount: 2,
      deletedAt: null,
    } as never);
    prisma.aiFeedbackDraft.updateMany.mockResolvedValue({ count: 1 } as never);

    await expect(
      handleGenerateWritingDraftJob(
        {
          id: "job-1",
          name: AI_FEEDBACK_JOB_NAMES.generateWritingDraft,
          data: {
            draftId: "b10d2a30-87bd-465f-8a5e-f23ca65be272",
            harnessInput: writingHarnessFixtures[0],
          },
          expireInSeconds: 60,
        },
        { providerRouter, now: () => now },
      ),
    ).rejects.toMatchObject({ code: "timeout" });

    expect(prisma.aiFeedbackDraft.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "queued",
          failureCode: "timeout",
          retryCount: { increment: 1 },
          nextRetryAt: new Date("2026-06-08T07:04:00.000Z"),
        }),
      }),
    );
  });

  it("marks exhausted retryable provider failures terminal without another retry timestamp", async () => {
    const now = new Date("2026-06-08T07:00:00.000Z");
    const providerRouter = {
      generate: vi.fn(async () => {
        throw new AiProviderError({
          code: "timeout",
          message: "Provider timed out.",
        });
      }),
    };

    prisma.aiFeedbackDraft.findUnique.mockResolvedValue({
      id: "b10d2a30-87bd-465f-8a5e-f23ca65be272",
      status: "queued",
      retryCount: 3,
      deletedAt: null,
    } as never);
    prisma.aiFeedbackDraft.updateMany.mockResolvedValue({ count: 1 } as never);

    await handleGenerateWritingDraftJob(
      {
        id: "job-1",
        name: AI_FEEDBACK_JOB_NAMES.generateWritingDraft,
        data: {
          draftId: "b10d2a30-87bd-465f-8a5e-f23ca65be272",
          harnessInput: writingHarnessFixtures[0],
        },
        expireInSeconds: 60,
      },
      { providerRouter, now: () => now },
    );

    expect(prisma.aiFeedbackDraft.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "failed",
          failureCode: "timeout",
          retryCount: { increment: 1 },
          nextRetryAt: null,
        }),
      }),
    );
  });

  it("uses the configured backoff delay directly for retry timestamps", async () => {
    const now = new Date("2026-06-08T07:00:00.000Z");
    const providerRouter = {
      generate: vi.fn(async () => {
        throw new AiProviderError({
          code: "timeout",
          message: "Provider timed out.",
        });
      }),
    };

    prisma.aiFeedbackDraft.findUnique.mockResolvedValue({
      id: "b10d2a30-87bd-465f-8a5e-f23ca65be272",
      status: "queued",
      retryCount: 1,
      deletedAt: null,
    } as never);
    prisma.aiFeedbackDraft.updateMany.mockResolvedValue({ count: 1 } as never);

    await expect(
      handleGenerateWritingDraftJob(
        {
          id: "job-1",
          name: AI_FEEDBACK_JOB_NAMES.generateWritingDraft,
          data: {
            draftId: "b10d2a30-87bd-465f-8a5e-f23ca65be272",
            harnessInput: writingHarnessFixtures[0],
          },
          expireInSeconds: 60,
        },
        { providerRouter, now: () => now },
      ),
    ).rejects.toMatchObject({ code: "timeout" });

    expect(prisma.aiFeedbackDraft.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "queued",
          retryCount: { increment: 1 },
          nextRetryAt: new Date("2026-06-08T07:02:00.000Z"),
        }),
      }),
    );
  });

  it("processes objective explanations into completed records", async () => {
    const fixture = objectiveHarnessFixtures[0];
    const providerRouter = {
      generate: vi.fn(async (request: AiProviderRequest) =>
        providerResult(request, fixture.providerOutput),
      ),
    };

    prisma.aiObjectiveExplanation.findUnique.mockResolvedValue({
      id: "38c79cf6-88bf-4dd6-8639-d6db3dd3b4a5",
      status: "queued",
      retryCount: 0,
      deletedAt: null,
    } as never);
    prisma.aiObjectiveExplanation.updateMany.mockResolvedValue({
      count: 1,
    } as never);

    await handleGenerateObjectiveExplanationJob(
      {
        id: "job-2",
        name: AI_FEEDBACK_JOB_NAMES.generateObjectiveExplanation,
        data: {
          explanationId: "38c79cf6-88bf-4dd6-8639-d6db3dd3b4a5",
          harnessInput: fixture,
        },
        expireInSeconds: 60,
      },
      { providerRouter },
    );

    expect(providerRouter.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        taskType: "objective_explanation",
        expectJson: true,
      }),
    );
    expect(prisma.aiObjectiveExplanation.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          id: "38c79cf6-88bf-4dd6-8639-d6db3dd3b4a5",
          status: "running",
          deletedAt: null,
        },
        data: expect.objectContaining({
          status: "completed",
          model: "gpt-test",
          failureCode: null,
          nextRetryAt: null,
        }),
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "ai_feedback.explanation_generated",
        entity: "ai_objective_explanation",
        entityId: "38c79cf6-88bf-4dd6-8639-d6db3dd3b4a5",
        diff: expect.objectContaining({
          model: "gpt-test",
          payloadSummary: expect.objectContaining({
            providerOutput: expect.objectContaining({ redacted: true }),
          }),
        }),
      }),
    });
    expect(JSON.stringify(prisma.auditLog.create.mock.calls)).not.toContain(
      fixture.providerOutput,
    );
  });

  it("does not convert generated objective explanations into failed audits when the success audit insert fails", async () => {
    const fixture = objectiveHarnessFixtures[0];
    const providerRouter = {
      generate: vi.fn(async (request: AiProviderRequest) =>
        providerResult(request, fixture.providerOutput),
      ),
    };

    prisma.auditLog.create
      .mockRejectedValueOnce(new Error("Audit insert failed."))
      .mockResolvedValueOnce({ id: "audit-failed" } as never);
    prisma.aiObjectiveExplanation.findUnique.mockResolvedValue({
      id: "38c79cf6-88bf-4dd6-8639-d6db3dd3b4a5",
      status: "queued",
      retryCount: 0,
      deletedAt: null,
    } as never);
    prisma.aiObjectiveExplanation.updateMany.mockResolvedValue({
      count: 1,
    } as never);

    await expect(
      handleGenerateObjectiveExplanationJob(
        {
          id: "job-2",
          name: AI_FEEDBACK_JOB_NAMES.generateObjectiveExplanation,
          data: {
            explanationId: "38c79cf6-88bf-4dd6-8639-d6db3dd3b4a5",
            harnessInput: fixture,
          },
          expireInSeconds: 60,
        },
        { providerRouter },
      ),
    ).rejects.toThrow("Audit insert failed.");

    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "ai_feedback.explanation_generated",
      }),
    });
    expect(prisma.aiObjectiveExplanation.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          id: "38c79cf6-88bf-4dd6-8639-d6db3dd3b4a5",
          status: "running",
          deletedAt: null,
        },
        data: expect.objectContaining({
          status: "failed",
          failureCode: "worker_finalization_failed",
          failureMessage: "Audit insert failed.",
          retryCount: { increment: 1 },
          nextRetryAt: null,
        }),
      }),
    );
  });

  it("persists retryable provider failures even when the failure audit insert fails", async () => {
    const now = new Date("2026-06-08T07:00:00.000Z");
    const providerRouter = {
      generate: vi.fn(async () => {
        throw new AiProviderError({
          code: "timeout",
          message: "Provider timed out.",
        });
      }),
    };

    prisma.auditLog.create.mockRejectedValueOnce(
      new Error("Audit insert failed."),
    );
    prisma.aiFeedbackDraft.findUnique.mockResolvedValue({
      id: "b10d2a30-87bd-465f-8a5e-f23ca65be272",
      status: "queued",
      retryCount: 0,
      deletedAt: null,
    } as never);
    prisma.aiFeedbackDraft.updateMany.mockResolvedValue({ count: 1 } as never);

    await expect(
      handleGenerateWritingDraftJob(
        {
          id: "job-1",
          name: AI_FEEDBACK_JOB_NAMES.generateWritingDraft,
          data: {
            draftId: "b10d2a30-87bd-465f-8a5e-f23ca65be272",
            harnessInput: writingHarnessFixtures[0],
          },
          expireInSeconds: 60,
        },
        { providerRouter, now: () => now },
      ),
    ).rejects.toThrow("Audit insert failed.");

    expect(prisma.aiFeedbackDraft.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          id: "b10d2a30-87bd-465f-8a5e-f23ca65be272",
          status: "running",
          deletedAt: null,
        },
        data: expect.objectContaining({
          status: "queued",
          failureCode: "timeout",
          retryCount: { increment: 1 },
        }),
      }),
    );
  });

  it("persists retryable objective provider failures even when the failure audit insert fails", async () => {
    const now = new Date("2026-06-08T07:00:00.000Z");
    const providerRouter = {
      generate: vi.fn(async () => {
        throw new AiProviderError({
          code: "timeout",
          message: "Provider timed out.",
        });
      }),
    };

    prisma.auditLog.create.mockRejectedValueOnce(
      new Error("Audit insert failed."),
    );
    prisma.aiObjectiveExplanation.findUnique.mockResolvedValue({
      id: "38c79cf6-88bf-4dd6-8639-d6db3dd3b4a5",
      status: "queued",
      retryCount: 0,
      deletedAt: null,
    } as never);
    prisma.aiObjectiveExplanation.updateMany.mockResolvedValue({
      count: 1,
    } as never);

    await expect(
      handleGenerateObjectiveExplanationJob(
        {
          id: "job-2",
          name: AI_FEEDBACK_JOB_NAMES.generateObjectiveExplanation,
          data: {
            explanationId: "38c79cf6-88bf-4dd6-8639-d6db3dd3b4a5",
            harnessInput: objectiveHarnessFixtures[0],
          },
          expireInSeconds: 60,
        },
        { providerRouter, now: () => now },
      ),
    ).rejects.toThrow("Audit insert failed.");

    expect(prisma.aiObjectiveExplanation.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          id: "38c79cf6-88bf-4dd6-8639-d6db3dd3b4a5",
          status: "running",
          deletedAt: null,
        },
        data: expect.objectContaining({
          status: "queued",
          failureCode: "timeout",
          retryCount: { increment: 1 },
        }),
      }),
    );
  });

  it("preserves the requested objective explanation cache route after provider fallback", async () => {
    const fixture = objectiveHarnessFixtures[0];
    const providerRouter = {
      generate: vi.fn(async (request: AiProviderRequest) =>
        providerResult(request, fixture.providerOutput, "premium"),
      ),
    };

    prisma.aiObjectiveExplanation.findUnique.mockResolvedValue({
      id: "38c79cf6-88bf-4dd6-8639-d6db3dd3b4a5",
      status: "queued",
      retryCount: 0,
      deletedAt: null,
    } as never);
    prisma.aiObjectiveExplanation.updateMany.mockResolvedValue({
      count: 1,
    } as never);

    await handleGenerateObjectiveExplanationJob(
      {
        id: "job-2",
        name: AI_FEEDBACK_JOB_NAMES.generateObjectiveExplanation,
        data: {
          explanationId: "38c79cf6-88bf-4dd6-8639-d6db3dd3b4a5",
          harnessInput: fixture,
        },
        expireInSeconds: 60,
      },
      { providerRouter },
    );

    const finalUpdate =
      prisma.aiObjectiveExplanation.updateMany.mock.calls.at(-1)?.[0];
    expect(finalUpdate?.data).not.toHaveProperty("routeKey");
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "ai_feedback.explanation_generated",
        entity: "ai_objective_explanation",
        entityId: "38c79cf6-88bf-4dd6-8639-d6db3dd3b4a5",
        diff: expect.objectContaining({
          routeKey: "premium",
          model: "gpt-test",
        }),
      }),
    });
  });

  it("marks malformed objective explanation payloads failed without provider retries", async () => {
    const providerRouter = {
      generate: vi.fn(),
    };

    await handleGenerateObjectiveExplanationJob(
      {
        id: "job-2",
        name: AI_FEEDBACK_JOB_NAMES.generateObjectiveExplanation,
        data: {
          explanationId: "38c79cf6-88bf-4dd6-8639-d6db3dd3b4a5",
          harnessInput: {
            taskType: "objective_explanation",
          },
        },
        expireInSeconds: 60,
      } as never,
      { providerRouter },
    );

    expect(providerRouter.generate).not.toHaveBeenCalled();
    expect(prisma.aiObjectiveExplanation.updateMany).toHaveBeenCalledWith({
      where: {
        id: "38c79cf6-88bf-4dd6-8639-d6db3dd3b4a5",
        status: {
          in: ["queued", "failed"],
        },
        deletedAt: null,
      },
      data: expect.objectContaining({
        status: "failed",
        failureCode: "invalid_job_payload",
      }),
    });
  });

  it("does not call providers when the running transition loses a stale-state race", async () => {
    const providerRouter = {
      generate: vi.fn(),
    };

    prisma.aiFeedbackDraft.findUnique.mockResolvedValue({
      id: "b10d2a30-87bd-465f-8a5e-f23ca65be272",
      status: "queued",
      retryCount: 0,
      deletedAt: null,
    } as never);
    prisma.aiFeedbackDraft.updateMany.mockResolvedValue({ count: 0 } as never);

    await handleGenerateWritingDraftJob(
      {
        id: "job-1",
        name: AI_FEEDBACK_JOB_NAMES.generateWritingDraft,
        data: {
          draftId: "b10d2a30-87bd-465f-8a5e-f23ca65be272",
          harnessInput: writingHarnessFixtures[0],
        },
        expireInSeconds: 60,
      },
      { providerRouter },
    );

    expect(providerRouter.generate).not.toHaveBeenCalled();
    expect(prisma.aiFeedbackDraft.updateMany).toHaveBeenCalledTimes(1);
  });
});

/**
 * File: tests/modules/ai-feedback/ai-feedback.explanations.repository.test.ts
 * Purpose: Verify AI objective explanation cache persistence behavior.
 * Why: Objective explanations should be reused for identical scoped inputs.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  assignmentId,
  requesterId,
  submissionId,
} from "./ai-feedback.repository.fixtures.js";
import { objectiveHarnessFixtures } from "../../fixtures/ai-feedback/harness/harness.fixtures.js";

vi.mock("../../../src/prisma/client.js", () => ({
  prisma: {
    auditLog: {
      create: vi.fn(),
    },
    aiObjectiveExplanation: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    submission: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("../../../src/jobs/aiFeedbackJob.enqueue.js", () => ({
  enqueueObjectiveExplanationOnActiveQueue: vi.fn(),
}));

const prismaModule = await import("../../../src/prisma/client.js");
const aiFeedbackJobQueueModule = await import(
  "../../../src/jobs/aiFeedbackJob.enqueue.js"
);
const prisma = vi.mocked(prismaModule.prisma, true);
const enqueueObjectiveExplanationOnActiveQueue = vi.mocked(
  aiFeedbackJobQueueModule.enqueueObjectiveExplanationOnActiveQueue,
);

const {
  findAiObjectiveExplanationByCacheKey,
  upsertAiObjectiveExplanation,
} = await import("../../../src/modules/ai-feedback/ai-feedback.repository.js");
const { getAiGenerationStatus } = await import(
  "../../../src/modules/ai-feedback/ai-feedback.repository.js"
);
const {
  aiFeedbackDraftStatusSchema,
  aiFeedbackVisibilityModeSchema,
  aiObjectiveExplanationStatusSchema,
} = await import("../../../src/modules/ai-feedback/ai-feedback.schema.js");

describe("ai-feedback objective explanations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enqueueObjectiveExplanationOnActiveQueue.mockResolvedValue("job-1");
    prisma.submission.findFirst.mockResolvedValue({
      id: submissionId,
      assignmentId,
    } as never);
  });

  it("reuses objective explanations for identical request inputs", async () => {
    const cached = {
      id: "38c79cf6-88bf-4dd6-8639-d6db3dd3b4a5",
      status: "completed",
    };
    prisma.aiObjectiveExplanation.findFirst.mockResolvedValueOnce(cached as never);

    const explanation = await upsertAiObjectiveExplanation({
      submissionId,
      assignmentId,
      requesterId,
      questionId: "q-1",
      deterministicResult: "incorrect",
      promptVersion: "objective-explanation-v1",
      sourceContextHash: "sha256:source",
      routeKey: "low_cost",
      provider: "openai-compatible",
      model: "gpt-5.4-nano",
      generatedExplanation: {
        explanation: "The answer conflicts with paragraph two.",
      },
    });

    expect(prisma.aiObjectiveExplanation.findFirst).toHaveBeenCalledWith({
      where: {
        submissionId,
        assignmentId,
        questionId: "q-1",
        deterministicResult: "incorrect",
        promptVersion: "objective-explanation-v1",
        sourceContextHash: "sha256:source",
        routeKey: "low_cost",
        requesterId,
        deletedAt: null,
      },
    });
    expect(prisma.aiObjectiveExplanation.create).not.toHaveBeenCalled();
    expect(explanation).toBe(cached);
  });

  it("finds objective explanations by deterministic cache key without enqueueing", async () => {
    const cached = {
      id: "38c79cf6-88bf-4dd6-8639-d6db3dd3b4a5",
      status: "running",
    };
    prisma.aiObjectiveExplanation.findFirst.mockResolvedValueOnce(cached as never);

    const explanation = await findAiObjectiveExplanationByCacheKey({
      submissionId,
      assignmentId,
      requesterId,
      questionId: "q-1",
      deterministicResult: "incorrect",
      promptVersion: "objective-explanation-v1",
      sourceContextHash: "sha256:source",
      routeKey: "low_cost",
    });

    expect(prisma.aiObjectiveExplanation.findFirst).toHaveBeenCalledWith({
      where: {
        submissionId,
        assignmentId,
        questionId: "q-1",
        deterministicResult: "incorrect",
        promptVersion: "objective-explanation-v1",
        sourceContextHash: "sha256:source",
        routeKey: "low_cost",
        requesterId,
        deletedAt: null,
      },
    });
    expect(prisma.aiObjectiveExplanation.create).not.toHaveBeenCalled();
    expect(enqueueObjectiveExplanationOnActiveQueue).not.toHaveBeenCalled();
    expect(explanation).toBe(cached);
  });

  it("derives objective explanation assignment from the submission", async () => {
    const created = {
      id: "ab7f0b13-e7d9-45dd-8ed2-c2a17a9e762d",
      assignmentId,
    };
    prisma.aiObjectiveExplanation.findFirst.mockResolvedValueOnce(null);
    prisma.aiObjectiveExplanation.create.mockResolvedValueOnce(created as never);

    const explanation = await upsertAiObjectiveExplanation({
      submissionId,
      assignmentId,
      requesterId,
      questionId: "q-1",
      deterministicResult: "incorrect",
      promptVersion: "objective-explanation-v1",
      sourceContextHash: "sha256:source",
      routeKey: "low_cost",
      provider: "openai-compatible",
      model: "gpt-5.4-nano",
      generatedExplanation: {
        explanation: "The answer conflicts with paragraph two.",
      },
    });

    expect(prisma.submission.findFirst).toHaveBeenCalledWith({
      where: {
        id: submissionId,
        deletedAt: null,
        assignment: {
          deletedAt: null,
        },
      },
      select: {
        id: true,
        assignmentId: true,
      },
    });
    expect(prisma.aiObjectiveExplanation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          submissionId,
          assignmentId,
        }),
      }),
    );
    expect(explanation).toBe(created);
  });

  it("enqueues queued objective explanations after persistence", async () => {
    const created = {
      id: "38c79cf6-88bf-4dd6-8639-d6db3dd3b4a5",
      status: "queued",
    };
    prisma.aiObjectiveExplanation.findFirst.mockResolvedValueOnce(null);
    prisma.aiObjectiveExplanation.create.mockResolvedValueOnce(created as never);

    const explanation = await upsertAiObjectiveExplanation({
      submissionId,
      assignmentId,
      requesterId,
      questionId: "q-1",
      deterministicResult: "incorrect",
      promptVersion: "objective-explanation-v1",
      sourceContextHash: "sha256:source",
      routeKey: "low_cost",
      provider: "openai-compatible",
      model: "gpt-5.4-nano",
      status: "queued",
      generationJob: {
        harnessInput: objectiveHarnessFixtures[0],
      },
    });

    expect(enqueueObjectiveExplanationOnActiveQueue).toHaveBeenCalledWith({
      explanationId: "38c79cf6-88bf-4dd6-8639-d6db3dd3b4a5",
      harnessInput: objectiveHarnessFixtures[0],
    });
    expect(explanation).toBe(created);
  });

  it("audits objective explanations that fail while enqueueing generation jobs", async () => {
    const created = {
      id: "38c79cf6-88bf-4dd6-8639-d6db3dd3b4a5",
      status: "queued",
    };
    prisma.aiObjectiveExplanation.findFirst.mockResolvedValueOnce(null);
    prisma.aiObjectiveExplanation.create.mockResolvedValueOnce(created as never);
    enqueueObjectiveExplanationOnActiveQueue.mockRejectedValueOnce(
      new Error("Queue unavailable."),
    );

    await expect(
      upsertAiObjectiveExplanation({
        submissionId,
        assignmentId,
        requesterId,
        questionId: "q-1",
        deterministicResult: "incorrect",
        promptVersion: "objective-explanation-v1",
        sourceContextHash: "sha256:source",
        routeKey: "low_cost",
        provider: "openai-compatible",
        model: "gpt-5.4-nano",
        status: "queued",
        generationJob: {
          harnessInput: objectiveHarnessFixtures[0],
        },
      }),
    ).rejects.toThrow("Queue unavailable.");

    expect(prisma.aiObjectiveExplanation.updateMany).toHaveBeenCalledWith({
      where: {
        id: "38c79cf6-88bf-4dd6-8639-d6db3dd3b4a5",
        status: "queued",
        deletedAt: null,
      },
      data: expect.objectContaining({
        status: "failed",
        failureCode: "queue_enqueue_failed",
      }),
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: requesterId,
        action: "ai_feedback.explanation_failed",
        entity: "ai_objective_explanation",
        entityId: "38c79cf6-88bf-4dd6-8639-d6db3dd3b4a5",
        diff: expect.objectContaining({
          routeKey: "low_cost",
          provider: "openai-compatible",
          model: "gpt-5.4-nano",
          promptVersion: "objective-explanation-v1",
        }),
      }),
    });
  });

  it("replaces terminal failed objective explanation cache rows", async () => {
    const failed = {
      id: "38c79cf6-88bf-4dd6-8639-d6db3dd3b4a5",
      status: "failed",
      nextRetryAt: null,
    };
    const created = {
      id: "ab7f0b13-e7d9-45dd-8ed2-c2a17a9e762d",
      status: "queued",
    };
    prisma.aiObjectiveExplanation.findFirst.mockResolvedValueOnce(
      failed as never,
    );
    prisma.aiObjectiveExplanation.update.mockResolvedValueOnce(failed as never);
    prisma.aiObjectiveExplanation.create.mockResolvedValueOnce(created as never);

    const explanation = await upsertAiObjectiveExplanation({
      submissionId,
      assignmentId,
      requesterId,
      questionId: "q-1",
      deterministicResult: "incorrect",
      promptVersion: "objective-explanation-v1",
      sourceContextHash: "sha256:source",
      routeKey: "low_cost",
      provider: "openai-compatible",
      model: "gpt-5.4-nano",
      status: "queued",
      generationJob: {
        harnessInput: objectiveHarnessFixtures[0],
      },
    });

    expect(prisma.aiObjectiveExplanation.update).toHaveBeenCalledWith({
      where: {
        id: "38c79cf6-88bf-4dd6-8639-d6db3dd3b4a5",
      },
      data: {
        deletedAt: expect.any(Date),
      },
    });
    expect(prisma.aiObjectiveExplanation.create).toHaveBeenCalled();
    expect(explanation).toBe(created);
  });

  it("rejects queued objective explanations with malformed generation payloads", async () => {
    await expect(
      upsertAiObjectiveExplanation({
        submissionId,
        assignmentId,
        requesterId,
        questionId: "q-1",
        deterministicResult: "incorrect",
        promptVersion: "objective-explanation-v1",
        sourceContextHash: "sha256:source",
        routeKey: "low_cost",
        provider: "openai-compatible",
        model: "gpt-5.4-nano",
        status: "queued",
        generationJob: {
          harnessInput: {
            taskType: "objective_explanation",
          },
        },
      }),
    ).rejects.toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({
          path: ["generationJob", "harnessInput", "fixtureId"],
        }),
        expect.objectContaining({
          path: ["generationJob", "harnessInput", "promptInput"],
        }),
      ]),
    });

    expect(prisma.aiObjectiveExplanation.create).not.toHaveBeenCalled();
    expect(enqueueObjectiveExplanationOnActiveQueue).not.toHaveBeenCalled();
  });

  it("rejects objective explanations when the caller assignment does not match the submission", async () => {
    await expect(
      upsertAiObjectiveExplanation({
        submissionId,
        assignmentId: "f65b452e-e7eb-4670-9220-75b27a3d4975",
        requesterId,
        questionId: "q-1",
        deterministicResult: "incorrect",
        promptVersion: "objective-explanation-v1",
        sourceContextHash: "sha256:source",
        routeKey: "low_cost",
        provider: "openai-compatible",
        model: "gpt-5.4-nano",
        generatedExplanation: {},
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(prisma.aiObjectiveExplanation.create).not.toHaveBeenCalled();
  });

  it("re-reads the objective explanation cache when a concurrent create wins", async () => {
    const cached = {
      id: "38c79cf6-88bf-4dd6-8639-d6db3dd3b4a5",
      status: "completed",
    };
    prisma.aiObjectiveExplanation.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(cached as never);
    prisma.aiObjectiveExplanation.create.mockRejectedValueOnce(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" }),
    );

    const explanation = await upsertAiObjectiveExplanation({
      submissionId,
      assignmentId,
      requesterId,
      questionId: "q-1",
      deterministicResult: "incorrect",
      promptVersion: "objective-explanation-v1",
      sourceContextHash: "sha256:source",
      routeKey: "low_cost",
      provider: "openai-compatible",
      model: "gpt-5.4-nano",
      generatedExplanation: {},
    });

    expect(prisma.aiObjectiveExplanation.findFirst).toHaveBeenCalledTimes(2);
    expect(explanation).toBe(cached);
  });

  it("validates lifecycle enum values used by persisted records", () => {
    expect(aiFeedbackDraftStatusSchema.options).toEqual([
      "queued",
      "running",
      "accepted",
      "review_required",
      "rejected",
      "failed",
      "approved",
      "finalized",
      "superseded",
    ]);
    expect(aiFeedbackVisibilityModeSchema.options).toEqual([
      "teacher_reviewed",
      "instant_student_visible",
      "hidden",
    ]);
    expect(aiObjectiveExplanationStatusSchema.options).toEqual([
      "queued",
      "running",
      "completed",
      "review_required",
      "rejected",
      "failed",
    ]);
  });

  it("reports draft and explanation queue statuses through one internal helper", async () => {
    prisma.aiFeedbackDraft = {
      findUnique: vi.fn().mockResolvedValueOnce({
        id: "b10d2a30-87bd-465f-8a5e-f23ca65be272",
        status: "accepted",
        failureCode: null,
        failureMessage: null,
        retryCount: 0,
        nextRetryAt: null,
        lastAttemptAt: new Date("2026-06-01T10:00:00.000Z"),
        updatedAt: new Date("2026-06-01T10:00:01.000Z"),
      }),
    } as never;

    const status = await getAiGenerationStatus({
      kind: "writing_draft",
      id: "b10d2a30-87bd-465f-8a5e-f23ca65be272",
    });

    expect(status).toEqual({
      kind: "writing_draft",
      id: "b10d2a30-87bd-465f-8a5e-f23ca65be272",
      status: "accepted",
      failureCode: null,
      failureMessage: null,
      retryCount: 0,
      nextRetryAt: null,
      lastAttemptAt: new Date("2026-06-01T10:00:00.000Z"),
      updatedAt: new Date("2026-06-01T10:00:01.000Z"),
    });
  });
});

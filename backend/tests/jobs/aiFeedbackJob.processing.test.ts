/**
 * File: tests/jobs/aiFeedbackJob.processing.test.ts
 * Purpose: Verify AI feedback job processing behavior.
 * Why: Objective explanation workers must preserve source-evidence guardrails.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AiProviderRequest,
  AiProviderResult,
} from "../../src/modules/ai-feedback/provider.types.js";

vi.mock("../../src/prisma/client.js", () => ({
  prisma: {
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
    aiObjectiveExplanation: {
      findUnique: vi.fn(),
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
const { processObjectiveExplanationJob } = await import(
  "../../src/jobs/aiFeedbackJob.processing.js"
);
const { AI_FEEDBACK_JOB_NAMES } = await import(
  "../../src/jobs/aiFeedbackJob.types.js"
);

function providerResult(
  request: AiProviderRequest,
  rawText: string,
): AiProviderResult {
  return {
    rawText,
    model: "gpt-test",
    routeKey: "low_cost",
    latencyMs: 10,
    request,
  };
}

describe("processObjectiveExplanationJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.auditLog.create.mockResolvedValue({ id: "audit-1" } as never);
    prisma.$transaction.mockImplementation(async (callback) => callback(prisma));
  });

  it("rejects provider evidence that is outside the allowed candidate list", async () => {
    const providerOutput = JSON.stringify({
      result: "incorrect",
      short_explanation: "This cites the wrong source span.",
      evidence: "The mayor announced bike lanes.",
      misconception: "The student used evidence from a different question.",
      study_tip: "Use only the evidence attached to the selected question.",
    });
    const providerRouter = {
      generate: vi.fn(async (request: AiProviderRequest) =>
        providerResult(request, providerOutput),
      ),
    };

    prisma.aiObjectiveExplanation.findUnique.mockResolvedValue({
      id: "38c79cf6-88bf-4dd6-8639-d6db3dd3b4a5",
      requesterId: "33333333-3333-4333-8333-333333333333",
      submissionId: "11111111-1111-4111-8111-111111111111",
      assignmentId: "22222222-2222-4222-8222-222222222222",
      promptVersion: "objective-explanation-v2",
      provider: "openai-compatible",
      routeKey: "low_cost",
      status: "queued",
      retryCount: 0,
      deletedAt: null,
    } as never);
    prisma.aiObjectiveExplanation.updateMany.mockResolvedValue({
      count: 1,
    } as never);

    await processObjectiveExplanationJob(
      {
        id: "job-1",
        name: AI_FEEDBACK_JOB_NAMES.generateObjectiveExplanation,
        data: {
          explanationId: "38c79cf6-88bf-4dd6-8639-d6db3dd3b4a5",
          harnessInput: {
            fixtureId: "objective-explanation:submission:q1",
            taskType: "objective_explanation",
            promptInput: {
              assignment: {
                title: "Reading Drill",
                type: "reading",
                config: {
                  version: 1,
                  aiPolicy: {
                    objectiveExplanations: "on_demand_student_visible",
                  },
                },
              },
              question: {
                id: "q1",
                text: "Why did commuters switch routes?",
                acceptedAnswer: "Rising fares made commuters switch routes.",
              },
              studentAnswer: "Bike lanes were announced.",
              deterministicResult: "incorrect",
              sourceContext: {
                kind: "reading_passage",
                text:
                  "Rising fares made commuters switch routes. The mayor announced bike lanes.",
              },
              sourceEvidenceCandidates: [
                {
                  id: "q1-evidence-1",
                  quote: "Rising fares made commuters switch routes.",
                },
              ],
            },
            routeKey: "low_cost",
          },
        },
        expireInSeconds: 60,
      },
      { providerRouter },
    );

    expect(prisma.aiObjectiveExplanation.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "rejected",
          failureCode: "unsupported_evidence",
        }),
      }),
    );
  });
});

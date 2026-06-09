/**
 * File: tests/modules/ai-feedback/ai-feedback.objective-explanations.service.test.ts
 * Purpose: Verify on-demand objective explanation request orchestration.
 * Why: Access, policy, scoring evidence, cache, and queue behavior must fail closed.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AssignmentType,
  EnrollmentRole,
  UserRole,
  UserStatus,
} from "../../../src/prisma/index.js";

vi.mock("../../../src/prisma/client.js", () => ({
  prisma: {
    submission: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("../../../src/modules/ai-feedback/ai-feedback.repository.js", () => ({
  createAiFeedbackDraft: vi.fn(),
  findAiObjectiveExplanationByCacheKey: vi.fn(),
  supersedeAiFeedbackDrafts: vi.fn(),
  upsertAiObjectiveExplanation: vi.fn(),
}));

const prismaModule = await import("../../../src/prisma/client.js");
const repositoryModule = await import(
  "../../../src/modules/ai-feedback/ai-feedback.repository.js"
);
const configModule = await import(
  "../../../src/modules/ai-feedback/ai-feedback.config.js"
);
const { getAiObjectiveExplanationStatus, requestAiObjectiveExplanation } =
  await import("../../../src/modules/ai-feedback/ai-feedback.service.js");

const prisma = vi.mocked(prismaModule.prisma, true);
const aiFeedbackConfig = configModule.aiFeedbackConfig;
const upsertAiObjectiveExplanation = vi.mocked(
  repositoryModule.upsertAiObjectiveExplanation,
);
const findAiObjectiveExplanationByCacheKey = vi.mocked(
  repositoryModule.findAiObjectiveExplanationByCacheKey,
);

const submissionId = "11111111-1111-4111-8111-111111111111";
const assignmentId = "22222222-2222-4222-8222-222222222222";
const studentId = "33333333-3333-4333-8333-333333333333";
const ownerId = "44444444-4444-4444-8444-444444444444";
const coTeacherId = "55555555-5555-4555-8555-555555555555";

const studentActor = {
  id: studentId,
  role: UserRole.student,
  status: UserStatus.active,
};

const baseSubmission = {
  id: submissionId,
  assignmentId,
  studentId,
  status: "graded",
  payload: {
    version: 1,
    answers: [{ questionId: "q1", value: "B" }],
  },
  grade: {
    id: "66666666-6666-4666-8666-666666666666",
    rawScore: 1,
    finalScore: 1,
    band: 1,
    deletedAt: null,
  },
  assignment: {
    id: assignmentId,
    title: "Reading Drill",
    type: AssignmentType.reading,
    assignmentConfig: {
      version: 1,
      aiPolicy: {
        writingFeedbackMode: "off",
        objectiveExplanations: "on_demand_student_visible",
        providerTier: "auto",
      },
      sections: [
        {
          id: "section-1",
          title: "Passage",
          passage: "Paragraph B says the new route reduced travel time.",
          questions: [
            {
              id: "q1",
              type: "multiple_choice",
              text: "Which option matches paragraph B?",
              options: ["A", "B", "C"],
              answer: "B",
            },
          ],
        },
      ],
    },
    course: {
      ownerId,
      enrollments: [],
    },
  },
};

describe("requestAiObjectiveExplanation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    aiFeedbackConfig.enabled = true;
    aiFeedbackConfig.apiKey = "sk-test";
    aiFeedbackConfig.baseUrl = "https://example.com/v1";
    prisma.submission.findFirst.mockResolvedValue(baseSubmission as never);
    upsertAiObjectiveExplanation.mockResolvedValue({
      id: "77777777-7777-4777-8777-777777777777",
      status: "queued",
      generatedExplanation: null,
    } as never);
    findAiObjectiveExplanationByCacheKey.mockResolvedValue(null as never);
  });

  it("queues an on-demand explanation with deterministic scoring evidence", async () => {
    const response = await requestAiObjectiveExplanation(
      { submissionId, questionId: "q1" },
      studentActor,
    );

    expect(upsertAiObjectiveExplanation).toHaveBeenCalledWith(
      expect.objectContaining({
        submissionId,
        assignmentId,
        requesterId: studentId,
        questionId: "q1",
        deterministicResult: "correct",
        promptVersion: "objective-explanation-v1",
        routeKey: "low_cost",
        provider: "openai-compatible",
        model: "gpt-5.4-nano",
        status: "queued",
        generationJob: {
          harnessInput: expect.objectContaining({
            fixtureId: `objective-explanation:${submissionId}:q1`,
            taskType: "objective_explanation",
            promptInput: expect.objectContaining({
              assignment: expect.objectContaining({
                title: "Reading Drill",
                type: "reading",
              }),
              question: {
                id: "q1",
                text: "Which option matches paragraph B?",
                acceptedAnswer: "B",
              },
              studentAnswer: "B",
              deterministicResult: "correct",
              sourceContext: {
                kind: "reading_passage",
                text: "Paragraph B says the new route reduced travel time.",
              },
            }),
            routeKey: "low_cost",
          }),
        },
      }),
    );
    expect(response).toEqual(
      expect.objectContaining({
        id: "77777777-7777-4777-8777-777777777777",
        status: "queued",
        pollingLocation:
          "/api/v1/submissions/11111111-1111-4111-8111-111111111111/questions/q1/ai-explanation",
      }),
    );
  });

  it("allows a co-teacher enrolled on the submission course", async () => {
    prisma.submission.findFirst.mockResolvedValueOnce({
      ...baseSubmission,
      assignment: {
        ...baseSubmission.assignment,
        course: {
          ownerId,
          enrollments: [
            {
              userId: coTeacherId,
              roleInCourse: EnrollmentRole.teacher,
              deletedAt: null,
            },
          ],
        },
      },
    } as never);

    await requestAiObjectiveExplanation(
      { submissionId, questionId: "q1" },
      { id: coTeacherId, role: UserRole.teacher, status: UserStatus.active },
    );

    expect(upsertAiObjectiveExplanation).toHaveBeenCalled();
  });

  it("returns a completed cached explanation without queue metadata", async () => {
    upsertAiObjectiveExplanation.mockResolvedValueOnce({
      id: "77777777-7777-4777-8777-777777777777",
      status: "completed",
      generatedExplanation: {
        short_explanation: "Paragraph B supports option B.",
      },
    } as never);

    const response = await requestAiObjectiveExplanation(
      { submissionId, questionId: "q1" },
      studentActor,
    );

    expect(response).toMatchObject({
      status: "completed",
      cached: true,
      explanation: {
        short_explanation: "Paragraph B supports option B.",
      },
    });
  });

  it("rejects cross-student requests before queueing generation", async () => {
    await expect(
      requestAiObjectiveExplanation(
        { submissionId, questionId: "q1" },
        {
          id: "88888888-8888-4888-8888-888888888888",
          role: UserRole.student,
          status: UserStatus.active,
        },
      ),
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(upsertAiObjectiveExplanation).not.toHaveBeenCalled();
  });

  it("requires an existing deterministic grade before generation", async () => {
    prisma.submission.findFirst.mockResolvedValueOnce({
      ...baseSubmission,
      grade: null,
    } as never);

    await expect(
      requestAiObjectiveExplanation({ submissionId, questionId: "q1" }, studentActor),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "Objective explanations require an existing deterministic score.",
    });

    expect(upsertAiObjectiveExplanation).not.toHaveBeenCalled();
  });

  it("requires the on-demand objective explanation assignment policy", async () => {
    prisma.submission.findFirst.mockResolvedValueOnce({
      ...baseSubmission,
      assignment: {
        ...baseSubmission.assignment,
        assignmentConfig: {
          ...baseSubmission.assignment.assignmentConfig,
          aiPolicy: {
            ...baseSubmission.assignment.assignmentConfig.aiPolicy,
            objectiveExplanations: "off",
          },
        },
      },
    } as never);

    await expect(
      requestAiObjectiveExplanation({ submissionId, questionId: "q1" }, studentActor),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("fails clearly when question scoring evidence is missing", async () => {
    await expect(
      requestAiObjectiveExplanation(
        { submissionId, questionId: "missing-question" },
        studentActor,
      ),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Question scoring evidence not found.",
    });

    expect(upsertAiObjectiveExplanation).not.toHaveBeenCalled();
  });

  it("rejects audio-only listening source context before queueing generation", async () => {
    prisma.submission.findFirst.mockResolvedValueOnce({
      ...baseSubmission,
      assignment: {
        ...baseSubmission.assignment,
        type: AssignmentType.listening,
        assignmentConfig: {
          version: 1,
          aiPolicy: {
            writingFeedbackMode: "off",
            objectiveExplanations: "on_demand_student_visible",
            providerTier: "auto",
          },
          sections: [
            {
              id: "section-1",
              title: "Listening Part 1",
              audioFileId: "99999999-9999-4999-8999-999999999999",
              questions: [
                {
                  id: "q1",
                  text: "What destination does the speaker choose?",
                  answer: "B",
                },
              ],
            },
          ],
        },
      },
    } as never);

    await expect(
      requestAiObjectiveExplanation({ submissionId, questionId: "q1" }, studentActor),
    ).rejects.toMatchObject({
      statusCode: 409,
      message:
        "Listening objective explanations require transcript source context.",
    });

    expect(upsertAiObjectiveExplanation).not.toHaveBeenCalled();
  });

  it("fails closed when AI feedback generation is globally disabled", async () => {
    aiFeedbackConfig.enabled = false;

    await expect(
      requestAiObjectiveExplanation({ submissionId, questionId: "q1" }, studentActor),
    ).rejects.toMatchObject({
      statusCode: 503,
      message: "AI feedback generation is disabled.",
    });

    expect(upsertAiObjectiveExplanation).not.toHaveBeenCalled();
  });
});

describe("getAiObjectiveExplanationStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    aiFeedbackConfig.enabled = true;
    aiFeedbackConfig.apiKey = "sk-test";
    aiFeedbackConfig.baseUrl = "https://example.com/v1";
    prisma.submission.findFirst.mockResolvedValue(baseSubmission as never);
    findAiObjectiveExplanationByCacheKey.mockResolvedValue({
      id: "77777777-7777-4777-8777-777777777777",
      status: "queued",
      generatedExplanation: null,
    } as never);
  });

  it("reads an existing explanation status without requiring provider readiness", async () => {
    aiFeedbackConfig.enabled = false;

    const response = await getAiObjectiveExplanationStatus(
      { submissionId, questionId: "q1" },
      studentActor,
    );

    expect(findAiObjectiveExplanationByCacheKey).toHaveBeenCalledWith(
      expect.objectContaining({
        submissionId,
        assignmentId,
        requesterId: studentId,
        questionId: "q1",
        deterministicResult: "correct",
        promptVersion: "objective-explanation-v1",
        sourceContextHash: expect.stringMatching(/^sha256:/),
        routeKey: "low_cost",
      }),
    );
    expect(upsertAiObjectiveExplanation).not.toHaveBeenCalled();
    expect(response).toEqual(
      expect.objectContaining({
        id: "77777777-7777-4777-8777-777777777777",
        status: "queued",
        cached: false,
        pollingLocation:
          "/api/v1/submissions/11111111-1111-4111-8111-111111111111/questions/q1/ai-explanation",
      }),
    );
  });

  it("does not enqueue a missing explanation during status polling", async () => {
    findAiObjectiveExplanationByCacheKey.mockResolvedValueOnce(null as never);

    await expect(
      getAiObjectiveExplanationStatus({ submissionId, questionId: "q1" }, studentActor),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "AI objective explanation not found.",
    });

    expect(upsertAiObjectiveExplanation).not.toHaveBeenCalled();
  });
});

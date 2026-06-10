/**
 * File: tests/modules/ai-feedback/ai-feedback.writing-feedback.service.test.ts
 * Purpose: Verify IELTS writing AI feedback request orchestration.
 * Why: Writing feedback must respect course access, assignment policy, visibility, and image context.
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
    rubric: {
      findMany: vi.fn(),
    },
    submission: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("../../../src/modules/ai-feedback/image-context.js", () => ({
  resolveAiFeedbackImageContext: vi.fn(),
}));

vi.mock("../../../src/modules/ai-feedback/ai-feedback.repository.js", () => ({
  createAiFeedbackDraft: vi.fn(),
  findLatestAiFeedbackDraftBySubmission: vi.fn(),
  findAiObjectiveExplanationByCacheKey: vi.fn(),
  supersedeAiFeedbackDrafts: vi.fn(),
  upsertAiObjectiveExplanation: vi.fn(),
}));

const prismaModule = await import("../../../src/prisma/client.js");
const repositoryModule = await import(
  "../../../src/modules/ai-feedback/ai-feedback.repository.js"
);
const imageContextModule = await import(
  "../../../src/modules/ai-feedback/image-context.js"
);
const configModule = await import(
  "../../../src/modules/ai-feedback/ai-feedback.config.js"
);
const {
  enqueueAiWritingFeedbackForSubmission,
  getAiWritingFeedbackStatus,
  requestAiWritingFeedback,
} = await import("../../../src/modules/ai-feedback/ai-feedback.service.js");

const prisma = vi.mocked(prismaModule.prisma, true);
const createAiFeedbackDraft = vi.mocked(repositoryModule.createAiFeedbackDraft);
const findLatestAiFeedbackDraftBySubmission = vi.mocked(
  repositoryModule.findLatestAiFeedbackDraftBySubmission,
);
const supersedeAiFeedbackDrafts = vi.mocked(
  repositoryModule.supersedeAiFeedbackDrafts,
);
const resolveAiFeedbackImageContext = vi.mocked(
  imageContextModule.resolveAiFeedbackImageContext,
);
const aiFeedbackConfig = configModule.aiFeedbackConfig;

const submissionId = "11111111-1111-4111-8111-111111111111";
const assignmentId = "22222222-2222-4222-8222-222222222222";
const studentId = "33333333-3333-4333-8333-333333333333";
const ownerId = "44444444-4444-4444-8444-444444444444";
const coTeacherId = "55555555-5555-4555-8555-555555555555";

const teacherActor = {
  id: ownerId,
  role: UserRole.teacher,
  status: UserStatus.active,
};

const studentActor = {
  id: studentId,
  role: UserRole.student,
  status: UserStatus.active,
};

const baseSubmission = {
  id: submissionId,
  assignmentId,
  studentId,
  status: "submitted",
  payload: {
    version: 1,
    task1: { text: "The chart shows steady growth." },
    task2: { text: "Cities should invest in public transport." },
  },
  grade: {
    id: "66666666-6666-4666-8666-666666666666",
    rawScore: 6.5,
    finalScore: 6.5,
    band: 6.5,
    feedback: "Clear position, but examples need depth.",
    deletedAt: null,
  },
  assignment: {
    id: assignmentId,
    title: "Writing Drill",
    type: AssignmentType.writing,
    courseId: "77777777-7777-4777-8777-777777777777",
    assignmentConfig: {
      version: 1,
      instructions: "Write both IELTS tasks.",
      aiPolicy: {
        writingFeedbackMode: "teacher_reviewed",
        objectiveExplanations: "off",
        providerTier: "auto",
      },
      task1: {
        prompt: "Summarise the chart.",
        visualType: "bar_chart",
        imageFileId: "88888888-8888-4888-8888-888888888888",
        rubricId: "99999999-9999-4999-8999-999999999999",
      },
      task2: {
        prompt: "Discuss both views and give your opinion.",
      },
    },
    course: {
      ownerId,
      enrollments: [],
    },
  },
};

describe("requestAiWritingFeedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    aiFeedbackConfig.enabled = true;
    aiFeedbackConfig.apiKey = "sk-test";
    aiFeedbackConfig.baseUrl = "https://example.com/v1";
    aiFeedbackConfig.maxInputChars = 12_000;
    prisma.submission.findFirst.mockResolvedValue(baseSubmission as never);
    prisma.rubric.findMany.mockResolvedValue([
      {
        id: "99999999-9999-4999-8999-999999999999",
        name: "Course writing rubric",
        criteria: [{ name: "Coherence", levels: [] }],
      },
    ] as never);
    resolveAiFeedbackImageContext.mockResolvedValue({
      type: "image",
      imageUrl: "https://storage.mock/task1.png",
      mimeType: "image/png",
      detail: "high",
    });
    createAiFeedbackDraft.mockImplementation(async (input: unknown) => {
      const data = input as Record<string, unknown>;

      return {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        submissionId: data.submissionId,
        status: data.status,
        visibilityMode: data.visibilityMode,
        generatedFeedback: data.generatedFeedback,
        failureCode: data.failureCode ?? null,
        failureMessage: data.failureMessage ?? null,
      } as never;
    });
  });

  it("queues a hidden teacher-reviewed draft with hosted image context", async () => {
    const response = await requestAiWritingFeedback(
      { submissionId },
      teacherActor,
    );

    expect(createAiFeedbackDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        submissionId,
        assignmentId,
        requesterId: ownerId,
        gradeId: "66666666-6666-4666-8666-666666666666",
        promptVersion: "ielts-writing-feedback-v1",
        routeKey: "low_cost",
        provider: "openai-compatible",
        model: "gpt-5.4-nano",
        status: "queued",
        visibilityMode: "teacher_reviewed",
        inputHash: expect.stringMatching(/^sha256:/),
        generationJob: {
          harnessInput: expect.objectContaining({
            fixtureId: expect.stringContaining(`writing-feedback:${submissionId}:`),
            taskType: "writing_feedback",
            routeKey: "low_cost",
            promptInput: expect.objectContaining({
              tasks: expect.objectContaining({
                task1: expect.objectContaining({
                  imageContext: {
                    status: "image_attached",
                    image: {
                      type: "image",
                      imageUrl: "https://storage.mock/task1.png",
                      mimeType: "image/png",
                      detail: "high",
                    },
                  },
                }),
              }),
              teacherConstraints: expect.arrayContaining([
                expect.stringContaining("Existing teacher grade"),
                expect.stringContaining("Teacher rubric context"),
              ]),
            }),
          }),
        },
      }),
    );
    expect(supersedeAiFeedbackDrafts).toHaveBeenCalledWith({
      submissionId,
      exceptDraftId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    expect(response).toEqual(
      expect.objectContaining({
        status: "queued",
        visibilityMode: "teacher_reviewed",
        pollingLocation: `/api/v1/submissions/${submissionId}/ai-feedback/writing`,
      }),
    );
  });

  it("persists instant-visible queued drafts when assignment policy allows it", async () => {
    prisma.submission.findFirst.mockResolvedValueOnce({
      ...baseSubmission,
      assignment: {
        ...baseSubmission.assignment,
        assignmentConfig: {
          ...baseSubmission.assignment.assignmentConfig,
          aiPolicy: {
            writingFeedbackMode: "instant_student_visible",
            objectiveExplanations: "off",
            providerTier: "premium",
          },
        },
      },
    } as never);

    await requestAiWritingFeedback({ submissionId }, teacherActor);

    expect(createAiFeedbackDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        routeKey: "premium",
        visibilityMode: "instant_student_visible",
      }),
    );
  });

  it("creates a teacher-review-only record when required image context is unavailable", async () => {
    resolveAiFeedbackImageContext.mockRejectedValueOnce(
      new Error("Unsupported image type for AI feedback."),
    );

    const response = await requestAiWritingFeedback(
      { submissionId },
      teacherActor,
    );

    expect(createAiFeedbackDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "review_required",
        visibilityMode: "teacher_reviewed",
        failureCode: "image_context_unavailable",
        failureMessage: "Unsupported image type for AI feedback.",
      }),
    );
    expect(createAiFeedbackDraft.mock.calls[0]?.[0]).not.toHaveProperty(
      "generationJob",
    );
    expect(response).toMatchObject({
      status: "review_required",
      visibilityMode: "teacher_reviewed",
      failureCode: "image_context_unavailable",
    });
  });

  it("fails closed when AI feedback generation is globally disabled", async () => {
    aiFeedbackConfig.enabled = false;

    await expect(
      requestAiWritingFeedback({ submissionId }, teacherActor),
    ).rejects.toMatchObject({
      statusCode: 503,
      message: "AI feedback generation is disabled.",
    });

    expect(createAiFeedbackDraft).not.toHaveBeenCalled();
  });

  it("rejects cross-course teacher access before creating a draft", async () => {
    prisma.submission.findFirst.mockResolvedValueOnce({
      ...baseSubmission,
      assignment: {
        ...baseSubmission.assignment,
        course: {
          ownerId,
          enrollments: [],
        },
      },
    } as never);

    await expect(
      requestAiWritingFeedback(
        { submissionId },
        {
          id: coTeacherId,
          role: UserRole.teacher,
          status: UserStatus.active,
        },
      ),
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(createAiFeedbackDraft).not.toHaveBeenCalled();
  });
});

describe("enqueueAiWritingFeedbackForSubmission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    aiFeedbackConfig.enabled = true;
    aiFeedbackConfig.apiKey = "sk-test";
    aiFeedbackConfig.baseUrl = "https://example.com/v1";
    prisma.submission.findFirst.mockResolvedValue({
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
    prisma.rubric.findMany.mockResolvedValue([] as never);
    resolveAiFeedbackImageContext.mockResolvedValue({
      type: "image",
      imageUrl: "https://storage.mock/task1.png",
      mimeType: "image/png",
      detail: "high",
    });
    createAiFeedbackDraft.mockResolvedValue({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      submissionId,
      status: "queued",
      visibilityMode: "teacher_reviewed",
      generatedFeedback: { status: "queued" },
      failureCode: null,
      failureMessage: null,
    } as never);
  });

  it("allows the submitting student to trigger automatic draft generation", async () => {
    await enqueueAiWritingFeedbackForSubmission(submissionId, studentActor);

    expect(createAiFeedbackDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        requesterId: studentId,
        status: "queued",
      }),
    );
    expect(supersedeAiFeedbackDrafts).toHaveBeenCalledWith({
      submissionId,
      exceptDraftId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    });
  });
});

describe("getAiWritingFeedbackStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    aiFeedbackConfig.enabled = false;
    prisma.submission.findFirst.mockResolvedValue(baseSubmission as never);
    findLatestAiFeedbackDraftBySubmission.mockResolvedValue({
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      submissionId,
      status: "running",
      visibilityMode: "teacher_reviewed",
      generatedFeedback: { status: "running" },
      failureCode: null,
      failureMessage: null,
    } as never);
  });

  it("returns the latest writing draft status without creating a new draft", async () => {
    const response = await getAiWritingFeedbackStatus(
      { submissionId },
      teacherActor,
    );

    expect(findLatestAiFeedbackDraftBySubmission).toHaveBeenCalledWith(
      submissionId,
    );
    expect(createAiFeedbackDraft).not.toHaveBeenCalled();
    expect(resolveAiFeedbackImageContext).not.toHaveBeenCalled();
    expect(response).toMatchObject({
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      status: "running",
      visibilityMode: "teacher_reviewed",
      pollingLocation: `/api/v1/submissions/${submissionId}/ai-feedback/writing`,
    });
  });

  it("returns 404 when no writing draft exists for the submission", async () => {
    findLatestAiFeedbackDraftBySubmission.mockResolvedValueOnce(null);

    await expect(
      getAiWritingFeedbackStatus({ submissionId }, teacherActor),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "AI writing feedback draft not found.",
    });
  });
});

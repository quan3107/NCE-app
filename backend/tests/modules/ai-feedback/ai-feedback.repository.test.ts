/**
 * File: tests/modules/ai-feedback/ai-feedback.repository.test.ts
 * Purpose: Verify AI feedback draft and objective explanation persistence behavior.
 * Why: AI-generated drafts must remain separate from teacher-approved grade feedback.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  assignmentId,
  draftId,
  instantAssignmentConfig,
  requesterId,
  submissionId,
} from "./ai-feedback.repository.fixtures.js";
import { writingHarnessFixtures } from "../../fixtures/ai-feedback/harness/harness.fixtures.js";

vi.mock("../../../src/prisma/client.js", () => ({
  prisma: {
    auditLog: {
      create: vi.fn(),
    },
    aiFeedbackDraft: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    submission: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("../../../src/jobs/aiFeedbackJob.enqueue.js", () => ({
  enqueueAiFeedbackDraftOnActiveQueue: vi.fn(),
}));

const prismaModule = await import("../../../src/prisma/client.js");
const aiFeedbackJobQueueModule = await import(
  "../../../src/jobs/aiFeedbackJob.enqueue.js"
);
const prisma = vi.mocked(prismaModule.prisma, true);
const enqueueAiFeedbackDraftOnActiveQueue = vi.mocked(
  aiFeedbackJobQueueModule.enqueueAiFeedbackDraftOnActiveQueue,
);

const {
  createAiFeedbackDraft,
  getStudentVisibleAiFeedbackDraft,
  recordAiFeedbackDraftDecision,
  supersedeAiFeedbackDrafts,
} = await import("../../../src/modules/ai-feedback/ai-feedback.repository.js");

describe("ai-feedback.repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enqueueAiFeedbackDraftOnActiveQueue.mockResolvedValue("job-1");
    prisma.submission.findFirst.mockResolvedValue({
      id: submissionId,
      assignmentId,
    } as never);
  });

  it("creates a writing feedback draft after checking for an active draft on the submission", async () => {
    const created = { id: draftId, status: "queued" };
    prisma.aiFeedbackDraft.findFirst.mockResolvedValueOnce(null);
    prisma.aiFeedbackDraft.create.mockResolvedValueOnce(created as never);

    const draft = await createAiFeedbackDraft({
      submissionId,
      assignmentId,
      requesterId,
      promptVersion: "writing-feedback-v1",
      routeKey: "low_cost",
      provider: "openai-compatible",
      model: "gpt-5.4-nano",
      reasoningEffort: "medium",
      inputHash: "sha256:writing-input",
      visibilityMode: "teacher_reviewed",
      generatedFeedback: {
        summary: "Good structure.",
      },
      normalizedCriterionSuggestions: [
        { criterion: "Task Response", band: 6.5 },
      ],
      criteriaVersion: "ielts-writing-v1",
      safetyFlags: {
        blocked: false,
      },
      generationJob: {
        harnessInput: writingHarnessFixtures[0],
      },
    });

    expect(prisma.aiFeedbackDraft.findFirst).toHaveBeenCalledWith({
      where: {
        submissionId,
        deletedAt: null,
        OR: [
          {
            status: {
              in: ["queued", "running"],
            },
          },
          {
            status: "failed",
            nextRetryAt: {
              not: null,
            },
          },
        ],
      },
      select: {
        id: true,
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
    expect(prisma.aiFeedbackDraft.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          submissionId,
          assignmentId,
          requesterId,
          status: "queued",
          visibilityMode: "teacher_reviewed",
          generatedFeedback: {
            summary: "Good structure.",
          },
          normalizedCriterionSuggestions: [
            { criterion: "Task Response", band: 6.5 },
          ],
          criteriaVersion: "ielts-writing-v1",
          safetyFlags: {
            blocked: false,
          },
          inputHash: "sha256:writing-input",
        }),
      }),
    );
    expect(enqueueAiFeedbackDraftOnActiveQueue).toHaveBeenCalledWith({
      draftId,
      harnessInput: writingHarnessFixtures[0],
    });
    expect(draft).toBe(created);
  });

  it("rejects writing feedback drafts when the caller assignment does not match the submission", async () => {
    prisma.submission.findFirst.mockResolvedValueOnce({
      id: submissionId,
      assignmentId,
    } as never);

    await expect(
      createAiFeedbackDraft({
        submissionId,
        assignmentId: "f65b452e-e7eb-4670-9220-75b27a3d4975",
        requesterId,
        promptVersion: "writing-feedback-v1",
        routeKey: "low_cost",
        provider: "openai-compatible",
        model: "gpt-5.4-nano",
        inputHash: "sha256:writing-input",
        visibilityMode: "teacher_reviewed",
        generatedFeedback: {},
        generationJob: {
          harnessInput: writingHarnessFixtures[0],
        },
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(prisma.aiFeedbackDraft.create).not.toHaveBeenCalled();
  });

  it("rejects a second queued or running draft for the same submission", async () => {
    prisma.aiFeedbackDraft.findFirst.mockResolvedValueOnce({ id: draftId } as never);

    await expect(
      createAiFeedbackDraft({
        submissionId,
        assignmentId,
        requesterId,
        promptVersion: "writing-feedback-v1",
        routeKey: "low_cost",
        provider: "openai-compatible",
        model: "gpt-5.4-nano",
        inputHash: "sha256:writing-input",
        visibilityMode: "teacher_reviewed",
        generatedFeedback: {},
        generationJob: {
          harnessInput: writingHarnessFixtures[0],
        },
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(prisma.aiFeedbackDraft.create).not.toHaveBeenCalled();
  });

  it("rejects another draft while a failed draft is pending retry", async () => {
    prisma.aiFeedbackDraft.findFirst.mockResolvedValueOnce({ id: draftId } as never);

    await expect(
      createAiFeedbackDraft({
        submissionId,
        assignmentId,
        requesterId,
        promptVersion: "writing-feedback-v1",
        routeKey: "low_cost",
        provider: "openai-compatible",
        model: "gpt-5.4-nano",
        inputHash: "sha256:writing-input",
        visibilityMode: "teacher_reviewed",
        generatedFeedback: {},
        generationJob: {
          harnessInput: writingHarnessFixtures[0],
        },
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(prisma.aiFeedbackDraft.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            {
              status: "failed",
              nextRetryAt: {
                not: null,
              },
            },
          ]),
        }),
      }),
    );
    expect(prisma.aiFeedbackDraft.create).not.toHaveBeenCalled();
  });

  it("rejects queued writing drafts with malformed generation payloads", async () => {
    await expect(
      createAiFeedbackDraft({
        submissionId,
        assignmentId,
        requesterId,
        promptVersion: "writing-feedback-v1",
        routeKey: "low_cost",
        provider: "openai-compatible",
        model: "gpt-5.4-nano",
        inputHash: "sha256:writing-input",
        visibilityMode: "teacher_reviewed",
        generatedFeedback: {},
        generationJob: {
          harnessInput: {
            taskType: "writing_feedback",
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

    expect(prisma.aiFeedbackDraft.create).not.toHaveBeenCalled();
    expect(enqueueAiFeedbackDraftOnActiveQueue).not.toHaveBeenCalled();
  });

  it("audits writing drafts that fail while enqueueing generation jobs", async () => {
    const created = { id: draftId, status: "queued" };
    prisma.aiFeedbackDraft.findFirst.mockResolvedValueOnce(null);
    prisma.aiFeedbackDraft.create.mockResolvedValueOnce(created as never);
    enqueueAiFeedbackDraftOnActiveQueue.mockRejectedValueOnce(
      new Error("Queue unavailable."),
    );

    await expect(
      createAiFeedbackDraft({
        submissionId,
        assignmentId,
        requesterId,
        promptVersion: "writing-feedback-v1",
        routeKey: "low_cost",
        provider: "openai-compatible",
        model: "gpt-5.4-nano",
        inputHash: "sha256:writing-input",
        visibilityMode: "teacher_reviewed",
        generatedFeedback: {},
        generationJob: {
          harnessInput: writingHarnessFixtures[0],
        },
      }),
    ).rejects.toThrow("Queue unavailable.");

    expect(prisma.aiFeedbackDraft.updateMany).toHaveBeenCalledWith({
      where: {
        id: draftId,
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
        action: "ai_feedback.writing_failed",
        entity: "ai_feedback_draft",
        entityId: draftId,
        diff: expect.objectContaining({
          routeKey: "low_cost",
          provider: "openai-compatible",
          model: "gpt-5.4-nano",
          promptVersion: "writing-feedback-v1",
        }),
      }),
    });
  });

  it("returns a conflict when a concurrent active draft create wins the race", async () => {
    prisma.aiFeedbackDraft.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: draftId } as never);
    prisma.aiFeedbackDraft.create.mockRejectedValueOnce(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" }),
    );

    const error = await createAiFeedbackDraft({
      submissionId,
      assignmentId,
      requesterId,
        promptVersion: "writing-feedback-v1",
        routeKey: "low_cost",
        provider: "openai-compatible",
        model: "gpt-5.4-nano",
      inputHash: "sha256:writing-input",
      visibilityMode: "teacher_reviewed",
      generatedFeedback: {},
      generationJob: {
        harnessInput: writingHarnessFixtures[0],
      },
    }).catch((caught: unknown) => caught);
    const findFirstCallCount = prisma.aiFeedbackDraft.findFirst.mock.calls.length;
    prisma.aiFeedbackDraft.findFirst.mockReset();

    expect(error).toMatchObject({
      statusCode: 409,
      details: { draftId },
    });
    expect(findFirstCallCount).toBe(2);
  });

  it("does not expose teacher-reviewed writing drafts to students", async () => {
    prisma.aiFeedbackDraft.findFirst.mockResolvedValueOnce(null);

    const draft = await getStudentVisibleAiFeedbackDraft({
      submissionId,
      studentId: requesterId,
    });

    expect(prisma.aiFeedbackDraft.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          submissionId,
          visibilityMode: "instant_student_visible",
          status: {
            in: ["accepted", "approved", "finalized"],
          },
          submission: expect.objectContaining({
            studentId: requesterId,
          }),
        }),
      }),
    );
    expect(draft).toBeNull();
  });

  it("does not expose instant-visible drafts from archived courses", async () => {
    prisma.aiFeedbackDraft.findFirst.mockResolvedValueOnce(null);

    await getStudentVisibleAiFeedbackDraft({
      submissionId,
      studentId: requesterId,
    });

    expect(prisma.aiFeedbackDraft.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          submission: expect.objectContaining({
            assignment: {
              deletedAt: null,
              course: {
                deletedAt: null,
              },
            },
          }),
        }),
      }),
    );
  });

  it("exposes instant-visible writing drafts only when assignment policy allows it", async () => {
    const visibleDraft = {
      id: draftId,
      submission: {
        assignment: {
          assignmentConfig: instantAssignmentConfig,
        },
      },
    };
    prisma.aiFeedbackDraft.findFirst.mockResolvedValueOnce(visibleDraft as never);

    const draft = await getStudentVisibleAiFeedbackDraft({
      submissionId,
      studentId: requesterId,
    });

    expect(draft).toBe(visibleDraft);
  });

  it("keeps instant-visible drafts hidden when the assignment policy changes away from instant visibility", async () => {
    prisma.aiFeedbackDraft.findFirst.mockResolvedValueOnce({
      id: draftId,
      submission: {
        assignment: {
          assignmentConfig: {
            ...instantAssignmentConfig,
            aiPolicy: {
              ...instantAssignmentConfig.aiPolicy,
              writingFeedbackMode: "teacher_reviewed",
            },
          },
        },
      },
    } as never);

    const draft = await getStudentVisibleAiFeedbackDraft({
      submissionId,
      studentId: requesterId,
    });

    expect(draft).toBeNull();
  });

  it("records teacher decisions without writing final grade feedback", async () => {
    prisma.aiFeedbackDraft.update.mockResolvedValueOnce({
      id: draftId,
      decision: "approved",
    } as never);

    await recordAiFeedbackDraftDecision({
      draftId,
      actorId: "0c59939f-7b62-43fe-8c8d-c20306867bdf",
      decision: "approved",
      gradeId: "1af68a94-d1a7-466e-b411-1f6f8f57ddbf",
      teacherEditedFeedback: {
        summary: "Use more precise examples.",
      },
    });

    expect(prisma.aiFeedbackDraft.update).toHaveBeenCalledWith({
      where: {
        id: draftId,
      },
      data: expect.objectContaining({
        decision: "approved",
        decisionActorId: "0c59939f-7b62-43fe-8c8d-c20306867bdf",
        gradeId: "1af68a94-d1a7-466e-b411-1f6f8f57ddbf",
        teacherEditedFeedback: {
          summary: "Use more precise examples.",
        },
        status: "approved",
      }),
    });
    expect("grade" in prisma).toBe(false);
  });

  it("marks older active drafts superseded when a newer result wins", async () => {
    await supersedeAiFeedbackDrafts({ submissionId, exceptDraftId: draftId });

    expect(prisma.aiFeedbackDraft.updateMany).toHaveBeenCalledWith({
      where: {
        submissionId,
        id: {
          not: draftId,
        },
        deletedAt: null,
        status: {
          in: ["queued", "running", "accepted", "review_required", "approved"],
        },
      },
      data: {
        status: "superseded",
      },
    });
  });
});

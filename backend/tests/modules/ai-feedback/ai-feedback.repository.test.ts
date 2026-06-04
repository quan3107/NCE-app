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

vi.mock("../../../src/prisma/client.js", () => ({
  prisma: {
    aiFeedbackDraft: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

const prismaModule = await import("../../../src/prisma/client.js");
const prisma = vi.mocked(prismaModule.prisma, true);

const {
  createAiFeedbackDraft,
  getStudentVisibleAiFeedbackDraft,
  recordAiFeedbackDraftDecision,
  supersedeAiFeedbackDrafts,
} = await import("../../../src/modules/ai-feedback/ai-feedback.repository.js");

describe("ai-feedback.repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    });

    expect(prisma.aiFeedbackDraft.findFirst).toHaveBeenCalledWith({
      where: {
        submissionId,
        deletedAt: null,
        status: {
          in: ["queued", "running"],
        },
      },
      select: {
        id: true,
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
    expect(draft).toBe(created);
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
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(prisma.aiFeedbackDraft.create).not.toHaveBeenCalled();
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

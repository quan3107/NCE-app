/**
 * File: tests/modules/ai-feedback/ai-feedback.teacher-review.service.test.ts
 * Purpose: Verify teacher review and override decisions for AI writing feedback.
 * Why: AI-generated feedback must stay draft-only until an authorized teacher publishes it to a grade.
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
    auditLog: {
      create: vi.fn(),
    },
    aiFeedbackDraft: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    grade: {
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

const prismaModule = await import("../../../src/prisma/client.js");
const prisma = vi.mocked(prismaModule.prisma, true);
const transactionAuditLogCreate = vi.fn();

const {
  approveAiWritingFeedbackDraft,
  finalizeAiWritingFeedbackDraft,
  listAiWritingFeedbackDrafts,
  rejectAiWritingFeedbackDraft,
} = await import("../../../src/modules/ai-feedback/ai-feedback.service.js");

const submissionId = "11111111-1111-4111-8111-111111111111";
const draftId = "22222222-2222-4222-8222-222222222222";
const gradeId = "33333333-3333-4333-8333-333333333333";
const teacherId = "44444444-4444-4444-8444-444444444444";
const outsideTeacherId = "55555555-5555-4555-8555-555555555555";

const teacherActor = {
  id: teacherId,
  role: UserRole.teacher,
  status: UserStatus.active,
};

const baseDraft = {
  id: draftId,
  submissionId,
  assignmentId: "66666666-6666-4666-8666-666666666666",
  status: "accepted",
  visibilityMode: "teacher_reviewed",
  generatedFeedback: {
    summary: "Good task response with uneven cohesion.",
  },
  teacherEditedFeedback: null,
  normalizedCriterionSuggestions: [
    { criterion: "Task Response", points: 6.5 },
    { criterion: "Coherence and Cohesion", points: 6 },
    { criterion: "Lexical Resource", points: 6.5 },
    { criterion: "Grammatical Range and Accuracy", points: 6 },
  ],
  decision: null,
  decisionActorId: null,
  decidedAt: null,
  finalizedAt: null,
  failureCode: null,
  failureMessage: null,
  createdAt: new Date("2026-06-01T10:00:00.000Z"),
  updatedAt: new Date("2026-06-01T10:01:00.000Z"),
  gradeId,
  submission: {
    id: submissionId,
    grade: {
      id: gradeId,
      feedback: "Original teacher feedback.",
      deletedAt: null,
    },
    assignment: {
      type: AssignmentType.writing,
      course: {
        ownerId: teacherId,
        enrollments: [],
      },
    },
  },
};

describe("AI writing feedback teacher review service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transactionAuditLogCreate.mockReset();
    prisma.$transaction.mockImplementation(async (callback) => callback(prisma));
    prisma.grade.update.mockResolvedValue({ id: gradeId } as never);
    prisma.aiFeedbackDraft.updateMany.mockResolvedValue({ count: 1 } as never);
    prisma.aiFeedbackDraft.findUnique.mockImplementation(async () => ({
      ...baseDraft,
      status: "approved",
      decision: "approved",
      decisionActorId: teacherId,
      teacherEditedFeedback: {
        feedbackMd: "Teacher-edited final feedback.",
      },
    }) as never);
    prisma.aiFeedbackDraft.update.mockImplementation(async (args) => ({
      ...baseDraft,
      ...args.data,
    }) as never);
  });

  it("lists all non-deleted writing drafts for an authorized course teacher", async () => {
    prisma.aiFeedbackDraft.findMany.mockResolvedValueOnce([baseDraft] as never);

    const drafts = await listAiWritingFeedbackDrafts(
      { submissionId },
      teacherActor,
    );

    expect(prisma.aiFeedbackDraft.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          submissionId,
          deletedAt: null,
          submission: expect.objectContaining({
            assignment: expect.objectContaining({
              course: expect.objectContaining({
                OR: [
                  { ownerId: teacherId },
                  {
                    enrollments: {
                      some: {
                        userId: teacherId,
                        roleInCourse: EnrollmentRole.teacher,
                        deletedAt: null,
                      },
                    },
                  },
                ],
              }),
            }),
          }),
        }),
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }),
    );
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({
      id: draftId,
      status: "accepted",
      feedback: baseDraft.generatedFeedback,
    });
  });

  it("approves edited feedback by atomically updating the existing grade and draft decision", async () => {
    prisma.$transaction.mockImplementation(async (callback) =>
      callback({
        ...prisma,
        auditLog: {
          create: transactionAuditLogCreate,
        },
      }),
    );
    prisma.aiFeedbackDraft.findFirst.mockResolvedValueOnce(baseDraft as never);

    const response = await approveAiWritingFeedbackDraft(
      { submissionId, draftId },
      {
        feedbackMd: "Teacher-edited final feedback.",
        normalizedCriterionSuggestions: [
          { criterion: "Task Response", points: 6.5 },
          { criterion: "Coherence and Cohesion", points: 6 },
          { criterion: "Lexical Resource", points: 6.5 },
          { criterion: "Grammatical Range and Accuracy", points: 6 },
        ],
      },
      teacherActor,
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.grade.update).toHaveBeenCalledWith({
      where: { id: gradeId },
      data: {
        feedback: "Teacher-edited final feedback.",
        graderId: teacherId,
        gradedAt: expect.any(Date),
      },
    });
    expect(prisma.aiFeedbackDraft.updateMany).toHaveBeenCalledWith({
      where: {
        id: draftId,
        decision: null,
        status: {
          in: ["accepted", "review_required", "failed"],
        },
      },
      data: expect.objectContaining({
        status: "approved",
        decision: "approved",
        decisionActorId: teacherId,
        gradeId,
        teacherEditedFeedback: {
          feedbackMd: "Teacher-edited final feedback.",
        },
        normalizedCriterionSuggestions: [
          { criterion: "Task Response", points: 6.5 },
          { criterion: "Coherence and Cohesion", points: 6 },
          { criterion: "Lexical Resource", points: 6.5 },
          { criterion: "Grammatical Range and Accuracy", points: 6 },
        ],
      }),
    });
    expect(transactionAuditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: teacherId,
        action: "ai_feedback.writing_approved",
        entity: "ai_feedback_draft",
        entityId: draftId,
        diff: expect.objectContaining({
          entityIds: expect.objectContaining({
            submissionId,
            assignmentId: "66666666-6666-4666-8666-666666666666",
            gradeId,
          }),
          teacherDecision: "approved",
        }),
      }),
    });
    expect(transactionAuditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: teacherId,
        action: "ai_feedback.grade_feedback_updated",
        entity: "grade",
        entityId: gradeId,
        diff: expect.objectContaining({
          entityIds: expect.objectContaining({
            submissionId,
            draftId,
          }),
        }),
      }),
    });
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    expect(JSON.stringify(transactionAuditLogCreate.mock.calls)).not.toContain(
      "Teacher-edited final feedback.",
    );
    expect(response).toMatchObject({
      id: draftId,
      status: "approved",
      gradeId,
    });
  });

  it("does not update grade feedback when a concurrent decision wins first", async () => {
    prisma.aiFeedbackDraft.findFirst.mockResolvedValueOnce(baseDraft as never);
    prisma.aiFeedbackDraft.updateMany.mockResolvedValueOnce({ count: 0 } as never);

    await expect(
      approveAiWritingFeedbackDraft(
        { submissionId, draftId },
        { feedbackMd: "Late competing edit." },
        teacherActor,
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "AI feedback draft has already been decided.",
    });

    expect(prisma.aiFeedbackDraft.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: draftId,
          decision: null,
        }),
      }),
    );
    expect(prisma.grade.update).not.toHaveBeenCalled();
  });

  it("finalizes instant-visible feedback into final grade feedback", async () => {
    prisma.aiFeedbackDraft.findFirst.mockResolvedValueOnce({
      ...baseDraft,
      visibilityMode: "instant_student_visible",
    } as never);
    prisma.aiFeedbackDraft.findUnique.mockResolvedValueOnce({
      ...baseDraft,
      visibilityMode: "instant_student_visible",
      status: "finalized",
      decision: "finalized",
    } as never);

    await finalizeAiWritingFeedbackDraft(
      { submissionId, draftId },
      {
        feedbackMd: "Final teacher replacement.",
      },
      teacherActor,
    );

    expect(prisma.grade.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: gradeId },
        data: expect.objectContaining({
          feedback: "Final teacher replacement.",
        }),
      }),
    );
    expect(prisma.aiFeedbackDraft.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "finalized",
          decision: "finalized",
          finalizedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("does not finalize teacher-reviewed drafts through the instant-visible finalization path", async () => {
    prisma.aiFeedbackDraft.findFirst.mockResolvedValueOnce(baseDraft as never);

    await expect(
      finalizeAiWritingFeedbackDraft(
        { submissionId, draftId },
        { feedbackMd: "Use approve instead." },
        teacherActor,
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      message:
        "Only instant-visible AI feedback drafts can be finalized through this endpoint.",
    });

    expect(prisma.grade.update).not.toHaveBeenCalled();
    expect(prisma.aiFeedbackDraft.update).not.toHaveBeenCalled();
  });

  it("keeps rejected drafts for audit without updating grade feedback", async () => {
    prisma.$transaction.mockImplementation(async (callback) =>
      callback({
        ...prisma,
        auditLog: {
          create: transactionAuditLogCreate,
        },
      }),
    );
    prisma.aiFeedbackDraft.findFirst.mockResolvedValueOnce(baseDraft as never);
    prisma.aiFeedbackDraft.findUnique.mockResolvedValueOnce({
      ...baseDraft,
      status: "rejected",
      decision: "rejected",
      teacherEditedFeedback: {
        rejectionReason: "Feedback overstated coherence.",
      },
    } as never);

    const response = await rejectAiWritingFeedbackDraft(
      { submissionId, draftId },
      { reason: "Feedback overstated coherence." },
      teacherActor,
    );

    expect(prisma.grade.update).not.toHaveBeenCalled();
    expect(prisma.aiFeedbackDraft.updateMany).toHaveBeenCalledWith({
      where: {
        id: draftId,
        decision: null,
        status: {
          in: ["accepted", "review_required", "failed"],
        },
      },
      data: expect.objectContaining({
        status: "rejected",
        decision: "rejected",
        decisionActorId: teacherId,
        teacherEditedFeedback: {
          rejectionReason: "Feedback overstated coherence.",
        },
      }),
    });
    expect(transactionAuditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: teacherId,
        action: "ai_feedback.writing_rejected",
        entity: "ai_feedback_draft",
        entityId: draftId,
        diff: expect.objectContaining({
          teacherDecision: "rejected",
        }),
      }),
    });
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    expect(JSON.stringify(transactionAuditLogCreate.mock.calls)).not.toContain(
      "Feedback overstated coherence.",
    );
    expect(response).toMatchObject({
      id: draftId,
      status: "rejected",
    });
  });

  it("rejects drafts without requiring a request body", async () => {
    prisma.aiFeedbackDraft.findFirst.mockResolvedValueOnce(baseDraft as never);
    prisma.aiFeedbackDraft.findUnique.mockResolvedValueOnce({
      ...baseDraft,
      status: "rejected",
      decision: "rejected",
    } as never);

    await rejectAiWritingFeedbackDraft(
      { submissionId, draftId },
      undefined,
      teacherActor,
    );

    expect(prisma.aiFeedbackDraft.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "rejected",
          decision: "rejected",
        }),
      }),
    );
  });

  it("keeps provider feedback visible in rejected draft history", async () => {
    prisma.aiFeedbackDraft.findMany.mockResolvedValueOnce([
      {
        ...baseDraft,
        status: "rejected",
        decision: "rejected",
        teacherEditedFeedback: {
          rejectionReason: "Feedback overstated coherence.",
        },
      },
    ] as never);

    const drafts = await listAiWritingFeedbackDrafts(
      { submissionId },
      teacherActor,
    );

    expect(drafts[0]).toMatchObject({
      status: "rejected",
      feedback: baseDraft.generatedFeedback,
      teacherEditedFeedback: {
        rejectionReason: "Feedback overstated coherence.",
      },
    });
  });

  it("requires an existing grade before publishing AI feedback", async () => {
    prisma.aiFeedbackDraft.findFirst.mockResolvedValueOnce({
      ...baseDraft,
      gradeId: null,
      submission: {
        ...baseDraft.submission,
        grade: null,
      },
    } as never);

    await expect(
      approveAiWritingFeedbackDraft(
        { submissionId, draftId },
        { feedbackMd: "Feedback without a grade." },
        teacherActor,
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "AI feedback approval requires an existing grade.",
    });

    expect(prisma.grade.update).not.toHaveBeenCalled();
    expect(prisma.aiFeedbackDraft.update).not.toHaveBeenCalled();
  });

  it("prevents re-deciding already decided drafts", async () => {
    prisma.aiFeedbackDraft.findFirst.mockResolvedValueOnce({
      ...baseDraft,
      status: "approved",
      decision: "approved",
    } as never);

    await expect(
      rejectAiWritingFeedbackDraft(
        { submissionId, draftId },
        { reason: "Too late." },
        teacherActor,
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "AI feedback draft has already been decided.",
    });
  });

  it("rejects invalid IELTS criterion edits before publishing", async () => {
    prisma.aiFeedbackDraft.findFirst.mockResolvedValueOnce(baseDraft as never);

    await expect(
      approveAiWritingFeedbackDraft(
        { submissionId, draftId },
        {
          feedbackMd: "Edited feedback.",
          normalizedCriterionSuggestions: [
            { criterion: "Task Response", points: 6.25 },
            { criterion: "Coherence and Cohesion", points: 6 },
            { criterion: "Lexical Resource", points: 6.5 },
            { criterion: "Grammatical Range and Accuracy", points: 6 },
          ],
        },
        teacherActor,
      ),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(prisma.grade.update).not.toHaveBeenCalled();
    expect(prisma.aiFeedbackDraft.update).not.toHaveBeenCalled();
  });

  it("does not let outside-course teachers decide drafts", async () => {
    prisma.aiFeedbackDraft.findFirst.mockResolvedValueOnce({
      ...baseDraft,
      submission: {
        ...baseDraft.submission,
        assignment: {
          ...baseDraft.submission.assignment,
          course: {
            ownerId: teacherId,
            enrollments: [],
          },
        },
      },
    } as never);

    await expect(
      approveAiWritingFeedbackDraft(
        { submissionId, draftId },
        { feedbackMd: "Outside teacher edit." },
        {
          id: outsideTeacherId,
          role: UserRole.teacher,
          status: UserStatus.active,
        },
      ),
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(prisma.grade.update).not.toHaveBeenCalled();
  });
});

/**
 * File: tests/modules/ai-feedback/ai-feedback.controller.test.ts
 * Purpose: Verify AI feedback HTTP response mapping.
 * Why: Terminal explanation states should not look like actively polling jobs.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";

vi.mock("../../../src/modules/ai-feedback/ai-feedback.service.js", () => ({
  approveAiWritingFeedbackDraft: vi.fn(),
  finalizeAiWritingFeedbackDraft: vi.fn(),
  getAiFeedbackHealth: vi.fn(),
  getAiObjectiveExplanationStatus: vi.fn(),
  getAiWritingFeedbackStatus: vi.fn(),
  listAiWritingFeedbackDrafts: vi.fn(),
  rejectAiWritingFeedbackDraft: vi.fn(),
  regenerateAiWritingFeedback: vi.fn(),
  requestAiWritingFeedback: vi.fn(),
  requestAiObjectiveExplanation: vi.fn(),
}));

const serviceModule = await import(
  "../../../src/modules/ai-feedback/ai-feedback.service.js"
);
const {
  getWritingFeedbackDraftHistory,
  getObjectiveExplanationStatus,
  getWritingFeedbackStatus,
  postWritingFeedbackApproval,
  postWritingFeedbackFinalization,
  postWritingFeedbackRejection,
  postWritingFeedbackRegeneration,
  postObjectiveExplanationRequest,
  postWritingFeedbackRequest,
} = await import("../../../src/modules/ai-feedback/ai-feedback.controller.js");

const approveAiWritingFeedbackDraft = vi.mocked(
  serviceModule.approveAiWritingFeedbackDraft,
);
const finalizeAiWritingFeedbackDraft = vi.mocked(
  serviceModule.finalizeAiWritingFeedbackDraft,
);
const getAiObjectiveExplanationStatus = vi.mocked(
  serviceModule.getAiObjectiveExplanationStatus,
);
const listAiWritingFeedbackDrafts = vi.mocked(
  serviceModule.listAiWritingFeedbackDrafts,
);
const rejectAiWritingFeedbackDraft = vi.mocked(
  serviceModule.rejectAiWritingFeedbackDraft,
);
const regenerateAiWritingFeedback = vi.mocked(
  serviceModule.regenerateAiWritingFeedback,
);
const requestAiObjectiveExplanation = vi.mocked(
  serviceModule.requestAiObjectiveExplanation,
);
const requestAiWritingFeedback = vi.mocked(serviceModule.requestAiWritingFeedback);
const getAiWritingFeedbackStatus = vi.mocked(
  serviceModule.getAiWritingFeedbackStatus,
);

function response() {
  return {
    status: vi.fn().mockReturnThis(),
    location: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response & {
    status: ReturnType<typeof vi.fn>;
    location: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
}

describe("postObjectiveExplanationRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 202 with a polling location for active explanation jobs", async () => {
    const res = response();
    const next = vi.fn() as NextFunction;
    requestAiObjectiveExplanation.mockResolvedValueOnce({
      id: "77777777-7777-4777-8777-777777777777",
      status: "queued",
      cached: false,
      pollingLocation:
        "/api/v1/submissions/11111111-1111-4111-8111-111111111111/questions/q1/ai-explanation",
    });

    await postObjectiveExplanationRequest(
      { params: {}, user: undefined } as Request,
      res,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.location).toHaveBeenCalledWith(
      "/api/v1/submissions/11111111-1111-4111-8111-111111111111/questions/q1/ai-explanation",
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: "queued" }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("returns a non-polling conflict response for terminal review states", async () => {
    const res = response();
    const next = vi.fn() as NextFunction;
    requestAiObjectiveExplanation.mockResolvedValueOnce({
      id: "77777777-7777-4777-8777-777777777777",
      status: "review_required",
      cached: false,
      pollingLocation:
        "/api/v1/submissions/11111111-1111-4111-8111-111111111111/questions/q1/ai-explanation",
    });

    await postObjectiveExplanationRequest(
      { params: {}, user: undefined } as Request,
      res,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.location).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: "review_required" }),
    );
    expect(next).not.toHaveBeenCalled();
  });
});

describe("getObjectiveExplanationStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns active explanation status without setting a Location header", async () => {
    const res = response();
    const next = vi.fn() as NextFunction;
    getAiObjectiveExplanationStatus.mockResolvedValueOnce({
      id: "77777777-7777-4777-8777-777777777777",
      status: "running",
      cached: false,
      pollingLocation:
        "/api/v1/submissions/11111111-1111-4111-8111-111111111111/questions/q1/ai-explanation",
    });

    await getObjectiveExplanationStatus(
      { params: {}, user: undefined } as Request,
      res,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.location).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: "running" }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("returns completed cached explanations", async () => {
    const res = response();
    const next = vi.fn() as NextFunction;
    getAiObjectiveExplanationStatus.mockResolvedValueOnce({
      id: "77777777-7777-4777-8777-777777777777",
      status: "completed",
      cached: true,
      explanation: {
        short_explanation: "Paragraph B supports option B.",
      },
    });

    await getObjectiveExplanationStatus(
      { params: {}, user: undefined } as Request,
      res,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.location).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: "completed", cached: true }),
    );
  });
});

describe("postWritingFeedbackRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 202 with a polling location for queued writing drafts", async () => {
    const res = response();
    const next = vi.fn() as NextFunction;
    requestAiWritingFeedback.mockResolvedValueOnce({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      status: "queued",
      visibilityMode: "teacher_reviewed",
      pollingLocation:
        "/api/v1/submissions/11111111-1111-4111-8111-111111111111/ai-feedback/writing",
    });

    await postWritingFeedbackRequest(
      { params: {}, user: undefined } as Request,
      res,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.location).toHaveBeenCalledWith(
      "/api/v1/submissions/11111111-1111-4111-8111-111111111111/ai-feedback/writing",
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: "queued" }),
    );
    expect(next).not.toHaveBeenCalled();
  });
});

describe("getWritingFeedbackStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns active writing draft status without setting a Location header", async () => {
    const res = response();
    const next = vi.fn() as NextFunction;
    getAiWritingFeedbackStatus.mockResolvedValueOnce({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      status: "running",
      visibilityMode: "teacher_reviewed",
      pollingLocation:
        "/api/v1/submissions/11111111-1111-4111-8111-111111111111/ai-feedback/writing",
    });

    await getWritingFeedbackStatus(
      { params: {}, user: undefined } as Request,
      res,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.location).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: "running" }),
    );
    expect(next).not.toHaveBeenCalled();
  });
});

describe("writing feedback teacher review controllers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns writing feedback draft history", async () => {
    const res = response();
    const next = vi.fn() as NextFunction;
    listAiWritingFeedbackDrafts.mockResolvedValueOnce([
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        status: "accepted",
        visibilityMode: "teacher_reviewed",
      },
    ]);

    await getWritingFeedbackDraftHistory(
      { params: { submissionId: "submission-1" }, user: { id: "teacher-1" } } as unknown as Request,
      res,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      drafts: [
        expect.objectContaining({
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          status: "accepted",
        }),
      ],
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("approves a draft and returns the decided record", async () => {
    const res = response();
    const next = vi.fn() as NextFunction;
    approveAiWritingFeedbackDraft.mockResolvedValueOnce({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      status: "approved",
      visibilityMode: "teacher_reviewed",
      gradeId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    });

    await postWritingFeedbackApproval(
      { params: {}, body: { feedbackMd: "Edited." }, user: { id: "teacher-1" } } as Request,
      res,
      next,
    );

    expect(approveAiWritingFeedbackDraft).toHaveBeenCalledWith(
      {},
      { feedbackMd: "Edited." },
      { id: "teacher-1" },
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: "approved" }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects a draft with teacher reason", async () => {
    const res = response();
    const next = vi.fn() as NextFunction;
    rejectAiWritingFeedbackDraft.mockResolvedValueOnce({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      status: "rejected",
      visibilityMode: "teacher_reviewed",
    });

    await postWritingFeedbackRejection(
      { params: {}, body: { reason: "Needs rewrite." }, user: { id: "teacher-1" } } as Request,
      res,
      next,
    );

    expect(rejectAiWritingFeedbackDraft).toHaveBeenCalledWith(
      {},
      { reason: "Needs rewrite." },
      { id: "teacher-1" },
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: "rejected" }),
    );
  });

  it("finalizes instant-visible provisional feedback", async () => {
    const res = response();
    const next = vi.fn() as NextFunction;
    finalizeAiWritingFeedbackDraft.mockResolvedValueOnce({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      status: "finalized",
      visibilityMode: "instant_student_visible",
    });

    await postWritingFeedbackFinalization(
      { params: {}, body: { feedbackMd: "Final." }, user: { id: "teacher-1" } } as Request,
      res,
      next,
    );

    expect(finalizeAiWritingFeedbackDraft).toHaveBeenCalledWith(
      {},
      { feedbackMd: "Final." },
      { id: "teacher-1" },
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: "finalized" }),
    );
  });

  it("regenerates writing feedback with an optional provider tier override", async () => {
    const res = response();
    const next = vi.fn() as NextFunction;
    regenerateAiWritingFeedback.mockResolvedValueOnce({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      status: "queued",
      visibilityMode: "teacher_reviewed",
      pollingLocation:
        "/api/v1/submissions/11111111-1111-4111-8111-111111111111/ai-feedback/writing",
    });

    await postWritingFeedbackRegeneration(
      { params: {}, body: { providerTier: "premium" }, user: { id: "teacher-1" } } as Request,
      res,
      next,
    );

    expect(regenerateAiWritingFeedback).toHaveBeenCalledWith(
      {},
      { providerTier: "premium" },
      { id: "teacher-1" },
    );
    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.location).toHaveBeenCalledWith(
      "/api/v1/submissions/11111111-1111-4111-8111-111111111111/ai-feedback/writing",
    );
  });
});

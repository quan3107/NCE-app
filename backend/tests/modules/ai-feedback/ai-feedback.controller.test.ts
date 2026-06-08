/**
 * File: tests/modules/ai-feedback/ai-feedback.controller.test.ts
 * Purpose: Verify AI feedback HTTP response mapping.
 * Why: Terminal explanation states should not look like actively polling jobs.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";

vi.mock("../../../src/modules/ai-feedback/ai-feedback.service.js", () => ({
  getAiObjectiveExplanationStatus: vi.fn(),
  requestAiObjectiveExplanation: vi.fn(),
}));

const serviceModule = await import(
  "../../../src/modules/ai-feedback/ai-feedback.service.js"
);
const { getObjectiveExplanationStatus, postObjectiveExplanationRequest } =
  await import("../../../src/modules/ai-feedback/ai-feedback.controller.js");

const getAiObjectiveExplanationStatus = vi.mocked(
  serviceModule.getAiObjectiveExplanationStatus,
);
const requestAiObjectiveExplanation = vi.mocked(
  serviceModule.requestAiObjectiveExplanation,
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

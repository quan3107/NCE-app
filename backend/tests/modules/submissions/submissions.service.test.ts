/**
 * File: tests/modules/submissions/submissions.service.test.ts
 * Purpose: Validate IELTS submission payload handling in the service layer.
 * Why: Ensures valid payloads persist once assignment types are verified.
 */
import { describe, expect, it, beforeEach, vi } from "vitest";
import type { Assignment, Submission } from "@prisma/client";

vi.mock("../../../src/prisma/client.js", () => ({
  prisma: {
    assignment: {
      findFirst: vi.fn(),
    },
    submission: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

const prismaModule = await import("../../../src/prisma/client.js");
const prisma = vi.mocked(prismaModule.prisma, true);

const { createSubmission } = await import(
  "../../../src/modules/submissions/submissions.service.js"
);

const assignmentId = "4c67e29f-7a7b-4c3e-8d56-52e5487e59a1";
const studentId = "b9a2031b-9eac-4c77-9f11-4e7fbf3b5c2b";

describe("submissions.service.createSubmission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists valid IELTS submission payloads", async () => {
    const assignmentRecord: Assignment = {
      id: assignmentId,
      courseId: "8a7c1b41-2a1c-4f6d-9f6d-3f2a0e8e2c15",
      title: "Reading Practice",
      description: null,
      type: "reading",
      dueAt: null,
      latePolicy: null,
      assignmentConfig: null,
      publishedAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      deletedAt: null,
    };

    prisma.assignment.findFirst.mockResolvedValueOnce(assignmentRecord);
    prisma.submission.findUnique.mockResolvedValueOnce(null);
    const record = { id: "submission-1" } as Submission;
    prisma.submission.create.mockResolvedValueOnce(record);

    const payload = {
      studentId,
      payload: {
        version: 1,
        answers: [{ questionId: "q1", value: "A" }],
      },
    };

    const result = await createSubmission(
      { assignmentId },
      payload,
      { id: studentId, role: "student" },
    );

    expect(prisma.submission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assignmentId,
          studentId,
          status: "draft",
          payload: expect.objectContaining({
            version: 1,
          }),
        }),
      }),
    );
    expect(result).toBe(record);
  });
});

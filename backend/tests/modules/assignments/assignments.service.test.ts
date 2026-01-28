/**
 * File: tests/modules/assignments/assignments.service.test.ts
 * Purpose: Validate IELTS assignment config handling in the service layer.
 * Why: Ensures valid configs persist while invalid configs are rejected.
 */
import { describe, expect, it, beforeEach, vi } from "vitest";
import type { Assignment } from "@prisma/client";
import { ZodError } from "zod";

vi.mock("../../../src/prisma/client.js", () => ({
  prisma: {
    assignment: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

const prismaModule = await import("../../../src/prisma/client.js");
const prisma = vi.mocked(prismaModule.prisma, true);

const { createAssignment } = await import(
  "../../../src/modules/assignments/assignments.service.js"
);

const courseId = "7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2";

const readingConfig = {
  version: 1,
  timing: { enabled: true, durationMinutes: 60, enforce: false },
  instructions: "Read and answer all questions.",
  attempts: { maxAttempts: null },
  sections: [],
};

describe("assignments.service.createAssignment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists valid IELTS assignment configs", async () => {
    const record = { id: "assignment-1" } as Assignment;
    prisma.assignment.create.mockResolvedValueOnce(record);

    const result = await createAssignment(
      { courseId },
      {
        title: "Reading Practice",
        type: "reading",
        assignmentConfig: readingConfig,
      },
    );

    expect(prisma.assignment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          courseId,
          title: "Reading Practice",
          type: "reading",
          assignmentConfig: readingConfig,
        }),
      }),
    );
    expect(result).toBe(record);
  });

  it("rejects IELTS assignments without assignment_config", async () => {
    await expect(
      createAssignment(
        { courseId },
        {
          title: "Reading Practice",
          type: "reading",
        } as never,
      ),
    ).rejects.toBeInstanceOf(ZodError);
  });
});

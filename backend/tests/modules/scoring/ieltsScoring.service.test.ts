/**
 * File: tests/modules/scoring/ieltsScoring.service.test.ts
 * Purpose: Validate IELTS reading/listening auto-scoring helpers.
 * Why: Ensures band conversion and idempotent scoring behave as expected.
 */
import { describe, expect, it, beforeEach, vi } from "vitest";
import { AssignmentType } from "@prisma/client";

vi.mock("../../../src/prisma/client.js", () => ({
  prisma: {
    grade: {
      findUnique: vi.fn(),
    },
    submission: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("../../../src/modules/grades/grades.service.js", () => ({
  upsertGrade: vi.fn(),
}));

const prismaModule = await import("../../../src/prisma/client.js");
const prisma = vi.mocked(prismaModule.prisma, true);
const gradeService = await import("../../../src/modules/grades/grades.service.js");
const { autoScoreSubmission } = await import(
  "../../../src/modules/scoring/ieltsScoring.service.js"
);
const { scoreIeltsSubmission } = await import(
  "../../../src/modules/scoring/ieltsScoring.utils.js"
);

const assignmentConfig = {
  version: 1,
  sections: [
    {
      id: "sec-1",
      title: "Passage",
      passage: "Sample passage",
      questions: [
        {
          id: "q1",
          type: "multiple_choice",
          answer: "B",
        },
        {
          id: "q2",
          type: "true_false_not_given",
          answer: "not_given",
        },
        {
          id: "q3",
          type: "sentence_completion",
          sentences: [{ id: "q3-1", answer: "rooftops" }],
        },
        {
          id: "q4",
          type: "matching_information",
          statements: [{ id: "q4-1", answerParagraph: "B" }],
        },
        {
          id: "q5",
          type: "matching_headings",
          items: [{ paragraph: "A", answerHeadingId: "h1" }],
        },
        {
          id: "q6",
          type: "matching_features",
          statements: [{ id: "q6-1", answerFeatureId: "f2" }],
        },
      ],
    },
  ],
};

const submissionPayload = {
  answers: [
    { questionId: "q1", value: "B" },
    { questionId: "q2", value: "Not Given" },
    { questionId: "q3-1", value: "Rooftops" },
    { questionId: "q4-1", value: "B" },
    { questionId: "A", value: "h1" },
    { questionId: "q6-1", value: "f1" },
  ],
};

describe("ieltsScoring.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("scores reading answers and returns a band", () => {
    const result = scoreIeltsSubmission({
      assignmentType: AssignmentType.reading,
      assignmentConfig,
      submissionPayload,
    });

    expect(result).toEqual(
      expect.objectContaining({
        rawScore: 5,
        band: 2.5,
        finalScore: 2.5,
        correctCount: 5,
        totalCount: 6,
      }),
    );
  });

  it("returns the existing grade for idempotent scoring", async () => {
    const existingGrade = { id: "grade-1" };
    prisma.grade.findUnique.mockResolvedValueOnce(existingGrade as never);

    const result = await autoScoreSubmission("submission-1");

    expect(result).toBe(existingGrade);
    expect(prisma.submission.findFirst).not.toHaveBeenCalled();
    expect(gradeService.upsertGrade).not.toHaveBeenCalled();
  });
});

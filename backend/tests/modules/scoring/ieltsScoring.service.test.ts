/**
 * File: tests/modules/scoring/ieltsScoring.service.test.ts
 * Purpose: Validate IELTS reading/listening auto-scoring helpers.
 * Why: Ensures band conversion and idempotent scoring behave as expected.
 */
import { describe, expect, it, beforeEach, vi } from "vitest";
import { AssignmentType } from '../../../src/prisma/index.js';

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
const { getIeltsQuestionScoringEvidence } = await import(
  "../../../src/modules/scoring/ieltsScoring.utils.js"
);
const {
  calculateIeltsManualBand,
  validateIeltsCriterionBreakdown,
} = await import("../../../src/modules/scoring/ieltsManualGrading.js");

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

  it("scores teacher-authored multiple choice indexes against submitted option text", () => {
    const result = scoreIeltsSubmission({
      assignmentType: AssignmentType.reading,
      assignmentConfig: {
        version: 1,
        sections: [
          {
            id: "sec-mc",
            title: "Section MC",
            passage: "Passage text",
            questions: [
              {
                id: "q-mc",
                type: "multiple_choice",
                options: ["A", "B", "C"],
                correctAnswer: "1",
              },
            ],
          },
        ],
      },
      submissionPayload: {
        answers: [{ questionId: "q-mc", value: "B" }],
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        correctCount: 1,
        totalCount: 1,
      }),
    );
  });

  it("returns resolved multiple-choice evidence for teacher-authored answer indexes", () => {
    const evidence = getIeltsQuestionScoringEvidence({
      assignmentType: AssignmentType.reading,
      assignmentConfig: {
        version: 1,
        sections: [
          {
            id: "sec-mc",
            title: "Section MC",
            passage: "Passage text",
            questions: [
              {
                id: "q-mc",
                type: "multiple_choice",
                text: "Which option is correct?",
                options: ["A", "B", "C"],
                correctAnswer: "1",
              },
            ],
          },
        ],
      },
      submissionPayload: {
        answers: [{ questionId: "q-mc", value: "B" }],
      },
      questionId: "q-mc",
    });

    expect(evidence).toEqual(
      expect.objectContaining({
        acceptedAnswer: "B",
        studentAnswer: "B",
        deterministicResult: "correct",
      }),
    );
  });

  it("scores matching item and diagram label answer targets", () => {
    const result = scoreIeltsSubmission({
      assignmentType: AssignmentType.listening,
      assignmentConfig: {
        version: 1,
        sections: [
          {
            id: "sec-nested",
            title: "Section nested",
            audioFileId: null,
            questions: [
              {
                id: "q-match",
                type: "matching",
                correctAnswer: "",
                matchingOptions: [{ id: "h1", label: "Heading 1" }],
                matchingItems: [{ id: "item-1", statement: "First item", matchId: "h1" }],
              },
              {
                id: "q-diagram",
                type: "diagram_labeling",
                correctAnswer: "",
                diagramLabels: [
                  {
                    id: "label-1",
                    letter: "A",
                    position: "Top left",
                    answer: "intake valve",
                  },
                ],
              },
            ],
          },
        ],
      },
      submissionPayload: {
        answers: [
          { questionId: "item-1", value: "h1" },
          { questionId: "label-1", value: "Intake Valve" },
        ],
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        correctCount: 2,
        totalCount: 2,
      }),
    );
  });

  it("returns per-question deterministic evidence for objective explanations", () => {
    const evidence = getIeltsQuestionScoringEvidence({
      assignmentType: AssignmentType.reading,
      assignmentConfig: {
        version: 1,
        sections: [
          {
            id: "sec-1",
            title: "Passage 1",
            passage: "Paragraph B explains that rooftop gardens reduce heat.",
            questions: [
              {
                id: "q3",
                type: "sentence_completion",
                text: "Complete the sentence about urban cooling.",
                sentences: [
                  {
                    id: "q3-1",
                    text: "Rooftop gardens reduce ____.",
                    answer: "heat",
                  },
                ],
              },
            ],
          },
        ],
      },
      submissionPayload: {
        answers: [{ questionId: "q3-1", value: "noise" }],
      },
      questionId: "q3-1",
    });

    expect(evidence).toEqual({
      questionId: "q3-1",
      questionText: "Rooftop gardens reduce ____.",
      acceptedAnswer: "heat",
      studentAnswer: "noise",
      deterministicResult: "incorrect",
      sourceContext: {
        kind: "reading_passage",
        text: "Paragraph B explains that rooftop gardens reduce heat.",
      },
      sourceEvidenceCandidates: [
        {
          id: "q3-1-evidence-1",
          quote: "Paragraph B explains that rooftop gardens reduce heat.",
        },
      ],
      sourceEvidenceStatus: "available",
    });
  });

  it("marks objective explanation evidence unavailable when source text lacks the accepted answer", () => {
    const evidence = getIeltsQuestionScoringEvidence({
      assignmentType: AssignmentType.listening,
      assignmentConfig: {
        version: 1,
        sections: [
          {
            id: "sec-summary",
            title: "Listening Part 1",
            audioFileId: "99999999-9999-4999-8999-999999999999",
            transcript: "The speaker confirms the move-in date with the caller.",
            questions: [
              {
                id: "listening-date",
                type: "short_answer",
                text: "What is the move-in date?",
                answer: "14 July",
              },
            ],
          },
        ],
      },
      submissionPayload: {
        answers: [{ questionId: "listening-date", value: "15 July" }],
      },
      questionId: "listening-date",
    });

    expect(evidence).toEqual(
      expect.objectContaining({
        questionId: "listening-date",
        acceptedAnswer: "14 July",
        deterministicResult: "incorrect",
        sourceEvidenceCandidates: [],
        sourceEvidenceStatus: "insufficient_source_evidence",
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

describe("ieltsManualGrading", () => {
  it("rounds writing criterion averages to the nearest half band", () => {
    const breakdown = [
      { criterion: "Task Achievement", points: 6.5 },
      { criterion: "Coherence and Cohesion", points: 7 },
      { criterion: "Lexical Resource", points: 7.5 },
      { criterion: "Grammatical Range and Accuracy", points: 7 },
    ];

    validateIeltsCriterionBreakdown(AssignmentType.writing, breakdown);

    expect(calculateIeltsManualBand(breakdown)).toBe(7);
  });

  it("weights task-scoped writing Task 2 twice as much as Task 1", () => {
    const breakdown = [
      { criterion: "Task 1 - Task Achievement", points: 5 },
      { criterion: "Task 1 - Coherence and Cohesion", points: 5 },
      { criterion: "Task 1 - Lexical Resource", points: 5 },
      { criterion: "Task 1 - Grammatical Range and Accuracy", points: 5 },
      { criterion: "Task 2 - Task Response", points: 8 },
      { criterion: "Task 2 - Coherence and Cohesion", points: 8 },
      { criterion: "Task 2 - Lexical Resource", points: 8 },
      { criterion: "Task 2 - Grammatical Range and Accuracy", points: 8 },
    ];

    validateIeltsCriterionBreakdown(AssignmentType.writing, breakdown);

    expect(calculateIeltsManualBand(breakdown)).toBe(7);
  });

  it("accepts official speaking criteria and rejects writing-only criteria", () => {
    const speakingBreakdown = [
      { criterion: "Fluency and Coherence", points: 6.5 },
      { criterion: "Lexical Resource", points: 7 },
      { criterion: "Grammatical Range and Accuracy", points: 7 },
      { criterion: "Pronunciation", points: 6.5 },
    ];

    expect(() =>
      validateIeltsCriterionBreakdown(
        AssignmentType.speaking,
        speakingBreakdown,
      ),
    ).not.toThrow();

    expect(() =>
      validateIeltsCriterionBreakdown(AssignmentType.speaking, [
        { criterion: "Task Response", points: 7 },
        { criterion: "Coherence and Cohesion", points: 7 },
        { criterion: "Lexical Resource", points: 7 },
        { criterion: "Grammatical Range and Accuracy", points: 7 },
      ]),
    ).toThrow(/IELTS speaking criteria/);
  });

  it("rejects IELTS criteria outside half-band increments", () => {
    expect(() =>
      validateIeltsCriterionBreakdown(AssignmentType.writing, [
        { criterion: "Task Response", points: 6.25 },
        { criterion: "Coherence and Cohesion", points: 7 },
        { criterion: "Lexical Resource", points: 7 },
        { criterion: "Grammatical Range and Accuracy", points: 7 },
      ]),
    ).toThrow(/0\.5 increments/);
  });
});

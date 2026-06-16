/**
 * File: tests/modules/scoring/ieltsQuestionEvidence.test.ts
 * Purpose: Verify IELTS objective explanation evidence extraction.
 * Why: Generation should only queue when source-backed evidence candidates exist.
 */
import { describe, expect, it } from "vitest";
import { AssignmentType } from "../../../src/prisma/index.js";
import { buildExpectedAnswersFromConfig } from "../../../src/modules/scoring/ieltsQuestionEvidence.js";

describe("buildExpectedAnswersFromConfig", () => {
  it("builds source evidence candidates from answer-bearing reading spans", () => {
    const expectedAnswers = buildExpectedAnswersFromConfig(AssignmentType.reading, {
      version: 1,
      sections: [
        {
          id: "section-1",
          title: "Passage",
          passage:
            "Rising fares made commuters switch routes. The mayor announced bike lanes.",
          questions: [
            {
              id: "q1",
              type: "multiple_choice",
              text: "Why did commuters switch routes?",
              options: [
                "Bike lanes were announced.",
                "Rising fares made commuters switch routes.",
                "Parking was free.",
              ],
              correctAnswer: "1",
            },
          ],
        },
      ],
    });

    expect(expectedAnswers[0]).toMatchObject({
      acceptedAnswer: "Rising fares made commuters switch routes.",
      sourceEvidenceStatus: "available",
      sourceEvidenceCandidates: [
        {
          id: "q1-evidence-1",
          quote: "Rising fares made commuters switch routes.",
        },
      ],
    });
  });

  it("marks summary-only listening context insufficient when it lacks the accepted answer", () => {
    const expectedAnswers = buildExpectedAnswersFromConfig(AssignmentType.listening, {
      version: 1,
      sections: [
        {
          id: "section-1",
          title: "Listening",
          audioFileId: "99999999-9999-4999-8999-999999999999",
          transcript: "The adviser confirms the move-in date with the student.",
          questions: [
            {
              id: "q1",
              type: "completion",
              text: "What is the move-in date?",
              answer: "3 September",
            },
          ],
        },
      ],
    });

    expect(expectedAnswers[0]).toMatchObject({
      acceptedAnswer: "3 September",
      sourceEvidenceStatus: "insufficient_source_evidence",
      sourceEvidenceCandidates: [],
    });
  });
});

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

  it("does not use completion prompt text as source evidence when the answer is absent", () => {
    const expectedAnswers = buildExpectedAnswersFromConfig(AssignmentType.listening, {
      version: 1,
      sections: [
        {
          id: "section-1",
          title: "Listening",
          transcript: "The weekly rent is 200 pounds after the increase.",
          questions: [
            {
              id: "q1",
              type: "completion",
              text: "The weekly rent is ____ pounds.",
              answer: "185",
            },
          ],
        },
      ],
    });

    expect(expectedAnswers[0]).toMatchObject({
      acceptedAnswer: "185",
      sourceEvidenceStatus: "insufficient_source_evidence",
      sourceEvidenceCandidates: [],
    });
  });

  it("builds source evidence candidates for true/false statements without requiring the answer word", () => {
    const expectedAnswers = buildExpectedAnswersFromConfig(AssignmentType.reading, {
      version: 1,
      sections: [
        {
          id: "section-1",
          title: "Passage",
          passage:
            "Comparative audits found that combining shading with ventilation reduced classroom heat more consistently than single-system upgrades.",
          questions: [
            {
              id: "q1",
              type: "true_false_not_given",
              prompt:
                "Comparative audits found that combining shading with ventilation reduced classroom heat more consistently than single-system upgrades.",
              answer: "true",
              correctAnswer: "true",
            },
          ],
        },
      ],
    });

    expect(expectedAnswers[0]).toMatchObject({
      acceptedAnswer: "true",
      sourceEvidenceStatus: "available",
      sourceEvidenceCandidates: [
        {
          id: "q1-evidence-1",
          quote:
            "Comparative audits found that combining shading with ventilation reduced classroom heat more consistently than single-system upgrades.",
        },
      ],
    });
  });

  it("builds source evidence candidates for option text that paraphrases the source span", () => {
    const expectedAnswers = buildExpectedAnswersFromConfig(AssignmentType.reading, {
      version: 1,
      sections: [
        {
          id: "section-1",
          title: "Passage",
          passage:
            "Schools that adopted routine commissioning schedules and staff training maintained steadier indoor conditions.",
          questions: [
            {
              id: "q1",
              type: "multiple_choice",
              prompt: "What mainly distinguished schools that maintained gains?",
              options: [
                "They replaced all buildings.",
                "They adopted commissioning routines and staff training.",
                "They paused lessons during summer.",
              ],
              answer: "They adopted commissioning routines and staff training.",
            },
          ],
        },
      ],
    });

    expect(expectedAnswers[0]).toMatchObject({
      sourceEvidenceStatus: "available",
      sourceEvidenceCandidates: [
        {
          id: "q1-evidence-1",
          quote:
            "Schools that adopted routine commissioning schedules and staff training maintained steadier indoor conditions.",
        },
      ],
    });
  });

  it("builds source evidence candidates for valid one-word source answers", () => {
    const expectedAnswers = buildExpectedAnswersFromConfig(AssignmentType.listening, {
      version: 1,
      sections: [
        {
          id: "section-1",
          title: "Listening",
          transcript:
            "The adviser confirms that the student must show a passport on arrival.",
          questions: [
            {
              id: "q1",
              type: "short_answer",
              text: "Which identification document must be shown on arrival?",
              answer: "passport",
            },
          ],
        },
      ],
    });

    expect(expectedAnswers[0]).toMatchObject({
      acceptedAnswer: "passport",
      sourceEvidenceStatus: "available",
      sourceEvidenceCandidates: [
        {
          id: "q1-evidence-1",
          quote:
            "The adviser confirms that the student must show a passport on arrival.",
        },
      ],
    });
  });

  it("keeps decimal answers in complete source evidence spans", () => {
    const expectedAnswers = buildExpectedAnswersFromConfig(AssignmentType.listening, {
      version: 1,
      sections: [
        {
          id: "section-1",
          title: "Listening",
          transcript:
            "The measured rate was 3.5 percent after calibration. The baseline was lower.",
          questions: [
            {
              id: "q1",
              type: "completion",
              text: "The measured rate was ____ percent.",
              answer: "3.5",
            },
          ],
        },
      ],
    });

    expect(expectedAnswers[0]).toMatchObject({
      acceptedAnswer: "3.5",
      sourceEvidenceStatus: "available",
      sourceEvidenceCandidates: [
        {
          id: "q1-evidence-1",
          quote: "The measured rate was 3.5 percent after calibration.",
        },
      ],
    });
  });

  it("keeps time abbreviations in complete source evidence spans", () => {
    const expectedAnswers = buildExpectedAnswersFromConfig(AssignmentType.listening, {
      version: 1,
      sections: [
        {
          id: "section-1",
          title: "Listening",
          transcript:
            "Quiet hours begin at 10 p.m. Laundry remains open during the day.",
          questions: [
            {
              id: "q1",
              type: "completion",
              text: "Quiet hours begin at ____ p.m.",
              answer: "10",
            },
          ],
        },
      ],
    });

    expect(expectedAnswers[0]).toMatchObject({
      acceptedAnswer: "10",
      sourceEvidenceStatus: "available",
      sourceEvidenceCandidates: [
        {
          id: "q1-evidence-1",
          quote: "Quiet hours begin at 10 p.m.",
        },
      ],
    });
  });

  it.each([
    {
      label: "titles",
      transcript:
        "The appointment is with Dr. Patel in the west clinic. Bring the referral form.",
      prompt: "Who is the appointment with?",
      answer: "Dr. Patel",
      quote: "The appointment is with Dr. Patel in the west clinic.",
    },
    {
      label: "number markers",
      transcript:
        "The locker number is No. 7 near the main entrance. The key is ready.",
      prompt: "Which locker number is assigned?",
      answer: "No. 7",
      quote: "The locker number is No. 7 near the main entrance.",
    },
    {
      label: "month abbreviations",
      transcript:
        "The final interview is on Sept. 3 after orientation. The email confirms this.",
      prompt: "When is the final interview?",
      answer: "Sept. 3",
      quote: "The final interview is on Sept. 3 after orientation.",
    },
    {
      label: "place abbreviations",
      transcript:
        "The meeting is at St. John's Hall beside the library. Signs will be posted.",
      prompt: "Where is the meeting?",
      answer: "St. John's Hall",
      quote: "The meeting is at St. John's Hall beside the library.",
    },
  ])("keeps common abbreviation source evidence spans: $label", (fixture) => {
    const expectedAnswers = buildExpectedAnswersFromConfig(AssignmentType.listening, {
      version: 1,
      sections: [
        {
          id: "section-1",
          title: "Listening",
          transcript: fixture.transcript,
          questions: [
            {
              id: "q1",
              type: "short_answer",
              text: fixture.prompt,
              answer: fixture.answer,
            },
          ],
        },
      ],
    });

    expect(expectedAnswers[0]).toMatchObject({
      acceptedAnswer: fixture.answer,
      sourceEvidenceStatus: "available",
      sourceEvidenceCandidates: [
        {
          id: "q1-evidence-1",
          quote: fixture.quote,
        },
      ],
    });
  });
});

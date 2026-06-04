/**
 * File: tests/modules/assignments/ielts.ai-policy.test.ts
 * Purpose: Validate assignment AI policy rules inside IELTS assignment configs.
 * Why: Keeps teacher-controlled AI modes constrained by assignment type.
 */
import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { AssignmentType } from "../../../src/prisma/index.js";
import { parseAssignmentConfigForType } from "../../../src/modules/assignments/ielts.schema.js";

const aiOffPolicy = {
  writingFeedbackMode: "off",
  objectiveExplanations: "off",
  providerTier: "auto",
};

const readingConfig = {
  version: 1,
  sections: [
    {
      id: "section-1",
      title: "Passage 1",
      passage: "Read this passage.",
      questions: [],
    },
  ],
};

const listeningConfig = {
  version: 1,
  sections: [
    {
      id: "section-1",
      title: "Section 1",
      audioFileId: null,
      questions: [],
    },
  ],
};

const writingConfig = {
  version: 1,
  task1: {
    prompt: "Summarize the chart.",
  },
  task2: {
    prompt: "Discuss both views.",
  },
};

const speakingConfig = {
  version: 1,
  part1: {
    questions: ["Where do you live?"],
  },
  part2: {
    cueCard: {
      topic: "Describe a useful skill.",
      bulletPoints: ["what it is"],
    },
    prepSeconds: 60,
    talkSeconds: 120,
  },
  part3: {
    questions: ["Why do people learn new skills?"],
  },
};

describe("IELTS assignment AI policy", () => {
  it("defaults existing configs without AI policy to AI off", () => {
    const parsed = parseAssignmentConfigForType(
      AssignmentType.reading,
      readingConfig,
    ) as Record<string, unknown>;

    expect(parsed.aiPolicy).toEqual(aiOffPolicy);
  });

  it("allows on-demand objective explanations for reading and listening", () => {
    const policy = {
      writingFeedbackMode: "off",
      objectiveExplanations: "on_demand_student_visible",
      providerTier: "low_cost",
    };

    expect(
      parseAssignmentConfigForType(AssignmentType.reading, {
        ...readingConfig,
        aiPolicy: policy,
      }),
    ).toEqual(expect.objectContaining({ aiPolicy: policy }));
    expect(
      parseAssignmentConfigForType(AssignmentType.listening, {
        ...listeningConfig,
        aiPolicy: policy,
      }),
    ).toEqual(expect.objectContaining({ aiPolicy: policy }));
  });

  it("allows teacher-reviewed and instant-visible writing feedback for writing", () => {
    for (const writingFeedbackMode of [
      "teacher_reviewed",
      "instant_student_visible",
    ]) {
      const policy = {
        writingFeedbackMode,
        objectiveExplanations: "off",
        providerTier: "premium",
      };

      expect(
        parseAssignmentConfigForType(AssignmentType.writing, {
          ...writingConfig,
          aiPolicy: policy,
        }),
      ).toEqual(expect.objectContaining({ aiPolicy: policy }));
    }
  });

  it("rejects AI modes that do not match the assignment type", () => {
    expect(() =>
      parseAssignmentConfigForType(AssignmentType.reading, {
        ...readingConfig,
        aiPolicy: {
          writingFeedbackMode: "teacher_reviewed",
          objectiveExplanations: "off",
          providerTier: "auto",
        },
      }),
    ).toThrow(ZodError);
    expect(() =>
      parseAssignmentConfigForType(AssignmentType.writing, {
        ...writingConfig,
        aiPolicy: {
          writingFeedbackMode: "off",
          objectiveExplanations: "on_demand_student_visible",
          providerTier: "auto",
        },
      }),
    ).toThrow(ZodError);
    expect(() =>
      parseAssignmentConfigForType(AssignmentType.speaking, {
        ...speakingConfig,
        aiPolicy: {
          writingFeedbackMode: "off",
          objectiveExplanations: "on_demand_student_visible",
          providerTier: "auto",
        },
      }),
    ).toThrow(ZodError);
  });
});

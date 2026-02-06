/**
 * File: src/prisma/seeds/ieltsOfficialShared.ts
 * Purpose: Provide shared constants and helpers for official IELTS seed fixtures.
 * Why: Keeps full/lite builders consistent across reading, listening, writing, and speaking.
 */
import type { Prisma } from "../generated.js";

export type IeltsFixtureVariant = "full" | "lite";

export const nullAttempts = { maxAttempts: null };

export const buildMultipleChoiceQuestion = (
  id: string,
  prompt: string,
  answer: string,
  optionStem: string,
): Prisma.InputJsonObject => {
  const options = [
    `${optionStem} A`,
    answer,
    `${optionStem} C`,
    `${optionStem} D`,
  ];
  return {
    id,
    type: "multiple_choice",
    prompt,
    options,
    answer,
    correctAnswer: answer,
  };
};

export const buildTrueFalseNotGivenQuestion = (
  id: string,
  prompt: string,
  answer: "true" | "false" | "not_given",
): Prisma.InputJsonObject => ({
  id,
  type: "true_false_not_given",
  prompt,
  options: ["True", "False", "Not Given"],
  answer,
  correctAnswer: answer,
});

export const buildShortAnswerQuestion = (
  id: string,
  prompt: string,
  answer: string,
): Prisma.InputJsonObject => ({
  id,
  type: "short_answer",
  prompt,
  answer,
  correctAnswer: answer,
});

export const buildCompletionQuestion = (
  id: string,
  prompt: string,
  answer: string,
): Prisma.InputJsonObject => ({
  id,
  type: "completion",
  prompt,
  format: "note",
  answer,
  correctAnswer: answer,
});

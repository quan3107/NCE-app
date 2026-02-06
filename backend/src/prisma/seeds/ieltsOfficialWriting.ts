/**
 * File: src/prisma/seeds/ieltsOfficialWriting.ts
 * Purpose: Build official-structure IELTS Writing assignment configs.
 * Why: Keeps Academic and General Training seeds aligned to 2-task/60-minute requirements.
 */
import type { Prisma } from "../generated.js";
import { nullAttempts, type IeltsFixtureVariant } from "./ieltsOfficialShared.js";

export function buildWritingAcademicConfigOfficial(
  variant: IeltsFixtureVariant = "full",
): Prisma.InputJsonObject {
  const full = variant === "full";
  return {
    version: 1,
    timing: { enabled: true, durationMinutes: 60, enforce: false },
    instructions:
      "IELTS Academic Writing format: complete Task 1 and Task 2 in 60 minutes. Write at least 150 words for Task 1 and at least 250 words for Task 2.",
    attempts: nullAttempts,
    task1: {
      prompt: full
        ? "The line graph shows changes in public transport usage across four city zones between 2005 and 2025. Summarise the information by selecting and reporting the main features, and make comparisons where relevant."
        : "The table compares household energy use by source in three regions in 2010 and 2025. Summarise the key features and make relevant comparisons.",
      imageFileId: null,
      visualType: full ? "line_graph" : "table",
      showSampleTiming: "after_submission",
    },
    task2: {
      prompt: full
        ? "Some people believe governments should prioritise investment in public transport, while others argue road expansion is more important. Discuss both views and give your own opinion."
        : "Many people think remote work is beneficial for employees and cities. To what extent do you agree or disagree?",
      showSampleTiming: "after_submission",
    },
  };
}

export function buildWritingGeneralConfigOfficial(
  variant: IeltsFixtureVariant = "full",
): Prisma.InputJsonObject {
  const full = variant === "full";
  return {
    version: 1,
    timing: { enabled: true, durationMinutes: 60, enforce: false },
    instructions:
      "IELTS General Training Writing format: complete Task 1 and Task 2 in 60 minutes. Write at least 150 words for Task 1 and at least 250 words for Task 2.",
    attempts: nullAttempts,
    task1: {
      prompt: full
        ? "You recently used a local sports centre and experienced several problems. Write a letter to the manager. In your letter: describe the problems, explain how they affected you, and say what action you want the manager to take."
        : "You borrowed an item from a friend and accidentally damaged it. Write a letter to your friend. In your letter: explain what happened, apologise, and suggest how you will resolve the issue.",
      imageFileId: null,
      showSampleTiming: "after_submission",
    },
    task2: {
      prompt: full
        ? "Online services are replacing many face-to-face services such as banking, shopping, and public administration. Is this a positive or negative development?"
        : "Some people think young adults should be required to do unpaid community service. Discuss both views and give your opinion.",
      showSampleTiming: "after_submission",
    },
  };
}

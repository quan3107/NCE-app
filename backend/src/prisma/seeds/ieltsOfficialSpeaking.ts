/**
 * File: src/prisma/seeds/ieltsOfficialSpeaking.ts
 * Purpose: Build official-structure IELTS Speaking assignment configs.
 * Why: Ensures 3-part speaking seeds use official prep/talk timing and total duration range.
 */
import type { Prisma } from "../generated.js";
import { nullAttempts, type IeltsFixtureVariant } from "./ieltsOfficialShared.js";

export function buildSpeakingConfigOfficial(
  variant: IeltsFixtureVariant = "full",
): Prisma.InputJsonObject {
  const full = variant === "full";
  return {
    version: 1,
    timing: { enabled: true, durationMinutes: 14, enforce: false },
    instructions:
      "IELTS Speaking format: complete Part 1, Part 2, and Part 3 in one recording session (total interview length 11-14 minutes).",
    attempts: nullAttempts,
    part1: {
      questions: full
        ? [
            "What do you enjoy doing after work or study?",
            "How often do you use public transport?",
            "What kind of weather do you prefer?",
            "Do you think your daily routine will change in the future?",
          ]
        : [
            "Do you like learning new skills?",
            "How do you usually spend weekends?",
            "What kind of books or media do you prefer?",
            "Would you like to change anything about your hometown?",
          ],
    },
    part2: {
      cueCard: {
        topic: full
          ? "Describe a place you visited that taught you something new"
          : "Describe a useful thing you learned from another person",
        bulletPoints: full
          ? [
              "Where the place is",
              "When and why you visited",
              "What you learned there",
              "Why this experience was memorable",
            ]
          : [
              "What it was",
              "Who taught you",
              "How you learned it",
              "Why it is useful for you now",
            ],
      },
      prepSeconds: 60,
      talkSeconds: 120,
    },
    part3: {
      questions: full
        ? [
            "How can travel influence a person's perspective?",
            "Do communities learn better from formal programs or lived experiences?",
            "Should governments fund more local learning spaces?",
            "How might technology change informal learning in the next decade?",
          ]
        : [
            "How do adults and children differ when learning practical skills?",
            "What role should schools play in teaching life skills?",
            "Can online communities replace face-to-face mentoring?",
            "What makes people continue learning later in life?",
          ],
    },
  };
}

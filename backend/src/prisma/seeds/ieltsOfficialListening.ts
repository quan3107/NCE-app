/**
 * File: src/prisma/seeds/ieltsOfficialListening.ts
 * Purpose: Build official-structure IELTS Listening assignment configs.
 * Why: Ensures seeds always match 4 sections, 40 questions, and computer-delivered timing notes.
 */
import type { Prisma } from "../generated/client/client.js";
import {
  buildCompletionQuestion,
  buildMultipleChoiceQuestion,
  buildShortAnswerQuestion,
  nullAttempts,
  type IeltsFixtureVariant,
} from "./ieltsOfficialShared.js";

const QUESTIONS_PER_SECTION = 10;
const LISTENING_SECTIONS = 4;

function buildSectionQuestions(
  sectionIndex: number,
  variant: IeltsFixtureVariant,
): Prisma.InputJsonObject[] {
  const sectionNumber = sectionIndex + 1;
  return Array.from({ length: QUESTIONS_PER_SECTION }, (_, offset) => {
    const questionNumber = sectionIndex * QUESTIONS_PER_SECTION + offset + 1;
    const id = `listening-${variant}-s${sectionNumber}-q${questionNumber}`;

    if (offset < 3) {
      return buildCompletionQuestion(
        id,
        `Question ${questionNumber}: complete the notes from Section ${sectionNumber}.`,
        `section-${sectionNumber}-note-${offset + 1}`,
      );
    }

    if (offset === 9) {
      return buildShortAnswerQuestion(
        id,
        `Question ${questionNumber}: write a short answer from Section ${sectionNumber}.`,
        `section-${sectionNumber}-short-answer`,
      );
    }

    if (variant === "full") {
      return buildMultipleChoiceQuestion(
        id,
        `Question ${questionNumber}: choose the correct option from Section ${sectionNumber}.`,
        `Section ${sectionNumber} answer ${questionNumber}B`,
        `Section ${sectionNumber} option ${questionNumber}`,
      );
    }

    return buildCompletionQuestion(
      id,
      `Question ${questionNumber}: complete the detail from Section ${sectionNumber}.`,
      `section-${sectionNumber}-detail-${offset + 1}`,
    );
  });
}

function buildListeningConfig(variant: IeltsFixtureVariant): Prisma.InputJsonObject {
  const sections = Array.from({ length: LISTENING_SECTIONS }, (_, sectionIndex) => ({
    id: `listening-${variant}-section-${sectionIndex + 1}`,
    title: `Section ${sectionIndex + 1}`,
    audioFileId: null,
    transcript:
      variant === "full"
        ? `Official-style transcript scaffold for Section ${sectionIndex + 1}.`
        : `Concise transcript scaffold for Section ${sectionIndex + 1}.`,
    playback: { limitPlays: 1 },
    questions: buildSectionQuestions(sectionIndex, variant),
  }));

  return {
    version: 1,
    timing: { enabled: true, durationMinutes: 30, enforce: true },
    instructions:
      "IELTS Listening computer-delivered format: 4 sections and 40 questions in 30 minutes, followed by short answer-check time (no 10-minute paper transfer sheet).",
    attempts: nullAttempts,
    sections,
  };
}

export function buildListeningConfigOfficialFullComputer(): Prisma.InputJsonObject {
  return buildListeningConfig("full");
}

export function buildListeningConfigOfficialLiteComputer(): Prisma.InputJsonObject {
  return buildListeningConfig("lite");
}

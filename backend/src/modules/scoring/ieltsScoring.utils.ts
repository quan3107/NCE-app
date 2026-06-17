/**
 * File: src/modules/scoring/ieltsScoring.utils.ts
 * Purpose: Score IELTS reading/listening submissions using answer keys.
 * Why: Keeps scoring logic isolated from persistence workflows.
 */
import { AssignmentType } from "../../prisma/index.js";
import {
  parseAssignmentConfigForType,
  parseSubmissionPayloadForType,
} from "../assignments/ielts.schema.js";
import {
  getIeltsBandForRawScore,
  type ReadingModule,
} from "./ieltsBanding.js";
import {
  buildExpectedAnswersFromConfig,
  type IeltsQuestionScoringEvidence,
} from "./ieltsQuestionEvidence.js";
type AnswerEntry = {
  questionId: string;
  value: unknown;
};
export type IeltsAutoScoreResult = {
  rawScore: number;
  finalScore: number;
  band: number;
  correctCount: number;
  totalCount: number;
};
export type {
  IeltsObjectiveSourceContext,
  IeltsQuestionScoringEvidence,
} from "./ieltsQuestionEvidence.js";

export const AUTO_SCORE_TYPES = new Set<AssignmentType>([
  AssignmentType.reading,
  AssignmentType.listening,
]);
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeString(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function normalizeComparable(value: unknown): string | null {
  if (typeof value === "string") {
    return normalizeString(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toString();
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return null;
}

function normalizeList(values: unknown[]): string[] {
  return values
    .map((value) => normalizeComparable(value))
    .filter((value): value is string => value !== null);
}

function isCorrectAnswer(expected: unknown, actual: unknown): boolean {
  if (Array.isArray(expected)) {
    const expectedList = normalizeList(expected);
    if (expectedList.length === 0) {
      return false;
    }
    if (Array.isArray(actual)) {
      const actualList = normalizeList(actual);
      if (actualList.length !== expectedList.length) {
        return false;
      }
      return expectedList.every((value) => actualList.includes(value));
    }
    const normalizedActual = normalizeComparable(actual);
    if (!normalizedActual) {
      return false;
    }
    return expectedList.includes(normalizedActual);
  }

  const normalizedExpected = normalizeComparable(expected);
  const normalizedActual = normalizeComparable(actual);
  if (!normalizedExpected || !normalizedActual) {
    return false;
  }
  return normalizedExpected === normalizedActual;
}

function buildAnswerMap(answers: AnswerEntry[]): Map<string, unknown> {
  const answerMap = new Map<string, unknown>();
  for (const answer of answers) {
    if (answer?.questionId) {
      answerMap.set(answer.questionId, answer.value);
    }
  }
  return answerMap;
}

function resolveReadingModule(): ReadingModule {
  // IELTS reading assignments are Academic-only for this project.
  return "academic";
}

export function scoreIeltsSubmission(input: {
  assignmentType: AssignmentType;
  assignmentConfig: unknown;
  submissionPayload: unknown;
}): IeltsAutoScoreResult | null {
  if (!AUTO_SCORE_TYPES.has(input.assignmentType)) {
    return null;
  }
  if (!input.assignmentConfig) {
    return null;
  }

  const parsedConfig = parseAssignmentConfigForType(
    input.assignmentType,
    input.assignmentConfig,
  );
  if (!isRecord(parsedConfig)) {
    return null;
  }
  const parsedPayload = parseSubmissionPayloadForType(
    input.assignmentType,
    input.submissionPayload,
  );
  if (!isRecord(parsedPayload)) {
    return null;
  }

  const expectedAnswers = buildExpectedAnswersFromConfig(
    input.assignmentType,
    parsedConfig,
  );
  if (expectedAnswers.length === 0) {
    return null;
  }

  const answers = Array.isArray(parsedPayload.answers)
    ? (parsedPayload.answers as AnswerEntry[])
    : [];
  const answerMap = buildAnswerMap(answers);
  let correctCount = 0;
  for (const expected of expectedAnswers) {
    const actual = expected.keys
      .map((key) => answerMap.get(key))
      .find((value) => value !== undefined);
    if (
      actual !== undefined &&
      isCorrectAnswer(expected.comparableAnswer, actual)
    ) {
      correctCount += 1;
    }
  }

  const rawScore = correctCount;
  const readingModule = resolveReadingModule();
  const band = getIeltsBandForRawScore(
    input.assignmentType,
    rawScore,
    { readingModule },
  );
  return {
    rawScore,
    finalScore: band,
    band,
    correctCount,
    totalCount: expectedAnswers.length,
  };
}

export function getIeltsQuestionScoringEvidence(input: {
  assignmentType: AssignmentType;
  assignmentConfig: unknown;
  submissionPayload: unknown;
  questionId: string;
}): IeltsQuestionScoringEvidence | null {
  if (!AUTO_SCORE_TYPES.has(input.assignmentType)) {
    return null;
  }

  const parsedConfig = parseAssignmentConfigForType(
    input.assignmentType,
    input.assignmentConfig,
  );
  const parsedPayload = parseSubmissionPayloadForType(
    input.assignmentType,
    input.submissionPayload,
  );

  if (!isRecord(parsedConfig) || !isRecord(parsedPayload)) {
    return null;
  }

  const expectedAnswers = buildExpectedAnswersFromConfig(
    input.assignmentType,
    parsedConfig,
  );
  const expected = expectedAnswers.find((candidate) =>
    candidate.keys.includes(input.questionId),
  );

  if (!expected) {
    return null;
  }

  const answers = Array.isArray(parsedPayload.answers)
    ? (parsedPayload.answers as AnswerEntry[])
    : [];
  const answerMap = buildAnswerMap(answers);
  const studentAnswer = expected.keys
    .map((key) => answerMap.get(key))
    .find((value) => value !== undefined);

  return {
    questionId: input.questionId,
    questionText: expected.questionText,
    acceptedAnswer: expected.acceptedAnswer,
    studentAnswer,
    deterministicResult:
      studentAnswer !== undefined &&
      isCorrectAnswer(expected.comparableAnswer, studentAnswer)
        ? "correct"
        : "incorrect",
    sourceEvidenceCandidates: expected.sourceEvidenceCandidates,
    sourceEvidenceStatus: expected.sourceEvidenceStatus,
    ...(expected.sourceContext ? { sourceContext: expected.sourceContext } : {}),
  };
}

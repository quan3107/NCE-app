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
type AnswerEntry = {
  questionId: string;
  value: unknown;
};
type ExpectedAnswer = {
  keys: string[];
  expected: unknown;
};
export type IeltsAutoScoreResult = {
  rawScore: number;
  finalScore: number;
  band: number;
  correctCount: number;
  totalCount: number;
};

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

function getAnswerValue(record: Record<string, unknown>): unknown {
  if ("answer" in record) {
    return record.answer;
  }
  if ("matchId" in record) {
    return record.matchId;
  }
  if ("answerParagraph" in record) {
    return record.answerParagraph;
  }
  if ("answerHeadingId" in record) {
    return record.answerHeadingId;
  }
  if ("answerFeatureId" in record) {
    return record.answerFeatureId;
  }
  if ("answerId" in record) {
    return record.answerId;
  }
  if ("correctAnswer" in record) {
    return record.correctAnswer;
  }
  return undefined;
}

function expandOptionAnswer(
  question: Record<string, unknown>,
  expected: unknown,
): unknown {
  if (typeof expected !== "string" || !Array.isArray(question.options)) {
    return expected;
  }

  const options = question.options.filter(
    (option): option is string => typeof option === "string",
  );
  const variants = new Set<string>([expected]);
  const optionIndex = Number(expected);
  if (
    Number.isInteger(optionIndex) &&
    optionIndex >= 0 &&
    optionIndex < options.length
  ) {
    variants.add(options[optionIndex] ?? expected);
  }

  const matchingIndex = options.findIndex(
    (option) => normalizeString(option) === normalizeString(expected),
  );
  if (matchingIndex >= 0) {
    variants.add(String(matchingIndex));
  }

  return variants.size > 1 ? Array.from(variants) : expected;
}

function addExpectedAnswer(
  expectedAnswers: ExpectedAnswer[],
  keys: string[],
  expected: unknown,
): void {
  const trimmedKeys = keys.filter((key) => key.length > 0);
  if (trimmedKeys.length === 0) {
    return;
  }
  if (expected === undefined) {
    return;
  }
  if (typeof expected === "string" && expected.trim() === "") {
    return;
  }
  expectedAnswers.push({ keys: trimmedKeys, expected });
}

function extractExpectedAnswersFromQuestion(
  question: Record<string, unknown>,
): ExpectedAnswer[] {
  const expectedAnswers: ExpectedAnswer[] = [];
  const questionId =
    typeof question.id === "string" ? question.id : "";
  const directAnswer = getAnswerValue(question);
  if (questionId) {
    addExpectedAnswer(
      expectedAnswers,
      [questionId],
      expandOptionAnswer(question, directAnswer),
    );
  }

  const sentences = Array.isArray(question.sentences)
    ? question.sentences
    : [];
  for (const sentence of sentences) {
    if (!isRecord(sentence)) {
      continue;
    }
    const sentenceId =
      typeof sentence.id === "string" ? sentence.id : "";
    const sentenceAnswer = getAnswerValue(sentence);
    if (sentenceId) {
      addExpectedAnswer(expectedAnswers, [sentenceId], sentenceAnswer);
    }
  }

  const statements = Array.isArray(question.statements)
    ? question.statements
    : [];
  for (const statement of statements) {
    if (!isRecord(statement)) {
      continue;
    }
    const statementId =
      typeof statement.id === "string" ? statement.id : "";
    const statementAnswer = getAnswerValue(statement);
    if (statementId) {
      addExpectedAnswer(expectedAnswers, [statementId], statementAnswer);
    }
  }

  const items = Array.isArray(question.items) ? question.items : [];
  for (const item of items) {
    if (!isRecord(item)) {
      continue;
    }
    const itemId = typeof item.id === "string" ? item.id : "";
    const paragraphId =
      typeof item.paragraph === "string" ? item.paragraph : "";
    const itemAnswer = getAnswerValue(item);
    if (itemId) {
      addExpectedAnswer(expectedAnswers, [itemId], itemAnswer);
      continue;
    }
    if (paragraphId) {
      const keys = questionId
        ? [paragraphId, `${questionId}:${paragraphId}`]
        : [paragraphId];
      addExpectedAnswer(expectedAnswers, keys, itemAnswer);
    }
  }

  const matchingItems = Array.isArray(question.matchingItems)
    ? question.matchingItems
    : [];
  for (const item of matchingItems) {
    if (!isRecord(item)) {
      continue;
    }
    const itemId = typeof item.id === "string" ? item.id : "";
    const itemAnswer = getAnswerValue(item);
    if (itemId) {
      addExpectedAnswer(expectedAnswers, [itemId], itemAnswer);
    }
  }

  const diagramLabels = Array.isArray(question.diagramLabels)
    ? question.diagramLabels
    : [];
  for (const label of diagramLabels) {
    if (!isRecord(label)) {
      continue;
    }
    const labelId = typeof label.id === "string" ? label.id : "";
    const labelAnswer = getAnswerValue(label);
    if (labelId) {
      addExpectedAnswer(expectedAnswers, [labelId], labelAnswer);
    }
  }

  return expectedAnswers;
}

function buildExpectedAnswersFromConfig(
  assignmentConfig: Record<string, unknown>,
): ExpectedAnswer[] {
  const expectedAnswers: ExpectedAnswer[] = [];
  const sections = Array.isArray(assignmentConfig.sections)
    ? assignmentConfig.sections
    : [];
  for (const section of sections) {
    if (!isRecord(section)) {
      continue;
    }
    const questions = Array.isArray(section.questions)
      ? section.questions
      : [];
    for (const question of questions) {
      if (!isRecord(question)) {
        continue;
      }
      expectedAnswers.push(
        ...extractExpectedAnswersFromQuestion(question),
      );
    }
  }
  return expectedAnswers;
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

  const expectedAnswers = buildExpectedAnswersFromConfig(parsedConfig);
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
    if (actual !== undefined && isCorrectAnswer(expected.expected, actual)) {
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

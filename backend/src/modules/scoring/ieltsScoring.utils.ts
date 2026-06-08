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
  acceptedAnswer: string;
  questionText: string;
  sourceContext?: IeltsObjectiveSourceContext;
};
export type IeltsAutoScoreResult = {
  rawScore: number;
  finalScore: number;
  band: number;
  correctCount: number;
  totalCount: number;
};
export type IeltsObjectiveSourceContext =
  | {
      kind: "reading_passage" | "listening_transcript";
      text: string;
    }
  | {
      kind: "listening_audio_file";
      audioFileId: string;
    };
export type IeltsQuestionScoringEvidence = {
  questionId: string;
  questionText: string;
  acceptedAnswer: string;
  studentAnswer: unknown;
  deterministicResult: "correct" | "incorrect";
  sourceContext?: IeltsObjectiveSourceContext;
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
  acceptedAnswer: unknown,
  questionText: string,
  sourceContext: IeltsObjectiveSourceContext | undefined,
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
  expectedAnswers.push({
    keys: trimmedKeys,
    expected,
    acceptedAnswer: displayAnswer(acceptedAnswer),
    questionText,
    sourceContext,
  });
}

function displayTextFromRecord(record: Record<string, unknown>): string {
  const candidates = [
    record.text,
    record.prompt,
    record.statement,
    record.label,
    record.position,
    record.title,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return "";
}

function displayAnswer(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(displayAnswer).filter(Boolean).join(" / ");
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  ) {
    return String(value);
  }

  if (value !== undefined) {
    return JSON.stringify(value) ?? "";
  }

  return "";
}

function extractExpectedAnswersFromQuestion(
  question: Record<string, unknown>,
  sourceContext?: IeltsObjectiveSourceContext,
): ExpectedAnswer[] {
  const expectedAnswers: ExpectedAnswer[] = [];
  const questionId =
    typeof question.id === "string" ? question.id : "";
  const parentQuestionText = displayTextFromRecord(question);
  const directAnswer = getAnswerValue(question);
  if (questionId) {
    addExpectedAnswer(
      expectedAnswers,
      [questionId],
      expandOptionAnswer(question, directAnswer),
      directAnswer,
      parentQuestionText,
      sourceContext,
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
      addExpectedAnswer(
        expectedAnswers,
        [sentenceId],
        sentenceAnswer,
        sentenceAnswer,
        displayTextFromRecord(sentence) || parentQuestionText,
        sourceContext,
      );
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
      addExpectedAnswer(
        expectedAnswers,
        [statementId],
        statementAnswer,
        statementAnswer,
        displayTextFromRecord(statement) || parentQuestionText,
        sourceContext,
      );
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
      addExpectedAnswer(
        expectedAnswers,
        [itemId],
        itemAnswer,
        itemAnswer,
        displayTextFromRecord(item) || parentQuestionText,
        sourceContext,
      );
      continue;
    }
    if (paragraphId) {
      const keys = questionId
        ? [paragraphId, `${questionId}:${paragraphId}`]
        : [paragraphId];
      addExpectedAnswer(
        expectedAnswers,
        keys,
        itemAnswer,
        itemAnswer,
        displayTextFromRecord(item) || parentQuestionText,
        sourceContext,
      );
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
      addExpectedAnswer(
        expectedAnswers,
        [itemId],
        itemAnswer,
        itemAnswer,
        displayTextFromRecord(item) || parentQuestionText,
        sourceContext,
      );
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
      addExpectedAnswer(
        expectedAnswers,
        [labelId],
        labelAnswer,
        labelAnswer,
        displayTextFromRecord(label) || parentQuestionText,
        sourceContext,
      );
    }
  }

  return expectedAnswers;
}

function sourceContextFromSection(
  assignmentType: AssignmentType,
  section: Record<string, unknown>,
): IeltsObjectiveSourceContext | undefined {
  if (assignmentType === AssignmentType.reading) {
    return typeof section.passage === "string" && section.passage.trim()
      ? {
          kind: "reading_passage",
          text: section.passage.trim(),
        }
      : undefined;
  }

  if (assignmentType === AssignmentType.listening) {
    if (typeof section.transcript === "string" && section.transcript.trim()) {
      return {
        kind: "listening_transcript",
        text: section.transcript.trim(),
      };
    }

    if (typeof section.audioFileId === "string" && section.audioFileId.trim()) {
      return {
        kind: "listening_audio_file",
        audioFileId: section.audioFileId.trim(),
      };
    }
  }

  return undefined;
}

function buildExpectedAnswersFromConfig(
  assignmentType: AssignmentType,
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
    const sourceContext = sourceContextFromSection(assignmentType, section);
    for (const question of questions) {
      if (!isRecord(question)) {
        continue;
      }
      expectedAnswers.push(
        ...extractExpectedAnswersFromQuestion(question, sourceContext),
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
      studentAnswer !== undefined && isCorrectAnswer(expected.expected, studentAnswer)
        ? "correct"
        : "incorrect",
    ...(expected.sourceContext ? { sourceContext: expected.sourceContext } : {}),
  };
}

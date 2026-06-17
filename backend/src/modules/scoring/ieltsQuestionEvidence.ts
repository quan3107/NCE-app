/**
 * File: src/modules/scoring/ieltsQuestionEvidence.ts
 * Purpose: Build per-question IELTS scoring evidence for objective explanations.
 * Why: AI prompt evidence needs richer wording than the raw grading answer keys.
 */
import { AssignmentType } from "../../prisma/index.js";

export type IeltsObjectiveSourceContext =
  | {
      kind: "reading_passage" | "listening_transcript";
      text: string;
    }
  | {
      kind: "listening_audio_file";
      audioFileId: string;
    };

export type IeltsSourceEvidenceCandidate = {
  id: string;
  quote: string;
};

export type IeltsQuestionScoringEvidence = {
  questionId: string;
  questionText: string;
  acceptedAnswer: string;
  studentAnswer: unknown;
  deterministicResult: "correct" | "incorrect";
  sourceContext?: IeltsObjectiveSourceContext;
  sourceEvidenceCandidates: IeltsSourceEvidenceCandidate[];
  sourceEvidenceStatus: "available" | "insufficient_source_evidence";
};

export type ExpectedAnswer = {
  keys: string[];
  comparableAnswer: unknown;
  acceptedAnswer: string;
  questionText: string;
  sourceContext?: IeltsObjectiveSourceContext;
  sourceEvidenceCandidates: IeltsSourceEvidenceCandidate[];
  sourceEvidenceStatus: "available" | "insufficient_source_evidence";
};

type ExpectedAnswerInput = {
  keys: string[];
  comparableAnswer: unknown;
  acceptedAnswer: unknown;
  questionText: string;
  sourceContext?: IeltsObjectiveSourceContext;
  evidenceTexts?: string[];
};

type ResolvedAnswer = {
  comparableAnswer: unknown;
  acceptedAnswer: string;
};

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

function evidenceTokens(value: string): string[] {
  return normalizeString(value)
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean);
}

const evidenceStopwords = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "how",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "their",
  "they",
  "this",
  "to",
  "was",
  "were",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "with",
]);

function contentEvidenceTokens(value: string): string[] {
  return evidenceTokens(value).filter(
    (token) => token.length > 2 && !evidenceStopwords.has(token),
  );
}

function hasContiguousTokenSequence(needle: string[], haystack: string[]): boolean {
  if (needle.length === 0 || needle.length > haystack.length) {
    return false;
  }

  for (let start = 0; start <= haystack.length - needle.length; start += 1) {
    const candidate = haystack.slice(start, start + needle.length);
    if (candidate.every((token, index) => token === needle[index])) {
      return true;
    }
  }

  return false;
}

function isAnswerKeyOnlyTokenSequence(tokens: string[]): boolean {
  const normalized = tokens.join(" ");

  return (
    (tokens.length === 1 && /^[a-z]$/.test(tokens[0] ?? "")) ||
    ["true", "false", "yes", "no", "not given"].includes(normalized)
  );
}

function isSingleTokenSourceAnchor(token: string): boolean {
  return /\d/.test(token) || (token.length > 2 && !evidenceStopwords.has(token));
}

function isAsciiDigit(value: string | undefined): boolean {
  return value !== undefined && /[0-9]/.test(value);
}

function isAsciiLetter(value: string | undefined): boolean {
  return value !== undefined && /[a-z]/i.test(value);
}

function isDecimalPoint(value: string, index: number): boolean {
  return isAsciiDigit(value[index - 1]) && isAsciiDigit(value[index + 1]);
}

const nonTerminalAbbreviations = new Set([
  "apr",
  "aug",
  "dec",
  "dr",
  "feb",
  "jan",
  "jul",
  "jun",
  "mar",
  "mr",
  "mrs",
  "ms",
  "no",
  "nov",
  "oct",
  "prof",
  "sep",
  "sept",
  "st",
]);

function isInternalAbbreviationPoint(value: string, index: number): boolean {
  return (
    isAsciiLetter(value[index - 1]) &&
    isAsciiLetter(value[index + 1]) &&
    value[index + 2] === "."
  );
}

function abbreviationBeforePoint(value: string, index: number): string {
  let start = index - 1;
  while (start >= 0 && isAsciiLetter(value[start])) {
    start -= 1;
  }

  return value.slice(start + 1, index).toLowerCase();
}

function isKnownNonTerminalAbbreviationPoint(value: string, index: number): boolean {
  return nonTerminalAbbreviations.has(abbreviationBeforePoint(value, index));
}

function sourceTextSpans(value: string): string[] {
  const spans: string[] = [];
  let spanStart = 0;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];

    if (
      character === "." &&
      (isDecimalPoint(value, index) ||
        isInternalAbbreviationPoint(value, index) ||
        isKnownNonTerminalAbbreviationPoint(value, index))
    ) {
      continue;
    }

    const isBoundary =
      character === "." ||
      character === "!" ||
      character === "?" ||
      character === ";" ||
      character === "\n";

    if (!isBoundary) {
      continue;
    }

    const spanEnd = character === "\n" ? index : index + 1;
    const span = value.slice(spanStart, spanEnd).trim();
    if (span) {
      spans.push(span);
    }
    spanStart = index + 1;
  }

  const tail = value.slice(spanStart).trim();
  if (tail) {
    spans.push(tail);
  }

  return spans;
}

function sourceSpanSupportsAcceptedAnswer(
  span: string,
  acceptedAnswer: string,
): boolean {
  const answerTokens = evidenceTokens(acceptedAnswer);
  const spanTokens = evidenceTokens(span);

  if (isAnswerKeyOnlyTokenSequence(answerTokens)) {
    return false;
  }

  if (
    answerTokens.length === 1 &&
    !isSingleTokenSourceAnchor(answerTokens[0] ?? "")
  ) {
    return false;
  }

  return hasContiguousTokenSequence(answerTokens, spanTokens);
}

function sourceSpanSupportsEvidenceText(
  span: string,
  evidenceText: string,
): boolean {
  const anchorTokens = contentEvidenceTokens(evidenceText);
  const spanTokens = new Set(contentEvidenceTokens(span));

  if (anchorTokens.length === 0 || spanTokens.size === 0) {
    return false;
  }

  const matchedTokens = anchorTokens.filter((token) => spanTokens.has(token));
  const requiredMatches = Math.max(2, Math.ceil(anchorTokens.length * 0.6));

  return matchedTokens.length >= requiredMatches;
}

function buildSourceEvidenceCandidates(input: {
  sourceContext?: IeltsObjectiveSourceContext;
  acceptedAnswer: string;
  evidenceKey: string;
  evidenceTexts?: string[];
}): IeltsSourceEvidenceCandidate[] {
  if (
    !input.sourceContext ||
    (input.sourceContext.kind !== "reading_passage" &&
      input.sourceContext.kind !== "listening_transcript")
  ) {
    return [];
  }

  return sourceTextSpans(input.sourceContext.text)
    .filter(
      (span) =>
        sourceSpanSupportsAcceptedAnswer(span, input.acceptedAnswer) ||
        (input.evidenceTexts ?? []).some((evidenceText) =>
          sourceSpanSupportsEvidenceText(span, evidenceText),
        ),
    )
    .map((quote, index) => ({
      id: `${input.evidenceKey || "question"}-evidence-${index + 1}`,
      quote,
    }));
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

function resolveOptionAnswer(
  question: Record<string, unknown>,
  answer: unknown,
): ResolvedAnswer {
  if (typeof answer !== "string" || !Array.isArray(question.options)) {
    return {
      comparableAnswer: answer,
      acceptedAnswer: displayAnswer(answer),
    };
  }

  const options = question.options.filter(
    (option): option is string => typeof option === "string",
  );
  const variants = new Set<string>([answer]);
  let acceptedAnswer = answer;
  const optionIndex = Number(answer);

  if (
    Number.isInteger(optionIndex) &&
    optionIndex >= 0 &&
    optionIndex < options.length
  ) {
    const optionText = options[optionIndex] ?? answer;
    variants.add(optionText);
    acceptedAnswer = optionText;
  }

  const matchingIndex = options.findIndex(
    (option) => normalizeString(option) === normalizeString(answer),
  );
  if (matchingIndex >= 0) {
    variants.add(String(matchingIndex));
    acceptedAnswer = options[matchingIndex] ?? answer;
  }

  return {
    comparableAnswer: variants.size > 1 ? Array.from(variants) : answer,
    acceptedAnswer: displayAnswer(acceptedAnswer),
  };
}

function toExpectedAnswer(input: ExpectedAnswerInput): ExpectedAnswer | null {
  const keys = input.keys.filter((key) => key.length > 0);
  if (keys.length === 0) {
    return null;
  }
  if (input.comparableAnswer === undefined) {
    return null;
  }
  if (
    typeof input.comparableAnswer === "string" &&
    input.comparableAnswer.trim() === ""
  ) {
    return null;
  }

  const acceptedAnswer = displayAnswer(input.acceptedAnswer);
  const evidenceKey = keys[0] ?? "";
  const sourceEvidenceCandidates = buildSourceEvidenceCandidates({
    sourceContext: input.sourceContext,
    acceptedAnswer,
    evidenceKey,
    evidenceTexts: input.evidenceTexts,
  });

  return {
    keys,
    comparableAnswer: input.comparableAnswer,
    acceptedAnswer,
    questionText: input.questionText,
    sourceEvidenceCandidates,
    sourceEvidenceStatus:
      sourceEvidenceCandidates.length > 0
        ? "available"
        : "insufficient_source_evidence",
    ...(input.sourceContext ? { sourceContext: input.sourceContext } : {}),
  };
}

function isStatementLikeQuestionText(value: string): boolean {
  const trimmed = value.trim();

  return trimmed.length > 0 && !trimmed.endsWith("?");
}

function usesAnswerKeyOnlySourceFallback(acceptedAnswer: string): boolean {
  return isAnswerKeyOnlyTokenSequence(evidenceTokens(acceptedAnswer));
}

function addExpectedAnswer(
  expectedAnswers: ExpectedAnswer[],
  input: ExpectedAnswerInput,
): void {
  const expectedAnswer = toExpectedAnswer(input);
  if (expectedAnswer) {
    expectedAnswers.push(expectedAnswer);
  }
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

function extractExpectedAnswersFromQuestion(
  question: Record<string, unknown>,
  sourceContext?: IeltsObjectiveSourceContext,
): ExpectedAnswer[] {
  const expectedAnswers: ExpectedAnswer[] = [];
  const questionId = typeof question.id === "string" ? question.id : "";
  const parentQuestionText = displayTextFromRecord(question);
  const directAnswer = resolveOptionAnswer(question, getAnswerValue(question));
  const parentQuestionTextEvidence =
    isStatementLikeQuestionText(parentQuestionText) &&
    usesAnswerKeyOnlySourceFallback(directAnswer.acceptedAnswer)
      ? [parentQuestionText]
      : [];

  if (questionId) {
    addExpectedAnswer(expectedAnswers, {
      keys: [questionId],
      ...directAnswer,
      questionText: parentQuestionText,
      sourceContext,
      evidenceTexts: [
        directAnswer.acceptedAnswer,
        ...parentQuestionTextEvidence,
      ],
    });
  }

  const sentences = Array.isArray(question.sentences)
    ? question.sentences
    : [];
  for (const sentence of sentences) {
    if (!isRecord(sentence)) {
      continue;
    }
    const sentenceAnswer = getAnswerValue(sentence);
    addExpectedAnswer(expectedAnswers, {
      keys: [typeof sentence.id === "string" ? sentence.id : ""],
      comparableAnswer: sentenceAnswer,
      acceptedAnswer: sentenceAnswer,
      questionText: displayTextFromRecord(sentence) || parentQuestionText,
      sourceContext,
      evidenceTexts: [displayTextFromRecord(sentence)],
    });
  }

  const statements = Array.isArray(question.statements)
    ? question.statements
    : [];
  for (const statement of statements) {
    if (!isRecord(statement)) {
      continue;
    }
    const statementAnswer = getAnswerValue(statement);
    addExpectedAnswer(expectedAnswers, {
      keys: [typeof statement.id === "string" ? statement.id : ""],
      comparableAnswer: statementAnswer,
      acceptedAnswer: statementAnswer,
      questionText: displayTextFromRecord(statement) || parentQuestionText,
      sourceContext,
      evidenceTexts: [displayTextFromRecord(statement)],
    });
  }

  const items = Array.isArray(question.items) ? question.items : [];
  for (const item of items) {
    if (!isRecord(item)) {
      continue;
    }
    const itemId = typeof item.id === "string" ? item.id : "";
    const paragraphId =
      typeof item.paragraph === "string" ? item.paragraph : "";
    const keys = itemId
      ? [itemId]
      : questionId && paragraphId
        ? [paragraphId, `${questionId}:${paragraphId}`]
        : [paragraphId];
    const itemAnswer = getAnswerValue(item);
    addExpectedAnswer(expectedAnswers, {
      keys,
      comparableAnswer: itemAnswer,
      acceptedAnswer: itemAnswer,
      questionText: displayTextFromRecord(item) || parentQuestionText,
      sourceContext,
      evidenceTexts: [displayTextFromRecord(item)],
    });
  }

  const matchingItems = Array.isArray(question.matchingItems)
    ? question.matchingItems
    : [];
  for (const item of matchingItems) {
    if (!isRecord(item)) {
      continue;
    }
    const itemAnswer = getAnswerValue(item);
    addExpectedAnswer(expectedAnswers, {
      keys: [typeof item.id === "string" ? item.id : ""],
      comparableAnswer: itemAnswer,
      acceptedAnswer: itemAnswer,
      questionText: displayTextFromRecord(item) || parentQuestionText,
      sourceContext,
      evidenceTexts: [displayTextFromRecord(item)],
    });
  }

  const diagramLabels = Array.isArray(question.diagramLabels)
    ? question.diagramLabels
    : [];
  for (const label of diagramLabels) {
    if (!isRecord(label)) {
      continue;
    }
    const labelAnswer = getAnswerValue(label);
    addExpectedAnswer(expectedAnswers, {
      keys: [typeof label.id === "string" ? label.id : ""],
      comparableAnswer: labelAnswer,
      acceptedAnswer: labelAnswer,
      questionText: displayTextFromRecord(label) || parentQuestionText,
      sourceContext,
      evidenceTexts: [displayTextFromRecord(label)],
    });
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

export function buildExpectedAnswersFromConfig(
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

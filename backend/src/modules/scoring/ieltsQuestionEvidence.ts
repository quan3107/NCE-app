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

function sourceTextSpans(value: string): string[] {
  return (
    value
      .match(/[^.!?;\n]+[.!?;]?/g)
      ?.map((span) => span.trim())
      .filter(Boolean) ?? []
  );
}

function sourceSpanSupportsAcceptedAnswer(
  span: string,
  acceptedAnswer: string,
): boolean {
  const answerTokens = evidenceTokens(acceptedAnswer);
  const spanTokens = evidenceTokens(span);

  return hasContiguousTokenSequence(answerTokens, spanTokens);
}

function buildSourceEvidenceCandidates(input: {
  sourceContext?: IeltsObjectiveSourceContext;
  acceptedAnswer: string;
  evidenceKey: string;
}): IeltsSourceEvidenceCandidate[] {
  if (
    !input.sourceContext ||
    (input.sourceContext.kind !== "reading_passage" &&
      input.sourceContext.kind !== "listening_transcript")
  ) {
    return [];
  }

  return sourceTextSpans(input.sourceContext.text)
    .filter((span) => sourceSpanSupportsAcceptedAnswer(span, input.acceptedAnswer))
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

  if (questionId) {
    addExpectedAnswer(expectedAnswers, {
      keys: [questionId],
      ...directAnswer,
      questionText: parentQuestionText,
      sourceContext,
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

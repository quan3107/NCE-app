/**
 * Location: features/assignments/components/ielts/student/studentIeltsAnswerTargets.ts
 * Purpose: Derive student-answerable targets from IELTS reading/listening questions.
 * Why: Compound IELTS questions often score nested item ids rather than the parent question id.
 */

import type { IeltsListeningConfig, IeltsQuestion, IeltsReadingConfig } from '@lib/ielts';

type AnswerOption = {
  value: string;
  label: string;
};

export type StudentIeltsAnswerTarget = {
  id: string;
  prompt: string;
  options: AnswerOption[];
  question: IeltsQuestion;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toDisplayString = (value: unknown): string =>
  typeof value === 'string' ? value : '';

const toQuestionOptions = (options: unknown): AnswerOption[] =>
  Array.isArray(options)
    ? options
        .map((option) => toDisplayString(option).trim())
        .filter((option) => option.length > 0)
        .map((option) => ({ value: option, label: option }))
    : [];

const matchingOptionsForQuestion = (question: IeltsQuestion): AnswerOption[] =>
  question.matchingOptions?.map((option) => ({
    value: option.id,
    label: option.label || option.id,
  })) ?? [];

const getNestedPrompt = (record: Record<string, unknown>, fallback: string): string =>
  toDisplayString(record.prompt) ||
  toDisplayString(record.statement) ||
  toDisplayString(record.text) ||
  toDisplayString(record.label) ||
  toDisplayString(record.paragraph) ||
  fallback;

const createDefaultTarget = (question: IeltsQuestion): StudentIeltsAnswerTarget => ({
  id: question.id,
  prompt: question.prompt,
  options: toQuestionOptions(question.options),
  question,
});

const getLegacyNestedTargets = (
  question: IeltsQuestion,
  key: 'sentences' | 'statements' | 'items',
): StudentIeltsAnswerTarget[] => {
  const nested = (question as unknown as Record<string, unknown>)[key];
  if (!Array.isArray(nested)) {
    return [];
  }

  return nested
    .map((item, index) => {
      if (!isRecord(item) || typeof item.id !== 'string' || item.id.trim() === '') {
        return null;
      }
      const itemOptions = toQuestionOptions(item.options);
      return {
        id: item.id,
        prompt: getNestedPrompt(item, `${question.prompt || 'Question'} ${index + 1}`),
        options: itemOptions.length ? itemOptions : toQuestionOptions(question.options),
        question,
      };
    })
    .filter((target): target is StudentIeltsAnswerTarget => Boolean(target));
};

const getMatchingTargets = (question: IeltsQuestion): StudentIeltsAnswerTarget[] =>
  question.matchingItems?.map((item) => ({
    id: item.id,
    prompt: item.statement,
    options: matchingOptionsForQuestion(question),
    question,
  })) ?? [];

const getDiagramTargets = (question: IeltsQuestion): StudentIeltsAnswerTarget[] =>
  question.diagramLabels?.map((label) => ({
    id: label.id,
    prompt: label.letter ? `${label.letter}. ${label.position}` : label.position,
    options: [],
    question,
  })) ?? [];

export const getAnswerTargetsForQuestion = (
  question: IeltsQuestion,
): StudentIeltsAnswerTarget[] => {
  const nestedTargets = [
    ...getLegacyNestedTargets(question, 'sentences'),
    ...getLegacyNestedTargets(question, 'statements'),
    ...getLegacyNestedTargets(question, 'items'),
    ...getMatchingTargets(question),
    ...getDiagramTargets(question),
  ];

  return nestedTargets.length > 0 ? nestedTargets : [createDefaultTarget(question)];
};

export const getStudentIeltsAnswerTargets = (
  config: IeltsReadingConfig | IeltsListeningConfig,
): StudentIeltsAnswerTarget[] =>
  config.sections.flatMap(section =>
    section.questions.flatMap(question => getAnswerTargetsForQuestion(question)),
  );

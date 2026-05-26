/**
 * Location: src/lib/ielts/question-normalization.ts
 * Purpose: Normalize IELTS question arrays and question-specific nested data.
 * Why: Keeps assignment-level normalization focused on section/task structure.
 */

import { createId, createQuestion } from './factory';
import { toString } from './normalization-utils';
import type {
  DiagramLabel,
  IeltsCompletionFormat,
  IeltsQuestion,
  IeltsQuestionType,
  MatchingItem,
  MatchingOption,
} from './types';

const normalizeBooleanQuestionAnswer = (
  type: IeltsQuestionType,
  value: string,
): string => {
  if (type !== 'true_false_not_given' && type !== 'yes_no_not_given') {
    return value;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === 'not given' || normalized === 'not_given') {
    return 'not_given';
  }

  if (type === 'true_false_not_given' && (normalized === 'true' || normalized === 'false')) {
    return normalized;
  }

  if (type === 'yes_no_not_given' && (normalized === 'yes' || normalized === 'no')) {
    return normalized;
  }

  return value;
};

const normalizeMatchingItem = (item: unknown): MatchingItem | null => {
  if (!item || typeof item !== 'object') return null;
  const record = item as Record<string, unknown>;
  return {
    id: toString(record.id, createId()),
    statement: toString(record.statement),
    matchId: record.matchId === null ? null : toString(record.matchId, ''),
  };
};

const normalizeMatchingOption = (option: unknown): MatchingOption | null => {
  if (!option || typeof option !== 'object') return null;
  const record = option as Record<string, unknown>;
  return {
    id: toString(record.id, createId()),
    label: toString(record.label),
  };
};

const normalizeDiagramLabel = (label: unknown): DiagramLabel | null => {
  if (!label || typeof label !== 'object') return null;
  const record = label as Record<string, unknown>;
  return {
    id: toString(record.id, createId()),
    letter: toString(record.letter),
    position: toString(record.position),
    answer: toString(record.answer),
  };
};

export const normalizeQuestions = (value: unknown): IeltsQuestion[] => {
  if (!Array.isArray(value)) {
    return [createQuestion()];
  }

  const questions = value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      const record = item as Record<string, unknown>;
      const questionType = (record.type as IeltsQuestionType) ?? 'multiple_choice';
      const rawCorrectAnswer = toString(record.correctAnswer);
      const question: IeltsQuestion = {
        id: toString(record.id, createId()),
        type: questionType,
        prompt: toString(record.prompt),
        options: Array.isArray(record.options)
          ? record.options.map((option) => toString(option))
          : [''],
        correctAnswer: normalizeBooleanQuestionAnswer(questionType, rawCorrectAnswer),
      };

      if (record.format && typeof record.format === 'string') {
        question.format = record.format as IeltsCompletionFormat;
      }

      if (Array.isArray(record.matchingItems)) {
        question.matchingItems = record.matchingItems
          .map(normalizeMatchingItem)
          .filter((item): item is MatchingItem => Boolean(item));
      }

      if (Array.isArray(record.matchingOptions)) {
        question.matchingOptions = record.matchingOptions
          .map(normalizeMatchingOption)
          .filter((option): option is MatchingOption => Boolean(option));
      }

      if (Array.isArray(record.diagramImageIds)) {
        question.diagramImageIds = record.diagramImageIds
          .map((id) => toString(id))
          .filter((id) => id);
      }

      if (Array.isArray(record.diagramLabels)) {
        question.diagramLabels = record.diagramLabels
          .map(normalizeDiagramLabel)
          .filter((label): label is DiagramLabel => Boolean(label));
      }

      return question;
    })
    .filter((item): item is IeltsQuestion => Boolean(item));

  return questions.length ? questions : [createQuestion()];
};

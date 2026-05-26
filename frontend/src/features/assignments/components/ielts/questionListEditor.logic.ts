/**
 * Location: features/assignments/components/ielts/questionListEditor.logic.ts
 * Purpose: Provide pure helpers for IELTS question-list editor state transitions.
 * Why: Keeps the list editor focused on rendering and per-question wiring.
 */

import type {
  DiagramLabel,
  IeltsQuestion,
  IeltsQuestionType,
  MatchingItem,
  MatchingOption,
} from '@lib/ielts';

export const OPTION_TYPES = new Set<IeltsQuestionType>(['multiple_choice']);

export const MATCHING_TYPES = new Set<IeltsQuestionType>([
  'matching',
  'matching_headings',
  'matching_information',
  'matching_features',
]);

export const DIAGRAM_LABELING_TYPES = new Set<IeltsQuestionType>([
  'diagram_labeling',
  'map_diagram_labeling',
]);

export type QuestionTypeOption = {
  value: IeltsQuestionType;
  label: string;
};

export type CompletionFormatOption = {
  value: string;
  label: string;
};

const createId = () => globalThis.crypto?.randomUUID?.() ?? `q-${Date.now()}`;

const createDefaultMatchingItems = (): MatchingItem[] => [
  { id: createId(), statement: '', matchId: null },
  { id: createId(), statement: '', matchId: null },
  { id: createId(), statement: '', matchId: null },
];

const createDefaultMatchingOptions = (): MatchingOption[] => [
  { id: createId(), label: 'A' },
  { id: createId(), label: 'B' },
  { id: createId(), label: 'C' },
  { id: createId(), label: 'D' },
];

const createDefaultDiagramLabels = (): DiagramLabel[] => [
  { id: createId(), letter: 'A', position: '', answer: '' },
  { id: createId(), letter: 'B', position: '', answer: '' },
  { id: createId(), letter: 'C', position: '', answer: '' },
];

export const createQuestion = (type: IeltsQuestionType): IeltsQuestion => {
  const baseOptions = type === 'completion' ? ['', ''] : [''];
  const question: IeltsQuestion = {
    id: createId(),
    type,
    prompt: '',
    options: baseOptions,
    correctAnswer: '',
  };

  if (type === 'completion') {
    question.format = 'summary';
  }

  if (MATCHING_TYPES.has(type)) {
    question.matchingItems = createDefaultMatchingItems();
    question.matchingOptions = createDefaultMatchingOptions();
  }

  if (DIAGRAM_LABELING_TYPES.has(type)) {
    question.diagramImageIds = [];
    question.diagramLabels = createDefaultDiagramLabels();
  }

  return question;
};

export const buildQuestionTypePatch = (
  question: IeltsQuestion,
  newType: IeltsQuestionType,
  defaultTrueFalseValue: string,
  defaultYesNoValue: string,
): Partial<IeltsQuestion> => {
  const updates: Partial<IeltsQuestion> = { type: newType };

  if (MATCHING_TYPES.has(newType) && !MATCHING_TYPES.has(question.type)) {
    updates.matchingItems = createDefaultMatchingItems();
    updates.matchingOptions = createDefaultMatchingOptions();
  } else if (!MATCHING_TYPES.has(newType)) {
    updates.matchingItems = undefined;
    updates.matchingOptions = undefined;
  }

  if (DIAGRAM_LABELING_TYPES.has(newType) && !DIAGRAM_LABELING_TYPES.has(question.type)) {
    updates.diagramImageIds = [];
    updates.diagramLabels = createDefaultDiagramLabels();
  } else if (!DIAGRAM_LABELING_TYPES.has(newType)) {
    updates.diagramImageIds = undefined;
    updates.diagramLabels = undefined;
  }

  if (OPTION_TYPES.has(newType) && !OPTION_TYPES.has(question.type)) {
    updates.options = ['', ''];
  } else if (!OPTION_TYPES.has(newType) && OPTION_TYPES.has(question.type)) {
    updates.options = [];
  }

  updates.format = newType === 'completion' ? 'summary' : undefined;

  if (newType === 'true_false_not_given') {
    updates.correctAnswer = defaultTrueFalseValue;
  } else if (newType === 'yes_no_not_given') {
    updates.correctAnswer = defaultYesNoValue;
  } else if (!MATCHING_TYPES.has(newType) && !DIAGRAM_LABELING_TYPES.has(newType)) {
    updates.correctAnswer = '';
  }

  return updates;
};

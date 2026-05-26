/**
 * Location: features/assignments/components/ielts/questionEditor.logic.ts
 * Purpose: Provide pure helpers for IELTS question editor state transitions.
 * Why: Keeps the QuestionEditor component focused on rendering and event wiring.
 */

import type {
  DiagramLabel,
  IeltsCompletionFormat,
  IeltsQuestion,
  IeltsQuestionType,
  MatchingItem,
  MatchingOption,
} from '@lib/ielts';

export const OPTION_BASED_TYPES: IeltsQuestionType[] = ['multiple_choice'];

export const MATCHING_TYPES: IeltsQuestionType[] = [
  'matching',
  'matching_headings',
  'matching_information',
  'matching_features',
];

export const DIAGRAM_LABELING_TYPES: IeltsQuestionType[] = [
  'diagram_labeling',
  'map_diagram_labeling',
];

export type QuestionTypeOption = { value: IeltsQuestionType; label: string };
export type CompletionFormatOption = { value: IeltsCompletionFormat; label: string };

type BuildTypeChangeParams = {
  question: IeltsQuestion;
  newType: IeltsQuestionType;
  defaultTrueFalseValue: string;
  defaultYesNoValue: string;
  createId: () => string;
};

const createDefaultMatchingItems = (createId: () => string): MatchingItem[] => [
  { id: createId(), statement: '', matchId: null },
  { id: createId(), statement: '', matchId: null },
  { id: createId(), statement: '', matchId: null },
];

const createDefaultMatchingOptions = (createId: () => string): MatchingOption[] => [
  { id: createId(), label: 'A' },
  { id: createId(), label: 'B' },
  { id: createId(), label: 'C' },
  { id: createId(), label: 'D' },
];

const createDefaultDiagramLabels = (createId: () => string): DiagramLabel[] => [
  { id: createId(), letter: 'A', position: '', answer: '' },
  { id: createId(), letter: 'B', position: '', answer: '' },
  { id: createId(), letter: 'C', position: '', answer: '' },
];

export const buildQuestionTypeChange = ({
  question,
  newType,
  defaultTrueFalseValue,
  defaultYesNoValue,
  createId,
}: BuildTypeChangeParams): IeltsQuestion => {
  let newOptions = question.options;
  if (OPTION_BASED_TYPES.includes(newType) && !OPTION_BASED_TYPES.includes(question.type)) {
    newOptions = ['', ''];
  } else if (!OPTION_BASED_TYPES.includes(newType) && OPTION_BASED_TYPES.includes(question.type)) {
    newOptions = [];
  }

  let newCorrectAnswer = question.correctAnswer;
  if (newType === 'true_false_not_given') {
    newCorrectAnswer = defaultTrueFalseValue;
  } else if (newType === 'yes_no_not_given') {
    newCorrectAnswer = defaultYesNoValue;
  } else if (question.type === 'true_false_not_given' || question.type === 'yes_no_not_given') {
    newCorrectAnswer = '';
  }

  const updates: Partial<IeltsQuestion> = {
    type: newType,
    options: newOptions,
    correctAnswer: newCorrectAnswer,
  };

  if (newType !== 'completion') {
    updates.format = undefined;
  }

  if (MATCHING_TYPES.includes(newType) && !MATCHING_TYPES.includes(question.type)) {
    updates.matchingItems = createDefaultMatchingItems(createId);
    updates.matchingOptions = createDefaultMatchingOptions(createId);
  } else if (!MATCHING_TYPES.includes(newType)) {
    updates.matchingItems = undefined;
    updates.matchingOptions = undefined;
  }

  if (DIAGRAM_LABELING_TYPES.includes(newType) && !DIAGRAM_LABELING_TYPES.includes(question.type)) {
    updates.diagramImageIds = [];
    updates.diagramLabels = createDefaultDiagramLabels(createId);
  } else if (!DIAGRAM_LABELING_TYPES.includes(newType)) {
    updates.diagramImageIds = undefined;
    updates.diagramLabels = undefined;
  }

  return {
    ...question,
    ...updates,
  };
};

export const removeOptionAtIndex = (
  question: IeltsQuestion,
  index: number,
): IeltsQuestion => {
  const newOptions = question.options.filter((_, i) => i !== index);
  let newCorrectAnswer = question.correctAnswer;
  if (question.correctAnswer === `${index}`) {
    newCorrectAnswer = '';
  } else {
    const parsed = parseInt(question.correctAnswer);
    if (!isNaN(parsed) && parsed > index) {
      newCorrectAnswer = `${parsed - 1}`;
    }
  }

  return {
    ...question,
    options: newOptions,
    correctAnswer: newCorrectAnswer,
  };
};

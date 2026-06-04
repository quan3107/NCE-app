/**
 * Location: src/lib/ielts/factory.ts
 * Purpose: Create default IELTS assignment configs and question scaffolds.
 * Why: Keeps default data construction isolated from normalization and UI code.
 */

import type {
  DiagramLabel,
  IeltsAssignmentAiPolicy,
  IeltsAssignmentBase,
  IeltsAssignmentConfig,
  IeltsAssignmentType,
  IeltsCompletionFormat,
  IeltsListeningSection,
  IeltsQuestion,
  IeltsQuestionType,
  IeltsReadingConfig,
  IeltsReadingSection,
  MatchingItem,
  MatchingOption,
} from './types';

export const createId = () => {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `ielts-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const createDefaultIeltsAiPolicy = (): IeltsAssignmentAiPolicy => ({
  writingFeedbackMode: 'off',
  objectiveExplanations: 'off',
  providerTier: 'auto',
});

export const baseConfig = (): IeltsAssignmentBase => ({
  version: 1,
  aiPolicy: createDefaultIeltsAiPolicy(),
  timing: {
    enabled: true,
    durationMinutes: 60,
    enforce: true,
  },
  instructions: '',
  attempts: {
    maxAttempts: null,
  },
});

export const createQuestion = (
  type: IeltsQuestionType = 'multiple_choice',
  format?: IeltsCompletionFormat,
): IeltsQuestion => {
  const baseOptions = type === 'completion' ? ['', ''] : [''];
  const question: IeltsQuestion = {
    id: createId(),
    type,
    prompt: '',
    options: baseOptions,
    correctAnswer: '',
  };

  if (type === 'completion') {
    question.format = format || 'summary';
  }

  if (['matching', 'matching_headings', 'matching_information', 'matching_features'].includes(type)) {
    const matchingItems: MatchingItem[] = [
      { id: createId(), statement: '', matchId: null },
      { id: createId(), statement: '', matchId: null },
      { id: createId(), statement: '', matchId: null },
    ];
    const matchingOptions: MatchingOption[] = [
      { id: createId(), label: 'A' },
      { id: createId(), label: 'B' },
      { id: createId(), label: 'C' },
      { id: createId(), label: 'D' },
    ];
    question.matchingItems = matchingItems;
    question.matchingOptions = matchingOptions;
  }

  if (['map_diagram_labeling', 'diagram_labeling'].includes(type)) {
    const diagramLabels: DiagramLabel[] = [
      { id: createId(), letter: 'A', position: '', answer: '' },
      { id: createId(), letter: 'B', position: '', answer: '' },
      { id: createId(), letter: 'C', position: '', answer: '' },
    ];
    question.diagramImageIds = [];
    question.diagramLabels = diagramLabels;
  }

  return question;
};

export const createReadingSection = (index: number): IeltsReadingSection => ({
  id: createId(),
  title: `Passage ${index + 1}`,
  passage: '',
  questions: [createQuestion('multiple_choice')],
});

export const createListeningSection = (index: number): IeltsListeningSection => ({
  id: createId(),
  title: `Section ${index + 1}`,
  audioFileId: null,
  transcript: '',
  playback: { limitPlays: 1 },
  questions: [createQuestion('multiple_choice')],
});

export const createIeltsAssignmentConfig = (
  type: IeltsAssignmentType,
): IeltsAssignmentConfig => {
  switch (type) {
    case 'reading':
      return {
        ...baseConfig(),
        sections: [createReadingSection(0), createReadingSection(1), createReadingSection(2)],
      };
    case 'listening':
      return {
        ...baseConfig(),
        sections: [
          createListeningSection(0),
          createListeningSection(1),
          createListeningSection(2),
          createListeningSection(3),
        ],
      };
    case 'writing':
      return {
        ...baseConfig(),
        task1: {
          prompt: '',
          imageFileId: null,
          visualType: undefined,
          sampleResponse: '',
          showSampleToStudents: false,
          showSampleTiming: 'immediate',
          showSampleDate: undefined,
          rubricId: null,
        },
        task2: {
          prompt: '',
          sampleResponse: '',
          showSampleToStudents: false,
          showSampleTiming: 'immediate',
          showSampleDate: undefined,
          rubricId: null,
        },
      };
    case 'speaking':
      return {
        ...baseConfig(),
        part1: { questions: [''] },
        part2: {
          cueCard: { topic: '', bulletPoints: [''] },
          prepSeconds: 60,
          talkSeconds: 120,
        },
        part3: { questions: [''] },
      };
    default:
      return {
        ...baseConfig(),
        sections: [createReadingSection(0)],
      } as IeltsReadingConfig;
  }
};

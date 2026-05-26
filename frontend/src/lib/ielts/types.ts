/**
 * Location: src/lib/ielts/types.ts
 * Purpose: Define IELTS assignment config types shared by authoring and preview flows.
 * Why: Keeps data shapes separate from creation and normalization logic.
 */

import type {
  IeltsAssignmentTypeRecord,
  IeltsCompletionFormatRecord,
  IeltsQuestionTypeRecord,
  IeltsSampleTimingOptionRecord,
  IeltsSpeakingPartTypeRecord,
  IeltsWritingTaskTypeRecord,
} from '@lib/backend-schema';

export type IeltsAssignmentType = IeltsAssignmentTypeRecord['id'];

/**
 * Check if a value is a valid IELTS assignment type.
 * Runtime validation stays explicit because backend serves IDs as dynamic strings.
 */
export const isIeltsAssignmentType = (value: string): value is IeltsAssignmentType =>
  ['reading', 'listening', 'writing', 'speaking'].includes(value as IeltsAssignmentType);

export type IeltsTimingConfig = {
  enabled: boolean;
  durationMinutes: number;
  enforce: boolean;
  startAt?: string;
  endAt?: string;
  autoSubmit?: boolean;
  rejectLateStart?: boolean;
};

export type IeltsAttemptsConfig = {
  maxAttempts: number | null;
};

export type IeltsCompletionFormat = IeltsCompletionFormatRecord['id'];

export type IeltsReadingQuestionType = IeltsQuestionTypeRecord['id'];

export type IeltsListeningQuestionType = IeltsQuestionTypeRecord['id'];

/**
 * Legacy union type for backward compatibility.
 * @deprecated Use IeltsReadingQuestionType or IeltsListeningQuestionType instead.
 */
export type IeltsQuestionType = IeltsReadingQuestionType | IeltsListeningQuestionType;

export type IeltsWritingTask1Type = IeltsWritingTaskTypeRecord['id'];

export type ShowSampleTiming = IeltsSampleTimingOptionRecord['id'];

export type IeltsWritingTask2Type = IeltsWritingTaskTypeRecord['id'];

export type IeltsSpeakingPartType = IeltsSpeakingPartTypeRecord['id'];

export type MatchingItem = {
  id: string;
  statement: string;
  matchId: string | null;
};

export type MatchingOption = {
  id: string;
  label: string;
};

export type DiagramLabel = {
  id: string;
  letter: string;
  position: string;
  answer: string;
};

export type IeltsQuestion = {
  id: string;
  type: IeltsQuestionType;
  prompt: string;
  options: string[];
  correctAnswer: string;
  format?: IeltsCompletionFormat;
  matchingItems?: MatchingItem[];
  matchingOptions?: MatchingOption[];
  diagramImageIds?: string[];
  diagramLabels?: DiagramLabel[];
};

export type IeltsReadingSection = {
  id: string;
  title: string;
  passage: string;
  questions: IeltsQuestion[];
};

export type IeltsListeningSection = {
  id: string;
  title: string;
  audioFileId: string | null;
  transcript?: string;
  playback?: {
    limitPlays: number;
  };
  questions: IeltsQuestion[];
};

export type IeltsWritingTask = {
  prompt: string;
  imageFileId?: string | null;
  visualType?: IeltsWritingTask1Type;
  sampleResponse?: string;
  showSampleToStudents?: boolean;
  showSampleTiming?: ShowSampleTiming;
  showSampleDate?: string;
  rubricId?: string | null;
};

export type IeltsSpeakingPart = {
  questions: string[];
};

export type IeltsAssignmentBase = {
  version: 1;
  timing: IeltsTimingConfig;
  instructions: string;
  attempts: IeltsAttemptsConfig;
};

export type IeltsReadingConfig = IeltsAssignmentBase & {
  sections: IeltsReadingSection[];
};

export type IeltsListeningConfig = IeltsAssignmentBase & {
  sections: IeltsListeningSection[];
};

export type IeltsWritingConfig = IeltsAssignmentBase & {
  task1: IeltsWritingTask;
  task2: Omit<IeltsWritingTask, 'imageFileId' | 'visualType'>;
};

export type IeltsSpeakingConfig = IeltsAssignmentBase & {
  part1: IeltsSpeakingPart;
  part2: {
    cueCard: {
      topic: string;
      bulletPoints: string[];
    };
    prepSeconds: number;
    talkSeconds: number;
  };
  part3: IeltsSpeakingPart;
};

export type IeltsAssignmentConfig =
  | IeltsReadingConfig
  | IeltsListeningConfig
  | IeltsWritingConfig
  | IeltsSpeakingConfig;

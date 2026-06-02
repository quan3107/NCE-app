/**
 * Location: features/assignments/components/ielts/student/studentIeltsAttempt.logic.ts
 * Purpose: Build student IELTS attempt payloads from form state.
 * Why: Keeps IELTS submission serialization testable outside React rendering.
 */

import type { SubmissionStatus } from '@domain';
import type {
  IeltsAssignmentConfig,
  IeltsAssignmentType,
  IeltsListeningConfig,
  IeltsQuestion,
  IeltsReadingConfig,
} from '@lib/ielts';

type StudentIeltsAnswerValue = string | number | boolean | string[];
type SpeakingPart = 'part1' | 'part2' | 'part3';

export type StudentIeltsRecording = {
  id: string;
  durationSeconds: number;
};

export type StudentIeltsAttemptState = {
  startedAt: string;
  answers: Record<string, StudentIeltsAnswerValue>;
  writing: {
    task1: string;
    task2: string;
  };
  speakingRecordings: Partial<Record<SpeakingPart, StudentIeltsRecording>>;
  notes: Partial<Record<SpeakingPart, string>>;
};

export type StudentIeltsAttemptAvailability = {
  nextAttempt: number;
  maxAttempts: number | null;
  hasReachedMaxAttempts: boolean;
};

export const createInitialStudentIeltsAttempt = (
  startedAt = new Date().toISOString(),
): StudentIeltsAttemptState => ({
  startedAt,
  answers: {},
  writing: {
    task1: '',
    task2: '',
  },
  speakingRecordings: {},
  notes: {},
});

const hasAnswerValue = (value: StudentIeltsAnswerValue | undefined): boolean => {
  if (Array.isArray(value)) {
    return value.some(item => item.trim().length > 0);
  }
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  return value !== undefined;
};

const getQuestionIds = (
  config: IeltsReadingConfig | IeltsListeningConfig,
): string[] =>
  config.sections.flatMap(section => section.questions.map(question => question.id));

const getQuestions = (
  config: IeltsReadingConfig | IeltsListeningConfig,
): IeltsQuestion[] => config.sections.flatMap(section => section.questions);

const getDurationSeconds = (startedAt: string, submittedAt?: string): number | undefined => {
  if (!submittedAt) {
    return undefined;
  }
  const started = new Date(startedAt).getTime();
  const submitted = new Date(submittedAt).getTime();
  if (!Number.isFinite(started) || !Number.isFinite(submitted)) {
    return undefined;
  }
  return Math.max(0, Math.floor((submitted - started) / 1000));
};

const toBasePayload = ({
  attempt,
  state,
  submittedAt,
}: {
  attempt: number;
  state: StudentIeltsAttemptState;
  submittedAt?: string;
}) => {
  const durationSeconds = getDurationSeconds(state.startedAt, submittedAt);
  return {
    version: 1,
    attempt,
    startedAt: state.startedAt,
    ...(submittedAt ? { submittedAt } : {}),
    ...(durationSeconds !== undefined ? { durationSeconds } : {}),
  };
};

const buildAnswerPayload = (
  config: IeltsReadingConfig | IeltsListeningConfig,
  state: StudentIeltsAttemptState,
) =>
  getQuestions(config)
    .map(question => ({
      questionId: question.id,
      value: state.answers[question.id],
    }))
    .filter(answer => hasAnswerValue(answer.value));

const buildSpeakingRecordings = (state: StudentIeltsAttemptState) =>
  (['part1', 'part2', 'part3'] as SpeakingPart[])
    .map(part => {
      const recording = state.speakingRecordings[part];
      if (!recording?.id || recording.durationSeconds <= 0) {
        return null;
      }
      return {
        part,
        fileId: recording.id,
        durationSeconds: recording.durationSeconds,
      };
    })
    .filter((recording): recording is NonNullable<typeof recording> => Boolean(recording));

const buildSpeakingNotes = (state: StudentIeltsAttemptState) => {
  const entries = Object.entries(state.notes).filter(
    ([, value]) => typeof value === 'string' && value.trim().length > 0,
  );
  return entries.length ? Object.fromEntries(entries) : undefined;
};

export function buildStudentIeltsPayload({
  type,
  config,
  attempt,
  state,
  submittedAt,
}: {
  type: IeltsAssignmentType;
  config: IeltsAssignmentConfig;
  attempt: number;
  state: StudentIeltsAttemptState;
  submittedAt?: string;
}): Record<string, unknown> {
  const basePayload = toBasePayload({ attempt, state, submittedAt });

  if (type === 'reading' || type === 'listening') {
    return {
      ...basePayload,
      answers: buildAnswerPayload(config as IeltsReadingConfig | IeltsListeningConfig, state),
    };
  }

  if (type === 'writing') {
    return {
      ...basePayload,
      task1: {
        taskId: 'task1',
        text: state.writing.task1.trim(),
      },
      task2: {
        taskId: 'task2',
        text: state.writing.task2.trim(),
      },
    };
  }

  const notes = buildSpeakingNotes(state);
  return {
    ...basePayload,
    recordings: buildSpeakingRecordings(state),
    ...(notes ? { notes } : {}),
  };
}

export function hasStudentIeltsSubmissionContent(
  type: IeltsAssignmentType,
  config: IeltsAssignmentConfig,
  state: StudentIeltsAttemptState,
): boolean {
  if (type === 'reading' || type === 'listening') {
    const questionIds = new Set(
      getQuestionIds(config as IeltsReadingConfig | IeltsListeningConfig),
    );
    return Object.entries(state.answers).some(
      ([questionId, value]) => questionIds.has(questionId) && hasAnswerValue(value),
    );
  }

  if (type === 'writing') {
    return state.writing.task1.trim().length > 0 && state.writing.task2.trim().length > 0;
  }

  return buildSpeakingRecordings(state).length > 0;
}

export function getStudentIeltsAttemptAvailability({
  config,
  existingVersion,
  existingStatus,
}: {
  config: IeltsAssignmentConfig;
  existingVersion?: number;
  existingStatus?: SubmissionStatus;
}): StudentIeltsAttemptAvailability {
  const maxAttempts = config.attempts?.maxAttempts ?? null;
  const nextAttempt =
    existingVersion && existingStatus === 'draft'
      ? existingVersion
      : (existingVersion ?? 0) + 1;

  return {
    nextAttempt,
    maxAttempts,
    hasReachedMaxAttempts: maxAttempts !== null && nextAttempt > maxAttempts,
  };
}

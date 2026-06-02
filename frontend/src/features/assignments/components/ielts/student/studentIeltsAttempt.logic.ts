/**
 * Location: features/assignments/components/ielts/student/studentIeltsAttempt.logic.ts
 * Purpose: Build student IELTS attempt payloads from form state.
 * Why: Keeps IELTS submission serialization testable outside React rendering.
 */

import type { SubmissionStatus } from '@domain';
import type { SubmissionFile } from '@domain';
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
  file?: SubmissionFile;
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

const getNestedTargets = (
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

export const getAnswerTargetsForQuestion = (
  question: IeltsQuestion,
): StudentIeltsAnswerTarget[] => {
  const nestedTargets = [
    ...getNestedTargets(question, 'sentences'),
    ...getNestedTargets(question, 'statements'),
    ...getNestedTargets(question, 'items'),
  ];

  if (question.matchingItems?.length) {
    nestedTargets.push(
      ...question.matchingItems.map((item) => ({
        id: item.id,
        prompt: item.statement,
        options: matchingOptionsForQuestion(question),
        question,
      })),
    );
  }

  if (question.diagramLabels?.length) {
    nestedTargets.push(
      ...question.diagramLabels.map((label) => ({
        id: label.id,
        prompt: label.letter ? `${label.letter}. ${label.position}` : label.position,
        options: [],
        question,
      })),
    );
  }

  return nestedTargets.length
    ? nestedTargets
    : [
        {
          id: question.id,
          prompt: question.prompt,
          options: toQuestionOptions(question.options),
          question,
        },
      ];
};

export const getStudentIeltsAnswerTargets = (
  config: IeltsReadingConfig | IeltsListeningConfig,
): StudentIeltsAnswerTarget[] =>
  config.sections.flatMap(section =>
    section.questions.flatMap(question => getAnswerTargetsForQuestion(question)),
  );

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
  getStudentIeltsAnswerTargets(config)
    .map(target => ({
      questionId: target.id,
      value: normalizeAnswerValue(target, state.answers[target.id]),
    }))
    .filter(answer => hasAnswerValue(answer.value));

const normalizeAnswerValue = (
  target: StudentIeltsAnswerTarget,
  value: StudentIeltsAnswerValue | undefined,
): StudentIeltsAnswerValue | undefined => {
  if (typeof value !== 'string' || target.options.length === 0) {
    return value;
  }
  const optionIndex = Number(value);
  if (Number.isInteger(optionIndex) && optionIndex >= 0 && optionIndex < target.options.length) {
    return target.options[optionIndex].value;
  }
  return value;
};

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

const toStudentAnswerValue = (value: unknown): StudentIeltsAnswerValue | null => {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value) && value.every(item => typeof item === 'string')) {
    return value;
  }
  return null;
};

const toSyntheticRecordingFile = (fileId: string): SubmissionFile => ({
  id: fileId,
  name: 'Uploaded recording',
  size: 0,
  mime: 'audio/*',
  checksum: '',
  bucket: '',
  objectKey: '',
});

export function createStudentIeltsAttemptFromPayload(
  type: IeltsAssignmentType,
  payload: unknown,
  fallbackStartedAt = new Date().toISOString(),
): StudentIeltsAttemptState {
  const record = isRecord(payload) ? payload : {};
  const state = createInitialStudentIeltsAttempt(
    typeof record.startedAt === 'string' ? record.startedAt : fallbackStartedAt,
  );

  if (type === 'reading' || type === 'listening') {
    const answers = Array.isArray(record.answers) ? record.answers : [];
    return {
      ...state,
      answers: Object.fromEntries(
        answers
          .map((answer) => {
            if (!isRecord(answer) || typeof answer.questionId !== 'string') {
              return null;
            }
            const value = toStudentAnswerValue(answer.value);
            return value === null ? null : [answer.questionId, value];
          })
          .filter((entry): entry is [string, StudentIeltsAnswerValue] => Boolean(entry)),
      ),
    };
  }

  if (type === 'writing') {
    const task1 = isRecord(record.task1) ? record.task1 : {};
    const task2 = isRecord(record.task2) ? record.task2 : {};
    return {
      ...state,
      writing: {
        task1: typeof task1.text === 'string' ? task1.text : '',
        task2: typeof task2.text === 'string' ? task2.text : '',
      },
    };
  }

  const recordings = Array.isArray(record.recordings) ? record.recordings : [];
  const notes = isRecord(record.notes)
    ? Object.fromEntries(
        Object.entries(record.notes).filter(
          (entry): entry is [SpeakingPart, string] =>
            ['part1', 'part2', 'part3'].includes(entry[0]) && typeof entry[1] === 'string',
        ),
      )
    : {};
  return {
    ...state,
    speakingRecordings: Object.fromEntries(
      recordings
        .map((recording) => {
          if (
            !isRecord(recording) ||
            !['part1', 'part2', 'part3'].includes(String(recording.part)) ||
            typeof recording.fileId !== 'string' ||
            typeof recording.durationSeconds !== 'number'
          ) {
            return null;
          }
          return [
            recording.part,
            {
              id: recording.fileId,
              durationSeconds: recording.durationSeconds,
              file: toSyntheticRecordingFile(recording.fileId),
            },
          ];
        })
        .filter((entry): entry is [SpeakingPart, StudentIeltsRecording] => Boolean(entry)),
    ),
    notes,
  };
}

export function hasStudentIeltsSubmissionContent(
  type: IeltsAssignmentType,
  config: IeltsAssignmentConfig,
  state: StudentIeltsAttemptState,
): boolean {
  if (type === 'reading' || type === 'listening') {
    const questionIds = new Set(
      getStudentIeltsAnswerTargets(config as IeltsReadingConfig | IeltsListeningConfig).map(
        target => target.id,
      ),
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

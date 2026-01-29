/**
 * Location: src/lib/ielts.ts
 * Purpose: Define IELTS assignment config types and helpers for authoring UI.
 * Why: Keeps IELTS-specific shapes centralized and reusable across authoring flows.
 */

export type IeltsAssignmentType = 'reading' | 'listening' | 'writing' | 'speaking';

export const IELTS_ASSIGNMENT_TYPES: IeltsAssignmentType[] = [
  'reading',
  'listening',
  'writing',
  'speaking',
];

export const isIeltsAssignmentType = (value: string): value is IeltsAssignmentType =>
  IELTS_ASSIGNMENT_TYPES.includes(value as IeltsAssignmentType);

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

export type IeltsQuestionType =
  | 'multiple_choice'
  | 'true_false_not_given'
  | 'matching_headings'
  | 'matching_information'
  | 'sentence_completion'
  | 'summary_completion'
  | 'matching_features'
  | 'form_completion'
  | 'table_completion'
  | 'map_labeling'
  | 'short_answer';

export type IeltsQuestion = {
  id: string;
  type: IeltsQuestionType;
  prompt: string;
  options: string[];
  correctAnswer: string;
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
  task2: {
    prompt: string;
  };
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

const createId = () => {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `ielts-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const baseConfig = (): IeltsAssignmentBase => ({
  version: 1,
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

const createQuestion = (type: IeltsQuestionType = 'multiple_choice'): IeltsQuestion => ({
  id: createId(),
  type,
  prompt: '',
  options: [''],
  correctAnswer: '',
});

const createReadingSection = (index: number): IeltsReadingSection => ({
  id: createId(),
  title: `Passage ${index + 1}`,
  passage: '',
  questions: [createQuestion('multiple_choice')],
});

const createListeningSection = (index: number): IeltsListeningSection => ({
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
        task1: { prompt: '', imageFileId: null },
        task2: { prompt: '' },
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

const toNumber = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const toString = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value : fallback;

const toBoolean = (value: unknown, fallback: boolean) =>
  typeof value === 'boolean' ? value : fallback;

const normalizeQuestions = (value: unknown): IeltsQuestion[] => {
  if (!Array.isArray(value)) {
    return [createQuestion()];
  }

  const questions = value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      const record = item as Record<string, unknown>;
      return {
        id: toString(record.id, createId()),
        type: (record.type as IeltsQuestionType) ?? 'multiple_choice',
        prompt: toString(record.prompt),
        options: Array.isArray(record.options)
          ? record.options.map((option) => toString(option))
          : [''],
        correctAnswer: toString(record.correctAnswer),
      };
    })
    .filter((item): item is IeltsQuestion => Boolean(item));

  return questions.length ? questions : [createQuestion()];
};

const normalizeTiming = (
  value: unknown,
  fallback: IeltsTimingConfig,
): IeltsTimingConfig => {
  if (!value || typeof value !== 'object') {
    return fallback;
  }
  const record = value as Record<string, unknown>;
  return {
    enabled: toBoolean(record.enabled, fallback.enabled),
    durationMinutes: toNumber(record.durationMinutes, fallback.durationMinutes),
    enforce: toBoolean(record.enforce, fallback.enforce),
    startAt: typeof record.startAt === 'string' ? record.startAt : undefined,
    endAt: typeof record.endAt === 'string' ? record.endAt : undefined,
    autoSubmit: typeof record.autoSubmit === 'boolean' ? record.autoSubmit : undefined,
    rejectLateStart:
      typeof record.rejectLateStart === 'boolean' ? record.rejectLateStart : undefined,
  };
};

const normalizeAttempts = (
  value: unknown,
  fallback: IeltsAttemptsConfig,
): IeltsAttemptsConfig => {
  if (!value || typeof value !== 'object') {
    return fallback;
  }
  const record = value as Record<string, unknown>;
  const maxAttempts =
    typeof record.maxAttempts === 'number' && Number.isFinite(record.maxAttempts)
      ? record.maxAttempts
      : null;
  return {
    maxAttempts,
  };
};

export const normalizeIeltsAssignmentConfig = (
  type: IeltsAssignmentType,
  config: unknown,
): IeltsAssignmentConfig => {
  const base = createIeltsAssignmentConfig(type);
  if (!config || typeof config !== 'object') {
    return base;
  }

  const record = config as Record<string, unknown>;
  const normalizedBase: IeltsAssignmentBase = {
    ...base,
    timing: normalizeTiming(record.timing, base.timing),
    instructions: toString(record.instructions, base.instructions),
    attempts: normalizeAttempts(record.attempts, base.attempts),
  };

  switch (type) {
    case 'reading': {
      const sections = Array.isArray(record.sections)
        ? record.sections.map((section, index) => {
            const fallback = createReadingSection(index);
            if (!section || typeof section !== 'object') {
              return fallback;
            }
            const sectionRecord = section as Record<string, unknown>;
            return {
              ...fallback,
              id: toString(sectionRecord.id, fallback.id),
              title: toString(sectionRecord.title, fallback.title),
              passage: toString(sectionRecord.passage, fallback.passage),
              questions: normalizeQuestions(sectionRecord.questions),
            };
          })
        : (base as IeltsReadingConfig).sections;
      return {
        ...normalizedBase,
        sections: sections.length ? sections : (base as IeltsReadingConfig).sections,
      };
    }
    case 'listening': {
      const sections = Array.isArray(record.sections)
        ? record.sections.map((section, index) => {
            const fallback = createListeningSection(index);
            if (!section || typeof section !== 'object') {
              return fallback;
            }
            const sectionRecord = section as Record<string, unknown>;
            const playback =
              sectionRecord.playback && typeof sectionRecord.playback === 'object'
                ? (sectionRecord.playback as Record<string, unknown>)
                : {};
            return {
              ...fallback,
              id: toString(sectionRecord.id, fallback.id),
              title: toString(sectionRecord.title, fallback.title),
              audioFileId:
                sectionRecord.audioFileId === null
                  ? null
                  : toString(sectionRecord.audioFileId, fallback.audioFileId ?? ''),
              transcript: toString(sectionRecord.transcript, fallback.transcript ?? ''),
              playback: {
                limitPlays: toNumber(playback.limitPlays, fallback.playback?.limitPlays ?? 1),
              },
              questions: normalizeQuestions(sectionRecord.questions),
            };
          })
        : (base as IeltsListeningConfig).sections;
      return {
        ...normalizedBase,
        sections: sections.length ? sections : (base as IeltsListeningConfig).sections,
      };
    }
    case 'writing': {
      const task1 =
        record.task1 && typeof record.task1 === 'object' ? (record.task1 as Record<string, unknown>) : {};
      const task2 =
        record.task2 && typeof record.task2 === 'object' ? (record.task2 as Record<string, unknown>) : {};
      return {
        ...normalizedBase,
        task1: {
          prompt: toString(task1.prompt, (base as IeltsWritingConfig).task1.prompt),
          imageFileId:
            task1.imageFileId === null
              ? null
              : toString(task1.imageFileId, (base as IeltsWritingConfig).task1.imageFileId ?? ''),
        },
        task2: {
          prompt: toString(task2.prompt, (base as IeltsWritingConfig).task2.prompt),
        },
      };
    }
    case 'speaking': {
      const part1 =
        record.part1 && typeof record.part1 === 'object' ? (record.part1 as Record<string, unknown>) : {};
      const part2 =
        record.part2 && typeof record.part2 === 'object' ? (record.part2 as Record<string, unknown>) : {};
      const part3 =
        record.part3 && typeof record.part3 === 'object' ? (record.part3 as Record<string, unknown>) : {};
      const cueCard =
        part2.cueCard && typeof part2.cueCard === 'object'
          ? (part2.cueCard as Record<string, unknown>)
          : {};
      return {
        ...normalizedBase,
        part1: {
          questions: Array.isArray(part1.questions)
            ? part1.questions.map((item) => toString(item))
            : (base as IeltsSpeakingConfig).part1.questions,
        },
        part2: {
          cueCard: {
            topic: toString(cueCard.topic, (base as IeltsSpeakingConfig).part2.cueCard.topic),
            bulletPoints: Array.isArray(cueCard.bulletPoints)
              ? cueCard.bulletPoints.map((item) => toString(item))
              : (base as IeltsSpeakingConfig).part2.cueCard.bulletPoints,
          },
          prepSeconds: toNumber(part2.prepSeconds, (base as IeltsSpeakingConfig).part2.prepSeconds),
          talkSeconds: toNumber(part2.talkSeconds, (base as IeltsSpeakingConfig).part2.talkSeconds),
        },
        part3: {
          questions: Array.isArray(part3.questions)
            ? part3.questions.map((item) => toString(item))
            : (base as IeltsSpeakingConfig).part3.questions,
        },
      };
    }
    default:
      return base;
  }
};

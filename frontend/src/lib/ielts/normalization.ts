/**
 * Location: src/lib/ielts/normalization.ts
 * Purpose: Normalize stored IELTS assignment config into current frontend shapes.
 * Why: Keeps compatibility logic isolated from type declarations and default factories.
 */

import {
  createIeltsAssignmentConfig,
  createListeningSection,
  createReadingSection,
} from './factory';
import { normalizeQuestions } from './question-normalization';
import { toBoolean, toNumber, toString } from './normalization-utils';
import type {
  IeltsAssignmentBase,
  IeltsAssignmentAiPolicy,
  IeltsAssignmentConfig,
  IeltsAssignmentType,
  IeltsAttemptsConfig,
  IeltsListeningConfig,
  IeltsReadingConfig,
  IeltsSpeakingConfig,
  IeltsTimingConfig,
  IeltsWritingConfig,
  IeltsWritingTask1Type,
  ShowSampleTiming,
} from './types';

const writingFeedbackModes = [
  'off',
  'teacher_reviewed',
  'instant_student_visible',
] as const;
const objectiveExplanationsModes = ['off', 'on_demand_student_visible'] as const;
const providerTiers = ['auto', 'low_cost', 'premium'] as const;

const normalizeEnum = <TValue extends string>(
  value: unknown,
  allowed: readonly TValue[],
  fallback: TValue,
): TValue =>
  typeof value === 'string' && allowed.includes(value as TValue)
    ? (value as TValue)
    : fallback;

const normalizeOptionalId = (
  value: unknown,
  fallback: string | null = null,
): string | null => {
  if (value === null || value === undefined) {
    return fallback;
  }
  if (typeof value !== 'string') {
    return fallback;
  }
  const normalized = value.trim();
  if (
    !normalized ||
    normalized.toLowerCase() === 'none' ||
    normalized.toLowerCase() === 'undefined' ||
    normalized.toLowerCase() === 'null'
  ) {
    return null;
  }
  return normalized;
};

const normalizeAiPolicy = (
  value: unknown,
  fallback: IeltsAssignmentAiPolicy,
): IeltsAssignmentAiPolicy => {
  if (!value || typeof value !== 'object') {
    return fallback;
  }
  const record = value as Record<string, unknown>;
  return {
    writingFeedbackMode: normalizeEnum(
      record.writingFeedbackMode,
      writingFeedbackModes,
      fallback.writingFeedbackMode,
    ),
    objectiveExplanations: normalizeEnum(
      record.objectiveExplanations,
      objectiveExplanationsModes,
      fallback.objectiveExplanations,
    ),
    providerTier: normalizeEnum(record.providerTier, providerTiers, fallback.providerTier),
  };
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
    aiPolicy: normalizeAiPolicy(record.aiPolicy, base.aiPolicy),
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
        record.task1 && typeof record.task1 === 'object'
          ? (record.task1 as Record<string, unknown>)
          : {};
      const task2 =
        record.task2 && typeof record.task2 === 'object'
          ? (record.task2 as Record<string, unknown>)
          : {};
      const baseConfig = base as IeltsWritingConfig;
      return {
        ...normalizedBase,
        task1: {
          prompt: toString(task1.prompt, baseConfig.task1.prompt),
          imageFileId:
            task1.imageFileId === null
              ? null
              : toString(task1.imageFileId, baseConfig.task1.imageFileId ?? ''),
          visualType:
            typeof task1.visualType === 'string'
              ? task1.visualType as IeltsWritingTask1Type
              : baseConfig.task1.visualType,
          sampleResponse: toString(task1.sampleResponse, baseConfig.task1.sampleResponse ?? ''),
          showSampleToStudents: toBoolean(
            task1.showSampleToStudents,
            baseConfig.task1.showSampleToStudents ?? false,
          ),
          showSampleTiming:
            typeof task1.showSampleTiming === 'string'
              ? task1.showSampleTiming as ShowSampleTiming
              : baseConfig.task1.showSampleTiming,
          showSampleDate:
            typeof task1.showSampleDate === 'string'
              ? task1.showSampleDate
              : baseConfig.task1.showSampleDate,
          rubricId: normalizeOptionalId(task1.rubricId, baseConfig.task1.rubricId ?? null),
        },
        task2: {
          prompt: toString(task2.prompt, baseConfig.task2.prompt),
          sampleResponse: toString(task2.sampleResponse, baseConfig.task2.sampleResponse ?? ''),
          showSampleToStudents: toBoolean(
            task2.showSampleToStudents,
            baseConfig.task2.showSampleToStudents ?? false,
          ),
          showSampleTiming:
            typeof task2.showSampleTiming === 'string'
              ? task2.showSampleTiming as ShowSampleTiming
              : baseConfig.task2.showSampleTiming,
          showSampleDate:
            typeof task2.showSampleDate === 'string'
              ? task2.showSampleDate
              : baseConfig.task2.showSampleDate,
          rubricId: normalizeOptionalId(task2.rubricId, baseConfig.task2.rubricId ?? null),
        },
      };
    }
    case 'speaking': {
      const part1 =
        record.part1 && typeof record.part1 === 'object'
          ? (record.part1 as Record<string, unknown>)
          : {};
      const part2 =
        record.part2 && typeof record.part2 === 'object'
          ? (record.part2 as Record<string, unknown>)
          : {};
      const part3 =
        record.part3 && typeof record.part3 === 'object'
          ? (record.part3 as Record<string, unknown>)
          : {};
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

/**
 * Location: features/assignments/components/IeltsSubmissionPayloadView.logic.ts
 * Purpose: Convert stored IELTS submission payloads into readable review sections.
 * Why: Teacher and student review surfaces need the same safe payload interpretation.
 */

import type {
  IeltsAssignmentType,
  IeltsListeningConfig,
  IeltsReadingConfig,
  IeltsWritingConfig,
} from '@lib/ielts';
import { normalizeIeltsAssignmentConfig } from '@lib/ielts';
import { stripHtml } from '@lib/rich-text';
import { getAnswerTargetsForQuestion } from './ielts/student/studentIeltsAnswerTargets';

export type IeltsSubmissionDisplayRow = {
  label: string;
  value: string;
};

export type IeltsSubmissionDisplaySection = {
  title: string;
  prompt?: string;
  text?: string;
  rows?: IeltsSubmissionDisplayRow[];
};

export type IeltsSubmissionDisplay = {
  metadata: IeltsSubmissionDisplayRow[];
  sections: IeltsSubmissionDisplaySection[];
  fallback?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toTrimmedString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const toAnswerValue = (value: unknown): string => {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value
      .map(item => toAnswerValue(item))
      .filter(Boolean)
      .join(', ');
  }
  return '';
};

const toDisplayPrompt = (value: string): string => stripHtml(value).trim();

const toOptionLabel = (
  target: ReturnType<typeof getAnswerTargetsForQuestion>[number],
  value: unknown,
): string => {
  const rawValue = toAnswerValue(value);
  const option = target.options.find(item => item.value === rawValue);
  return option?.label || rawValue;
};

const formatDuration = (value: unknown): string => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return '';
  }
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  if (minutes === 0) {
    return `${seconds}s`;
  }
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
};

const buildMetadata = (payload: Record<string, unknown>): IeltsSubmissionDisplayRow[] => {
  const metadata: IeltsSubmissionDisplayRow[] = [];
  if (typeof payload.attempt === 'number') {
    metadata.push({ label: 'Attempt', value: String(payload.attempt) });
  }
  if (typeof payload.version === 'number') {
    metadata.push({ label: 'Payload version', value: String(payload.version) });
  }
  const duration = formatDuration(payload.durationSeconds);
  if (duration) {
    metadata.push({ label: 'Duration', value: duration });
  }
  return metadata;
};

const buildWritingSections = (
  payload: Record<string, unknown>,
  config: unknown,
): IeltsSubmissionDisplaySection[] => {
  const writingConfig = normalizeIeltsAssignmentConfig('writing', config) as IeltsWritingConfig;
  const task1 = isRecord(payload.task1) ? payload.task1 : {};
  const task2 = isRecord(payload.task2) ? payload.task2 : {};
  const sections = [
    {
      title: 'Task 1',
      prompt: toDisplayPrompt(writingConfig.task1.prompt),
      text: toTrimmedString(task1.text),
    },
    {
      title: 'Task 2',
      prompt: toDisplayPrompt(writingConfig.task2.prompt),
      text: toTrimmedString(task2.text),
    },
  ];

  return sections.filter(section => Boolean(section.text));
};

const buildObjectiveSections = (
  type: 'reading' | 'listening',
  payload: Record<string, unknown>,
  config: unknown,
): IeltsSubmissionDisplaySection[] => {
  const normalizedConfig = normalizeIeltsAssignmentConfig(type, config) as
    | IeltsReadingConfig
    | IeltsListeningConfig;
  const answers = Array.isArray(payload.answers) ? payload.answers : [];
  const answersByQuestionId = new Map<string, unknown>();

  for (const answer of answers) {
    if (!isRecord(answer) || typeof answer.questionId !== 'string') {
      continue;
    }
    if (toAnswerValue(answer.value)) {
      answersByQuestionId.set(answer.questionId, answer.value);
    }
  }

  const renderedQuestionIds = new Set<string>();
  const sections: IeltsSubmissionDisplaySection[] = [];

  normalizedConfig.sections.forEach((section, sectionIndex) => {
    const rows = section.questions
      .flatMap(question => getAnswerTargetsForQuestion(question))
      .map((target): IeltsSubmissionDisplayRow | null => {
        const value = toOptionLabel(target, answersByQuestionId.get(target.id));
        if (!value) {
          return null;
        }
        renderedQuestionIds.add(target.id);
        return {
          label: target.prompt || target.id,
          value,
        };
      })
      .filter((row): row is IeltsSubmissionDisplayRow => Boolean(row));

    if (rows.length > 0) {
      sections.push({
        title: section.title || `Section ${sectionIndex + 1}`,
        rows,
      });
    }
  });

  const unmatchedRows = Array.from(answersByQuestionId.entries())
    .filter(([questionId]) => !renderedQuestionIds.has(questionId))
    .map(([questionId, value]) => ({
      label: questionId,
      value: toAnswerValue(value),
    }));

  if (unmatchedRows.length > 0) {
    sections.push({ title: 'Answers', rows: unmatchedRows });
  }

  return sections;
};

const buildSpeakingSections = (payload: Record<string, unknown>): IeltsSubmissionDisplaySection[] => {
  const sections: IeltsSubmissionDisplaySection[] = [];
  if (isRecord(payload.notes)) {
    const rows = Object.entries(payload.notes)
      .map(([part, value]) => ({
        label: part,
        value: toTrimmedString(value),
      }))
      .filter(row => Boolean(row.value));
    if (rows.length > 0) {
      sections.push({ title: 'Notes', rows });
    }
  }

  const recordings = Array.isArray(payload.recordings) ? payload.recordings : [];
  const recordingRows = recordings
    .map((recording): IeltsSubmissionDisplayRow | null => {
      if (!isRecord(recording) || typeof recording.part !== 'string') {
        return null;
      }
      const fileName = toTrimmedString(recording.fileName);
      const fileId = toTrimmedString(recording.fileId);
      const duration = formatDuration(recording.durationSeconds);
      const details = [fileName || fileId, duration].filter(Boolean).join(' · ');
      return details ? { label: recording.part, value: details } : null;
    })
    .filter((row): row is IeltsSubmissionDisplayRow => Boolean(row));

  if (recordingRows.length > 0) {
    sections.push({ title: 'Recordings', rows: recordingRows });
  }

  return sections;
};

export const buildIeltsSubmissionDisplay = ({
  type,
  payload,
  assignmentConfig,
}: {
  type: IeltsAssignmentType;
  payload: unknown;
  assignmentConfig?: Record<string, unknown> | null;
}): IeltsSubmissionDisplay => {
  if (!isRecord(payload)) {
    return {
      metadata: [],
      sections: [],
      fallback: 'Submitted IELTS payload could not be displayed.',
    };
  }

  const sections =
    type === 'writing'
      ? buildWritingSections(payload, assignmentConfig)
      : type === 'reading' || type === 'listening'
        ? buildObjectiveSections(type, payload, assignmentConfig)
        : buildSpeakingSections(payload);

  return {
    metadata: buildMetadata(payload),
    sections,
    fallback:
      sections.length === 0
        ? 'Submitted IELTS payload does not include displayable response content.'
        : undefined,
  };
};

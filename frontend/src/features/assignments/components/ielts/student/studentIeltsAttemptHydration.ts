/**
 * Location: features/assignments/components/ielts/student/studentIeltsAttemptHydration.ts
 * Purpose: Recover student IELTS attempt state from persisted submission payloads.
 * Why: Draft recovery should stay separate from payload serialization.
 */

import type { SubmissionFile } from '@domain';
import type { IeltsAssignmentType } from '@lib/ielts';
import {
  createInitialStudentIeltsAttempt,
  type SpeakingPart,
  type StudentIeltsAnswerValue,
  type StudentIeltsAttemptState,
  type StudentIeltsRecording,
} from './studentIeltsAttempt.logic';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

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

const recoverAnswers = (
  state: StudentIeltsAttemptState,
  record: Record<string, unknown>,
): StudentIeltsAttemptState => {
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
};

const recoverWriting = (
  state: StudentIeltsAttemptState,
  record: Record<string, unknown>,
): StudentIeltsAttemptState => {
  const task1 = isRecord(record.task1) ? record.task1 : {};
  const task2 = isRecord(record.task2) ? record.task2 : {};
  return {
    ...state,
    writing: {
      task1: typeof task1.text === 'string' ? task1.text : '',
      task2: typeof task2.text === 'string' ? task2.text : '',
    },
  };
};

const recoverSpeaking = (
  state: StudentIeltsAttemptState,
  record: Record<string, unknown>,
): StudentIeltsAttemptState => {
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
};

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
    return recoverAnswers(state, record);
  }
  if (type === 'writing') {
    return recoverWriting(state, record);
  }
  return recoverSpeaking(state, record);
}

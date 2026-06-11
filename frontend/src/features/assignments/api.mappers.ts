/**
 * Location: features/assignments/api.mappers.ts
 * Purpose: Convert assignment API DTOs into UI domain models.
 * Why: Keeps data-shape compatibility logic out of React Query hook definitions.
 */

import type { Assignment, Submission, SubmissionFile } from '@domain';
import { isIeltsAssignmentType } from '@lib/ielts';
import type { ApiAssignment, ApiSubmission } from './api.types';

const safeParseJson = (value: string): Record<string, unknown> | null => {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const formatPercent = (value: number): string =>
  Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/\.?0+$/, '');

const formatLatePolicy = (
  policy: Record<string, unknown> | string | null,
): string => {
  if (!policy) {
    return '';
  }

  const record = typeof policy === 'string' ? safeParseJson(policy) : policy;
  if (!record) {
    return typeof policy === 'string' ? policy : JSON.stringify(policy);
  }

  if (record.type === 'percent' && typeof record.value === 'number') {
    return `${formatPercent(record.value)}% late penalty`;
  }

  return JSON.stringify(record);
};

const maxScoreForAssignmentType = (type: ApiAssignment['type']): number =>
  isIeltsAssignmentType(type) ? 9 : 100;

export const toAssignment = (
  assignment: ApiAssignment,
  courseName: string,
): Assignment => {
  const latePolicy = formatLatePolicy(assignment.latePolicy);

  const assignmentConfig =
    typeof assignment.assignmentConfig === 'string'
      ? safeParseJson(assignment.assignmentConfig)
      : (assignment.assignmentConfig ?? null);

  return {
    id: assignment.id,
    title: assignment.title,
    description: assignment.description ?? '',
    type: assignment.type,
    courseId: assignment.courseId,
    courseName,
    dueAt: assignment.dueAt ? new Date(assignment.dueAt) : new Date(),
    publishedAt: assignment.publishedAt
      ? new Date(assignment.publishedAt)
      : undefined,
    status: assignment.publishedAt ? 'published' : 'draft',
    latePolicy,
    maxScore: maxScoreForAssignmentType(assignment.type),
    assignmentConfig,
  };
};

const toSubmissionFile = (item: unknown): SubmissionFile | null => {
  if (typeof item === 'string') {
    return {
      id: item,
      name: item,
      size: 0,
      mime: 'application/octet-stream',
      checksum: '',
      bucket: '',
      objectKey: '',
    };
  }

  if (!item || typeof item !== 'object') {
    return null;
  }

  const record = item as Record<string, unknown>;
  const name = typeof record.name === 'string' ? record.name : 'Uploaded file';
  const id = typeof record.id === 'string' ? record.id : name;
  const size = typeof record.size === 'number' ? record.size : 0;
  const mime =
    typeof record.mime === 'string' ? record.mime : 'application/octet-stream';
  const checksum = typeof record.checksum === 'string' ? record.checksum : '';
  const bucket = typeof record.bucket === 'string' ? record.bucket : '';
  const objectKey =
    typeof record.objectKey === 'string' ? record.objectKey : '';

  return { id, name, size, mime, checksum, bucket, objectKey };
};

const toSpeakingRecordingFile = (item: unknown): SubmissionFile | null => {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const record = item as Record<string, unknown>;
  if (typeof record.fileId !== 'string') {
    return null;
  }

  return {
    id: record.fileId,
    name:
      typeof record.fileName === 'string'
        ? record.fileName
        : 'Uploaded recording',
    size: typeof record.size === 'number' ? record.size : 0,
    mime:
      typeof record.mime === 'string'
        ? record.mime
        : 'application/octet-stream',
    checksum: typeof record.checksum === 'string' ? record.checksum : '',
    bucket: typeof record.bucket === 'string' ? record.bucket : '',
    objectKey: typeof record.objectKey === 'string' ? record.objectKey : '',
  };
};

const toSubmissionFiles = (
  payloadRecord: Record<string, unknown>,
): SubmissionFile[] | undefined => {
  const files = Array.isArray(payloadRecord.files)
    ? payloadRecord.files
        .map(toSubmissionFile)
        .filter((item): item is SubmissionFile => Boolean(item))
    : [];
  const recordingFiles = Array.isArray(payloadRecord.recordings)
    ? payloadRecord.recordings
        .map(toSpeakingRecordingFile)
        .filter((item): item is SubmissionFile => Boolean(item))
    : [];
  const mergedFiles = [...files, ...recordingFiles];

  return mergedFiles.length > 0 ? mergedFiles : undefined;
};

export const toSubmission = (submission: ApiSubmission): Submission => {
  const payload = submission.payload ?? {};
  const payloadRecord = payload as Record<string, unknown>;
  const files = toSubmissionFiles(payloadRecord);

  return {
    id: submission.id,
    assignmentId: submission.assignmentId,
    studentId: submission.studentId,
    studentName:
      typeof payloadRecord.studentName === 'string'
        ? payloadRecord.studentName
        : 'Student',
    status: submission.status,
    submittedAt: submission.submittedAt
      ? new Date(submission.submittedAt)
      : undefined,
    content:
      typeof payloadRecord.content === 'string'
        ? payloadRecord.content
        : undefined,
    files,
    version:
      typeof payloadRecord.version === 'number' ? payloadRecord.version : 1,
    rawPayload: payloadRecord,
  };
};

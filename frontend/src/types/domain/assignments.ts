/**
 * Location: src/types/domain/assignments.ts
 * Purpose: Define shared assignment, submission, and upload domain types.
 * Why: Centralizes frontend contracts without relying on mock data modules.
 */

export type AssignmentType =
  | 'file'
  | 'link'
  | 'text'
  | 'quiz'
  | 'reading'
  | 'listening'
  | 'writing'
  | 'speaking';

export type AssignmentStatus = 'draft' | 'published' | 'archived';
export type SubmissionStatus = 'not_submitted' | 'draft' | 'submitted' | 'late' | 'graded';

export type SubmissionFile = {
  id: string;
  name: string;
  size: number;
  mime: string;
  checksum: string;
  bucket: string;
  objectKey: string;
};

/**
 * UploadFile - Used for temporary file uploads during authoring.
 * Contains client-side metadata including a blob URL for preview.
 * This is NOT stored in the database - files must be uploaded to server first.
 */
export type UploadFile = {
  id: string;
  name: string;
  size: number;
  mime: string;
  url: string;
  createdAt: string;
};

export type Assignment = {
  id: string;
  title: string;
  description: string;
  type: AssignmentType;
  courseId: string;
  courseName: string;
  dueAt: Date;
  publishedAt?: Date;
  status: AssignmentStatus;
  latePolicy: string;
  maxScore: number;
  assignmentConfig?: Record<string, unknown> | null;
};

export type Submission = {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  status: SubmissionStatus;
  submittedAt?: Date;
  content?: string;
  files?: SubmissionFile[];
  version: number;
};

export type Enrollment = {
  id: string;
  userId: string;
  courseId: string;
  enrolledAt: Date;
};

/**
 * Location: src/types/domain/index.ts
 * Purpose: Re-export shared domain type contracts for frontend features.
 * Why: Provides a single import surface after removing mock-data dependencies.
 */

export type { Role, User } from './auth';
export type { Course } from './courses';
export type {
  AssignmentType,
  AssignmentStatus,
  SubmissionStatus,
  SubmissionFile,
  UploadFile,
  Assignment,
  Submission,
  Enrollment,
} from './assignments';
export type { Grade } from './grades';
export type { Notification } from './notifications';
export type { AuditLog } from './admin';

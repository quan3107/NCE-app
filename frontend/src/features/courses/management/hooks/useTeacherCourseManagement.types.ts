/**
 * Location: features/courses/management/hooks/useTeacherCourseManagement.types.ts
 * Purpose: Define the teacher course management hook view-model and handler contracts.
 * Why: Keeps type declarations separate from stateful hook behavior.
 */

import type { Assignment } from '@domain';
import type {
  CourseArchiveState,
  CourseDetailsState,
  EnrollmentState,
  ManagedCourse,
  RubricCriterion,
} from '../types';

export type EnrollmentHandlers = {
  setNewStudentEmail: (value: string) => void;
  addStudent: () => Promise<void>;
  removeStudent: (studentId: string, studentName: string) => Promise<void>;
};

export type CourseDetailsHandlers = {
  setTitle: (value: string) => void;
  setDescription: (value: string) => void;
  setSchedule: (value: string) => void;
  setDuration: (value: string) => void;
  setLevel: (value: string) => void;
  setPrice: (value: string) => void;
  save: () => Promise<void>;
};

export type CourseArchiveHandlers = {
  archive: () => Promise<void>;
  restore: () => Promise<void>;
};

export type DialogState = {
  showAddStudent: boolean;
  setShowAddStudent: (open: boolean) => void;
};

export type CourseManagementViewModel = {
  course?: ManagedCourse;
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  details: CourseDetailsState;
  detailsHandlers: CourseDetailsHandlers;
  enrollment: EnrollmentState;
  enrollmentHandlers: EnrollmentHandlers;
  assignments: Assignment[];
  rubric: {
    criteria: RubricCriterion[];
    totalWeight: number;
  };
  archive: CourseArchiveState;
  archiveHandlers: CourseArchiveHandlers;
  dialogs: DialogState;
};

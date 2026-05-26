/**
 * Location: features/courses/management/hooks/useTeacherCourseManagement.types.ts
 * Purpose: Define the teacher course management hook view-model and handler contracts.
 * Why: Keeps type declarations separate from stateful hook behavior.
 */

import type { Assignment } from '@domain';
import type {
  AnnouncementDraft,
  CourseDetailsState,
  EnrollmentState,
  ManagedCourse,
  RubricCriterion,
} from '../types';

export type EnrollmentHandlers = {
  setNewStudentEmail: (value: string) => void;
  addStudent: () => Promise<void>;
  removeStudent: (studentId: string, studentName: string) => void;
};

export type CourseDetailsHandlers = {
  setTitle: (value: string) => void;
  setDescription: (value: string) => void;
  setSchedule: (value: string) => void;
  setDuration: (value: string) => void;
  setLevel: (value: string) => void;
  setPrice: (value: string) => void;
  save: () => void;
};

export type AnnouncementHandlers = {
  setTitle: (value: string) => void;
  setMessage: (value: string) => void;
  setSendEmail: (value: boolean) => void;
  create: () => void;
};

export type RubricHandlers = {
  setCriteria: (criteria: RubricCriterion[]) => void;
  updateWeight: (index: number, weight: number) => void;
  save: () => void;
};

export type DialogState = {
  showAddStudent: boolean;
  setShowAddStudent: (open: boolean) => void;
  showAnnouncement: boolean;
  setShowAnnouncement: (open: boolean) => void;
  showEditRubric: boolean;
  setShowEditRubric: (open: boolean) => void;
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
  announcements: AnnouncementDraft;
  announcementHandlers: AnnouncementHandlers;
  rubric: {
    criteria: RubricCriterion[];
    totalWeight: number;
  };
  rubricHandlers: RubricHandlers;
  dialogs: DialogState;
};

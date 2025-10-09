/**
 * Location: features/courses/management/types.ts
 * Purpose: Share typed contracts for the teacher course management refactor.
 * Why: Keeps components and hooks aligned on data/state shapes after splitting files.
 */

import type { Assignment, Course, User } from '@lib/mock-data';

export type RubricCriterion = {
  name: string;
  weight: number;
  description: string;
};

export type CourseDetailsState = {
  title: string;
  description: string;
  schedule: string;
  duration: string;
  level: string;
  price: string;
};

export type EnrollmentState = {
  students: User[];
  newStudentEmail: string;
};

export type AnnouncementDraft = {
  title: string;
  message: string;
  sendEmail: boolean;
};

export type RubricState = {
  criteria: RubricCriterion[];
  totalWeight: number;
};

export type CourseManagementData = {
  course?: Course;
  details: CourseDetailsState;
  enrollment: EnrollmentState;
  announcements: AnnouncementDraft;
  assignments: Assignment[];
  rubric: RubricState;
};

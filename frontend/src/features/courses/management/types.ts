/**
 * Location: features/courses/management/types.ts
 * Purpose: Share typed contracts for the teacher course management refactor.
 * Why: Keeps components and hooks aligned on data/state shapes after splitting files.
 */

import type { Assignment } from '@types/domain';

export type ManagedCourse = {
  id: string;
  title: string;
  description: string | null;
  scheduleLabel: string | null;
  level: string | null;
  duration: string | null;
  price: number | null;
  teacherName: string;
  teacherId: string;
  teacherEmail: string;
  metrics: {
    activeStudentCount: number;
    invitedStudentCount: number;
    teacherCount: number;
    assignmentCount: number;
    rubricCount: number;
  };
};

export type EnrolledStudent = {
  id: string;
  name: string;
  email: string;
  status: 'active' | 'invited' | 'suspended';
  enrolledAt: string;
};

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
  students: EnrolledStudent[];
  newStudentEmail: string;
  isAddingStudent: boolean;
  addStudentError: string | null;
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
  course?: ManagedCourse;
  details: CourseDetailsState;
  enrollment: EnrollmentState;
  announcements: AnnouncementDraft;
  assignments: Assignment[];
  rubric: RubricState;
};

/**
 * File: src/modules/courses/courses.types.ts
 * Purpose: Centralize shared course domain types for service layers.
 * Why: Keeps service files lean while reusing consistent response contracts.
 */
import type { UserRole, UserStatus } from "../../prisma/index.js";

export type CourseManager = {
  id: string;
  role: UserRole;
};

export type CourseStudent = {
  id: string;
  fullName: string;
  email: string;
  status: UserStatus;
  enrolledAt: string;
};

export type CourseStudentsResponse = {
  courseId: string;
  students: CourseStudent[];
};

export type CourseMetrics = {
  activeStudentCount: number;
  invitedStudentCount: number;
  teacherCount: number;
  assignmentCount: number;
  rubricCount: number;
};

export type CourseSchedule = {
  cadence: string | null;
  startTime: string | null;
  durationMinutes: number | null;
  timeZone: string | null;
  format: string | null;
  label: string | null;
};

export type CourseMetadata = {
  duration: string | null;
  level: string | null;
  price: number | null;
};

export type CourseSummary = {
  id: string;
  title: string;
  description: string | null;
  schedule: CourseSchedule | null;
  metadata: CourseMetadata;
  owner: {
    id: string;
    fullName: string;
    email: string;
  };
  metrics: CourseMetrics;
  learningOutcomes?: unknown;
  structureSummary?: string | null;
  prerequisitesSummary?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CourseListResponse = {
  courses: CourseSummary[];
};

export type CourseDetailResponse = CourseSummary;

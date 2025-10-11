/**
 * File: src/modules/courses/courses.types.ts
 * Purpose: Centralize shared course domain types for service layers.
 * Why: Keeps service files lean while reusing consistent response contracts.
 */
import type { UserRole, UserStatus } from "@prisma/client";

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

export type CourseSummary = {
  id: string;
  title: string;
  description: string | null;
  schedule: Record<string, unknown> | null;
  owner: {
    id: string;
    fullName: string;
    email: string;
  };
  metrics: CourseMetrics;
  createdAt: string;
  updatedAt: string;
};

export type CourseListResponse = {
  courses: CourseSummary[];
};

export type CourseDetailResponse = CourseSummary;

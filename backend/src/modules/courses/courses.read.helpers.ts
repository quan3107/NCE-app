/**
 * File: src/modules/courses/courses.read.helpers.ts
 * Purpose: Share course parsing and mapping helpers for public and authenticated queries.
 * Why: Keeps the read service focused while keeping course DTO logic reusable.
 */
import { EnrollmentRole, UserStatus } from "../../prisma/index.js";

import type {
  CourseMetadata,
  CourseMetrics,
  CourseSchedule,
  CourseSummary,
} from "./courses.types.js";

export type CourseWithRelations = {
  id: string;
  title: string;
  description: string | null;
  scheduleJson: unknown;
  ownerId: string;
  owner: {
    id: string;
    fullName: string;
    email: string;
  };
  enrollments: Array<{
    roleInCourse: EnrollmentRole;
    userId: string;
    user: {
      status: UserStatus;
    };
  }>;
  _count: {
    assignments: number;
    rubrics: number;
  };
  learningOutcomes?: unknown;
  structureSummary?: string | null;
  prerequisitesSummary?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PublicCourseRow = {
  id: string;
  title: string;
  description: string | null;
  scheduleJson: unknown;
  ownerId: string;
  ownerName: string | null;
  activeStudentCount: number | null;
  invitedStudentCount: number | null;
  teacherCount: number | null;
  assignmentCount: number | null;
  rubricCount: number | null;
  learningOutcomes?: unknown;
  structureSummary?: string | null;
  prerequisitesSummary?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type ParsedCourseConfig = {
  schedule: CourseSchedule | null;
  metadata: CourseMetadata;
};

const readString = (
  source: Record<string, unknown>,
  keys: string[],
): string | null => {
  for (const key of keys) {
    const candidate = source[key];
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate;
    }
  }
  return null;
};

const readNumber = (
  source: Record<string, unknown>,
  keys: string[],
): number | null => {
  for (const key of keys) {
    const candidate = source[key];
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
  }
  return null;
};

const parseCourseConfig = (value: unknown): ParsedCourseConfig => {
  const fallbackMetadata: CourseMetadata = {
    duration: null,
    level: null,
    price: null,
  };

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      schedule: null,
      metadata: fallbackMetadata,
    };
  }

  const record = value as Record<string, unknown>;

  const schedule: CourseSchedule = {
    cadence: readString(record, ["cadence"]),
    startTime: readString(record, ["start_time", "startTime"]),
    durationMinutes: readNumber(record, ["duration_minutes", "durationMinutes"]),
    timeZone: readString(record, ["time_zone", "timeZone"]),
    format: readString(record, ["format"]),
    label: readString(record, ["label", "schedule_label"]),
  };

  const hasScheduleValue = Object.values(schedule).some(
    (entry) => entry !== null,
  );

  const metadata: CourseMetadata = {
    duration: readString(record, [
      "duration",
      "duration_label",
      "durationLabel",
      "duration_weeks",
    ]),
    level: readString(record, ["level"]),
    price: readNumber(record, ["price", "tuition"]),
  };

  return {
    schedule: hasScheduleValue ? schedule : null,
    metadata,
  };
};

const courseMetricsFromEnrollments = (
  course: CourseWithRelations,
): CourseMetrics => {
  const metrics: CourseMetrics = {
    activeStudentCount: 0,
    invitedStudentCount: 0,
    teacherCount: 0,
    assignmentCount: course._count.assignments,
    rubricCount: course._count.rubrics,
    completionRatePercent: 0,
  };

  for (const enrollment of course.enrollments) {
    if (enrollment.roleInCourse === EnrollmentRole.student) {
      if (enrollment.user.status === UserStatus.invited) {
        metrics.invitedStudentCount += 1;
      } else {
        metrics.activeStudentCount += 1;
      }
      continue;
    }

    if (enrollment.roleInCourse === EnrollmentRole.teacher) {
      metrics.teacherCount += 1;
    }
  }

  return metrics;
};

const courseMetricsFromPublicRow = (
  course: PublicCourseRow,
): CourseMetrics => ({
  activeStudentCount: course.activeStudentCount ?? 0,
  invitedStudentCount: course.invitedStudentCount ?? 0,
  teacherCount: course.teacherCount ?? 0,
  assignmentCount: course.assignmentCount ?? 0,
  rubricCount: course.rubricCount ?? 0,
  completionRatePercent: 0,
});

const toIsoString = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

export const toCourseSummary = (
  course: CourseWithRelations,
): CourseSummary => ({
  id: course.id,
  title: course.title,
  description: course.description,
  ...parseCourseConfig(course.scheduleJson),
  owner: course.owner,
  metrics: courseMetricsFromEnrollments(course),
  learningOutcomes: course.learningOutcomes,
  structureSummary: course.structureSummary ?? null,
  prerequisitesSummary: course.prerequisitesSummary ?? null,
  createdAt: course.createdAt.toISOString(),
  updatedAt: course.updatedAt.toISOString(),
});

export const toPublicCourseSummary = (
  course: PublicCourseRow,
): CourseSummary => ({
  id: course.id,
  title: course.title,
  description: course.description,
  ...parseCourseConfig(course.scheduleJson),
  owner: {
    id: course.ownerId,
    fullName: course.ownerName ?? "Instructor",
    email: "",
  },
  metrics: courseMetricsFromPublicRow(course),
  learningOutcomes: course.learningOutcomes,
  structureSummary: course.structureSummary ?? null,
  prerequisitesSummary: course.prerequisitesSummary ?? null,
  createdAt: toIsoString(course.createdAt),
  updatedAt: toIsoString(course.updatedAt),
});

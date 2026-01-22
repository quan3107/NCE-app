/**
 * File: src/modules/analytics/analytics.utils.ts
 * Purpose: Provide lightweight helpers for analytics calculations.
 * Why: Keeps analytics service logic readable and within size limits.
 */
import { Prisma, SubmissionStatus } from "@prisma/client";

import type { AnalyticsCourseSummary } from "./analytics.types.js";

type CourseRecord = {
  id: string;
  title: string;
};

type AssignmentRecord = {
  id: string;
  courseId: string;
  dueAt: Date | null;
};

type SubmissionRecord = {
  assignmentId: string;
  status: SubmissionStatus;
  submittedAt: Date | null;
  createdAt: Date;
};

type CourseStats = {
  courseId: string;
  courseTitle: string;
  submissionCount: number;
  gradedCount: number;
  onTimeCount: number;
  scoreSum: number;
  scoreCount: number;
  turnaroundSumDays: number;
  turnaroundCount: number;
};

type RubricTotals = {
  sum: number;
  count: number;
};

export type { AssignmentRecord, CourseRecord, CourseStats, RubricTotals, SubmissionRecord };

export const NON_DRAFT_STATUSES: SubmissionStatus[] = [
  "submitted",
  "late",
  "graded",
];

export const toNumber = (value: unknown): number | null => {
  if (value instanceof Prisma.Decimal) {
    return value.toNumber();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export const safeAverage = (sum: number, count: number): number | null => {
  if (count <= 0) {
    return null;
  }
  return Math.round((sum / count) * 100) / 100;
};

export const safeRate = (numerator: number, denominator: number): number | null => {
  if (denominator <= 0) {
    return null;
  }
  return Math.round((numerator / denominator) * 1000) / 10;
};

export const readRubricBreakdown = (
  value: unknown,
): Array<{ criterion: string; points: number }> => {
  if (!Array.isArray(value)) {
    return [];
  }

  const results: Array<{ criterion: string; points: number }> = [];

  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const record = item as Record<string, unknown>;
    const criterion =
      typeof record.criterion === "string" ? record.criterion.trim() : "";
    const points = toNumber(record.points);

    if (criterion && points !== null) {
      results.push({ criterion, points });
    }
  }

  return results;
};

export const buildCourseStats = (
  courses: CourseRecord[],
): Map<string, CourseStats> => {
  const map = new Map<string, CourseStats>();

  for (const course of courses) {
    map.set(course.id, {
      courseId: course.id,
      courseTitle: course.title,
      submissionCount: 0,
      gradedCount: 0,
      onTimeCount: 0,
      scoreSum: 0,
      scoreCount: 0,
      turnaroundSumDays: 0,
      turnaroundCount: 0,
    });
  }

  return map;
};

export const isSubmissionOnTime = (
  submission: SubmissionRecord,
  assignment: AssignmentRecord | undefined,
): boolean => {
  if (!assignment) {
    return submission.status !== "late";
  }

  const submittedAt = submission.submittedAt ?? submission.createdAt;

  if (assignment.dueAt && submittedAt) {
    return submittedAt.getTime() <= assignment.dueAt.getTime();
  }

  return submission.status !== "late";
};

export const toCourseSummary = (
  stats: CourseStats,
): AnalyticsCourseSummary => ({
  courseId: stats.courseId,
  courseTitle: stats.courseTitle,
  submissionCount: stats.submissionCount,
  gradedCount: stats.gradedCount,
  onTimeRate: safeRate(stats.onTimeCount, stats.submissionCount),
  averageScore: safeAverage(stats.scoreSum, stats.scoreCount),
  averageTurnaroundDays: safeAverage(
    stats.turnaroundSumDays,
    stats.turnaroundCount,
  ),
});

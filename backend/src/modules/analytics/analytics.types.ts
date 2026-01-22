/**
 * File: src/modules/analytics/analytics.types.ts
 * Purpose: Share response contracts for analytics aggregates.
 * Why: Keeps analytics route/service aligned on stable JSON shapes.
 */

export type AnalyticsCourseSummary = {
  courseId: string;
  courseTitle: string;
  submissionCount: number;
  gradedCount: number;
  onTimeRate: number | null;
  averageScore: number | null;
  averageTurnaroundDays: number | null;
};

export type AnalyticsRubricAverage = {
  criterion: string;
  averageScore: number;
  sampleSize: number;
};

export type TeacherAnalyticsResponse = {
  teacherId: string;
  courseCount: number;
  onTimeRate: number | null;
  averageScore: number | null;
  averageTurnaroundDays: number | null;
  courses: AnalyticsCourseSummary[];
  rubricAverages: AnalyticsRubricAverage[];
  generatedAt: string;
};

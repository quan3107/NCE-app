/**
 * Location: features/analytics/api.ts
 * Purpose: Provide analytics data hooks backed by the backend aggregates.
 * Why: Keeps analytics data fetching centralized for reuse across dashboards.
 */

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@lib/apiClient";

const TEACHER_ANALYTICS_KEY = ["analytics", "teacher"] as const;

export type AnalyticsFilters = {
  from?: string;
  to?: string;
  courseId?: string;
  cohort?: string;
  role?: "owner" | "coTeacher";
};

export const buildAnalyticsParams = (
  filters: AnalyticsFilters,
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(filters).flatMap(([key, value]) => {
      const normalized = value?.trim();
      return normalized ? [[key, normalized]] : [];
    }),
  );

export const teacherAnalyticsQueryKey = (filters: AnalyticsFilters = {}) =>
  [...TEACHER_ANALYTICS_KEY, buildAnalyticsParams(filters)] as const;

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

const fetchTeacherAnalytics = async (
  filters: AnalyticsFilters,
): Promise<TeacherAnalyticsResponse> =>
  apiClient<TeacherAnalyticsResponse>("/api/v1/analytics/teacher", {
    params: buildAnalyticsParams(filters),
  });

export const fetchTeacherAnalyticsCsv = async (
  filters: AnalyticsFilters,
): Promise<Blob> =>
  apiClient<Blob>("/api/v1/analytics/teacher", {
    params: { ...buildAnalyticsParams(filters), format: "csv" },
    responseType: "blob",
  });

export function useTeacherAnalyticsQuery(filters: AnalyticsFilters = {}) {
  return useQuery({
    queryKey: teacherAnalyticsQueryKey(filters),
    queryFn: () => fetchTeacherAnalytics(filters),
  });
}

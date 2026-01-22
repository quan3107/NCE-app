/**
 * Location: features/analytics/api.ts
 * Purpose: Provide analytics data hooks backed by the backend aggregates.
 * Why: Keeps analytics data fetching centralized for reuse across dashboards.
 */

import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@lib/apiClient';

const TEACHER_ANALYTICS_KEY = ['analytics', 'teacher'] as const;

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

const fetchTeacherAnalytics = async (): Promise<TeacherAnalyticsResponse> =>
  apiClient<TeacherAnalyticsResponse>('/api/v1/analytics/teacher');

export function useTeacherAnalyticsQuery() {
  return useQuery({
    queryKey: TEACHER_ANALYTICS_KEY,
    queryFn: fetchTeacherAnalytics,
  });
}

/**
 * Location: features/courses/api.ts
 * Purpose: Centralize course data fetching so routes/components can share cached results.
 * Why: Keeps the course feature aligned on backend responses while leveraging the shared query cache.
 */

import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@lib/apiClient';
import { Course } from '@lib/mock-data';
import { queryClient } from '@lib/queryClient';

const COURSES_KEY = ['courses', 'list'] as const;

type CourseMetricsResponse = {
  activeStudentCount: number;
  invitedStudentCount: number;
  teacherCount: number;
  assignmentCount: number;
  rubricCount: number;
};

type CourseScheduleResponse = {
  cadence: string | null;
  startTime: string | null;
  durationMinutes: number | null;
  timeZone: string | null;
  format: string | null;
  label: string | null;
} | null;

type CourseMetadataResponse = {
  duration: string | null;
  level: string | null;
  price: number | null;
};

type CourseOwnerResponse = {
  id: string;
  fullName: string;
  email: string;
};

type CourseSummaryResponse = {
  id: string;
  title: string;
  description: string | null;
  schedule: CourseScheduleResponse;
  metadata: CourseMetadataResponse;
  owner: CourseOwnerResponse;
  metrics: CourseMetricsResponse;
  learningOutcomes?: unknown;
  structureSummary?: string | null;
  prerequisitesSummary?: string | null;
  createdAt: string;
  updatedAt: string;
};

type CourseListResponse = {
  courses: CourseSummaryResponse[];
};

const buildScheduleLabel = (schedule: CourseScheduleResponse): string => {
  if (!schedule) {
    return '';
  }

  if (schedule.label) {
    return schedule.label;
  }

  const parts = [];
  if (schedule.cadence) {
    parts.push(schedule.cadence);
  }
  if (schedule.startTime) {
    parts.push(schedule.startTime);
  }

  return parts.join(' ').trim();
};

// Sanitize the backend JSON array before it hits the UI.
const normalizeLearningOutcomes = (source: unknown): string[] | undefined => {
  if (!Array.isArray(source)) {
    return undefined;
  }

  const outcomes = source
    .map(item => (typeof item === 'string' ? item.trim() : ''))
    .filter((item): item is string => item.length > 0);

  return outcomes.length > 0 ? outcomes : undefined;
};

const toCourse = (course: CourseSummaryResponse): Course => ({
  id: course.id,
  title: course.title,
  description: course.description ?? '',
  schedule: buildScheduleLabel(course.schedule),
  duration: course.metadata.duration ?? undefined,
  level: course.metadata.level ?? undefined,
  price: course.metadata.price ?? undefined,
  teacher: course.owner.fullName,
  teacherId: course.owner.id,
  enrolled: course.metrics.activeStudentCount + course.metrics.invitedStudentCount,
  learningOutcomes: normalizeLearningOutcomes(course.learningOutcomes),
  structureSummary: course.structureSummary ?? undefined,
  prerequisitesSummary: course.prerequisitesSummary ?? undefined,
});

const fetchCourses = async (): Promise<Course[]> => {
  const response = await apiClient<CourseListResponse>('/api/v1/courses');
  return response.courses.map(toCourse);
};

export async function preloadCourses() {
  await queryClient.prefetchQuery({
    queryKey: COURSES_KEY,
    queryFn: fetchCourses,
  });
}

export function useCoursesQuery() {
  return useQuery({
    queryKey: COURSES_KEY,
    queryFn: fetchCourses,
  });
}

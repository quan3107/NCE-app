/**
 * Location: features/courses/management/hooks/useTeacherCourseManagement.ts
 * Purpose: Centralize teacher course management state, derived data, and handlers.
 * Why: Allows presentational tabs/dialogs to stay lean after refactoring the page.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ApiError } from '@lib/apiClient';
import { useCourseDefaultRubricTemplateQuery } from '@features/rubrics/api';

import {
  useCourseAssignmentsQuery,
  useCourseDetailQuery,
  useCourseStudentsQuery,
} from '../api';
import type { CourseManagementData, RubricCriterion } from '../types';
import {
  defaultRubric,
  toCourseManagementPageError,
  toCourseRubricCriteria,
  toEnrolledStudent,
  toManagedAssignment,
  toManagedCourse,
} from './useTeacherCourseManagement.mappers';
import {
  useArchiveActions,
  useCourseDetailsActions,
  useEnrollmentActions,
} from './useTeacherCourseActions';
import type { CourseManagementViewModel } from './useTeacherCourseManagement.types';

export type {
  CourseArchiveHandlers,
  CourseDetailsHandlers,
  CourseManagementViewModel,
  DialogState,
  EnrollmentHandlers,
} from './useTeacherCourseManagement.types';

export function useTeacherCourseManagement(courseId: string): CourseManagementViewModel {
  const courseQuery = useCourseDetailQuery(courseId);
  const studentsQuery = useCourseStudentsQuery(courseId);
  const assignmentsQuery = useCourseAssignmentsQuery(courseId);
  const courseDefaultRubricTemplateQuery = useCourseDefaultRubricTemplateQuery(courseId);

  const course = useMemo(
    () => (courseQuery.data ? toManagedCourse(courseQuery.data) : undefined),
    [courseQuery.data],
  );

  const assignmentErrorLogRef = useRef(false);

  const { details, detailsHandlers } = useCourseDetailsActions(
    courseId,
    course,
    courseQuery,
  );
  const { enrollmentActionState, enrollmentHandlers, addStudentDialog } = useEnrollmentActions(
    courseId,
    courseQuery,
    studentsQuery,
  );
  const { archiveState, archiveHandlers } = useArchiveActions(courseId, course, courseQuery);

  const [rubricCriteria, setRubricCriteria] = useState<RubricCriterion[]>(defaultRubric);
  const rubricHydrationRef = useRef(false);

  useEffect(() => {
    rubricHydrationRef.current = false;
    assignmentErrorLogRef.current = false;
  }, [courseId]);

  useEffect(() => {
    if (!assignmentsQuery.isError || assignmentErrorLogRef.current) {
      return;
    }

    const status =
      assignmentsQuery.error instanceof ApiError ? assignmentsQuery.error.status : undefined;
    console.warn('[course-management] backend course assignments unavailable; using empty fallback', {
      endpoint: '/api/v1/courses/:courseId/assignments',
      courseId,
      status,
      reason: 'request_failed',
      fallbackCount: 0,
    });

    assignmentErrorLogRef.current = true;
  }, [assignmentsQuery.error, assignmentsQuery.isError, courseId]);

  useEffect(() => {
    if (rubricHydrationRef.current) {
      return;
    }

    if (courseDefaultRubricTemplateQuery.data?.template.criteria) {
      const nextCriteria = toCourseRubricCriteria(
        courseDefaultRubricTemplateQuery.data.template.criteria.map((criterion) => ({
          name: criterion.name,
          weight: criterion.weight,
          description: criterion.description,
        })),
      );
      setRubricCriteria(nextCriteria);
      rubricHydrationRef.current = true;
      return;
    }

    if (courseDefaultRubricTemplateQuery.isError) {
      setRubricCriteria(defaultRubric);
      rubricHydrationRef.current = true;
    }
  }, [
    courseDefaultRubricTemplateQuery.data?.template.criteria,
    courseDefaultRubricTemplateQuery.isError,
  ]);

  const enrolledStudents = useMemo(() => {
    const rawStudents = studentsQuery.data?.students ?? [];
    return rawStudents
      .map(toEnrolledStudent)
      .sort(
        (a, b) => new Date(a.enrolledAt).getTime() - new Date(b.enrolledAt).getTime(),
      );
  }, [studentsQuery.data]);

  const courseAssignments = useMemo(() => {
    const courseName = course?.title ?? 'Unknown Course';
    return (assignmentsQuery.data ?? []).map((assignment) =>
      toManagedAssignment(assignment, courseName),
    );
  }, [assignmentsQuery.data, course?.title]);

  const totalRubricWeight = useMemo(
    () => rubricCriteria.reduce((sum, criterion) => sum + criterion.weight, 0),
    [rubricCriteria],
  );

  const reload = useCallback(async () => {
    await Promise.all([courseQuery.refetch(), studentsQuery.refetch(), assignmentsQuery.refetch()]);
  }, [assignmentsQuery, courseQuery, studentsQuery]);

  const data: CourseManagementData = {
    course,
    details,
    enrollment: {
      students: enrolledStudents,
      ...enrollmentActionState,
    },
    assignments: courseAssignments,
    rubric: {
      criteria: rubricCriteria,
      totalWeight: totalRubricWeight,
    },
    archive: archiveState,
  };

  return {
    course,
    isLoading:
      courseQuery.isLoading ||
      studentsQuery.isLoading ||
      assignmentsQuery.isLoading ||
      courseDefaultRubricTemplateQuery.isLoading,
    error: toCourseManagementPageError({
      courseError: courseQuery.error,
      studentsError: studentsQuery.error,
      assignmentsError: assignmentsQuery.error,
    }),
    reload,
    details: data.details,
    detailsHandlers,
    enrollment: data.enrollment,
    enrollmentHandlers: {
      ...enrollmentHandlers,
    },
    assignments: data.assignments,
    rubric: data.rubric,
    archive: data.archive,
    archiveHandlers: {
      ...archiveHandlers,
    },
    dialogs: {
      ...addStudentDialog,
    },
  };
}

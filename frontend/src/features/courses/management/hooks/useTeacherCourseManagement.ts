/**
 * Location: features/courses/management/hooks/useTeacherCourseManagement.ts
 * Purpose: Centralize teacher course management state, derived data, and handlers.
 * Why: Allows presentational tabs/dialogs to stay lean after refactoring the page.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner@2.0.3';

import { ApiError } from '@lib/apiClient';
import type { Assignment } from '@lib/mock-data';
import { useCourseDefaultRubricTemplateQuery } from '@features/rubrics/api';

import {
  addCourseStudent,
  type CourseAssignmentResponse,
  type CourseDetailResponse,
  type CourseStudentResponse,
  useCourseAssignmentsQuery,
  useCourseDetailQuery,
  useCourseStudentsQuery,
} from '../api';
import type {
  AnnouncementDraft,
  CourseDetailsState,
  CourseManagementData,
  EnrollmentState,
  ManagedCourse,
  RubricCriterion,
} from '../types';

export type EnrollmentHandlers = {
  setNewStudentEmail: (value: string) => void;
  addStudent: () => Promise<void>;
  removeStudent: (studentId: string, studentName: string) => void;
};

export type CourseDetailsHandlers = {
  setTitle: (value: string) => void;
  setDescription: (value: string) => void;
  setSchedule: (value: string) => void;
  setDuration: (value: string) => void;
  setLevel: (value: string) => void;
  setPrice: (value: string) => void;
  save: () => void;
};

export type AnnouncementHandlers = {
  setTitle: (value: string) => void;
  setMessage: (value: string) => void;
  setSendEmail: (value: boolean) => void;
  create: () => void;
};

export type RubricHandlers = {
  setCriteria: (criteria: RubricCriterion[]) => void;
  updateWeight: (index: number, weight: number) => void;
  save: () => void;
};

export type DialogState = {
  showAddStudent: boolean;
  setShowAddStudent: (open: boolean) => void;
  showAnnouncement: boolean;
  setShowAnnouncement: (open: boolean) => void;
  showEditRubric: boolean;
  setShowEditRubric: (open: boolean) => void;
};

export type CourseManagementViewModel = {
  course?: ManagedCourse;
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  details: CourseDetailsState;
  detailsHandlers: CourseDetailsHandlers;
  enrollment: EnrollmentState;
  enrollmentHandlers: EnrollmentHandlers;
  assignments: Assignment[];
  announcements: AnnouncementDraft;
  announcementHandlers: AnnouncementHandlers;
  rubric: {
    criteria: RubricCriterion[];
    totalWeight: number;
  };
  rubricHandlers: RubricHandlers;
  dialogs: DialogState;
};

const defaultRubric: RubricCriterion[] = [
  { name: 'Task Achievement', weight: 25, description: 'How well the task requirements are met' },
  { name: 'Coherence & Cohesion', weight: 25, description: 'Logical organization and flow' },
  { name: 'Lexical Resource', weight: 25, description: 'Vocabulary range and accuracy' },
  { name: 'Grammatical Range', weight: 25, description: 'Grammar variety and accuracy' },
];

const toCourseRubricCriteria = (
  criteria: Array<{
    name: string;
    weight: number;
    description?: string;
  }>,
): RubricCriterion[] => {
  const mapped = criteria.map((item) => ({
    name: item.name,
    weight: item.weight,
    description: item.description ?? '',
  }));

  return mapped.length > 0 ? mapped : defaultRubric;
};

const toManagedCourse = (input: CourseDetailResponse): ManagedCourse => ({
  id: input.id,
  title: input.title,
  description: input.description,
  scheduleLabel: input.schedule?.label ?? null,
  level: input.metadata.level,
  duration: input.metadata.duration,
  price: input.metadata.price,
  teacherName: input.owner.fullName,
  teacherEmail: input.owner.email,
  teacherId: input.owner.id,
  metrics: input.metrics,
});

const toEnrolledStudent = (input: CourseStudentResponse): EnrollmentState['students'][number] => ({
  id: input.id,
  name: input.fullName,
  email: input.email,
  status: input.status,
  enrolledAt: input.enrolledAt,
});

const toAddStudentErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError) {
    if (error.status === 404) {
      return 'Student account not found';
    }
    if (error.status === 409) {
      return error.message || 'Student is already enrolled in this course';
    }
    if (error.status === 401 || error.status === 403) {
      return 'You do not have permission to manage enrollment for this course';
    }
    return error.message || 'Unable to add student right now';
  }

  return 'Unable to add student right now';
};

const toLatePolicy = (value: Record<string, unknown> | string | null): string => {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  return JSON.stringify(value);
};

const toAssignmentConfig = (
  value: CourseAssignmentResponse['assignmentConfig'],
): Record<string, unknown> | null => {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as Record<string, unknown>;
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  return value;
};

const toManagedAssignment = (
  assignment: CourseAssignmentResponse,
  courseName: string,
): Assignment => ({
  id: assignment.id,
  title: assignment.title,
  description: assignment.description ?? '',
  type: assignment.type,
  courseId: assignment.courseId,
  courseName,
  dueAt: assignment.dueAt ? new Date(assignment.dueAt) : new Date(),
  publishedAt: assignment.publishedAt ? new Date(assignment.publishedAt) : undefined,
  status: assignment.publishedAt ? 'published' : 'draft',
  latePolicy: toLatePolicy(assignment.latePolicy),
  maxScore: 100,
  assignmentConfig: toAssignmentConfig(assignment.assignmentConfig),
});

export function useTeacherCourseManagement(courseId: string): CourseManagementViewModel {
  const courseQuery = useCourseDetailQuery(courseId);
  const studentsQuery = useCourseStudentsQuery(courseId);
  const assignmentsQuery = useCourseAssignmentsQuery(courseId);
  const courseDefaultRubricTemplateQuery = useCourseDefaultRubricTemplateQuery(courseId);

  const course = useMemo(
    () => (courseQuery.data ? toManagedCourse(courseQuery.data) : undefined),
    [courseQuery.data],
  );

  const [courseTitle, setCourseTitle] = useState('');
  const [courseDescription, setCourseDescription] = useState('');
  const [courseSchedule, setCourseSchedule] = useState('');
  const [courseDuration, setCourseDuration] = useState('');
  const [courseLevel, setCourseLevel] = useState('');
  const [coursePrice, setCoursePrice] = useState('');

  const [newStudentEmail, setNewStudentEmail] = useState('');
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [addStudentError, setAddStudentError] = useState<string | null>(null);

  const hydrationRef = useRef(false);
  const assignmentErrorLogRef = useRef(false);

  const handleNewStudentEmailChange = useCallback(
    (value: string) => {
      setNewStudentEmail(value);
      setAddStudentError(null);
    },
    [setAddStudentError, setNewStudentEmail],
  );

  useEffect(() => {
    hydrationRef.current = false;
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

  useEffect(() => {
    if (!course) {
      return;
    }
    if (hydrationRef.current) {
      return;
    }

    setCourseTitle(course.title);
    setCourseDescription(course.description ?? '');
    setCourseSchedule(course.scheduleLabel ?? '');
    setCourseDuration(course.duration ?? '');
    setCourseLevel(course.level ?? '');
    setCoursePrice(course.price !== null ? String(course.price) : '');
    hydrationRef.current = true;
  }, [course]);

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

  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementMessage, setAnnouncementMessage] = useState('');
  const [sendEmail, setSendEmail] = useState(true);

  const [rubricCriteria, setRubricCriteria] = useState<RubricCriterion[]>(defaultRubric);
  const [showAddStudentDialog, setShowAddStudentDialog] = useState(false);
  const [showCreateAnnouncementDialog, setShowCreateAnnouncementDialog] = useState(false);
  const [showEditRubricDialog, setShowEditRubricDialog] = useState(false);
  const rubricHydrationRef = useRef(false);

  const handleSaveCourseDetails = useCallback(() => {
    toast.success('Course details updated successfully');
  }, []);

  const handleAddStudent = useCallback(async () => {
    const email = newStudentEmail.trim();

    if (!email) {
      const message = 'Please enter a student email';
      setAddStudentError(message);
      toast.error(message);
      return;
    }

    setIsAddingStudent(true);
    setAddStudentError(null);

    try {
      await addCourseStudent(courseId, { email });
      toast.success(`Invitation sent to ${email}`);
      setNewStudentEmail('');
      setShowAddStudentDialog(false);
    } catch (error) {
      const message = toAddStudentErrorMessage(error);
      setAddStudentError(message);
      toast.error(message);
    } finally {
      setIsAddingStudent(false);
    }
  }, [
    courseId,
    newStudentEmail,
    setAddStudentError,
    setIsAddingStudent,
    setNewStudentEmail,
    setShowAddStudentDialog,
  ]);

  const handleRemoveStudent = useCallback((studentId: string, studentName: string) => {
    toast.success(`${studentName} removed from course`);
  }, []);

  const handleCreateAnnouncement = useCallback(() => {
    if (!announcementTitle || !announcementMessage) {
      toast.error('Please fill in all fields');
      return;
    }
    toast.success(`Announcement posted${sendEmail ? ' and sent via email' : ''}`);
    setAnnouncementTitle('');
    setAnnouncementMessage('');
    setShowCreateAnnouncementDialog(false);
  }, [announcementMessage, announcementTitle, sendEmail]);

  const totalRubricWeight = useMemo(
    () => rubricCriteria.reduce((sum, criterion) => sum + criterion.weight, 0),
    [rubricCriteria],
  );

  const handleSaveRubric = useCallback(() => {
    if (totalRubricWeight !== 100) {
      toast.error('Rubric criteria weights must total 100%');
      return;
    }
    toast.success('Rubric updated successfully');
    setShowEditRubricDialog(false);
  }, [totalRubricWeight]);

  const updateRubricWeight = useCallback(
    (index: number, weight: number) => {
      setRubricCriteria((criteria) => {
        const updated = [...criteria];
        if (updated[index]) {
          updated[index] = { ...updated[index], weight };
        }
        return updated;
      });
    },
    [],
  );

  const reload = useCallback(async () => {
    hydrationRef.current = false;
    await Promise.all([courseQuery.refetch(), studentsQuery.refetch(), assignmentsQuery.refetch()]);
  }, [assignmentsQuery, courseQuery, studentsQuery]);

  const data: CourseManagementData = {
    course,
    details: {
      title: courseTitle,
      description: courseDescription,
      schedule: courseSchedule,
      duration: courseDuration,
      level: courseLevel,
      price: coursePrice,
    },
    enrollment: {
      students: enrolledStudents,
      newStudentEmail,
      isAddingStudent,
      addStudentError,
    },
    announcements: {
      title: announcementTitle,
      message: announcementMessage,
      sendEmail,
    },
    assignments: courseAssignments,
    rubric: {
      criteria: rubricCriteria,
      totalWeight: totalRubricWeight,
    },
  };

  return {
    course,
    isLoading:
      courseQuery.isLoading ||
      studentsQuery.isLoading ||
      assignmentsQuery.isLoading ||
      courseDefaultRubricTemplateQuery.isLoading,
    error:
      courseQuery.error?.message ??
      studentsQuery.error?.message ??
      assignmentsQuery.error?.message ??
      courseDefaultRubricTemplateQuery.error?.message ??
      null,
    reload,
    details: data.details,
    detailsHandlers: {
      setTitle: setCourseTitle,
      setDescription: setCourseDescription,
      setSchedule: setCourseSchedule,
      setDuration: setCourseDuration,
      setLevel: setCourseLevel,
      setPrice: setCoursePrice,
      save: handleSaveCourseDetails,
    },
    enrollment: data.enrollment,
    enrollmentHandlers: {
      setNewStudentEmail: handleNewStudentEmailChange,
      addStudent: handleAddStudent,
      removeStudent: handleRemoveStudent,
    },
    assignments: data.assignments,
    announcements: data.announcements,
    announcementHandlers: {
      setTitle: setAnnouncementTitle,
      setMessage: setAnnouncementMessage,
      setSendEmail,
      create: handleCreateAnnouncement,
    },
    rubric: data.rubric,
    rubricHandlers: {
      setCriteria: setRubricCriteria,
      updateWeight: updateRubricWeight,
      save: handleSaveRubric,
    },
    dialogs: {
      showAddStudent: showAddStudentDialog,
      setShowAddStudent: setShowAddStudentDialog,
      showAnnouncement: showCreateAnnouncementDialog,
      setShowAnnouncement: setShowCreateAnnouncementDialog,
      showEditRubric: showEditRubricDialog,
      setShowEditRubric: setShowEditRubricDialog,
    },
  };
}

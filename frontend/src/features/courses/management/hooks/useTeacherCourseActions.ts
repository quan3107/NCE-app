/**
 * Location: features/courses/management/hooks/useTeacherCourseActions.ts
 * Purpose: Own course-management mutation state and handlers.
 * Why: Keeps the main management view-model hook focused on data composition.
 */

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner@2.0.3';

import {
  addCourseStudent,
  archiveCourse,
  removeCourseStudent,
  restoreCourse,
  updateCourseDetails,
} from '../api';
import type { ManagedCourse } from '../types';
import {
  toAddStudentErrorMessage,
  toCourseMutationErrorMessage,
} from './useTeacherCourseManagement.mappers';

type Refetchable = {
  refetch: () => Promise<unknown>;
};

export function useCourseDetailsActions(
  courseId: string,
  course: ManagedCourse | undefined,
  courseQuery: Refetchable,
) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [schedule, setSchedule] = useState('');
  const [duration, setDuration] = useState('');
  const [level, setLevel] = useState('');
  const [price, setPrice] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setErrorMessage(null);
  }, [courseId]);

  useEffect(() => {
    if (!course) {
      return;
    }

    setTitle(course.title);
    setDescription(course.description ?? '');
    setSchedule(course.scheduleLabel ?? '');
    setDuration(course.duration ?? '');
    setLevel(course.level ?? '');
    setPrice(course.price !== null ? String(course.price) : '');
  }, [course]);

  const save = useCallback(async () => {
    if (!title.trim()) {
      const message = 'Course title is required';
      setErrorMessage(message);
      toast.error(message);
      return;
    }

    if (price.trim() && !Number.isFinite(Number(price.trim()))) {
      const message = 'Course price must be a valid number';
      setErrorMessage(message);
      toast.error(message);
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      await updateCourseDetails(courseId, {
        title,
        description,
        schedule,
        duration,
        level,
        price,
      });
      await courseQuery.refetch();
      toast.success('Course details updated successfully');
    } catch (error) {
      const message = toCourseMutationErrorMessage(
        error,
        'Unable to update course details right now',
      );
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }, [courseId, courseQuery, description, duration, level, price, schedule, title]);

  const clearOnChange = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setErrorMessage(null);
  };

  return {
    details: { title, description, schedule, duration, level, price, isSaving, errorMessage },
    detailsHandlers: {
      setTitle: clearOnChange(setTitle),
      setDescription: clearOnChange(setDescription),
      setSchedule: clearOnChange(setSchedule),
      setDuration: clearOnChange(setDuration),
      setLevel: clearOnChange(setLevel),
      setPrice: clearOnChange(setPrice),
      save,
    },
  };
}

export function useEnrollmentActions(
  courseId: string,
  courseQuery: Refetchable,
  studentsQuery: Refetchable,
) {
  const [newStudentEmail, setNewStudentEmail] = useState('');
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [addStudentError, setAddStudentError] = useState<string | null>(null);
  const [removingStudentIds, setRemovingStudentIds] = useState<string[]>([]);
  const [removeStudentError, setRemoveStudentError] = useState<string | null>(null);
  const [showAddStudentDialog, setShowAddStudentDialog] = useState(false);

  useEffect(() => {
    setAddStudentError(null);
    setRemoveStudentError(null);
  }, [courseId]);

  const setNewStudentEmailAndClearError = useCallback((value: string) => {
    setNewStudentEmail(value);
    setAddStudentError(null);
  }, []);

  const addStudent = useCallback(async () => {
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
  }, [courseId, newStudentEmail]);

  const removeStudent = useCallback(
    async (studentId: string, studentName: string) => {
      setRemovingStudentIds((current) =>
        current.includes(studentId) ? current : current.concat(studentId),
      );
      setRemoveStudentError(null);

      try {
        await removeCourseStudent(courseId, studentId);
        await Promise.all([studentsQuery.refetch(), courseQuery.refetch()]);
        toast.success(`${studentName} removed from course`);
      } catch (error) {
        const message = toCourseMutationErrorMessage(
          error,
          'Unable to remove student right now',
        );
        setRemoveStudentError(message);
        toast.error(message);
      } finally {
        setRemovingStudentIds((current) => current.filter((id) => id !== studentId));
      }
    },
    [courseId, courseQuery, studentsQuery],
  );

  return {
    enrollmentActionState: {
      newStudentEmail,
      isAddingStudent,
      addStudentError,
      removingStudentIds,
      removeStudentError,
    },
    enrollmentHandlers: {
      setNewStudentEmail: setNewStudentEmailAndClearError,
      addStudent,
      removeStudent,
    },
    addStudentDialog: {
      showAddStudent: showAddStudentDialog,
      setShowAddStudent: setShowAddStudentDialog,
    },
  };
}

export function useArchiveActions(
  courseId: string,
  course: ManagedCourse | undefined,
  courseQuery: Refetchable,
) {
  const [archivedAtOverride, setArchivedAtOverride] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setErrorMessage(null);
    setArchivedAtOverride(null);
  }, [courseId]);

  const archive = useCallback(async () => {
    setIsMutating(true);
    setErrorMessage(null);

    try {
      const response = await archiveCourse(courseId);
      setArchivedAtOverride(response.deletedAt ?? new Date().toISOString());
      toast.success('Course archived');
    } catch (error) {
      const message = toCourseMutationErrorMessage(error, 'Unable to archive course right now');
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsMutating(false);
    }
  }, [courseId]);

  const restore = useCallback(async () => {
    setIsMutating(true);
    setErrorMessage(null);

    try {
      await restoreCourse(courseId);
      setArchivedAtOverride(null);
      await courseQuery.refetch();
      toast.success('Course restored');
    } catch (error) {
      const message = toCourseMutationErrorMessage(error, 'Unable to restore course right now');
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsMutating(false);
    }
  }, [courseId, courseQuery]);

  return {
    archiveState: {
      isArchived: Boolean(archivedAtOverride ?? course?.archivedAt),
      isMutating,
      errorMessage,
    },
    archiveHandlers: { archive, restore },
  };
}

/**
 * Location: features/courses/management/hooks/useTeacherCourseManagement.ts
 * Purpose: Centralize teacher course management state, derived data, and handlers.
 * Why: Allows presentational tabs/dialogs to stay lean after refactoring the page.
 */

import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner@2.0.3';

import {
  mockAssignments,
  mockCourses,
  mockEnrollments,
  mockUsers,
  type Assignment,
  type Course,
  type User,
} from '@lib/mock-data';

import type {
  AnnouncementDraft,
  CourseDetailsState,
  CourseManagementData,
  RubricCriterion,
} from '../types';

export type EnrollmentHandlers = {
  setNewStudentEmail: (value: string) => void;
  addStudent: () => void;
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
  course?: Course;
  details: CourseDetailsState;
  detailsHandlers: CourseDetailsHandlers;
  enrollment: {
    students: User[];
    newStudentEmail: string;
  };
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

export function useTeacherCourseManagement(courseId: string): CourseManagementViewModel {
  const course = useMemo(() => mockCourses.find((c) => c.id === courseId), [courseId]);

  const [courseTitle, setCourseTitle] = useState(course?.title ?? '');
  const [courseDescription, setCourseDescription] = useState(course?.description ?? '');
  const [courseSchedule, setCourseSchedule] = useState(course?.schedule ?? '');
  const [courseDuration, setCourseDuration] = useState(course?.duration ?? '');
  const [courseLevel, setCourseLevel] = useState(course?.level ?? '');
  const [coursePrice, setCoursePrice] = useState(course?.price?.toString() ?? '');

  const [newStudentEmail, setNewStudentEmail] = useState('');

  const enrolledStudents = useMemo(
    () =>
      mockEnrollments
        .filter((enrollment) => enrollment.courseId === courseId)
        .map((enrollment) => mockUsers.find((user) => user.id === enrollment.userId))
        .filter((user): user is User => Boolean(user)),
    [courseId],
  );

  const courseAssignments = useMemo(
    () => mockAssignments.filter((assignment) => assignment.courseId === courseId),
    [courseId],
  );

  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementMessage, setAnnouncementMessage] = useState('');
  const [sendEmail, setSendEmail] = useState(true);

  const [rubricCriteria, setRubricCriteria] = useState<RubricCriterion[]>(defaultRubric);
  const [showAddStudentDialog, setShowAddStudentDialog] = useState(false);
  const [showCreateAnnouncementDialog, setShowCreateAnnouncementDialog] = useState(false);
  const [showEditRubricDialog, setShowEditRubricDialog] = useState(false);

  const handleSaveCourseDetails = useCallback(() => {
    toast.success('Course details updated successfully');
  }, []);

  const handleAddStudent = useCallback(() => {
    if (!newStudentEmail) {
      toast.error('Please enter a student email');
      return;
    }
    toast.success(`Invitation sent to ${newStudentEmail}`);
    setNewStudentEmail('');
    setShowAddStudentDialog(false);
  }, [newStudentEmail]);

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
    [setRubricCriteria],
  );

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
      setNewStudentEmail,
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

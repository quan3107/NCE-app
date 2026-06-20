/**
 * Location: features/nce-content/types.ts
 * Purpose: Define frontend types for read-only NCE content APIs.
 * Why: Keeps student and teacher content consumers aligned on backend payloads.
 */

export type NcePublishStatus = 'draft' | 'published' | 'archived';

export type NceExerciseType =
  | 'vocabulary'
  | 'grammar'
  | 'listening'
  | 'speaking'
  | 'reading'
  | 'writing'
  | 'translation'
  | 'dictation'
  | 'multiple_choice'
  | 'gap_fill';

export type NceReadQuery = {
  includeDrafts?: boolean;
  courseId?: string;
  page?: number;
  pageSize?: number;
};

export type NcePagination = {
  page: number;
  pageSize: number;
  total: number;
};

export type NceBook = {
  id: string;
  code: string;
  title: string;
  level: string;
  description: string | null;
  sortOrder: number;
  status: NcePublishStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NceUnit = {
  id: string;
  bookId: string;
  unitNumber: number;
  title: string;
  description: string | null;
  sortOrder: number;
  status: NcePublishStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NceObjective = {
  id: string;
  lessonId: string;
  code: string;
  title: string;
  category: string;
  description: string | null;
  masteryThreshold: number;
  sortOrder: number;
};

export type NceExercise = {
  id: string;
  lessonId: string;
  objectiveId: string | null;
  exerciseType: NceExerciseType;
  prompt: string;
  content: unknown;
  answerKey?: unknown;
  scoringConfig: unknown | null;
  sortOrder: number;
};

export type NceLesson = {
  id: string;
  unitId: string;
  lessonNumber: number;
  title: string;
  lessonText: string;
  media: unknown | null;
  sortOrder: number;
  status: NcePublishStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  teacherNotes?: string | null;
  unit?: {
    id: string;
    bookId: string;
    unitNumber: number;
    title: string;
    status: NcePublishStatus;
    book?: {
      id: string;
      code: string;
      title: string;
      level: string;
      status: NcePublishStatus;
    };
  };
  objectives: NceObjective[];
  exercises: NceExercise[];
};

export type NceObjectiveInput = {
  code: string;
  title: string;
  category: string;
  description?: string | null;
  masteryThreshold: number;
  sortOrder: number;
};

export type NceExerciseInput = {
  objectiveId?: string | null;
  objectiveCode?: string;
  exerciseType: NceExerciseType;
  prompt: string;
  content: Record<string, unknown>;
  answerKey: Record<string, unknown>;
  scoringConfig?: Record<string, unknown> | null;
  sortOrder: number;
};

export type NceLessonWritePayload = {
  unitId: string;
  lessonNumber: number;
  title: string;
  lessonText: string;
  media?: Record<string, unknown> | null;
  teacherNotes?: string | null;
  sortOrder: number;
  objectives: NceObjectiveInput[];
  exercises: NceExerciseInput[];
};

export type NceLessonPatchPayload = Partial<NceLessonWritePayload>;

export type CourseNceLessonAssignmentInput = {
  lessonId: string;
  sequence: number;
  availableFrom?: string | null;
  dueAt?: string | null;
};

export type CourseNceLessonAssignmentPayload = {
  lessons: CourseNceLessonAssignmentInput[];
};

export type CourseNceLessonAssignmentResponse = {
  courseId: string;
  assignedCount: number;
};

export type CourseNceLesson = NceLesson & {
  sequence: number;
  availableFrom: string | null;
  dueAt: string | null;
  canEdit: boolean;
  canPublish: boolean;
};

export type NceBookListResponse = {
  books: NceBook[];
};

export type NceUnitListResponse = {
  units: NceUnit[];
};

export type NceLessonListResponse = {
  lessons: NceLesson[];
  pagination: NcePagination;
};

export type CourseNceLessonListResponse = {
  lessons: CourseNceLesson[];
  pagination: NcePagination;
};

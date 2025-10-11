/**
 * File: src/modules/courses/courses.service.ts
 * Purpose: Aggregate course service exports for controller consumption.
 * Why: Provides a stable entrypoint while internally splitting logic into focused modules.
 */
export {
  listCourses,
  getCourseById,
} from "./courses.read.service.js";

export {
  listStudentsForCourse,
  addStudentToCourse,
  removeStudentFromCourse,
} from "./courses.students.service.js";

export type {
  CourseManager,
  CourseStudent,
  CourseStudentsResponse,
  CourseMetrics,
  CourseSummary,
  CourseListResponse,
  CourseDetailResponse,
} from "./courses.types.js";

import { createCourseSchema } from "./courses.schema.js";

export async function createCourse(payload: unknown): Promise<void> {
  createCourseSchema.parse(payload);
}

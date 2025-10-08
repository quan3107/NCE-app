/**
 * File: src/modules/courses/courses.service.ts
 * Purpose: Stub business routines for managing courses.
 * Why: Encapsulates course-specific logic to keep controllers slim.
 */
import {
  courseIdParamsSchema,
  createCourseSchema,
} from "./courses.schema.js";

export async function listCourses(): Promise<void> {
  // Future implementation will paginate courses by teacher.
}

export async function getCourseById(params: unknown): Promise<void> {
  courseIdParamsSchema.parse(params);
}

export async function createCourse(payload: unknown): Promise<void> {
  createCourseSchema.parse(payload);
}

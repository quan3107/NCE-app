/**
 * Location: src/types/domain/courses.ts
 * Purpose: Define shared course domain types used across frontend features.
 * Why: Provides a backend-driven source of truth for course contracts.
 */

export type Course = {
  id: string;
  title: string;
  description: string;
  schedule: string;
  duration?: string;
  level?: string;
  price?: number;
  teacher: string;
  teacherId: string;
  enrolled?: number;
  learningOutcomes?: string[];
  structureSummary?: string;
  prerequisitesSummary?: string;
};

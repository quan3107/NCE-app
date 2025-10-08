/**
 * Location: features/grades/api.ts
 * Purpose: Provide grade data hooks that leverage the shared query client cache.
 * Why: Consolidates grade access paths ahead of backend integration work.
 */

import { Grade, mockGrades } from '@lib/mock-data';
import { queryClient } from '@lib/queryClient';
import { useStaticQuery } from '@lib/useStaticQuery';

const GRADES_KEY = 'grades:list';

const fetchGrades = async (): Promise<Grade[]> => mockGrades;

export function preloadGrades() {
  queryClient.setQueryData(GRADES_KEY, mockGrades);
}

export function useGradesQuery() {
  return useStaticQuery<Grade[]>(GRADES_KEY, fetchGrades);
}

/** Staff reads load scoped counts and one visible page; opening work fetches its full content. */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@lib/auth';
import { apiClient } from '@lib/apiClient';
import { toAssignment, toSubmission } from './api.mappers';
import { ASSIGNMENTS_KEY, type ApiAssignment, type ApiSubmission } from './api.types';

export const STAFF_SUBMISSIONS_KEY = 'staff:submissions';
export type SubmissionSummary = Omit<ApiSubmission, 'payload'> & {
  studentName: string; assignmentTitle: string;
};
export type AssignmentSummary = Pick<ApiAssignment, 'id' | 'courseId' | 'title' | 'type' | 'dueAt' | 'publishedAt'> & {
  courseName: string; submissionCount: number;
};
type Page<T> = { items: T[]; nextCursor: string | null; total: number };
type Overview = { activeAssignments: number; pendingSubmissions: number; recentSubmissions: SubmissionSummary[] };
type AssignmentOverview = {
  assignment: ApiAssignment & { courseName: string };
  counts: { total: number; submitted: number; pending: number; graded: number; late: number };
};

export function useStaffOverview() {
  const { currentUser } = useAuth();
  return useQuery({
    queryKey: [STAFF_SUBMISSIONS_KEY, 'overview', currentUser.id, currentUser.role],
    queryFn: ({ signal }) => apiClient<Overview>('/assignments/overview', { auth: 'required', signal }),
  });
}

export function useStaffPage<T>(path: string, key: string, params: { assignmentId?: string; pending?: string } = {}) {
  const { currentUser } = useAuth();
  const scope = JSON.stringify([currentUser.id, currentUser.role, path, params]);
  const [paging, setPaging] = useState<{ scope: string; cursors: Array<string | undefined> }>({ scope, cursors: [undefined] });
  // A new resource/session starts at its first page, never at the previous resource's cursor.
  const cursors = paging.scope === scope ? paging.cursors : [undefined];
  const setCursors = (update: (value: Array<string | undefined>) => Array<string | undefined>) => setPaging(previous => ({ scope, cursors: update(previous.scope === scope ? previous.cursors : [undefined]) }));
  const cursor = cursors.at(-1);
  const query = useQuery({
    queryKey: [key, currentUser.id, currentUser.role, path, params, cursor],
    queryFn: ({ signal }) => apiClient<Page<T>>(path, { auth: 'required', signal, params: { ...params, cursor, limit: 50 } }),
  });
  return {
    ...query, page: cursors.length, canPrevious: cursors.length > 1,
    previous: () => setCursors(value => value.slice(0, -1)),
    next: () => { if (query.data?.nextCursor) setCursors(value => [...value, query.data!.nextCursor!]); },
  };
}

export function useStaffAssignment(id: string) {
  const { currentUser } = useAuth();
  const query = useQuery({
    queryKey: [ASSIGNMENTS_KEY, 'detail', currentUser.id, currentUser.role, id],
    queryFn: ({ signal }) => apiClient<AssignmentOverview>(`/assignments/${id}/overview`, { auth: 'required', signal }),
  });
  const assignment = useMemo(() => query.data ? toAssignment(query.data.assignment, query.data.assignment.courseName) : null, [query.data]);
  return { ...query, assignment, counts: query.data?.counts };
}

export function useStaffSubmission(id: string) {
  const { currentUser } = useAuth();
  const query = useQuery({
    queryKey: [STAFF_SUBMISSIONS_KEY, 'detail', currentUser.id, currentUser.role, id],
    queryFn: ({ signal }) => apiClient<{ submission: ApiSubmission; assignment: ApiAssignment & { courseName: string } }>(`/submissions/${id}/detail`, { auth: 'required', signal }),
  });
  return {
    ...query,
    submission: useMemo(() => query.data ? toSubmission(query.data.submission) : undefined, [query.data]),
    assignment: useMemo(() => query.data ? toAssignment(query.data.assignment, query.data.assignment.courseName) : null, [query.data]),
  };
}

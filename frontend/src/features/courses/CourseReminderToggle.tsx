/** Course reminder control: persist the student's preference and retain errors for retry. */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@lib/apiClient';
import { useAuthStore } from '@store/authStore';
import { useMutationLifetime } from '@lib/useMutationLifetime';
import { Button } from '@components/ui/button';

export function CourseReminderToggle({ courseId }: { courseId: string }) {
  const { currentUser, sessionGeneration } = useAuthStore();
  const key = ['course-reminders', courseId, currentUser.id, sessionGeneration];
  const path = `/api/v1/courses/${courseId}/reminders`;
  const cache = useQueryClient();
  const capture = useMutationLifetime();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const query = useQuery({ queryKey: key, queryFn: () => apiClient<{ muted: boolean }>(path, { auth: 'required' }) });
  const toggle = async () => {
    if (saving || !query.data) return;
    const isCurrent = capture();
    setSaving(true); setError(null);
    try {
      const result = await apiClient<{ muted: boolean }>(path, {
        auth: 'required', method: 'PUT', body: { muted: !query.data.muted },
      });
      cache.setQueryData(key, result);
    } catch (cause) {
      if (isCurrent()) setError(cause instanceof Error ? cause.message : 'Unable to save reminder preference.');
    } finally { if (isCurrent()) setSaving(false); }
  };
  return <div className="mt-4 space-y-2">
    <p className="text-sm">Deadline reminders arrive in-app and by email 24 hours before deadlines.</p>
    {query.isPending ? <p role="status">Loading reminders…</p> : query.isError ?
      <><p role="alert">Unable to load course reminders.</p><Button variant="outline" onClick={() => void query.refetch()}>Retry reminders</Button></> :
      <Button variant="outline" disabled={saving} aria-pressed={query.data.muted} onClick={() => void toggle()}>
        {saving ? 'Saving reminders…' : query.data.muted ? 'Unmute course reminders' : 'Mute course reminders'}
      </Button>}
    {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
    <p className="text-xs text-muted-foreground">Course announcements remain enabled.</p>
  </div>;
}

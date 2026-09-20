/**
 * Location: tests/routeStateRecovery.component.test.tsx
 * Purpose: Exercise real NCE query failure, pending retry, and editor recovery.
 * Why: A failed or missing lesson must never become an editable blank form.
 */
import assert from 'node:assert/strict';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, test, vi } from 'vitest';
import { TeacherNceLessonEditorPage } from '../src/features/nce-content/components/TeacherNceLessonEditorPage';

vi.mock('@lib/router', () => ({ useRouter: () => ({ navigate: vi.fn() }) }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

for (const failure of ['lesson', 'books', 'units', 'missing']) {
  test(`lesson editor gates ${failure} failure and recovers through Retry`, async () => {
    let recover = false;
    let finish: (() => void) | undefined;
    const lesson = { id: 'lesson-1', unitId: 'unit-1', unit: { bookId: 'book-1' },
      title: 'Recovered lesson', lessonText: 'Authoritative text', lessonNumber: 1,
      sortOrder: 1, objectives: [], exercises: [] };
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      const kind = url.includes('/lessons/') ? 'lesson' : url.includes('/units') ? 'units' : 'books';
      if (kind === (failure === 'missing' ? 'lesson' : failure)) {
        if (!recover) return Response.json({ message: failure === 'missing' ? 'Lesson not found' : 'Read failed' },
          { status: failure === 'missing' ? 404 : 500 });
        await new Promise<void>((resolve) => { finish = resolve; });
      }
      return Response.json(kind === 'lesson' ? lesson : kind === 'books'
        ? { books: [{ id: 'book-1', title: 'Book 1' }] }
        : { units: [{ id: 'unit-1', unitNumber: 1, title: 'Unit 1' }] });
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><TeacherNceLessonEditorPage lessonId="lesson-1" /></QueryClientProvider>);
    await screen.findByRole('alert');
    assert.ok(screen.queryByRole('button', { name: 'Save Lesson' }) === null);
    assert.ok(screen.queryByLabelText('Title') === null);
    recover = true;
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    await waitFor(() => assert.ok(finish));
    assert.ok(screen.queryByRole('button', { name: 'Save Lesson' }) === null);
    finish!();
    await screen.findByDisplayValue('Recovered lesson');
    await waitFor(() => assert.equal((screen.getByRole('button', { name: 'Save Lesson' }) as HTMLButtonElement).disabled, false));
    assert.ok(screen.queryByRole('alert') === null);
    client.clear();
  });
}

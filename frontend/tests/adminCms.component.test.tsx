/**
 * Location: tests/adminCms.component.test.tsx
 * Purpose: Verify administrators can edit, save, publish, and roll back CMS content.
 * Why: The management UI is the primary completion path for the CMS workflow.
 */
import assert from 'node:assert/strict';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, test, vi } from 'vitest';

import { AdminCmsPage } from '../src/features/admin/components/AdminCmsPage';

const saveMutate = vi.hoisted(() => vi.fn());
const publishMutate = vi.hoisted(() => vi.fn());
const rollbackMutate = vi.hoisted(() => vi.fn());

vi.mock('@features/admin/cmsApi', () => ({
  useCmsPagesQuery: () => ({
    data: {
      pages: [
        {
          pageKey: 'homepage',
          label: 'Homepage',
          draftVersion: 1,
          publishedDraftVersion: 0,
          publishedRevision: 0,
          publishedAt: null,
          hasUnpublishedChanges: true,
        },
        {
          pageKey: 'contact',
          label: 'Contact Page',
          draftVersion: 1,
          publishedDraftVersion: 1,
          publishedRevision: 0,
          publishedAt: null,
          hasUnpublishedChanges: false,
        },
      ],
    },
    isLoading: false,
    error: null,
  }),
  useCmsDraftQuery: (pageKey: string) => ({
    data: {
      pageKey,
      label: pageKey === 'contact' ? 'Contact Page' : 'Homepage',
      content: pageKey === 'contact'
        ? {
            header: { title: 'Contact us', description: 'Get in touch.' },
            form: { title: 'Message us', description: 'We can help.', submitLabel: 'Send' },
            details: { email: 'support@example.com', phone: '123', address: 'Office' },
            hours: [],
          }
        : {
            hero: {
              badge: 'Badge',
              title: 'Original title',
              description: 'Description',
              cta_primary: 'Browse',
              cta_secondary: 'Login',
            },
            stats: [],
            howItWorks: { title: 'How it works', description: 'Steps', features: [] },
          },
      draftVersion: 1,
      publishedDraftVersion: 0,
      publishedRevision: 0,
      publishedAt: null,
      hasUnpublishedChanges: true,
    },
    isLoading: false,
    error: null,
  }),
  useCmsRevisionsQuery: () => ({
    data: {
      revisions: [
        {
          id: 'revision-1',
          revisionNumber: 1,
          operation: 'publish',
          createdAt: '2026-07-01T00:00:00.000Z',
          createdBy: { id: 'admin-1', fullName: 'Admin User' },
          sourceRevision: null,
        },
      ],
    },
    isLoading: false,
  }),
  useSaveCmsDraftMutation: () => ({ mutate: saveMutate, isPending: false }),
  usePublishCmsDraftMutation: () => ({ mutate: publishMutate, isPending: false }),
  useRollbackCmsRevisionMutation: () => ({ mutate: rollbackMutate, isPending: false }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

test('admin CMS page submits edited drafts, publishes, and rolls back', () => {
  render(
    <MemoryRouter>
      <AdminCmsPage />
    </MemoryRouter>,
  );

  fireEvent.change(screen.getByLabelText('Hero title'), {
    target: { value: 'Updated title' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
  fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
  fireEvent.click(screen.getByRole('button', { name: 'Roll back to revision 1' }));

  assert.equal(saveMutate.mock.calls[0]?.[0].pageKey, 'homepage');
  assert.equal(saveMutate.mock.calls[0]?.[0].content.hero.title, 'Updated title');
  assert.deepEqual(publishMutate.mock.calls[0]?.[0], 'homepage');
  assert.deepEqual(rollbackMutate.mock.calls[0]?.[0], {
    pageKey: 'homepage',
    revisionId: 'revision-1',
  });
});

test('switching page types never renders the previous draft through the new editor', async () => {
  render(
    <MemoryRouter>
      <AdminCmsPage />
    </MemoryRouter>,
  );

  fireEvent.change(screen.getByLabelText('Marketing page'), {
    target: { value: 'contact' },
  });

  assert.equal((await screen.findByLabelText('Header title')).getAttribute('value'), 'Contact us');
});

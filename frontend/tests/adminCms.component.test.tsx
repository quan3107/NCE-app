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
const cmsState = vi.hoisted(() => ({
  draftVersion: 1,
  hasUnpublishedChanges: true,
  pagesError: null as Error | null,
  draftError: null as Error | null,
  revisionError: null as Error | null,
  saveError: null as Error | null,
  publishError: null as Error | null,
  rollbackError: null as Error | null,
}));

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
    error: cmsState.pagesError,
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
      draftVersion: cmsState.draftVersion,
      publishedDraftVersion: 0,
      publishedRevision: 0,
      publishedAt: null,
      hasUnpublishedChanges: cmsState.hasUnpublishedChanges,
    },
    isLoading: false,
    error: cmsState.draftError,
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
    error: cmsState.revisionError,
  }),
  useSaveCmsDraftMutation: () => ({
    mutate: saveMutate,
    isPending: false,
    error: cmsState.saveError,
  }),
  usePublishCmsDraftMutation: () => ({
    mutate: publishMutate,
    isPending: false,
    error: cmsState.publishError,
  }),
  useRollbackCmsRevisionMutation: () => ({
    mutate: rollbackMutate,
    isPending: false,
    error: cmsState.rollbackError,
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  cmsState.draftVersion = 1;
  cmsState.hasUnpublishedChanges = true;
  cmsState.pagesError = null;
  cmsState.draftError = null;
  cmsState.revisionError = null;
  cmsState.saveError = null;
  cmsState.publishError = null;
  cmsState.rollbackError = null;
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
  assert.equal(saveMutate.mock.calls[0]?.[0].expectedDraftVersion, 1);
  assert.equal(publishMutate.mock.calls[0]?.[0].pageKey, 'homepage');
  assert.equal(publishMutate.mock.calls[0]?.[0].content.hero.title, 'Updated title');
  assert.equal(publishMutate.mock.calls[0]?.[0].expectedDraftVersion, 1);
  assert.deepEqual(rollbackMutate.mock.calls[0]?.[0], {
    pageKey: 'homepage',
    revisionId: 'revision-1',
  });
});

test('publishes unsaved displayed content when the saved draft has no changes', () => {
  cmsState.hasUnpublishedChanges = false;
  render(
    <MemoryRouter>
      <AdminCmsPage />
    </MemoryRouter>,
  );

  fireEvent.change(screen.getByLabelText('Hero title'), {
    target: { value: 'Unsaved reviewed title' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

  assert.equal(publishMutate.mock.calls[0]?.[0].content.hero.title, 'Unsaved reviewed title');
  assert.equal(publishMutate.mock.calls[0]?.[0].expectedDraftVersion, 1);
});

test('shows revision, save, publish, and rollback failures', () => {
  cmsState.revisionError = new Error('revision failed');
  cmsState.saveError = new Error('save failed');
  cmsState.publishError = new Error('publish failed');
  cmsState.rollbackError = new Error('rollback failed');
  render(
    <MemoryRouter>
      <AdminCmsPage />
    </MemoryRouter>,
  );

  assert.ok(screen.getByText('Unable to load revision history. Please try again.'));
  assert.ok(screen.getByText('Unable to save the draft. Please try again.'));
  assert.ok(screen.getByText('Unable to publish the draft. Reload and try again.'));
  assert.ok(screen.getByText('Unable to roll back the revision. Please try again.'));
  assert.equal(screen.queryByText('No published revisions yet.'), null);
});

test('retains dirty content with its base version when the server draft advances', () => {
  const view = render(
    <MemoryRouter>
      <AdminCmsPage />
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText('Hero title'), {
    target: { value: 'Locally reviewed title' },
  });

  cmsState.draftVersion = 2;
  view.rerender(
    <MemoryRouter>
      <AdminCmsPage />
    </MemoryRouter>,
  );

  assert.equal(screen.getByLabelText('Hero title').getAttribute('value'), 'Locally reviewed title');
  assert.ok(screen.getByText('This draft changed on the server. Reload before saving or publishing.'));
  assert.equal((screen.getByRole('button', { name: 'Publish' }) as HTMLButtonElement).disabled, true);
});

test('shows page-list and draft-load failures distinctly', () => {
  cmsState.pagesError = new Error('pages failed');
  cmsState.draftError = new Error('draft failed');
  render(
    <MemoryRouter>
      <AdminCmsPage />
    </MemoryRouter>,
  );

  assert.ok(screen.getByText('Unable to load CMS pages. Please refresh and try again.'));
  assert.ok(screen.getByText('Unable to load the page draft. Please refresh and try again.'));
  assert.equal(screen.queryByText('Loading page draft…'), null);
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

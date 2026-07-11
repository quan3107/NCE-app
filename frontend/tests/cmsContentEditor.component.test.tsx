/**
 * Location: tests/cmsContentEditor.component.test.tsx
 * Purpose: Verify CMS variable-length collections can be populated and trimmed.
 * Why: Empty arrays must remain manageable through the structured admin editor.
 */
import assert from 'node:assert/strict';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, test } from 'vitest';

import { CmsContentEditor } from '../src/features/admin/components/CmsContentEditor';
import type { CmsPageContent, CmsPageKey } from '../src/features/admin/cmsTypes';

afterEach(cleanup);

function EditorHarness({ pageKey, initial }: { pageKey: CmsPageKey; initial: CmsPageContent }) {
  const [content, setContent] = useState(initial);
  return <CmsContentEditor pageKey={pageKey} content={content} onChange={setContent} />;
}

test('adds and removes homepage statistics and features', () => {
  render(<EditorHarness pageKey="homepage" initial={{
    hero: { badge: '', title: '', description: '', cta_primary: '', cta_secondary: '' },
    stats: [],
    howItWorks: { title: '', description: '', features: [] },
  }} />);

  fireEvent.click(screen.getByRole('button', { name: 'Add statistic' }));
  assert.ok(screen.getByLabelText('Statistic 1 label'));
  fireEvent.click(screen.getByRole('button', { name: 'Remove statistic 1' }));
  assert.equal(screen.queryByLabelText('Statistic 1 label'), null);

  fireEvent.click(screen.getByRole('button', { name: 'Add feature' }));
  assert.ok(screen.getByLabelText('Feature 1 title'));
  fireEvent.click(screen.getByRole('button', { name: 'Remove feature 1' }));
  assert.equal(screen.queryByLabelText('Feature 1 title'), null);
});

test('adds and removes about values and story paragraphs', () => {
  render(<EditorHarness pageKey="about" initial={{
    hero: { title: '', description: '' }, values: [], story: { sections: [] },
  }} />);

  fireEvent.click(screen.getByRole('button', { name: 'Add value' }));
  assert.ok(screen.getByLabelText('Value 1 title'));
  fireEvent.click(screen.getByRole('button', { name: 'Remove value 1' }));

  fireEvent.click(screen.getByRole('button', { name: 'Add story paragraph' }));
  assert.ok(screen.getByLabelText('Paragraph 1'));
  fireEvent.click(screen.getByRole('button', { name: 'Remove paragraph 1' }));
  assert.equal(screen.queryByLabelText('Paragraph 1'), null);
});

test('adds and removes contact office hours', () => {
  render(<EditorHarness pageKey="contact" initial={{
    header: { title: '', description: '' },
    form: { title: '', description: '', submitLabel: '' },
    details: { email: '', phone: '', address: '' }, hours: [],
  }} />);

  fireEvent.click(screen.getByRole('button', { name: 'Add office hours' }));
  assert.ok(screen.getByLabelText('Hours 1 label'));
  fireEvent.click(screen.getByRole('button', { name: 'Remove office hours 1' }));
  assert.equal(screen.queryByLabelText('Hours 1 label'), null);
});

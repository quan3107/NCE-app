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

test('keeps realtime statistic membership fixed while features remain variable', () => {
  const view = render(<EditorHarness pageKey="homepage" initial={{
    hero: { badge: '', title: '', description: '', cta_primary: '', cta_secondary: '' },
    stats: [
      { itemKey: 'stat_students', label: 'Students', value: 10, format: 'number' },
      { itemKey: 'stat_band_score', label: 'Band score', value: 7.5, format: 'decimal' },
      { itemKey: 'stat_success_rate', label: 'Success rate', value: 0.8, format: 'percentage' },
    ],
    howItWorks: { title: '', description: '', features: [] },
  }} />);

  assert.ok(screen.getByLabelText('Statistic 1 label'));
  assert.equal(view.container.textContent?.includes('Add statistic'), false);
  assert.ok(view.container.querySelector('[aria-label="Remove statistic 1"]') === null);

  fireEvent.click(screen.getByRole('button', { name: 'Add feature' }));
  assert.ok(screen.getByLabelText('Feature 1 title'));
  fireEvent.click(screen.getByRole('button', { name: 'Remove feature 1' }));
  assert.ok(screen.queryByLabelText('Feature 1 title') === null);
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
  assert.ok(screen.queryByLabelText('Paragraph 1') === null);
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
  assert.ok(screen.queryByLabelText('Hours 1 label') === null);
});

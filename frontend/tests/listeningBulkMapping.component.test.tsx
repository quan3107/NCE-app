/**
 * Location: tests/listeningBulkMapping.component.test.tsx
 * Purpose: Verify duplicate mapping feedback and selection identity for same-name files.
 * Why: Filename-based values silently choose the wrong audio when names collide.
 */
import React, { useState } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import { BulkAudioUploadDialog } from '../src/features/assignments/components/ielts/authoring/BulkAudioUploadDialog';
import { createIeltsAssignmentConfig, type IeltsListeningConfig } from '../src/lib/ielts';
afterEach(cleanup);

test('same-name audio remains selectable independently and duplicate assignment blocks Apply', async () => {
  const user = userEvent.setup();
  const first = new File(['one'], 'section.wav', { type: 'audio/wav' });
  const second = new File(['different'], 'section.wav', { type: 'audio/wav' });
  const sections = (createIeltsAssignmentConfig('listening') as IeltsListeningConfig).sections.slice(0, 2);
  const applied = vi.fn();
  function Harness() {
    const [matches, setMatches] = useState<Record<string, File | null>>({ [sections[0].id]: first });
    return <BulkAudioUploadDialog open onOpenChange={vi.fn()} files={[first, second]} sections={sections}
      bulkMatches={matches} onApply={() => applied(matches)} onCancel={vi.fn()}
      onAssignFileToSection={(id, file) => setMatches(prev => ({ ...prev, [id]: file }))}
      onRemoveFileFromSection={vi.fn()} onRemoveUnassignedFile={vi.fn()} />;
  }
  render(<Harness />);
  expect(screen.getByText('Unassigned Files (1)')).toBeTruthy();
  await user.click(screen.getByRole('combobox', { name: 'Audio for Section 2' }));
  await user.click(screen.getByRole('option', { name: 'section.wav (file 1, 3 bytes)' }));
  expect(screen.getByRole('alert').textContent).toContain('Duplicate assignments');
  expect(screen.getByRole('button', { name: 'Apply (2 files)' }).matches(':disabled')).toBe(true);
  await user.click(screen.getByRole('combobox', { name: 'Audio for Section 2' }));
  await user.click(screen.getByRole('option', { name: 'section.wav (file 2, 9 bytes)' }));
  expect(screen.queryByRole('alert')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Apply (2 files)' }));
  expect(applied.mock.calls[0][0][sections[1].id]).toBe(second);
});

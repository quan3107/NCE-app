/**
 * Location: tests/rollbackKeyboard.component.test.tsx
 * Purpose: Verify focus restoration after rollback replaces its revision trigger.
 * Why: A refreshed history must not leave keyboard focus on the document body.
 */
import { useState } from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test } from 'vitest';
import { ConfirmRollbackDialog } from '../src/features/admin/components/ConfirmRollbackDialog';

afterEach(cleanup);

test('pending rollback stays open and returns focus to the refreshed trigger', async () => {
  let finish!: () => void;
  const completion = new Promise<void>((resolve) => { finish = resolve; });
  function Fixture() {
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [version, setVersion] = useState(0);
    return <>
      <button key={version} id="revision-trigger" disabled={busy} onClick={() => setOpen(true)}>Roll back revision</button>
      <ConfirmRollbackDialog open={open} isBusy={busy} onCancel={() => setOpen(false)} onConfirm={() => {
        setBusy(true);
        void completion.then(() => { setVersion(1); setBusy(false); setOpen(false); });
      }} />
    </>;
  }
  const user = userEvent.setup();
  render(<Fixture />);
  await user.tab();
  await user.keyboard('{Enter}');
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));
  await user.tab();
  await user.keyboard('{Enter}');
  expect(screen.getByRole('alertdialog')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Rolling back…' }).hasAttribute('disabled')).toBe(true);
  await act(async () => { finish(); await completion; });
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Roll back revision' })));
});

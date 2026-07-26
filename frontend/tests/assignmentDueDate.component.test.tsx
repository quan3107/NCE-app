/**
 * Location: tests/assignmentDueDate.component.test.tsx
 * Purpose: Verify the assignment overview retains the server instant after edit/revert.
 * Why: Repeated DST wall times cannot be reconstructed uniquely from the control value.
 */
import assert from 'node:assert/strict';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React, { useState } from 'react';
import { afterEach, test } from 'vitest';

import { TeacherAssignmentOverviewTab } from '../src/features/assignments/components/TeacherAssignmentOverviewTab';
import type { Assignment } from '../src/types/domain/assignments';

const originalTimezone = process.env.TZ;

afterEach(() => {
  cleanup();
  if (originalTimezone === undefined) {
    delete process.env.TZ;
  } else {
    process.env.TZ = originalTimezone;
  }
});

test('reverting a repeated DST wall time restores the original instant', () => {
  process.env.TZ = 'America/New_York';
  const originalDueAt = new Date('2026-11-01T06:30:00.000Z');

  function Harness() {
    const [assignment, setAssignment] = useState({
      title: 'Reading Practice',
      description: 'Read carefully.',
      type: 'reading',
      dueAt: originalDueAt,
      maxScore: 9,
      status: 'draft',
    } as Assignment);

    return (
      <>
        <TeacherAssignmentOverviewTab
          assignment={assignment}
          originalDueAt={originalDueAt}
          courseTitle="Course"
          statsCards={[]}
          isEditing
          onAssignmentChange={(updates) =>
            setAssignment((current) => ({ ...current, ...updates }))
          }
        />
        <output data-testid="due-at">{assignment.dueAt.toISOString()}</output>
      </>
    );
  }

  render(<Harness />);
  const input = screen.getByLabelText('Due Date');
  fireEvent.change(input, { target: { value: '2026-11-01T02:30' } });
  fireEvent.change(input, { target: { value: '2026-11-01T01:30' } });

  assert.equal(screen.getByTestId('due-at').textContent, originalDueAt.toISOString());
});

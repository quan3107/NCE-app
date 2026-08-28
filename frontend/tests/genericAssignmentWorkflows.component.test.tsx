/**
 * Location: tests/genericAssignmentWorkflows.component.test.tsx
 * Purpose: Verify generic type selection, response controls, and safe link rendering.
 * Why: These controls make the generic student workflows reachable in the browser.
 */
import assert from 'node:assert/strict';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, test, vi } from 'vitest';

vi.mock('@features/assignments/components/IeltsSubmissionPayloadView', () => ({
  IeltsSubmissionPayloadView: () => null,
}));
vi.mock('@features/assignments/components/ielts/student/StudentIeltsAttemptForm', () => ({
  StudentIeltsAttemptForm: () => null,
}));

import type { Assignment } from '../src/types/domain/assignments';
import { GenericAssignmentTypeSelection } from '../src/features/assignments/components/GenericAssignmentTypeSelection';
import { StudentAssignmentSubmissionSummary } from '../src/features/assignments/components/StudentAssignmentSubmissionSummary';
import { StudentAssignmentSubmitDialog } from '../src/features/assignments/components/StudentAssignmentSubmitDialog';

afterEach(() => {
  cleanup();
});

const assignment: Assignment = {
  id: 'assignment-1',
  title: 'Research response',
  description: 'Share your research.',
  type: 'link',
  courseId: 'course-1',
  courseName: 'General English',
  dueAt: new Date('2026-09-01T12:00:00.000Z'),
  publishedAt: new Date('2026-08-28T12:00:00.000Z'),
  status: 'published',
  latePolicy: '',
  maxScore: 75,
  assignmentConfig: { version: 1, maxScore: 75 },
};

test('generic assignment type cards expose all supported response types', () => {
  const onSelect = vi.fn();
  render(<GenericAssignmentTypeSelection onSelect={onSelect} />);

  assert.ok(screen.getByRole('button', { name: /text response/i }));
  assert.ok(screen.getByRole('button', { name: /link response/i }));
  assert.ok(screen.getByRole('button', { name: /file upload/i }));

  fireEvent.click(screen.getByRole('button', { name: /link response/i }));
  assert.equal(onSelect.mock.calls[0]?.[0], 'link');
});

test('link submission dialog shows only the link response control', () => {
  render(
    <StudentAssignmentSubmitDialog
      assignment={assignment}
      isOpen
      isSubmitting={false}
      isUploadBusy={false}
      submissionContent=""
      uploadedFiles={[]}
      onOpenChange={vi.fn()}
      onSubmissionContentChange={vi.fn()}
      onUploadedFilesChange={vi.fn()}
      onUploadBusyChange={vi.fn()}
      onSubmit={vi.fn()}
    />,
  );

  assert.ok(screen.getByLabelText('Submission Link'));
  assert.equal(screen.queryByText('Upload Files') === null, true);
  assert.equal(screen.queryByLabelText('Your Response') === null, true);
});

test('submitted links render as inertly labeled http links', () => {
  render(
    <StudentAssignmentSubmissionSummary
      assignment={assignment}
      submission={{
        id: 'submission-1',
        assignmentId: assignment.id,
        studentId: 'student-1',
        studentName: 'Student',
        status: 'submitted',
        submittedAt: new Date('2026-08-28T12:30:00.000Z'),
        link: 'https://example.com/work',
        version: 1,
      }}
    />,
  );

  const link = screen.getByRole('link', { name: 'https://example.com/work' });
  assert.equal(link.getAttribute('href'), 'https://example.com/work');
  assert.equal(link.getAttribute('target'), '_blank');
  assert.equal(link.getAttribute('rel'), 'noopener noreferrer');
});

/**
 * Location: tests/listeningSaveLock.component.test.tsx
 * Purpose: Verify the create route locks uploads and mutation as one operation.
 * Why: Slow uploads must not permit duplicate assignments or strand retry controls.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { TeacherIeltsAssignmentCreatePage } from '../src/features/assignments/components/TeacherIeltsAssignmentCreatePage';

const mocks = vi.hoisted(() => ({ upload: vi.fn(), create: vi.fn(), navigate: vi.fn() }));
vi.mock('@features/assignments/api', () => ({
  useAssignmentResources: () => ({ courses: [{ id: 'course', title: 'Course' }], isLoading: false }),
  useCreateAssignmentMutation: () => ({ mutateAsync: mocks.create, isPending: false }),
}));
vi.mock('@lib/router', () => ({ useRouter: () => ({ navigate: mocks.navigate }) }));
vi.mock('@lib/use-auto-save', () => ({ useAutoSave: () => ({ clearDraft: vi.fn() }) }));
vi.mock('../src/features/assignments/components/teacherIeltsCreate.logic', async (original) => {
  const actual = await original<typeof import('../src/features/assignments/components/teacherIeltsCreate.logic')>();
  const { createIeltsAssignmentConfig } = await import('../src/lib/ielts');
  return { ...actual, uploadListeningAudioFiles: mocks.upload,
    getInitialStateFromDraft: () => ({ type: 'listening', timestamp: Date.now(), data: {
      assignmentTitle: 'Listening', courseId: 'course', assignmentConfig: createIeltsAssignmentConfig('listening'),
    } }),
  };
});
vi.mock('../src/features/assignments/components/TeacherIeltsAssignmentEditor', () => ({
  TeacherIeltsAssignmentEditor: ({ isLoading, onSaveDraft }: { isLoading: boolean; onSaveDraft: () => void }) =>
    <><output>{isLoading ? 'Busy' : 'Ready'}</output><button disabled={isLoading}
      onClick={() => { onSaveDraft(); onSaveDraft(); }}>Save twice</button></>,
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

test('locks synchronously through deferred upload and mutation, then releases on completion', async () => {
  let finishUpload!: (value: unknown) => void;
  let finishCreate!: () => void;
  mocks.upload.mockImplementation((config) => new Promise(resolve => { finishUpload = () => resolve(config); }));
  mocks.create.mockImplementation(() => new Promise<void>(resolve => { finishCreate = resolve; }));
  render(<TeacherIeltsAssignmentCreatePage />);
  fireEvent.click(screen.getByText('Save twice'));
  expect(mocks.upload).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Busy')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Save twice' }).matches(':disabled')).toBe(true);
  expect(mocks.create).not.toHaveBeenCalled();
  await act(async () => finishUpload(undefined));
  expect(mocks.create).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Busy')).toBeTruthy();
  await act(async () => finishCreate());
  expect(mocks.navigate).toHaveBeenCalledWith('/teacher/assignments');
});

test('failed upload creates nothing and permits a deliberate retry', async () => {
  mocks.upload.mockRejectedValueOnce(new Error('Storage unavailable')).mockImplementation(async (config) => config);
  mocks.create.mockResolvedValue(undefined);
  render(<TeacherIeltsAssignmentCreatePage />);
  fireEvent.click(screen.getByText('Save twice'));
  await waitFor(() => expect(screen.getByText('Ready')).toBeTruthy());
  expect(mocks.create).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Save twice'));
  await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1));
  expect(mocks.upload).toHaveBeenCalledTimes(2);
});

test('leaving during upload never starts an assignment mutation', async () => {
  let finishUpload!: () => void;
  mocks.upload.mockImplementation((config) => new Promise(resolve => { finishUpload = () => resolve(config); }));
  const view = render(<TeacherIeltsAssignmentCreatePage />);
  fireEvent.click(screen.getByText('Save twice'));
  view.unmount();
  await act(async () => finishUpload());
  expect(mocks.create).not.toHaveBeenCalled();
  expect(mocks.navigate).not.toHaveBeenCalled();
});

test('leaving during creation never redirects when the server acknowledges', async () => {
  mocks.upload.mockImplementation(async (config) => config);
  let finishCreate!: () => void;
  mocks.create.mockImplementation(() => new Promise<void>(resolve => { finishCreate = resolve; }));
  const view = render(<TeacherIeltsAssignmentCreatePage />);
  fireEvent.click(screen.getByText('Save twice'));
  await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1));
  view.unmount();
  await act(async () => finishCreate());
  expect(mocks.navigate).not.toHaveBeenCalled();
});

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { before, test } from 'node:test';

import type {
  ObjectiveExplanationResponse,
} from '../src/features/grades/api';
import type { Assignment, Submission } from '../src/types/domain';

type GradesApi = typeof import('../src/features/grades/api');

let fetchObjectiveExplanation: GradesApi['fetchObjectiveExplanation'];
let pollObjectiveExplanationUntilSettled: GradesApi['pollObjectiveExplanationUntilSettled'];
let requestObjectiveExplanation: GradesApi['requestObjectiveExplanation'];
let toGrade: GradesApi['toGrade'];

before(async () => {
  if (typeof process !== 'undefined' && process.env) {
    process.env.VITE_API_BASE_URL = 'http://localhost:4000/api/v1';
  }

  const gradesApi = await import('../src/features/grades/api');
  fetchObjectiveExplanation = gradesApi.fetchObjectiveExplanation;
  pollObjectiveExplanationUntilSettled = gradesApi.pollObjectiveExplanationUntilSettled;
  requestObjectiveExplanation = gradesApi.requestObjectiveExplanation;
  toGrade = gradesApi.toGrade;
});

const withFetch = async (
  fetch: typeof globalThis.fetch,
  run: () => Promise<void>,
) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetch;

  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
};

test('grade queries are enabled for authenticated students', async () => {
  const gradesApiPath = path.resolve(import.meta.dirname, '../src/features/grades/api.ts');
  const gradesApi = await readFile(gradesApiPath, 'utf8');

  assert.match(
    gradesApi,
    /currentUser\.role === 'student'/,
  );
});

test('grade query keys include the current actor identity', async () => {
  const gradesApiPath = path.resolve(import.meta.dirname, '../src/features/grades/api.ts');
  const gradesApi = await readFile(gradesApiPath, 'utf8');

  assert.match(
    gradesApi,
    /queryKey:\s*\[\s*GRADES_KEY,\s*currentUser\.id,\s*currentUser\.role,/,
  );
});

test('toGrade maps student-safe AI feedback labels without transport metadata', () => {
  const submission: Submission = {
    id: 'submission-1',
    assignmentId: 'assignment-1',
    studentId: 'student-1',
    studentName: 'Student One',
    status: 'graded',
    version: 1,
  };
  const assignment: Assignment = {
    id: 'assignment-1',
    title: 'Writing Task',
    description: '',
    type: 'writing',
    courseId: 'course-1',
    courseName: 'IELTS',
    dueAt: new Date('2026-06-01T00:00:00.000Z'),
    status: 'published',
    latePolicy: '',
    maxScore: 9,
  };

  const grade = toGrade(
    {
      id: 'grade-1',
      submissionId: submission.id,
      graderId: 'teacher-1',
      finalScore: 7,
      feedback: 'Final teacher note.',
      feedbackLabel: 'teacher-reviewed AI-assisted feedback',
      studentAiFeedback: {
        label: 'provisional AI feedback',
        status: 'accepted',
        feedback: {
          feedbackMd: 'Add a clearer overview.',
        },
      },
      gradedAt: '2026-06-02T12:00:00.000Z',
      graderName: 'Teacher One',
    },
    submission,
    new Map([[assignment.id, assignment]]),
  );

  assert.equal(grade.feedbackLabel, 'teacher-reviewed AI-assisted feedback');
  assert.deepEqual(grade.studentAiFeedback, {
    label: 'provisional AI feedback',
    status: 'accepted',
    feedback: {
      feedbackMd: 'Add a clearer overview.',
    },
  });
  assert.equal(JSON.stringify(grade).includes('provider'), false);
  assert.equal(JSON.stringify(grade).includes('model'), false);
});

test('toGrade maps provisional-only feedback records before teacher grading', () => {
  const submission: Submission = {
    id: 'submission-2',
    assignmentId: 'assignment-2',
    studentId: 'student-1',
    studentName: 'Student One',
    status: 'submitted',
    version: 1,
  };
  const assignment: Assignment = {
    id: 'assignment-2',
    title: 'Writing Task',
    description: '',
    type: 'writing',
    courseId: 'course-1',
    courseName: 'IELTS',
    dueAt: new Date('2026-06-01T00:00:00.000Z'),
    status: 'published',
    latePolicy: '',
    maxScore: 9,
  };

  const grade = toGrade(
    {
      id: 'draft-before-grade',
      submissionId: submission.id,
      provisionalOnly: true,
      feedbackLabel: 'teacher feedback',
      studentAiFeedback: {
        label: 'provisional AI feedback',
        status: 'accepted',
        feedback: {
          feedbackMd: 'Ready before teacher grading.',
        },
      },
    },
    submission,
    new Map([[assignment.id, assignment]]),
  );

  assert.equal(grade.provisionalOnly, true);
  assert.equal(grade.gradedAt, undefined);
  assert.equal(grade.gradedBy, undefined);
  assert.equal(grade.studentAiFeedback?.feedback.feedbackMd, 'Ready before teacher grading.');
});

test('pollObjectiveExplanationUntilSettled refetches queued explanations until ready', async () => {
  const queued: ObjectiveExplanationResponse = {
    id: 'explanation-1',
    status: 'queued',
    cached: false,
    pollingLocation: '/poll',
  };
  const running: ObjectiveExplanationResponse = {
    ...queued,
    status: 'running',
  };
  const completed: ObjectiveExplanationResponse = {
    id: 'explanation-1',
    status: 'completed',
    cached: true,
    explanation: {
      short_explanation: 'The passage supports option B.',
    },
  };
  const fetched = [running, completed];

  const result = await pollObjectiveExplanationUntilSettled(
    'submission-1',
    'q1',
    queued,
    {
      intervalMs: 0,
      wait: async () => {},
      fetcher: async () => fetched.shift() ?? completed,
    },
  );

  assert.equal(result.status, 'completed');
  assert.deepEqual(result.explanation, completed.explanation);
  assert.equal(fetched.length, 0);
});

test('pollObjectiveExplanationUntilSettled rejects when polling attempts are exhausted', async () => {
  const queued: ObjectiveExplanationResponse = {
    id: 'explanation-2',
    status: 'queued',
    cached: false,
    pollingLocation: '/poll',
  };
  const running: ObjectiveExplanationResponse = {
    ...queued,
    status: 'running',
  };

  await assert.rejects(
    () =>
      pollObjectiveExplanationUntilSettled('submission-1', 'q2', queued, {
        intervalMs: 0,
        maxAttempts: 2,
        wait: async () => {},
        fetcher: async () => running,
      }),
    {
      name: 'ObjectiveExplanationPollingTimeoutError',
      message: 'Objective explanation is still running.',
    },
  );
});

test('student explanation polling timeout leaves a retry path available', async () => {
  const studentGradesPagePath = path.resolve(
    import.meta.dirname,
    '../src/features/grades/components/StudentGradesPage.tsx',
  );
  const studentGradesPage = await readFile(studentGradesPagePath, 'utf8');

  assert.match(studentGradesPage, /ObjectiveExplanationPollingTimeoutError/);
  assert.match(studentGradesPage, /status:\s+[\s\S]*\? 'polling_timeout'/);
  assert.match(studentGradesPage, /\? 'Retry'/);
});

test('requestObjectiveExplanation returns review-required payloads from conflict responses', async () => {
  const terminalResponse: ObjectiveExplanationResponse = {
    id: 'explanation-review',
    status: 'review_required',
    cached: false,
  };

  await withFetch(
    async () =>
      new Response(JSON.stringify(terminalResponse), {
        status: 409,
        statusText: 'Conflict',
        headers: { 'content-type': 'application/json' },
      }),
    async () => {
      const result = await requestObjectiveExplanation('submission-1', 'q3');

      assert.deepEqual(result, terminalResponse);
    },
  );
});

test('fetchObjectiveExplanation returns rejected payloads from conflict responses', async () => {
  const terminalResponse: ObjectiveExplanationResponse = {
    id: 'explanation-rejected',
    status: 'rejected',
    cached: true,
  };

  await withFetch(
    async () =>
      new Response(JSON.stringify(terminalResponse), {
        status: 409,
        statusText: 'Conflict',
        headers: { 'content-type': 'application/json' },
      }),
    async () => {
      const result = await fetchObjectiveExplanation('submission-1', 'q4');

      assert.deepEqual(result, terminalResponse);
    },
  );
});

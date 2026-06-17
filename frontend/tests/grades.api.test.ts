import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { before, test } from 'node:test';

import type { ObjectiveExplanationResponse } from '../src/features/grades/api';
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
  pollObjectiveExplanationUntilSettled =
    gradesApi.pollObjectiveExplanationUntilSettled;
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
  const gradesApiPath = path.resolve(
    import.meta.dirname,
    '../src/features/grades/api.ts',
  );
  const gradesApi = await readFile(gradesApiPath, 'utf8');

  assert.match(gradesApi, /currentUser\.role === 'student'/);
});

test('grade query keys include the current actor identity', async () => {
  const gradesApiPath = path.resolve(
    import.meta.dirname,
    '../src/features/grades/api.ts',
  );
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

test('toGrade maps IELTS writing grades to band display metadata', () => {
  const submission: Submission = {
    id: 'submission-writing',
    assignmentId: 'assignment-writing',
    studentId: 'student-1',
    studentName: 'Student One',
    status: 'graded',
    version: 1,
  };
  const assignment: Assignment = {
    id: 'assignment-writing',
    title: 'IELTS Writing',
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
      id: 'grade-writing',
      submissionId: submission.id,
      rubricBreakdown: [
        { criterion: 'Task Achievement', points: 7 },
        { criterion: 'Coherence and Cohesion', points: 7.5 },
      ],
      rawScore: 7,
      finalScore: 7,
      feedback: 'Good response.',
      gradedAt: '2026-06-02T12:00:00.000Z',
      graderName: 'Teacher One',
    },
    submission,
    new Map([[assignment.id, assignment]]),
  );

  assert.equal(grade.scoreDisplay.kind, 'ielts_band');
  assert.equal(grade.scoreDisplay.value, 7);
  assert.equal(grade.scoreDisplay.max, 9);
  assert.equal(grade.band, 7);
  assert.deepEqual(grade.rubricBreakdown, [
    {
      criteria: 'Task Achievement',
      points: 7,
      maxPoints: 9,
      scale: 'ielts_band',
    },
    {
      criteria: 'Coherence and Cohesion',
      points: 7.5,
      maxPoints: 9,
      scale: 'ielts_band',
    },
  ]);
});

test('toGrade normalizes numeric-string IELTS grade payloads before display', () => {
  const submission: Submission = {
    id: 'submission-writing-string-score',
    assignmentId: 'assignment-writing-string-score',
    studentId: 'student-1',
    studentName: 'Student One',
    status: 'graded',
    version: 1,
  };
  const assignment: Assignment = {
    id: 'assignment-writing-string-score',
    title: 'IELTS Writing',
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
      id: 'grade-writing-string-score',
      submissionId: submission.id,
      rubricBreakdown: [
        { criterion: 'Task Achievement', points: '7' },
        { criterion: 'Coherence and Cohesion', points: '7.5' },
      ],
      rawScore: '7',
      finalScore: '7',
      band: '7',
      feedback: 'Good response.',
    },
    submission,
    new Map([[assignment.id, assignment]]),
  );

  assert.equal(grade.scoreDisplay.value, 7);
  assert.equal(grade.finalScore, 7);
  assert.equal(grade.band, 7);
  assert.deepEqual(grade.rubricBreakdown, [
    {
      criteria: 'Task Achievement',
      points: 7,
      maxPoints: 9,
      scale: 'ielts_band',
    },
    {
      criteria: 'Coherence and Cohesion',
      points: 7.5,
      maxPoints: 9,
      scale: 'ielts_band',
    },
  ]);
});

test('toGrade maps IELTS reading and listening bands to band display metadata', () => {
  const ieltsObjectiveTypes: Array<Assignment['type']> = [
    'reading',
    'listening',
  ];

  for (const assignmentType of ieltsObjectiveTypes) {
    const submission: Submission = {
      id: `submission-${assignmentType}`,
      assignmentId: `assignment-${assignmentType}`,
      studentId: 'student-1',
      studentName: 'Student One',
      status: 'graded',
      version: 1,
    };
    const assignment: Assignment = {
      id: submission.assignmentId,
      title: `IELTS ${assignmentType}`,
      description: '',
      type: assignmentType,
      courseId: 'course-1',
      courseName: 'IELTS',
      dueAt: new Date('2026-06-01T00:00:00.000Z'),
      status: 'published',
      latePolicy: '',
      maxScore: 9,
    };

    const grade = toGrade(
      {
        id: `grade-${assignmentType}`,
        submissionId: submission.id,
        rawScore: '30',
        finalScore: '7',
        band: '7',
        feedback: 'Auto-scored IELTS objective result.',
      },
      submission,
      new Map([[assignment.id, assignment]]),
    );

    assert.equal(grade.scoreDisplay.kind, 'ielts_band');
    assert.equal(grade.scoreDisplay.value, 7);
    assert.equal(grade.scoreDisplay.max, 9);
    assert.equal(grade.rawScore, 30);
    assert.equal(grade.finalScore, 7);
    assert.equal(grade.band, 7);
  }
});

test('toGrade does not derive IELTS reading or listening bands from raw score counts', () => {
  const ieltsObjectiveTypes: Array<Assignment['type']> = [
    'reading',
    'listening',
  ];

  for (const assignmentType of ieltsObjectiveTypes) {
    const submission: Submission = {
      id: `raw-only-submission-${assignmentType}`,
      assignmentId: `raw-only-assignment-${assignmentType}`,
      studentId: 'student-1',
      studentName: 'Student One',
      status: 'graded',
      version: 1,
    };
    const assignment: Assignment = {
      id: submission.assignmentId,
      title: `IELTS ${assignmentType}`,
      description: '',
      type: assignmentType,
      courseId: 'course-1',
      courseName: 'IELTS',
      dueAt: new Date('2026-06-01T00:00:00.000Z'),
      status: 'published',
      latePolicy: '',
      maxScore: 9,
    };

    const grade = toGrade(
      {
        id: `raw-only-grade-${assignmentType}`,
        submissionId: submission.id,
        rawScore: 30,
        feedback: 'Raw correct-count without a persisted band.',
      },
      submission,
      new Map([[assignment.id, assignment]]),
    );

    assert.equal(grade.rawScore, 30);
    assert.equal(grade.finalScore, 0);
    assert.equal(grade.band, undefined);
    assert.deepEqual(grade.scoreDisplay, {
      kind: 'unavailable',
      label: 'Score unavailable',
    });
  }
});

test('toGrade keeps generic assignments on point display metadata', () => {
  const submission: Submission = {
    id: 'submission-generic',
    assignmentId: 'assignment-generic',
    studentId: 'student-1',
    studentName: 'Student One',
    status: 'graded',
    version: 1,
  };
  const assignment: Assignment = {
    id: 'assignment-generic',
    title: 'Generic Project',
    description: '',
    type: 'file',
    courseId: 'course-1',
    courseName: 'General',
    dueAt: new Date('2026-06-01T00:00:00.000Z'),
    status: 'published',
    latePolicy: '',
    maxScore: 100,
  };

  const grade = toGrade(
    {
      id: 'grade-generic',
      submissionId: submission.id,
      rubricBreakdown: [{ criterion: 'Evidence', points: 8 }],
      rawScore: 8,
      finalScore: 8,
      feedback: 'Good evidence.',
    },
    submission,
    new Map([[assignment.id, assignment]]),
  );

  assert.equal(grade.scoreDisplay.kind, 'points');
  assert.equal(grade.scoreDisplay.value, 8);
  assert.equal(grade.scoreDisplay.max, 100);
  assert.deepEqual(grade.rubricBreakdown, [
    { criteria: 'Evidence', points: 8, maxPoints: 8, scale: 'points' },
  ]);
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
  assert.equal(
    grade.studentAiFeedback?.feedback.feedbackMd,
    'Ready before teacher grading.',
  );
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
    failureCode: 'insufficient_source_evidence',
    failureMessage:
      'This question does not include enough source text for a source-backed AI explanation.',
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
      assert.equal(result.failureCode, 'insufficient_source_evidence');
      assert.equal(
        result.failureMessage,
        'This question does not include enough source text for a source-backed AI explanation.',
      );
    },
  );
});

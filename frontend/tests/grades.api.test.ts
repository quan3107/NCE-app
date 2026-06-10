import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';

import { toGrade } from '../src/features/grades/api';
import type { Assignment, Submission } from '../src/types/domain';

test('grade queries are enabled for authenticated students', async () => {
  const gradesApiPath = path.resolve(import.meta.dirname, '../src/features/grades/api.ts');
  const gradesApi = await readFile(gradesApiPath, 'utf8');

  assert.match(
    gradesApi,
    /currentUser\.role === 'student'/,
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

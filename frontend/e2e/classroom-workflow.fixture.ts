/**
 * Location: frontend/e2e/classroom-workflow.fixture.ts
 * Purpose: Provide isolated auth and API state for the classroom workflow browser test.
 * Why: Keeps the E2E focused on UI behavior while avoiding a required local database.
 */

import type { Page, Route } from '@playwright/test';

type Role = 'teacher' | 'student';

export type TestUser = {
  id: string;
  email: string;
  fullName: string;
  name: string;
  role: Role;
  token: string;
};

type ApiAssignment = {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  type: 'writing';
  dueAt: string | null;
  latePolicy: null;
  publishedAt: string | null;
  assignmentConfig: Record<string, unknown> | null;
};

type ApiSubmission = {
  id: string;
  assignmentId: string;
  studentId: string;
  status: 'submitted' | 'graded';
  submittedAt: string | null;
  payload: Record<string, unknown>;
};

type ApiGrade = {
  id: string;
  submissionId: string;
  graderId: string;
  rubricBreakdown: Array<{ criterion: string; points: number }>;
  rawScore: number;
  adjustments: Array<{ reason: string; delta: number }>;
  finalScore: number;
  band: number | null;
  feedback: string;
  gradedAt: string;
  graderName: string;
};

export type ClassroomApiState = {
  activeUser: TestUser;
  assignments: ApiAssignment[];
  submissions: ApiSubmission[];
  grades: ApiGrade[];
};

export const courseId = 'course-classroom-workflow';
export const teacher: TestUser = {
  id: '22222222-2222-4222-8222-222222222222',
  email: 'sarah.tutor@ielts.local',
  fullName: 'Sarah Nguyen',
  name: 'Sarah Nguyen',
  role: 'teacher',
  token: 'e2e-teacher-token',
};
export const student: TestUser = {
  id: '33333333-3333-4333-8333-333333333333',
  email: 'amelia.chan@ielts.local',
  fullName: 'Amelia Chan',
  name: 'Amelia Chan',
  role: 'student',
  token: 'e2e-student-token',
};

export async function signInAs(
  page: Page,
  user: TestUser,
  api: ClassroomApiState,
) {
  api.activeUser = user;
  const snapshot = {
    mode: 'live',
    token: user.token,
    persona: { basePersona: 'admin', actingPersona: null },
    liveUser: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  };

  await page.goto('/');
  await page.evaluate((nextSnapshot) => {
    window.localStorage.setItem('currentUser', JSON.stringify(nextSnapshot));
  }, snapshot);
}

export async function installClassroomApi(page: Page): Promise<ClassroomApiState> {
  const api: ClassroomApiState = {
    activeUser: teacher,
    assignments: [],
    submissions: [],
    grades: [],
  };

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api/v1', '');
    const method = request.method();

    if (path === '/auth/refresh' && method === 'POST') {
      return fulfillJson(route, authResponse(api.activeUser));
    }
    if (path === '/courses' && method === 'GET') {
      return fulfillJson(route, { courses: [courseResponse()] });
    }
    if (path === '/me' && method === 'GET') {
      return fulfillJson(route, meResponse(api.activeUser));
    }
    if (path === '/config/ielts' && method === 'GET') {
      return fulfillJson(route, ieltsConfigResponse());
    }
    if (path === '/config/ielts/type-metadata' && method === 'GET') {
      return fulfillJson(route, ieltsTypeMetadataResponse());
    }
    if (path === `/courses/${courseId}/rubrics` && method === 'GET') {
      return fulfillJson(route, []);
    }
    if (path === `/courses/${courseId}/assignments` && method === 'GET') {
      return fulfillJson(route, api.assignments);
    }
    if (path === `/courses/${courseId}/assignments` && method === 'POST') {
      const assignment = createAssignmentFromRequest(
        parseRequestBody<Record<string, unknown>>(request.postData()),
      );
      api.assignments.push(assignment);
      return fulfillJson(route, assignment, 201);
    }

    const submissionsMatch = path.match(/^\/assignments\/([^/]+)\/submissions$/);
    if (submissionsMatch && method === 'GET') {
      return fulfillJson(
        route,
        api.submissions.filter((submission) => submission.assignmentId === submissionsMatch[1]),
      );
    }
    if (submissionsMatch && method === 'POST') {
      const submission = createSubmissionFromRequest(
        submissionsMatch[1],
        parseRequestBody<Record<string, unknown>>(request.postData()),
      );
      api.submissions.push(submission);
      return fulfillJson(route, submission, 201);
    }

    const gradeMatch = path.match(/^\/submissions\/([^/]+)\/grade$/);
    if (gradeMatch && method === 'GET') {
      const grade = api.grades.find((item) => item.submissionId === gradeMatch[1]);
      return grade
        ? fulfillJson(route, grade)
        : fulfillJson(route, { message: 'Grade not found.' }, 404);
    }
    if (gradeMatch && method === 'PUT') {
      const grade = createGradeFromRequest(
        gradeMatch[1],
        parseRequestBody<Record<string, unknown>>(request.postData()),
      );
      api.grades = api.grades.filter((item) => item.submissionId !== grade.submissionId);
      api.grades.push(grade);
      api.submissions = api.submissions.map((submission) =>
        submission.id === grade.submissionId ? { ...submission, status: 'graded' } : submission,
      );
      return fulfillJson(route, grade);
    }

    return fulfillJson(route, { message: `Unhandled E2E route: ${method} ${path}` }, 404);
  });

  return api;
}

function parseRequestBody<T>(body: string | null): T {
  return body ? (JSON.parse(body) as T) : ({} as T);
}

function fulfillJson(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

function authResponse(user: TestUser) {
  return {
    accessToken: user.token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    },
  };
}

function meResponse(user: TestUser) {
  return {
    profile: { id: user.id },
    enrollments:
      user.role === 'student'
        ? [{ id: 'enrollment-classroom-workflow', courseId, enrolledAt: '2026-06-01T00:00:00.000Z' }]
        : [],
  };
}

function courseResponse() {
  return {
    id: courseId,
    title: 'IELTS Writing Studio',
    description: 'Focused IELTS writing practice.',
    schedule: null,
    metadata: { duration: '8 weeks', level: 'Intermediate', price: null },
    owner: { id: teacher.id, fullName: teacher.fullName, email: teacher.email },
    metrics: { activeStudentCount: 1, invitedStudentCount: 0, teacherCount: 1, assignmentCount: 0, rubricCount: 0 },
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
  };
}

function createAssignmentFromRequest(body: Record<string, unknown>): ApiAssignment {
  return {
    id: 'assignment-classroom-workflow',
    courseId,
    title: String(body.title),
    description: typeof body.descriptionMd === 'string' ? body.descriptionMd : null,
    type: 'writing',
    dueAt: typeof body.dueAt === 'string' ? body.dueAt : null,
    latePolicy: null,
    publishedAt: typeof body.publishedAt === 'string' ? body.publishedAt : null,
    assignmentConfig:
      body.assignmentConfig && typeof body.assignmentConfig === 'object'
        ? (body.assignmentConfig as Record<string, unknown>)
        : null,
  };
}

function createSubmissionFromRequest(
  assignmentId: string,
  body: Record<string, unknown>,
): ApiSubmission {
  return {
    id: 'submission-classroom-workflow',
    assignmentId,
    studentId: student.id,
    status: 'submitted',
    submittedAt: typeof body.submittedAt === 'string' ? body.submittedAt : new Date().toISOString(),
    payload:
      body.payload && typeof body.payload === 'object'
        ? (body.payload as Record<string, unknown>)
        : {},
  };
}

function createGradeFromRequest(submissionId: string, body: Record<string, unknown>): ApiGrade {
  const finalScore = Number(body.finalScore ?? body.band ?? body.rawScore ?? 0);
  return {
    id: 'grade-classroom-workflow',
    submissionId,
    graderId: teacher.id,
    rubricBreakdown: [],
    rawScore: Number(body.rawScore ?? finalScore),
    adjustments: [],
    finalScore,
    band: typeof body.band === 'number' ? body.band : finalScore,
    feedback: typeof body.feedbackMd === 'string' ? body.feedbackMd : '',
    gradedAt: new Date().toISOString(),
    graderName: teacher.name,
  };
}

function ieltsTypeMetadataResponse() {
  return {
    version: 1,
    types: [
      typeMetadata('reading', 'Reading', 1),
      typeMetadata('listening', 'Listening', 2),
      typeMetadata('writing', 'Writing', 3),
      typeMetadata('speaking', 'Speaking', 4),
    ],
  };
}

function typeMetadata(id: string, title: string, sortOrder: number) {
  return {
    id,
    title,
    description: `Create an IELTS ${title.toLowerCase()} assignment`,
    icon: id === 'writing' ? 'pen-tool' : 'book-open',
    theme: { color_from: '#F0FDF4', color_to: '#DCFCE7', border_color: '#BBF7D0' },
    enabled: true,
    sort_order: sortOrder,
  };
}

function ieltsConfigResponse() {
  return {
    version: 1,
    assignment_types: [],
    question_types: { reading: [], listening: [] },
    writing_task_types: {
      task1: [{ id: 'line_chart', label: 'Line chart', enabled: true }],
      task2: [{ id: 'essay', label: 'Essay', enabled: true }],
    },
    speaking_part_types: [],
    completion_formats: [],
    sample_timing_options: [{ id: 'immediate', label: 'Immediately', enabled: true }],
  };
}

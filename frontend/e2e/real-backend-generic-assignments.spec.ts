/**
 * Location: e2e/real-backend-generic-assignments.spec.ts
 * Purpose: Exercise generic assignment, submission, upload, and download stories.
 * Why: ASG-13 and STU-03 through STU-06 require real browser and authoritative API evidence.
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

type AuthResponse = {
  accessToken: string;
  user: { id: string; email: string; role: 'teacher' | 'student' };
};

type AssignmentResponse = {
  id: string;
  courseId: string;
  title: string;
  type: 'text' | 'link' | 'file';
  publishedAt: string | null;
  assignmentConfig: { version: 1; maxScore: number };
};

type SubmissionResponse = {
  id: string;
  assignmentId: string;
  payload: Record<string, unknown>;
  status: 'submitted' | 'late';
};

const apiBaseURL = (process.env.PLAYWRIGHT_API_BASE_URL ?? 'http://127.0.0.1:4000/api/v1').replace(/\/$/, '');
const evidenceDir = process.env.PLAYWRIGHT_EVIDENCE_DIR ?? '/tmp/nce-generic-e2e-20260828';
const password = process.env.PLAYWRIGHT_TEST_PASSWORD;
if (!password) {
  throw new Error('PLAYWRIGHT_TEST_PASSWORD is required.');
}
const teacherEmail = process.env.PLAYWRIGHT_TEACHER_EMAIL ?? 'sarah.tutor@ielts.local';
const studentEmail = process.env.PLAYWRIGHT_STUDENT_EMAIL ?? 'amelia.chan@ielts.local';
const otherStudentEmail = 'diego.rojas@ielts.local';
const courseTitle = 'IELTS Academic Writing Bootcamp';

async function loginThroughBrowser(page: Page, email: string): Promise<AuthResponse> {
  const loginResponse = page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url() === `${apiBaseURL}/auth/login`,
  );
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  const response = await loginResponse;
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as AuthResponse;
}

async function loginThroughApi(request: APIRequestContext, email: string): Promise<AuthResponse> {
  const response = await request.post(`${apiBaseURL}/auth/login`, {
    data: { email, password },
  });
  expect(response.ok(), `API login failed for ${email}`).toBeTruthy();
  return (await response.json()) as AuthResponse;
}

async function logoutThroughBrowser(page: Page): Promise<void> {
  await page
    .locator('header button')
    .filter({ has: page.locator('[data-slot="avatar"]') })
    .click();
  await page.getByRole('menuitem', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/\/login$/);
}

async function selectCourse(page: Page): Promise<void> {
  await page.getByLabel('Course').click();
  await page.getByRole('option', { name: courseTitle }).click();
}

async function createGenericAssignment(
  page: Page,
  input: {
    type: AssignmentResponse['type'];
    title: string;
    maxScore: number;
    publish: boolean;
  },
): Promise<AssignmentResponse> {
  const typeLabels = {
    text: 'Text Response',
    link: 'Link Response',
    file: 'File Upload',
  } as const;
  await page.goto('/teacher/assignments/create');
  await page.getByRole('button', { name: new RegExp(typeLabels[input.type], 'i') }).click();
  await page.getByLabel('Title').fill(input.title);
  await selectCourse(page);
  await page.getByLabel('Description').fill(`Instructions for ${input.title}`);
  await page.getByLabel('Due Date').fill('2030-08-30T12:00');
  await page.getByLabel('Maximum Score').fill(String(input.maxScore));

  const createResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && /\/courses\/[^/]+\/assignments$/.test(new URL(response.url()).pathname),
  );
  await page
    .getByRole('button', {
      name: input.publish ? 'Create & Publish' : 'Save Draft',
    })
    .click();
  const response = await createResponse;
  expect(response.status()).toBe(201);
  const assignment = (await response.json()) as AssignmentResponse;
  expect(assignment).toMatchObject({
    title: input.title,
    type: input.type,
    assignmentConfig: { version: 1, maxScore: input.maxScore },
  });
  expect(Boolean(assignment.publishedAt)).toBe(input.publish);
  await expect(page).toHaveURL(/\/teacher\/assignments$/);
  return assignment;
}

async function openStudentAssignment(page: Page, title: string): Promise<void> {
  await page.goto('/student/assignments');
  await page.getByRole('heading', { name: title }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
}

test('ASG-13 and STU-03 through STU-06 pass against the real backend', async ({ context, page, request }) => {
  test.setTimeout(120_000);
  await mkdir(evidenceDir, { recursive: true });
  const createdAssignments: AssignmentResponse[] = [];

  await context.route('https://storage.mock/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: route.request().method() === 'GET' ? 'application/pdf' : 'text/plain',
      body: route.request().method() === 'GET' ? '%PDF-1.4\n%e2e\n' : '',
    });
  });

  try {
    await loginThroughBrowser(page, teacherEmail);

    // ASG-13: invalid forms remain local, then draft and published states persist.
    await page.goto('/teacher/assignments/create');
    await page.getByRole('button', { name: /text response/i }).click();
    await page.getByRole('button', { name: 'Create & Publish' }).click();
    await expect(page.getByText('Assignment title is required.')).toBeVisible();
    await page.getByLabel('Title').fill('Invalid generic assignment');
    await page.getByRole('button', { name: 'Create & Publish' }).click();
    await expect(page.getByText('Please select a course.')).toBeVisible();
    await selectCourse(page);
    await page.getByRole('button', { name: 'Create & Publish' }).click();
    await expect(page.getByText('Due date is required before publishing.')).toBeVisible();
    await page.getByLabel('Due Date').fill('2030-08-30T12:00');
    await page.getByLabel('Maximum Score').fill('0');
    await page.getByRole('button', { name: 'Create & Publish' }).click();
    await expect(page.getByText('Maximum score must be greater than 0 and no more than 10,000.')).toBeVisible();

    const suffix = Date.now();
    const textAssignment = await createGenericAssignment(page, {
      type: 'text',
      title: `E2E Generic Text ${suffix}`,
      maxScore: 75,
      publish: false,
    });
    createdAssignments.push(textAssignment);

    const studentApiAuth = await loginThroughApi(request, studentEmail);
    const hiddenDraftResponse = await request.get(`${apiBaseURL}/courses/${textAssignment.courseId}/assignments`, {
      headers: { authorization: `Bearer ${studentApiAuth.accessToken}` },
    });
    expect(hiddenDraftResponse.ok()).toBeTruthy();
    expect(
      ((await hiddenDraftResponse.json()) as AssignmentResponse[]).some(
        (assignment) => assignment.id === textAssignment.id,
      ),
    ).toBe(false);

    await page.goto(`/teacher/assignments/${textAssignment.id}/edit`);
    const publishResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'PATCH' && response.url().endsWith(`/assignments/${textAssignment.id}`),
    );
    await page.getByRole('button', { name: 'Publish Now' }).click();
    expect((await publishResponse).ok()).toBeTruthy();
    const visibleResponse = await request.get(`${apiBaseURL}/courses/${textAssignment.courseId}/assignments`, {
      headers: { authorization: `Bearer ${studentApiAuth.accessToken}` },
    });
    expect(
      ((await visibleResponse.json()) as AssignmentResponse[]).some(
        (assignment) => assignment.id === textAssignment.id,
      ),
    ).toBe(true);

    const linkAssignment = await createGenericAssignment(page, {
      type: 'link',
      title: `E2E Generic Link ${suffix}`,
      maxScore: 40,
      publish: true,
    });
    const fileAssignment = await createGenericAssignment(page, {
      type: 'file',
      title: `E2E Generic File ${suffix}`,
      maxScore: 100,
      publish: true,
    });
    createdAssignments.push(linkAssignment, fileAssignment);
    const fileAssignmentCard = page.getByText(fileAssignment.title);
    await expect(fileAssignmentCard).toBeVisible();
    await expect(page.getByText(linkAssignment.title)).toBeVisible();
    await fileAssignmentCard.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: path.join(evidenceDir, 'ASG-13-published-generic.png'),
    });

    await logoutThroughBrowser(page);
    const studentAuth = await loginThroughBrowser(page, studentEmail);

    // STU-03: blank text is rejected and one authoritative response survives reload.
    await openStudentAssignment(page, textAssignment.title);
    await page.getByRole('button', { name: 'Submit Assignment' }).click();
    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    await expect(page.getByText('Please add your submission before sending.')).toBeVisible();
    const textContent = 'A substantive E2E text response.';
    await page.getByLabel('Your Response').fill(textContent);
    const textSubmissionResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().endsWith(`/assignments/${textAssignment.id}/submissions`),
    );
    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    const textSubmission = (await (await textSubmissionResponse).json()) as SubmissionResponse;
    expect(textSubmission.payload).toMatchObject({
      content: textContent,
      version: 1,
    });
    await page.reload();
    await expect(page.getByText(textContent)).toBeVisible();
    await expect(page.getByText(/Version 1/)).toBeVisible();
    await page.screenshot({
      path: path.join(evidenceDir, 'STU-03-text-submission.png'),
    });

    // STU-04: malformed links fail server validation; safe http links persist and render inertly.
    await openStudentAssignment(page, linkAssignment.title);
    await page.getByRole('button', { name: 'Submit Assignment' }).click();
    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    await expect(page.getByText('Please add your submission before sending.')).toBeVisible();
    await page.getByLabel('Submission Link').fill('javascript:alert(1)');
    const invalidLinkResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().endsWith(`/assignments/${linkAssignment.id}/submissions`),
    );
    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    expect((await invalidLinkResponse).status()).toBe(400);
    const validLink = 'https://example.com/e2e-work';
    await page.getByLabel('Submission Link').fill(validLink);
    const linkSubmissionResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().endsWith(`/assignments/${linkAssignment.id}/submissions`),
    );
    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    const linkSubmission = (await (await linkSubmissionResponse).json()) as SubmissionResponse;
    expect(linkSubmission.payload).toMatchObject({
      link: validLink,
      version: 1,
    });
    await page.reload();
    const renderedLink = page.getByRole('link', { name: validLink });
    await expect(renderedLink).toHaveAttribute('href', validLink);
    await expect(renderedLink).toHaveAttribute('rel', 'noopener noreferrer');
    await page.screenshot({
      path: path.join(evidenceDir, 'STU-04-link-submission.png'),
    });

    // STU-05: the real sign/complete APIs back a browser upload; canonical metadata is submitted.
    await openStudentAssignment(page, fileAssignment.title);
    await page.getByRole('button', { name: 'Submit Assignment' }).click();
    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    await expect(page.getByText('Please upload at least one file before submitting.')).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles({
      name: 'e2e-essay.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\nE2E assignment evidence\n'),
    });
    await expect(page.getByText('e2e-essay.pdf')).toBeVisible();
    const fileSubmissionResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().endsWith(`/assignments/${fileAssignment.id}/submissions`),
    );
    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    const fileSubmission = (await (await fileSubmissionResponse).json()) as SubmissionResponse;
    const canonicalFiles = fileSubmission.payload.files as Array<Record<string, unknown>>;
    expect(canonicalFiles).toHaveLength(1);
    expect(canonicalFiles[0]).toMatchObject({
      name: 'e2e-essay.pdf',
      mime: 'application/pdf',
    });
    expect(canonicalFiles[0].objectKey).toMatch(
      new RegExp(`^uploads/${studentAuth.user.id}/[0-9a-f-]+/e2e-essay\\.pdf$`),
    );
    await page.reload();
    await expect(page.getByText('e2e-essay.pdf')).toBeVisible();
    await page.screenshot({
      path: path.join(evidenceDir, 'STU-05-file-submission.png'),
    });

    // STU-06: owner and course teacher receive fresh signed locations; another student is denied.
    const fileId = String(canonicalFiles[0].id);
    await page.evaluate(() => {
      window.open = () => null;
    });
    await page.getByRole('button', { name: 'Download e2e-essay.pdf' }).click();
    await expect(page.getByRole('status')).toHaveText('Allow popups to open file downloads.');
    await page.reload();
    await expect(page.getByText('e2e-essay.pdf')).toBeVisible();

    const firstDownloadResponse = page.waitForResponse((response) =>
      response.url().endsWith(`/files/${fileId}/download`),
    );
    const firstPopup = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Download e2e-essay.pdf' }).click();
    const firstSigned = await (await firstDownloadResponse).json();
    await firstPopup;
    expect(new Date(firstSigned.expiresAt).getTime()).toBeGreaterThan(Date.now());

    const secondDownloadResponse = page.waitForResponse((response) =>
      response.url().endsWith(`/files/${fileId}/download`),
    );
    const secondPopup = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Download e2e-essay.pdf' }).click();
    const secondSigned = await (await secondDownloadResponse).json();
    await secondPopup;
    expect(new Date(secondSigned.expiresAt).getTime()).toBeGreaterThan(Date.now());

    const otherStudentAuth = await loginThroughApi(request, otherStudentEmail);
    const forbiddenDownload = await request.get(`${apiBaseURL}/files/${fileId}/download`, {
      headers: { authorization: `Bearer ${otherStudentAuth.accessToken}` },
    });
    expect(forbiddenDownload.status()).toBe(403);

    const traversalSign = await request.post(`${apiBaseURL}/files/sign`, {
      headers: { authorization: `Bearer ${studentAuth.accessToken}` },
      data: {
        fileName: '../../unsafe name.pdf',
        mime: 'application/pdf',
        size: 128,
      },
    });
    expect(traversalSign.ok()).toBeTruthy();
    const sanitizedIntent = await traversalSign.json();
    expect(sanitizedIntent.objectKey).not.toContain('..');
    expect(sanitizedIntent.objectKey).toMatch(/\/unsafe_name\.pdf$/);

    await logoutThroughBrowser(page);
    await loginThroughBrowser(page, teacherEmail);
    await page.goto(`/teacher/grade/${fileSubmission.id}`);
    await expect(page.getByText('e2e-essay.pdf')).toBeVisible();
    const teacherDownloadResponse = page.waitForResponse((response) =>
      response.url().endsWith(`/files/${fileId}/download`),
    );
    const teacherPopup = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Download e2e-essay.pdf' }).click();
    expect((await teacherDownloadResponse).status()).toBe(200);
    await teacherPopup;
    await page.screenshot({
      path: path.join(evidenceDir, 'STU-06-teacher-download.png'),
    });
  } finally {
    if (createdAssignments.length > 0) {
      // Browser logout revokes prior access tokens, so cleanup always authenticates afresh.
      const cleanupAuth = await loginThroughApi(request, teacherEmail);
      for (const assignment of createdAssignments.reverse()) {
        const cleanupResponse = await request.delete(
          `${apiBaseURL}/courses/${assignment.courseId}/assignments/${assignment.id}`,
          {
            headers: { authorization: `Bearer ${cleanupAuth.accessToken}` },
          },
        );
        expect(cleanupResponse.ok(), `Failed to clean up ${assignment.title}`).toBeTruthy();
      }
    }
  }
});

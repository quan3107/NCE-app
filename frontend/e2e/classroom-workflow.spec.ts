/**
 * Location: frontend/e2e/classroom-workflow.spec.ts
 * Purpose: Cover the full teacher-student classroom workflow in a browser.
 * Why: Protects create/publish, submit, grade, and feedback visibility as the Phase 2 exit path.
 */

import { expect, test } from '@playwright/test';
import {
  installClassroomApi,
  signInAs,
  student,
  teacher,
} from './classroom-workflow.fixture';

test('teacher publishes, student submits, teacher grades, and student sees feedback', async ({ page }) => {
  const api = await installClassroomApi(page);
  const assignmentTitle = 'E2E Writing Task';
  const feedback = 'Strong response with clear organization and precise vocabulary.';
  const dueAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16);

  await signInAs(page, teacher, api);
  await page.goto('/teacher/assignments/create');
  await page.getByText('Writing', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Create Writing Assignment' })).toBeVisible();

  await page.getByPlaceholder('e.g., IELTS Reading Practice Test 1').fill(assignmentTitle);
  await page.getByPlaceholder('Provide instructions for students...').fill('Answer both writing tasks.');
  await page.locator('input[type="datetime-local"]').fill(dueAt);
  await page
    .getByPlaceholder('The chart below shows... / You should spend about 20 minutes on this task...')
    .fill('Summarize the chart for an academic reader.');
  await page
    .getByPlaceholder('Some people believe that... Discuss both views and give your opinion...')
    .fill('Discuss whether online learning can replace classroom learning.');
  await page.getByRole('button', { name: 'Publish Assignment' }).click();

  await expect(page).toHaveURL(/\/teacher\/assignments$/);
  await expect(page.getByText(assignmentTitle)).toBeVisible();
  expect(api.assignments).toHaveLength(1);
  expect(api.assignments[0]?.publishedAt).toBeTruthy();

  await signInAs(page, student, api);
  await page.goto('/student/assignments');
  await expect(page.getByText(assignmentTitle)).toBeVisible();
  await page.getByText(assignmentTitle).click();
  await page.getByRole('button', { name: 'Submit Assignment' }).click();
  await expect(page.getByRole('heading', { name: 'IELTS Attempt' })).toBeVisible();
  await page.locator('#task1').fill('Task 1 response with a complete chart summary.');
  await page.locator('#task2').fill('Task 2 response with a balanced classroom learning argument.');
  await page.getByRole('dialog').getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByText(/Submitted on/)).toBeVisible();
  expect(api.submissions).toHaveLength(1);

  await signInAs(page, teacher, api);
  await page.goto('/teacher/submissions');
  await expect(page.getByText(assignmentTitle)).toBeVisible();
  await page.getByRole('button', { name: 'Grade' }).click();
  await expect(page.getByRole('heading', { name: 'Grade Submission' })).toBeVisible();
  await expect(page.getByText('Task 1 - Task Achievement')).toBeVisible();
  const bandInputs = page.locator('input[type="number"]');
  await expect(bandInputs).toHaveCount(8);
  for (let index = 0; index < 8; index += 1) {
    await bandInputs.nth(index).fill('7.5');
  }
  await page.getByPlaceholder('Provide detailed feedback to the student...').fill(feedback);
  await page.getByRole('button', { name: 'Post Grade' }).click();
  await expect(page).toHaveURL(/\/teacher\/submissions$/);
  expect(api.submissions[0]?.status).toBe('graded');

  await signInAs(page, student, api);
  await page.goto('/student/grades');
  await expect(page.getByText(assignmentTitle)).toBeVisible();
  await expect(page.getByText('7.5', { exact: true })).toBeVisible();
  await expect(page.getByText(feedback)).toBeVisible();
});

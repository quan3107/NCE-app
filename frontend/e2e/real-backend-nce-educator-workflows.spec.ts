/**
 * Location: e2e/real-backend-nce-educator-workflows.spec.ts
 * Purpose: Verify NCE ownership, delegation, authoring, path, and summary workflows.
 * Why: COURSE-06 and NCE-02/03/04/09 require browser evidence backed by real authorization state.
 */

import { mkdir } from "node:fs/promises";
import path from "node:path";
import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

type Auth = {
  accessToken: string;
  user: { id: string; email: string; role: "teacher" | "student" };
};
type Course = { id: string; title: string };
type PathLesson = { id: string; exercises: Array<{ id: string }> };

const apiBaseURL = (
  process.env.PLAYWRIGHT_API_BASE_URL ?? "http://127.0.0.1:4000/api/v1"
).replace(/\/$/, "");
const evidenceDir =
  process.env.PLAYWRIGHT_EVIDENCE_DIR ?? "/tmp/nce-educator-e2e-20260828";
const password = process.env.PLAYWRIGHT_TEST_PASSWORD;
if (!password) throw new Error("PLAYWRIGHT_TEST_PASSWORD is required.");

const ownerEmail =
  process.env.PLAYWRIGHT_TEACHER_EMAIL ?? "sarah.tutor@ielts.local";
const coTeacherEmail = "david.tutor@ielts.local";
const studentEmail =
  process.env.PLAYWRIGHT_STUDENT_EMAIL ?? "amelia.chan@ielts.local";
const courseTitle = "New Concept English Book 1 Foundations";

async function apiLogin(
  request: APIRequestContext,
  email: string,
): Promise<Auth> {
  const response = await request.post(`${apiBaseURL}/auth/login`, {
    data: { email, password },
  });
  expect(response.ok(), `Login failed for ${email}`).toBeTruthy();
  return response.json() as Promise<Auth>;
}

async function browserLogin(
  page: Page,
  email: string,
  landing: RegExp,
): Promise<Auth> {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url() === `${apiBaseURL}/auth/login` &&
      response.request().method() === "POST",
  );
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  const response = await responsePromise;
  expect(response.ok()).toBeTruthy();
  await expect(page).toHaveURL(landing);
  return response.json() as Promise<Auth>;
}

async function browserLogout(page: Page) {
  await page
    .locator("header button")
    .filter({ has: page.locator('[data-slot="avatar"]') })
    .click();
  await page.getByRole("menuitem", { name: "Logout" }).click();
  await expect(page).toHaveURL(/\/login$/);
}

const authorization = (auth: Auth) => ({
  authorization: `Bearer ${auth.accessToken}`,
});

test("COURSE-06 and NCE-02/03/04/09 pass against real course authority", async ({
  page,
  request,
}) => {
  test.setTimeout(180_000);
  await mkdir(evidenceDir, { recursive: true });
  const suffix = Date.now();
  const lessonTitle = `Delegated NCE lesson ${suffix}`;
  let courseId = "";

  const owner = await browserLogin(page, ownerEmail, /\/teacher\//);
  const coursesResponse = await request.get(`${apiBaseURL}/courses`, {
    headers: authorization(owner),
  });
  const courses = ((await coursesResponse.json()) as { courses: Course[] })
    .courses;
  const course = courses.find((item) => item.title === courseTitle);
  expect(
    course,
    "Documented teacher must own the seeded NCE course",
  ).toBeTruthy();
  courseId = course?.id ?? "";
  const coTeacher = await apiLogin(request, coTeacherEmail);
  const coTeacherId = coTeacher.user.id;
  const rosterResponse = await request.get(
    `${apiBaseURL}/courses/${courseId}/teachers`,
    {
      headers: authorization(owner),
    },
  );
  const roster = (
    (await rosterResponse.json()) as { teachers: Array<{ id: string }> }
  ).teachers;
  if (roster.some((teacher) => teacher.id === coTeacherId)) {
    const resetDelegation = await request.delete(
      `${apiBaseURL}/courses/${courseId}/teachers/${coTeacherId}`,
      { headers: authorization(owner) },
    );
    expect(resetDelegation.status()).toBe(204);
  }

  // COURSE-06: the owner selects a named active teacher and grants access.
  await page.goto(`/teacher/courses/${courseId}/manage`);
  await page.getByRole("tab", { name: "Settings" }).click();
  await page.getByLabel("Active teacher").click();
  await page
    .getByRole("option", { name: new RegExp(`David.*${coTeacherEmail}`) })
    .click();
  const addResponsePromise = page.waitForResponse(
    (response) =>
      response.url() === `${apiBaseURL}/courses/${courseId}/teachers` &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Add co-teacher" }).click();
  expect((await addResponsePromise).status()).toBe(201);
  await expect(page.getByText(coTeacherEmail)).toBeVisible();
  await page.screenshot({
    path: path.join(evidenceDir, "COURSE-06-owner-delegated.png"),
  });

  const peerMutation = await request.post(
    `${apiBaseURL}/courses/${courseId}/teachers`,
    {
      headers: authorization(coTeacher),
      data: { email: "nce.content@system.local" },
    },
  );
  expect(peerMutation.status()).toBe(403);

  // Seed a real learner attempt for the summary workflow.
  const addStudent = await request.post(
    `${apiBaseURL}/courses/${courseId}/students`,
    {
      headers: authorization(owner),
      data: { email: studentEmail },
    },
  );
  expect([201, 409]).toContain(addStudent.status());
  const student = await apiLogin(request, studentEmail);
  const pathResponse = await request.get(
    `${apiBaseURL}/courses/${courseId}/nce-path?pageSize=100`,
    { headers: authorization(student) },
  );
  expect(pathResponse.ok()).toBeTruthy();
  const seededPath = ((await pathResponse.json()) as { lessons: PathLesson[] })
    .lessons;
  const exerciseId = seededPath[0]?.exercises[0]?.id;
  expect(exerciseId).toBeTruthy();
  const draftAttempt = await request.post(
    `${apiBaseURL}/courses/${courseId}/nce-exercises/${exerciseId}/attempts`,
    {
      headers: authorization(student),
      data: { response: { answer: "fixture response" } },
    },
  );
  expect(draftAttempt.ok()).toBeTruthy();
  const attemptId = ((await draftAttempt.json()) as { id: string }).id;
  const submitAttempt = await request.post(
    `${apiBaseURL}/nce-attempts/${attemptId}/submit`,
    { headers: authorization(student) },
  );
  expect(submitAttempt.ok()).toBeTruthy();

  await browserLogout(page);
  await browserLogin(page, coTeacherEmail, /\/teacher\//);
  await page.goto("/teacher/nce-lessons");
  await page.getByLabel("Course").click();
  await page.getByRole("option", { name: courseTitle }).click();
  await expect(page.getByText("Excuse me!")).toBeVisible();

  // NCE-09: the delegated educator sees only safe course-scoped summaries.
  await page.getByRole("tab", { name: "Learner Activity" }).click();
  await expect(page.getByText("Amelia Chan").first()).toBeVisible();
  await expect(page.getByText(/Lesson 1:/).first()).toBeVisible();
  await page.screenshot({
    path: path.join(evidenceDir, "NCE-09-co-teacher-attempts.png"),
  });

  // NCE-02: create a course-owned draft using named book and unit controls.
  await page.getByRole("button", { name: "New Lesson" }).click();
  await page.getByLabel("Book").click();
  await page
    .getByRole("option", { name: "New Concept English Book 1" })
    .click();
  await page.getByLabel("Unit").click();
  await page.getByRole("option", { name: /Unit 1:/ }).click();
  await page
    .getByLabel("Lesson Number")
    .fill(String(100_000 + (suffix % 800_000)));
  await page.getByLabel("Title").fill(lessonTitle);
  await page
    .getByLabel("Lesson Text")
    .fill("A delegated teacher authors and verifies this lesson.");
  await page
    .getByLabel("Teacher Notes")
    .fill("Visible only to authorized educators.");
  await page.getByRole("button", { name: "Save Lesson" }).click();
  await expect(page).toHaveURL(
    new RegExp(`/teacher/nce-lessons\\?courseId=${courseId}$`),
  );
  await expect(page.getByText(lessonTitle)).toBeVisible();

  // NCE-03: incomplete content is rejected, then a complete edit can publish/unpublish.
  await page.getByRole("button", { name: "Publish" }).last().click();
  await expect(
    page.getByText(
      "Add at least one objective and one exercise before publishing",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit" }).last().click();
  await page.getByRole("button", { name: "Add Objective" }).click();
  await page
    .getByLabel("Title")
    .last()
    .fill("Use delegated ownership language");
  await page.getByRole("button", { name: "Add Exercise" }).click();
  await page.getByLabel("Objective Code").fill("objective-1");
  await page.getByLabel("Prompt").fill("Complete the ownership sentence.");
  await page
    .getByLabel("Content JSON")
    .fill('{"sentence":"This is ___ course."}');
  await page.getByLabel("Answer Key JSON").fill('{"answers":["our"]}');
  await page.getByRole("button", { name: "Save Lesson" }).click();
  await page.getByRole("button", { name: "Publish" }).last().click();
  await expect(
    page.locator('[data-slot="card"]').filter({ hasText: lessonTitle }),
  ).toContainText("published");
  await page.screenshot({
    path: path.join(evidenceDir, "NCE-02-03-authored-published.png"),
  });
  await page.getByRole("button", { name: "Unpublish" }).last().click();
  await expect(
    page.locator('[data-slot="card"]').filter({ hasText: lessonTitle }),
  ).toContainText("draft");

  // Republish for path availability, then reorder and persist a valid window.
  await page.getByRole("button", { name: "Publish" }).last().click();
  await page.getByRole("tab", { name: "Course Path" }).click();
  const ownedCard = page
    .locator('[data-slot="card"]')
    .filter({ hasText: lessonTitle });
  await ownedCard.getByLabel(`Move ${lessonTitle} up`).click();
  await ownedCard.getByLabel("Available from").fill("2026-08-29T09:00");
  await ownedCard.getByLabel("Due at").fill("2030-08-29T09:00");
  const pathSave = page.waitForResponse(
    (response) =>
      response.url() === `${apiBaseURL}/courses/${courseId}/nce-lessons` &&
      response.request().method() === "PUT",
  );
  await page.getByRole("button", { name: "Save path" }).click();
  expect((await pathSave).ok()).toBeTruthy();
  await page.screenshot({
    path: path.join(evidenceDir, "NCE-04-ordered-path.png"),
  });

  // Revocation removes every delegated NCE read immediately.
  await browserLogout(page);
  await browserLogin(page, ownerEmail, /\/teacher\//);
  await page.goto(`/teacher/courses/${courseId}/manage`);
  await page.getByRole("tab", { name: "Settings" }).click();
  const removeResponse = page.waitForResponse(
    (response) =>
      response.url() ===
        `${apiBaseURL}/courses/${courseId}/teachers/${coTeacherId}` &&
      response.request().method() === "DELETE",
  );
  await page.getByRole("button", { name: /Remove David/ }).click();
  expect((await removeResponse).status()).toBe(204);

  const revokedSummary = await request.get(
    `${apiBaseURL}/courses/${courseId}/nce-attempts`,
    { headers: authorization(coTeacher) },
  );
  const revokedDrafts = await request.get(
    `${apiBaseURL}/courses/${courseId}/nce-lessons?includeDrafts=true`,
    { headers: authorization(coTeacher) },
  );
  expect(revokedSummary.status()).toBe(403);
  expect(revokedDrafts.status()).toBe(403);
  await page.screenshot({
    path: path.join(evidenceDir, "COURSE-06-revoked.png"),
  });
});

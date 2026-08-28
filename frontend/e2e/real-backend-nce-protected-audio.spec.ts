/**
 * Location: e2e/real-backend-nce-protected-audio.spec.ts
 * Purpose: Verify seeded NCE audio playback, refresh, and authorization boundaries.
 * Why: The learner media contract must exercise real protected bytes, not only signed metadata.
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
type PathLesson = {
  id: string;
  title: string;
  exercises: Array<{ content: unknown }>;
};

const apiBaseURL = (
  process.env.PLAYWRIGHT_API_BASE_URL ?? "http://127.0.0.1:4000/api/v1"
).replace(/\/$/, "");
const apiOrigin = new URL(apiBaseURL).origin;
const evidenceDir =
  process.env.PLAYWRIGHT_EVIDENCE_DIR ?? "/tmp/nce-protected-audio-e2e-20260828";
const password = process.env.PLAYWRIGHT_TEST_PASSWORD;
if (!password) throw new Error("PLAYWRIGHT_TEST_PASSWORD is required.");

const ownerEmail =
  process.env.PLAYWRIGHT_TEACHER_EMAIL ?? "sarah.tutor@ielts.local";
const studentEmail =
  process.env.PLAYWRIGHT_STUDENT_EMAIL ?? "amelia.chan@ielts.local";
const unrelatedStudentEmail = "noah.patel@ielts.local";
const revocationStudentEmail = "diego.rojas@ielts.local";
const courseTitle = "New Concept English Book 1 Foundations";
const audioKey = "nce/book1/lesson1/dialogue.ogg";

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

async function browserLogin(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/\/student\/dashboard$/);
}

const authorization = (auth: Auth) => ({
  authorization: `Bearer ${auth.accessToken}`,
});

async function ensureEnrollment(
  request: APIRequestContext,
  courseId: string,
  owner: Auth,
  email: string,
) {
  const response = await request.post(
    `${apiBaseURL}/courses/${courseId}/students`,
    { headers: authorization(owner), data: { email } },
  );
  expect([201, 409]).toContain(response.status());
}

test("seeded NCE audio plays and remains course-scoped", async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  await mkdir(evidenceDir, { recursive: true });

  const owner = await apiLogin(request, ownerEmail);
  const coursesResponse = await request.get(`${apiBaseURL}/courses`, {
    headers: authorization(owner),
  });
  expect(coursesResponse.ok()).toBeTruthy();
  const course = (
    (await coursesResponse.json()) as { courses: Course[] }
  ).courses.find((item) => item.title === courseTitle);
  expect(course, "The documented NCE course must be seeded.").toBeTruthy();
  const courseId = course?.id ?? "";
  await ensureEnrollment(request, courseId, owner, studentEmail);

  const student = await apiLogin(request, studentEmail);
  const pathResponse = await request.get(
    `${apiBaseURL}/courses/${courseId}/nce-path?pageSize=100`,
    { headers: authorization(student) },
  );
  expect(pathResponse.ok()).toBeTruthy();
  const pathPayload = (await pathResponse.json()) as { lessons: PathLesson[] };
  const serializedPath = JSON.stringify(pathPayload);
  expect(serializedPath).not.toMatch(
    /answerKey|teacherNotes|privateTranscript|teacherTranscript/i,
  );
  const lesson = pathPayload.lessons.find((item) =>
    item.exercises.some(
      (exercise) =>
        typeof exercise.content === "object" &&
        exercise.content !== null &&
        "audioKey" in exercise.content &&
        exercise.content.audioKey === audioKey,
    ),
  );
  expect(lesson).toBeTruthy();

  await browserLogin(page, studentEmail);
  await page.getByRole("button", { name: "NCE Path" }).click();
  await page
    .getByRole("button", { name: `Open NCE path for ${courseTitle}` })
    .click();
  const firstLocationResponse = page.waitForResponse(
    (response) =>
      response.url().includes(`/courses/${courseId}/nce-assets/content?`) &&
      response.request().method() === "GET",
  );
  await page
    .getByRole("button", { name: `Open ${lesson?.title ?? ""}` })
    .click();
  expect((await firstLocationResponse).status()).toBe(200);
  const audio = page.getByLabel("Exercise audio");
  await expect(audio).toBeVisible();
  const firstSignedUrl = await audio.getAttribute("src");
  expect(firstSignedUrl).toContain(audioKey.replaceAll("/", "%2F"));

  const streamed = await page.evaluate(async (url) => {
    const response = await fetch(url);
    const bytes = new Uint8Array(await response.arrayBuffer());
    return {
      status: response.status,
      mime: response.headers.get("content-type"),
      size: bytes.length,
      header: String.fromCharCode(...bytes.slice(0, 4)),
    };
  }, firstSignedUrl ?? "");
  expect(streamed).toMatchObject({
    status: 200,
    mime: "audio/ogg",
    header: "OggS",
  });
  expect(streamed.size).toBeGreaterThan(1_000);

  const refreshedLocation = page.waitForResponse(
    (response) =>
      response.url().includes(`/courses/${courseId}/nce-assets/content?`) &&
      response.request().method() === "GET",
  );
  await page.getByRole("button", { name: "Refresh audio" }).click();
  expect((await refreshedLocation).status()).toBe(200);
  await expect
    .poll(() => audio.getAttribute("src"))
    .not.toBe(firstSignedUrl);
  await audio.evaluate(async (element) => {
    const player = element as HTMLAudioElement;
    player.load();
    await player.play();
  });
  await expect
    .poll(() =>
      audio.evaluate((element) => {
        return (element as HTMLAudioElement).currentTime;
      }),
    )
    .toBeGreaterThan(0);
  await audio.evaluate((element) => (element as HTMLAudioElement).pause());
  await page.screenshot({
    path: path.join(evidenceDir, "NCE-06-protected-audio.png"),
    fullPage: true,
  });

  const unauthenticated = await request.get(
    `${apiBaseURL}/courses/${courseId}/nce-assets/content?key=${encodeURIComponent(audioKey)}`,
  );
  expect(unauthenticated.status()).toBe(401);
  const missing = await request.get(
    `${apiBaseURL}/courses/${courseId}/nce-assets/content?key=${encodeURIComponent("nce/book1/missing.mp3")}`,
    { headers: authorization(student) },
  );
  expect(missing.status()).toBe(404);
  const teacherDenied = await request.get(
    `${apiBaseURL}/courses/${courseId}/nce-assets/content?key=${encodeURIComponent(audioKey)}`,
    { headers: authorization(owner) },
  );
  expect(teacherDenied.status()).toBe(403);
  const unrelatedStudent = await apiLogin(request, unrelatedStudentEmail);
  const unrelatedDenied = await request.get(
    `${apiBaseURL}/courses/${courseId}/nce-assets/content?key=${encodeURIComponent(audioKey)}`,
    { headers: authorization(unrelatedStudent) },
  );
  expect(unrelatedDenied.status()).toBe(403);

  const signedLocationResponse = await request.get(
    `${apiBaseURL}/courses/${courseId}/nce-assets/content?key=${encodeURIComponent(audioKey)}`,
    { headers: authorization(student) },
  );
  const signedLocation = (await signedLocationResponse.json()) as {
    url: string;
  };
  const signedUrl = new URL(signedLocation.url, apiOrigin);
  const unrelatedCourseUrl = new URL(signedUrl);
  unrelatedCourseUrl.pathname = unrelatedCourseUrl.pathname.replace(
    courseId,
    "00000000-0000-4000-8000-000000000000",
  );
  expect((await request.get(unrelatedCourseUrl.toString())).status()).toBe(401);
  signedUrl.searchParams.delete("token");
  expect((await request.get(signedUrl.toString())).status()).toBe(401);

  const revocationStudent = await apiLogin(request, revocationStudentEmail);
  await ensureEnrollment(
    request,
    courseId,
    owner,
    revocationStudentEmail,
  );
  const revocableLocationResponse = await request.get(
    `${apiBaseURL}/courses/${courseId}/nce-assets/content?key=${encodeURIComponent(audioKey)}`,
    { headers: authorization(revocationStudent) },
  );
  expect(revocableLocationResponse.ok()).toBeTruthy();
  const revocableLocation = (await revocableLocationResponse.json()) as {
    url: string;
  };
  const revoke = await request.delete(
    `${apiBaseURL}/courses/${courseId}/students/${revocationStudent.user.id}`,
    { headers: authorization(owner) },
  );
  expect(revoke.status()).toBe(204);
  expect(
    (
      await request.get(new URL(revocableLocation.url, apiOrigin).toString())
    ).status(),
  ).toBe(403);
});

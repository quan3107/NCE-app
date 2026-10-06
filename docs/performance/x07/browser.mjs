// File: docs/performance/x07/browser.mjs
// Purpose: Measure production routes and rendered interactions with Chromium/CDP.
// Why: Explicit CPU/network conditions make browser responsiveness evidence comparable.
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const repo = resolve(import.meta.dirname, "../../..");
const require = createRequire(`${repo}/frontend/package.json`);
const { chromium } = require("@playwright/test");
const dir = process.env.X07_EVIDENCE_DIR ?? "/tmp/nce-x07-performance-20260926",
  base = "http://127.0.0.1:3018";
const fixture = JSON.parse(readFileSync(`${dir}/fixture.json`));
const { password } = JSON.parse(readFileSync(`${dir}/credentials.json`));
const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true });
const onlyExtra = process.argv.includes("--extra-only");
const results = [],
  interactions = onlyExtra ? JSON.parse(readFileSync(`${dir}/browser-interactions.json`)) : [];
const profiles = [
  { name: "baseline", cpu: 1, latency: 0, down: -1, up: -1, repeats: 1 },
  { name: "mid-range-proxy", cpu: 4, latency: 150, down: 1_600_000 / 8, up: 750_000 / 8, repeats: 3 },
];
function observe() {
  window.__x07 = { lcp: [], longTasks: [], events: [], paints: [], loading: [] };
  for (const [type, key] of [
    ["largest-contentful-paint", "lcp"],
    ["longtask", "longTasks"],
    ["event", "events"],
  ]) {
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries())
          window.__x07[key].push({
            name: e.name,
            start: e.startTime,
            duration: e.duration,
            interactionId: e.interactionId ?? null,
            text: type === "largest-contentful-paint" ? e.element?.textContent?.slice(0, 100) : undefined,
          });
      }).observe({ type, buffered: true, ...(type === "event" ? { durationThreshold: 16 } : {}) });
    } catch {}
  }
  for (const type of ["click", "keydown", "input", "change"])
    document.addEventListener(
      type,
      (event) => {
        if (!event.isTrusted) return;
        const start = performance.now();
        requestAnimationFrame(() =>
          requestAnimationFrame(() =>
            window.__x07.paints.push({ type, ms: performance.now() - start, target: event.target.tagName }),
          ),
        );
      },
      true,
    );
  const mutation = new MutationObserver(() => {
    if (
      /Loading (?:teacher analytics|dashboard metrics|homepage content|assignments|analytics)/.test(
        document.body?.innerText ?? "",
      )
    )
      if (!window.__x07.loading.length) window.__x07.loading.push(performance.now());
  });
  mutation.observe(document, { subtree: true, childList: true });
}
async function ready(page, role) {
  if (role === "public") {
    await page
      .getByRole("heading", { name: "Achieve Your Target IELTS Band Score", exact: true })
      .waitFor({ timeout: 90_000 });
  } else await page.getByRole("button", { name: "Customize", exact: true }).waitFor({ timeout: 90_000 });
}
async function metrics(page) {
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  return page.evaluate(() => ({
    observer: window.__x07,
    navigation: performance
      .getEntriesByType("navigation")
      .map((e) => ({ ttfb: e.responseStart, domContentLoaded: e.domContentLoadedEventEnd, load: e.loadEventEnd })),
    domElements: document.querySelectorAll("*").length,
    jsHeapBytes: performance.memory?.usedJSHeapSize ?? null,
  }));
}
async function contextFor(role) {
  const context = await browser.newContext({
    viewport: { width: 1365, height: 900 },
    locale: "en-US",
    timezoneId: "Asia/Ho_Chi_Minh",
  });
  // Prevent a rehearsal from contacting hosted storage/AI/mail. Record any non-local assets excluded.
  const blocked = [];
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (["127.0.0.1", "localhost"].includes(url.hostname) || ["data:", "blob:"].includes(url.protocol))
      return route.continue();
    blocked.push(`${url.origin}${url.pathname}`);
    return route.abort();
  });
  await context.addInitScript(observe);
  const page = await context.newPage();
  page.setDefaultTimeout(90_000);
  if (role !== "public") {
    const email =
      role === "student"
        ? "student100@x07.example.test"
        : role === "admin"
          ? "admin@x07.example.test"
          : "teacher1@x07.example.test";
    await page.goto(`${base}/login`);
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await ready(page, role);
  }
  return { context, page, blocked };
}
async function configure(context, page, profile) {
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Network.clearBrowserCache");
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: profile.cpu });
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: profile.latency,
    downloadThroughput: profile.down,
    uploadThroughput: profile.up,
    connectionType: profile.latency ? "cellular4g" : "ethernet",
  });
  return cdp;
}
if (!process.argv.includes("--actions-only") && !onlyExtra)
  for (const profile of profiles)
    for (const role of ["public", "student", "teacher"]) {
      const { context, page, blocked } = await contextFor(role);
      await configure(context, page, profile);
      for (let i = 0; i < profile.repeats; i++) {
        const requests = [],
          errors = [];
        const pending = new Set();
        const start = performance.now();
        const requestStart = (request) => pending.add(request);
        const requestEnd = async (request) => {
          pending.delete(request);
          const response = await request.response();
          if (!response) return;
          const url = new URL(request.url());
          const timing = request.timing();
          requests.push({
            path: url.pathname,
            method: request.method(),
            status: response.status(),
            ms: timing.responseEnd,
            responseEndMs: timing.responseEnd,
            bodyBytes: (await request.sizes().catch(() => ({ responseBodySize: null }))).responseBodySize,
            cursor: url.searchParams.has("cursor"),
          });
        };
        const onError = (e) => errors.push(e.message);
        page.on("request", requestStart);
        page.on("requestfinished", requestEnd);
        page.on("pageerror", onError);
        const path = role === "public" ? "/" : `/${role}/dashboard`;
        let failure = null;
        try {
          await page.goto(base + path, { waitUntil: "domcontentloaded" });
          await ready(page, role);
        } catch (e) {
          failure = e.message;
        }
        const readyMs = performance.now() - start;
        await page.waitForLoadState("networkidle", { timeout: 90_000 });
        const settledMs = performance.now() - start;
        // Preserve a pre-interaction LCP observation; shell/loading text may be the largest element.
        await page.waitForTimeout(500);
        const measured = await metrics(page);
        const idleStart = requests.length;
        if (role === "teacher" && i === profile.repeats - 1) await page.waitForTimeout(10_000);
        if (i === profile.repeats - 1)
          await page.screenshot({ path: `${dir}/${profile.name}-${role}.png`, fullPage: true });
        const entry = {
          profile,
          role,
          repeat: i + 1,
          readyMs,
          settledMs,
          ...measured,
          requests,
          errors,
          failure,
          blocked: [...new Set(blocked)],
          pendingAtReady: pending.size,
          idleRequests: role === "teacher" && i === profile.repeats - 1 ? requests.length - idleStart : null,
          idleWindowMs: role === "teacher" && i === profile.repeats - 1 ? 10_000 : null,
        };
        results.push(entry);
        writeFileSync(`${dir}/browser-loads.json`, JSON.stringify({ browser: browser.version(), results }, null, 2));
        console.log(
          JSON.stringify({
            profile: profile.name,
            role,
            repeat: i + 1,
            readyMs,
            lcpMs: measured.observer.lcp.at(-1)?.start,
            requests: requests.length,
            failure,
          }),
        );
        page.off("request", requestStart);
        page.off("requestfinished", requestEnd);
        page.off("pageerror", onError);
      }
      await context.close();
    }
if (process.argv.includes("--loads-only")) {
  await browser.close();
  process.exit(0);
}
// Exercise the rendered routes at the slower profile after load testing has completed.
const profile = profiles[1];
async function measuredAction(page, name, operation) {
  const requests = [];
  const onRequest = async (request) => {
    const response = await request.response();
    if (response) {
      const url = new URL(request.url());
      requests.push({
        path: url.pathname,
        status: response.status(),
        method: request.method(),
        cursor: url.searchParams.has("cursor"),
        responseEndMs: request.timing().responseEnd,
      });
    }
  };
  page.on("requestfinished", onRequest);
  await page.evaluate(() => {
    window.__x07.events = [];
    window.__x07.paints = [];
    window.__x07.longTasks = [];
  });
  const start = performance.now();
  let failure = null;
  try {
    await operation();
  } catch (e) {
    failure = e.message;
  }
  const wallMs = performance.now() - start;
  await page.waitForTimeout(500);
  page.off("requestfinished", onRequest);
  interactions.push({ name, wallMs, profile, ...(await metrics(page)), requests, failure });
  writeFileSync(`${dir}/browser-interactions.json`, JSON.stringify(interactions, null, 2));
  console.log(JSON.stringify({ interaction: name, wallMs: interactions.at(-1).wallMs, failure }));
}
if (!onlyExtra) {
  const { context, page } = await contextFor("student");
  await configure(context, page, profile);
  await measuredAction(page, "student-assignment-list", async () => {
    await page
      .locator("aside")
      .getByRole("button", { name: /^Assignments/ })
      .click();
    await page.getByPlaceholder("Search assignments...").waitFor();
  });
  await measuredAction(page, "student-search-type", async () => {
    await page.getByPlaceholder("Search assignments...").pressSequentially("Course 4 Essay", { delay: 50 });
  });
  await page.screenshot({ path: `${dir}/student-filter.png`, fullPage: true });
  const file = fixture.assignments.find((a) => a.title === "File Upload 3");
  await page.goto(`${base}/student/assignments/${file.id}`);
  // The real uploader prepares a PDF-shaped buffer; only local signing is reached.
  await measuredAction(page, "upload-open", async () => {
    await page.getByRole("button", { name: /Submit Assignment/i }).click();
    await page.locator("input[type=file]").waitFor({ state: "attached" });
  });
  const pdf = Buffer.alloc(2 * 1024 * 1024, 32);
  pdf.write("%PDF-1.4\n% X07 local file\n");
  pdf.write("\n%%EOF", pdf.length - 7);
  const pdfPath = `${dir}/performance.pdf`;
  writeFileSync(pdfPath, pdf);
  await measuredAction(page, "upload-2MiB-failure", async () => {
    await page
      .locator("input[type=file]")
      .setInputFiles(pdfPath);
    await page
      .getByText("File storage is not configured. Contact the administrator.", { exact: true })
      .first()
      .waitFor();
  });
  await page.screenshot({ path: `${dir}/upload-failure.png`, fullPage: true });
  await context.close();
}
if (!onlyExtra) {
  const { context, page } = await contextFor("teacher");
  await configure(context, page, profile);
  await measuredAction(page, "teacher-analytics-route", async () => {
    await page.locator("aside").getByRole("button", { name: "Analytics", exact: true }).click();
    await page.getByText("Courses Tracked", { exact: true }).waitFor();
  });
  await measuredAction(page, "teacher-analytics-filter", async () => {
    await page.getByLabel("Course", { exact: true }).selectOption(fixture.courses[0].id);
    await page.getByText("Loading analytics...", { exact: true }).waitFor({ state: "hidden" });
    await page.getByText("Updated", { exact: false }).waitFor();
  });
  await page.screenshot({ path: `${dir}/teacher-analytics.png`, fullPage: true });
  await measuredAction(page, "teacher-submissions-queue", async () => {
    await page
      .locator("aside")
      .getByRole("button", { name: /^Submissions/ })
      .click();
    await page.waitForFunction(() => document.querySelectorAll("tbody tr").length === 50);
  });
  await page.screenshot({ path: `${dir}/teacher-queue-top.png` });
  await page.locator("tbody tr").last().scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${dir}/teacher-queue-bottom.png` });
  const firstQueue = await page.locator('tbody tr').allTextContents();
  await measuredAction(page, 'teacher-queue-next', async () => {
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByText('Page 2 · 700 total', { exact: true }).waitFor();
    await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 50);
  });
  const secondQueue = await page.locator('tbody tr').allTextContents();
  interactions.at(-1).pagination = { firstRows: firstQueue.length, secondRows: secondQueue.length, disjoint: secondQueue.every(row => !firstQueue.includes(row)) };
  await page.screenshot({ path: `${dir}/teacher-queue-page2.png`, fullPage: true });
  await measuredAction(page, 'teacher-queue-previous', async () => {
    await page.getByRole('button', { name: 'Previous', exact: true }).click();
    await page.getByText('Page 1 · 700 total', { exact: true }).waitFor();
    await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 50);
  });
  interactions.at(-1).restoredFirstPage = JSON.stringify(firstQueue) === JSON.stringify(await page.locator('tbody tr').allTextContents());
  await measuredAction(page, "teacher-assignment-list", async () => {
    await page
      .locator("aside")
      .getByRole("button", { name: /^Assignments/ })
      .click();
    await page.getByRole("button", { name: "Large Reading 1", exact: true }).waitFor();
  });
  await page.screenshot({ path: `${dir}/teacher-assignments.png`, fullPage: true });
  await measuredAction(page, "large-reading-open", async () => {
    await page.getByRole("button", { name: "Large Reading 1", exact: true }).click();
    await page.getByRole("button", { name: "Edit", exact: true }).waitFor();
  });
  await measuredAction(page, "large-reading-edit", async () => {
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page.getByLabel("Passage text", { exact: true }).waitFor();
  });
  await measuredAction(page, "large-reading-type", async () => {
    await page.getByLabel("Passage text", { exact: true }).pressSequentially(" Additional example.", { delay: 50 });
  });
  await measuredAction(page, "large-reading-expand", async () => {
    await page.getByRole("tab", { name: "Passage 3", exact: true }).click();
    await page.getByLabel("Passage text", { exact: true }).waitFor();
  });
  await page.screenshot({ path: `${dir}/large-reading-editor.png`, fullPage: true });
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await context.close();
}
if (!onlyExtra) {
  const { context, page } = await contextFor("admin");
  await configure(context, page, profile);
  await measuredAction(page, "audit-first-page", async () => {
    await page.goto(`${base}/admin/logs`);
    await page.getByText("Page 1", { exact: true }).waitFor();
    await page.locator("tbody tr").first().waitFor();
  });
  const firstRows = await page.locator("tbody tr").allTextContents();
  await measuredAction(page, "audit-next-page", async () => {
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByText("Page 2", { exact: true }).waitFor();
  });
  const secondRows = await page.locator("tbody tr").allTextContents();
  await page.screenshot({ path: `${dir}/audit-page-2.png`, fullPage: true });
  interactions.at(-1).pagination = {
    firstRows: firstRows.length,
    secondRows: secondRows.length,
    overlap: firstRows.filter((r) => secondRows.includes(r)).length,
  };
  await measuredAction(page, "audit-previous-page", async () => {
    await page.getByRole("button", { name: "Previous", exact: true }).click();
    await page.getByText("Page 1", { exact: true }).waitFor();
  });
  interactions.at(-1).restoredFirstPage =
    JSON.stringify(firstRows) === JSON.stringify(await page.locator("tbody tr").allTextContents());
  writeFileSync(`${dir}/browser-interactions.json`, JSON.stringify(interactions, null, 2));
  await context.close();
}
if (onlyExtra) {
  const { context, page } = await contextFor("student");
  await configure(context, page, profile);
  await measuredAction(page, "student-grades-route", async () => {
    await page.locator("aside").getByRole("button", { name: "Grades", exact: true }).click();
    await page.getByText("Loading grades...", { exact: true }).waitFor({ state: "hidden" });
    await page.getByRole("heading", { name: "Course 3 Essay 1", exact: true }).waitFor();
  });
  await page.screenshot({ path: `${dir}/student-grades.png` });
  const file = fixture.assignments.find((a) => a.title === "File Upload 3");
  await page.goto(`${base}/student/assignments/${file.id}`);
  await page.getByRole("button", { name: "Submit Assignment", exact: true }).click();
  await page
    .locator("input[type=file]")
    .setInputFiles({ name: "recovery.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF") });
  await page.getByText("File storage is not configured. Contact the administrator.", { exact: true }).first().waitFor();
  await measuredAction(page, "upload-failure-remove", async () => {
    await page.getByRole("button", { name: "Remove recovery.pdf", exact: true }).click();
    await page.getByRole("button", { name: "Remove recovery.pdf", exact: true }).waitFor({ state: "hidden" });
  });
  await measuredAction(page, "upload-failure-cancel", async () => {
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
  });
  await context.close();
}
await browser.close();

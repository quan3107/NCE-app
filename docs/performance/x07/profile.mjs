// File: docs/performance/x07/profile.mjs
// Purpose: Attribute upload and Reading work in the production browser.
// Why: Compare native file selection with Playwright buffer injection before changing hashing.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { strictEqual } from 'node:assert';
const repo = resolve(import.meta.dirname, '../../..');
const require = createRequire(`${repo}/frontend/package.json`);
const { chromium } = require('@playwright/test');
const input = process.env.X07_FIXTURE_DIR ?? '/tmp/nce-x07-performance-20260926';
const dir = process.env.X07_EVIDENCE_DIR ?? `${input}/profile-before`;
mkdirSync(dir, { recursive: true });
const fixture = JSON.parse(readFileSync(`${input}/fixture.json`));
const { password } = JSON.parse(readFileSync(`${input}/credentials.json`));
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true });
const results = [];
async function session(role) {
  const context = await browser.newContext({ viewport: { width: 1365, height: 900 } });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    return ['127.0.0.1', 'localhost'].includes(url.hostname) || ['data:', 'blob:'].includes(url.protocol)
      ? route.continue() : route.abort();
  });
  await context.addInitScript(() => {
    window.__profile = { stages: [], longTasks: [], fileChange: null, checksum: null };
    // The buffer-injection conversion happens before this application event boundary.
    document.addEventListener('change', event => {
      if (event.target instanceof HTMLInputElement && event.target.type === 'file') {
        window.__profile.fileChange = performance.now();
      }
    }, true);
    new PerformanceObserver(list => window.__profile.longTasks.push(...list.getEntries().map(e => ({ start: e.startTime, duration: e.duration })))).observe({ type: 'longtask', buffered: true });
    for (const [object, name, label] of [[Blob.prototype, 'arrayBuffer', 'file-read'], [SubtleCrypto.prototype, 'digest', 'sha256']]) {
      const original = object[name];
      object[name] = async function (...args) {
        const start = performance.now();
        let syncMs;
        try {
          const pending = original.apply(this, args);
          syncMs = performance.now() - start;
          const result = await pending;
          if (label === 'sha256') window.__profile.checksum = Array.from(new Uint8Array(result), byte => byte.toString(16).padStart(2, '0')).join('');
          return result;
        }
        finally { window.__profile.stages.push({ label, start, syncMs, duration: performance.now() - start }); }
      };
    }
  });
  const page = await context.newPage();
  page.setDefaultTimeout(90_000);
  await page.goto('http://127.0.0.1:3018/login');
  await page.getByLabel('Email', { exact: true }).fill(`${role === 'teacher' ? 'teacher1' : 'student100'}@x07.example.test`);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await page.getByRole('button', { name: 'Customize', exact: true }).waitFor();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 200_000, uploadThroughput: 93_750 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await cdp.send('Profiler.enable');
  return { context, page, cdp };
}
async function measure(page, cdp, name, action) {
  await page.evaluate(() => { window.__profile = { stages: [], longTasks: [], fileChange: null, checksum: null }; });
  await cdp.send('Profiler.start');
  const start = performance.now();
  await action();
  const wallMs = performance.now() - start;
  const { profile } = await cdp.send('Profiler.stop');
  writeFileSync(`${dir}/${name}.cpuprofile`, JSON.stringify(profile));
  const counts = new Map();
  for (let i = 0; i < (profile.samples ?? []).length; i++) counts.set(profile.samples[i], (counts.get(profile.samples[i]) ?? 0) + (profile.timeDeltas[i] ?? 0));
  const topFrames = profile.nodes.map(n => ({ function: n.callFrame.functionName, url: n.callFrame.url, line: n.callFrame.lineNumber + 1, selfMs: (counts.get(n.id) ?? 0) / 1000 })).sort((a,b) => b.selfMs-a.selfMs).slice(0, 20);
  results.push({ name, wallMs, ...await page.evaluate(() => window.__profile), topFrames });
  if (name.startsWith('upload-')) {
    // Real signing fails locally, but the exact selected bytes must still hash correctly.
    strictEqual(results.at(-1).checksum, createHash('sha256').update(pdf).digest('hex'));
    results.at(-1).checksumMatchesSelectedBytes = true;
  }
  writeFileSync(`${dir}/profile.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results.at(-1)));
}
const pdf = Buffer.alloc(2 * 1024 * 1024, 32);
pdf.write('%PDF-1.4\n% X07 local file\n'); pdf.write('\n%%EOF', pdf.length-7);
const path = `${dir}/performance.pdf`; writeFileSync(path, pdf);
for (const mode of ['buffer', 'path']) {
  const { context, page, cdp } = await session('student');
  const file = fixture.assignments.find(a => a.title === 'File Upload 3');
  await page.goto(`http://127.0.0.1:3018/student/assignments/${file.id}`);
  await page.getByRole('button', { name: /Submit Assignment/i }).click();
  await measure(page, cdp, `upload-${mode}`, async () => {
    await page.locator('input[type=file]').setInputFiles(mode === 'path' ? path : { name: 'performance.pdf', mimeType: 'application/pdf', buffer: pdf });
    await page.getByText('File storage is not configured. Contact the administrator.', { exact: true }).first().waitFor();
  });
  await context.close();
}
const { context, page, cdp } = await session('teacher');
const reading = fixture.assignments.find(a => a.title === 'Large Reading 1');
await page.goto(`http://127.0.0.1:3018/teacher/assignments/${reading.id}/detail`);
await page.getByRole('button', { name: 'Edit', exact: true }).click();
await page.getByLabel('Passage text', { exact: true }).waitFor();
await measure(page, cdp, 'reading-type', () => page.getByLabel('Passage text', { exact: true }).pressSequentially(' Additional example.', { delay: 50 }));
await measure(page, cdp, 'reading-switch', async () => {
  await page.getByRole('tab', { name: 'Passage 3', exact: true }).click();
  await page.getByLabel('Passage text', { exact: true }).waitFor();
});
await page.getByRole('button', { name: 'Cancel', exact: true }).click();
await context.close(); await browser.close();

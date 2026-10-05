<!--
File: docs/e2e-x07-performance-verification.md
Purpose: Record reproducible X-07 launch-scale performance measurements and acceptance limits.
Why: Real user activity, browser responsiveness, and approved SLOs require separate evidence.
-->

# X-07 launch-scale performance measurement — 2026-09-26

**Follow-up (2026-10-01):** Authorized fixes and repeated verification are recorded
in [X-07 performance fixes](e2e-x07-performance-fixes.md). This baseline remains
historical evidence; full acceptance is still blocked on approved targets and
the required device/storage evidence.

Testing was reopened for the user-confirmed **100 total students and 50 simultaneous
users**. The measurements are complete; **X-07 remains BLOCKED for full acceptance**.
No performance SLO or physical mid-range device baseline has been approved. This
report does not assign a release PASS. The teacher's complete submission download
and the public hero image produce substantial delays under the tested conditions.
No application behavior, UX/API contract, schema, or dependency was changed.

## Environment and isolation

- Checkout `c2714fe0e3b5b70fe5310aab40aef1b7f4fd4547`, including the existing local
  documentation/lockfile edits. Those edits were preserved. No worktree, subagent,
  commit, push, or hosted/shared database was used.
- Node 26.8.1, Chromium 152.0.7977.82, Intel Core Ultra 5 225H (14 logical CPUs),
  approximately 31 GiB RAM, Linux. Generator, API, browser, and database share this
  desktop; hardware/background work can affect measurements.
- Production frontend build at `http://127.0.0.1:3018`, served through Vite preview;
  compiled API with `NODE_ENV=production` at `http://127.0.0.1:4008/api/v1`.
  Both builds passed. Route lazy loading is included in the actual build.
- Disposable PostgreSQL 17 container `nce-x07-performance-20260926`, database
  `nce_x07`, port `127.0.0.1:55448`, limited to two CPUs and 2 GiB RAM. Image digest:
  `sha256:d74eeac9a635390a49bc21bd49fccd973de707e2a53a76ac49b552b8712ec46f`.
  All **86 migrations**, pg-boss installation, and reference bootstrap completed.
- API requests use the normal least-privilege `nce_runtime` login and dedicated
  job login. The API pool remains the default ten connections, with the default
  5,000 ms transaction acquisition limit. Auth limits were not increased.
- AI disabled, dummy delivery/provider settings, no stored files, and no pending
  notifications. Browser requests to non-local hosts are blocked; no blocked
  external resource occurred in the measured loads. R2 is deliberately absent.
  No hosted AI, email, or storage service was exercised or substituted.

## Dataset assumptions

These are explicit test assumptions, not additional product requirements:

| Data                   | Quantity and shape                                                                                  |
| ---------------------- | --------------------------------------------------------------------------------------------------- |
| Accounts               | 100 active students, two teachers, one admin; 103 total                                             |
| Courses/enrollment     | Four courses, 50 students/course; each student takes two courses; 200 enrollments                   |
| Assignments            | 30/course, 120 total: 112 text, four file, four Reading                                             |
| Reading                | Each official full fixture has three passages/40 questions; 24,998-byte config                      |
| Historical submissions | 24/student/course, 48/student, 4,800 total; 2,124-byte text per answer                              |
| Grades                 | 17 graded assignments/student/course; 3,400 grades, 1,400 pending historical submissions            |
| Draft writes           | 48 active learners create/update one future-assignment draft each; total becomes 4,848 submissions  |
| Activity dates         | Historical submissions September 19, grades September 20; broad teacher filters include all history |
| Upload assumptions     | 2 MiB PDF selected in the browser; 2 MiB PDF and 10 MiB WAV signing diagnostics                     |

The 48 active students belong to the first 50-student cohort, concentrating their
traffic on one teacher's two courses. Teacher 1 has 2,448 accessible submissions
after drafts; Teacher 2 has 2,400. Browser student 100 has 48 submissions and 60
accessible assignments. Synthetic answers repeat deterministic English paragraphs;
their database compressibility and warmed working set are not a diverse production
history or a disk-I/O capacity test. Rubric breakdowns and notifications are empty.

## Authenticated activity model

Fifty distinct real accounts are authenticated before timing. Each maintains its
own session and keepalive agent; source addresses `127.0.0.10`–`127.0.0.59` model
independent local clients. API traffic has no synthetic latency/CPU throttle.

- 30-second staggered ramp, then 60-second warmup with all users active; **300-second
  measured interval**. Work already started can finish after the boundary, and its
  drain tail is recorded in the JSON summary.
- **48 students and two teachers**, closed-loop activities with deterministic **3–8
  seconds of reading/thinking after each activity**. Users wait for their activity
  to finish before starting another. This is a bounded launch-load scenario, not a
  maximum-throughput saturation test or 50 simultaneous GETs.
- Student cycle: dashboard bundle; populated historical assignment detail;
  populated own submission page; one grade read; approximately 2 KiB draft save;
  assignment list. Teacher cycle: dashboard bundle; historical assignment detail;
  first 50-row submission page; analytics course/date filter; 25-row offset page;
  assignment list. Each cycle's activities are equally weighted, with pacing.
- Dashboard bundles reproduce courses, profile/enrollment/navigation data, widget
  defaults/config, notifications and role metrics alongside assignment/submission
  collections. Collections drain cursors exactly as the current frontend helper
  does. Teacher analytics is fetched with dashboard and filter activities.
- Grade 404s for ungraded work are expected responses, separately counted by
  status, rather than transport/server errors. Drafts use the real POST and are
  verified in PostgreSQL. No login, upload, AI, email, or grade-write burst is mixed
  into these steady-state totals.
- The preliminary run selected the newest future assignment for scoped reads,
  yielding empty pages. Its evidence remains under `preliminary-*` in `/tmp`; it
  is excluded from the final results. The final harness selects Essay 1 and asserts
  one student row, 50 teacher rows, and 25 rows on the teacher offset page.

The final run began with 4,848 submissions, including the 48 drafts retained from
the preliminary run. All 50 actors completed measured activities. It produced
**6,274 requests / 20.913 requests per second**, **2,701 activities / 9.003 activities
per second**, and **zero unexpected request/activity errors**. The response bodies
totaled 227,076,412 bytes; the whole-run in-flight peak was 26. The measured interval
began at `2026-09-26T10:09:33.646Z`; its final drain tail was 136 ms.

| Request group                              | Samples | p50 / p95 / p99 (ms) |
| ------------------------------------------ | ------- | -------------------- |
| All measured requests                      | 6,274   | 42.8 / 95.5 / 128.8  |
| Assignment collection                      | 899     | 34.9 / 67.7 / 104.3  |
| Submission collection pages                | 873     | 32.6 / 66.9 / 94.1   |
| Populated scoped submission pages          | 468     | 17.6 / 34.4 / 47.8   |
| Draft save                                 | 433     | 78.0 / 126.3 / 174.5 |
| Assignment detail                          | 451     | 26.3 / 48.9 / 60.8   |
| Grade detail                               | 432     | 41.2 / 72.6 / 107.7  |
| Teacher analytics, all-course and filtered | 36      | 78.5 / 149.9 / 150.8 |

Maximum request duration was 231.1 ms. Grade reads returned 336×200 and 96 expected
404s; no measured 5xx or transport failure occurred. Draft saves returned 433×201.
Student dashboard activities (432 samples) had p50/p95 of 57.1/110.3 ms; teacher
dashboard activities (18 samples) took **707.0/803.1 ms**, including their full page
drain. Teacher percentile estimates have a small sample, with nearest-rank p95
equal to the maximum. The preliminary run's single connection reset is retained
as a diagnostic and is not silently merged into or removed from final-run totals.
Full request mix, per-endpoint counts/statuses and activity distributions are in
[api-summary.json](performance/x07/api-summary.json).

## Browser method and initial loads

Browser measurements run separately, with no concurrent API load generator.
Headless installed Chromium uses a 1365×900 desktop viewport, `en-US`, and
`Asia/Ho_Chi_Minh`. Each measured navigation creates a new document with the HTTP
cache disabled. Student/teacher login is outside the timed navigation; refresh and
auth restoration during the navigation are included.

The reference is unthrottled loopback (one sample/route). The synthetic mid-range
proxy uses **4× CDP CPU slowdown, 150 ms added network latency, 1.6 Mbps download,
750 Kbps upload** (three cold samples/route). This is an explicit desktop throttle,
not calibrated physical mid-range hardware, mobile viewport, or real deployment RTT.
Production CDN, hosting, TLS, database distance, and storage are not modeled.

Observers are installed before application startup. LCP is the last observed
pre-interaction entry after network settling; content-ready is timed independently.
Public content-ready means the hero heading is visible. Dashboard-ready requires
the final Customize control, not just the shell/loading heading. Network-idle and
long-task evidence are retained. The student shell description can be its largest
element, so its LCP does not establish that dashboard data is ready.

| Route             | Reference LCP / ready (s) | Throttled LCP median [range] (s) | Throttled ready median [range] (s) |
| ----------------- | ------------------------- | -------------------------------- | ---------------------------------- |
| Public Home       | 0.556 / 0.431             | 10.212 [10.176–10.404]           | 2.424 [2.400–2.546]                |
| Student Dashboard | 0.352 / 0.496             | 2.320 [2.264–2.336]              | 3.970 [3.899–3.977]                |
| Teacher Dashboard | 1.596 / 1.998             | 37.420 [37.400–37.452]           | 37.468 [37.432–37.608]             |

Public Home transfers 1,763,802 response-body bytes, of which the hero PNG accounts
for **1,574,061 bytes** and is the final LCP element. Student Dashboard transfers
398,164 bytes/36 requests; Teacher Dashboard transfers **6,327,477 bytes/60
requests**, including **25 sequential submission pages**. Body sizes are observed
transport sizes from Playwright, not a claim about production CDN compression.
The final reference/throttled teacher sample had zero further requests in a
10-second idle window. Measured initial loads had no page errors, failed loads,
or external blocked assets. Loading feedback was visible before final data.

## Browser actions, responsiveness, and uploads

Actions use the same slower profile, following a real UI login. These are single
exploratory samples, not action p95s. Some routes retain cached data and finish
while background requests continue. Request lists are included in evidence; they
must not be interpreted as mutually isolated endpoint microbenchmarks.

| Rendered action                                                    | Time to observed completion       |
| ------------------------------------------------------------------ | --------------------------------- |
| Student assignment list                                            | 0.970 s                           |
| Student Grades, 48 grade GETs (34×200, 14 expected 404)            | 2.752 s                           |
| Assignment search, 14 characters with 50 ms intentional key pacing | 1.404 s                           |
| Teacher analytics route / course filter                            | 1.419 s / 0.418 s                 |
| Teacher submissions queue, all 700 pending rows                    | **36.285 s**                      |
| Teacher assignment list, 60 cards                                  | 0.803 s, with background fetching |
| Three-passage/40-question Reading open / enter edit                | 2.276 s / 0.858 s                 |
| Reading text, 20 characters with 50 ms intentional key pacing      | 4.039 s                           |
| Switch to Passage 3                                                | 0.576 s                           |
| Audit first page / Next / Previous                                 | 2.892 s / 0.564 s / 0.533 s       |
| 2 MiB file selection through visible local signing failure         | 1.458 s                           |
| Remove failed file / Cancel submission dialog                      | 0.187 s / 0.146 s                 |

Search's maximum captured interaction event duration was 176 ms. Reading typing
reached 224 ms; entering edit reached 232 ms; passage switching reached **400 ms**.
The queue rendered 5,748 DOM elements with a 748 ms long task. File preparation
had a **1,002 ms main-thread long task** before local signing failed. These are
Event Timing/Long Tasks observations and event-to-two-animation-frame proxies,
not field INP, a calibrated paint timestamp, or a release percentile.

The audit pages contain 50 distinct rows each with zero overlap; Previous restored
the original first-page rows. Next/Previous each made one actual audit GET. There
is no audit page drain. Collection diagnostics independently confirmed assignment
pages of 100/20 and admin submission pages of 48×100 plus 48, without duplicates.
Teacher 1's 25-page drain contained 2,448 unique rows and **6,039,593 JSON bytes**.

Both 2 MiB PDF and 10 MiB WAV signing returned the actual local **503** configuration
error. The selected PDF's error, Remove and Cancel controls were readable; recovery
actions were exercised. PostgreSQL retained zero uploaded files. **Successful
transfer, completion/download latency, simultaneous uploads, and 25 MiB limits
remain unmeasured** because the R2 adapter only accepts the hosted R2 endpoint and
this task did not authorize hosted storage load. Existing real-R2 correctness
verification is not substituted for storage performance evidence.

Supplemental valid-login burst: 50 distinct students from one loopback source IP,
50 HTTP 200 responses with unchanged auth defaults; its percentiles are retained
in the supplemental summary. This is separate from the
steady-state workload and does not cover a mass refresh burst or failed-login limits.

## Bottlenecks ranked by observed impact

1. **Teacher collection drain:** the 100-row API bound does not bound frontend
   work. `frontend/src/features/assignments/api.requests.ts:fetchCollection` drains
   every page before returning. Dashboard and queue wait roughly 37 seconds for
   ~6 MB; the queue then renders 700 rows. This is the dominant measured user cost.
   A follow-up should investigate bounded visible pages and aggregate summaries;
   it would require a separately approved UX/API design.
2. **Public hero transfer:** the 1.57 MB PNG dominates public LCP (~10.2 seconds).
   Investigate appropriate image dimensions/formats and delivery, then retest the
   actual production build and hosting configuration.
3. **Upload preparation and authoring main-thread work:** a 2 MiB file caused a
   one-second long task; Reading interactions reached 224–400 ms. Profile hashing
   and editor rerender work before selecting a fix. Storage transfer is a separate
   unresolved measurement.
4. **Remaining request amplification:** student Grades requests each submission's
   grade separately; teacher analytics reads all qualifying facts in the server.
   They are bounded by this fixture rather than a general scaling contract. The
   supplemental grade-route request count is captured in browser evidence; no
   claim is made about larger histories, more teachers, or maximum API capacity.

## Proposed targets and acceptance limits

For product approval, consider API read p95 ≤300 ms/p99 ≤1 s, draft-save p95 ≤500
ms, unexpected-error rate <0.1%; cold LCP ≤2.5 s and dashboard data-ready ≤5 s under
the named device/network profile; interaction Event Timing ≤200 ms and prompt
loading feedback once the app is running. Upload targets need agreed file sizes,
parallelism, region and storage environment. **These are proposals, not approved
SLOs, an official standards claim, or a release decision.**

This run is short, warm, synthetic, desktop-only, and performed on one shared
machine. Fifty paced authenticated actors are not fifty browsers or a constant
50-request in-flight stress test. It excludes saturation, long-soak/leaks, browser
memory pressure, simultaneous initial-login/refresh storms, large file transfers,
other networks/devices, and hosted deployment behavior. The actual browser delays
and main-thread stalls require follow-up before claiming responsive launch readiness.

## Reproduction and retained evidence

From the repository root with installed backend/frontend dependencies and local
Chromium, choose an unused test name/ports if retaining an existing rehearsal.
`setup.mjs` refuses an already-existing Docker container and creates only its own
disposable database; its owner is needed solely for setup/fixtures.

```bash
node docs/performance/x07/setup.mjs
node docs/performance/x07/load.mjs
node docs/performance/x07/supplement.mjs
node docs/performance/x07/browser.mjs
node docs/performance/x07/browser.mjs --extra-only
node docs/performance/x07/summarize.mjs
node docs/performance/x07/setup.mjs stop
```

The harnesses produce raw JSONL requests, activity durations, per-endpoint and
action summaries, browser loads/events/long tasks/request lists, fixtures,
environment/build/migration logs and screenshots under
`/tmp/nce-x07-performance-20260926`. Credentials and signing keys remain local
private files and are not included in the documentation or summary artifacts.
The prior `/tmp/nce-dg07-download-20260926` and container were preserved.

To rerun this retained fixture after cleanup, start only its container with
`sudo -n docker start nce-x07-performance-20260926`, then use
`node docs/performance/x07/setup.mjs start` before the measurement commands above.
This preserves the existing 48 drafts rather than re-inserting historical fixtures.

Screenshots inspected: public/student/teacher reference and throttled dashboards,
student search/grades, teacher analytics, queue top/bottom, Reading Passage 3,
upload failure, and audit Page 2. Visible controls, charts and form text were
readable at the measured desktop size. The long queue has no visible page controls;
the audit footer requires scrolling and remains operable. No other viewport is
claimed. Browser measurement has no intercepted/fabricated API response.

The final numeric artifacts are [API summary](performance/x07/api-summary.json),
[browser summary](performance/x07/browser-summary.json) and
[supplemental summary](performance/x07/supplement-summary.json). Both production
builds, script syntax and documentation whitespace checks passed. Broad application
test suites were not repeated for this testing/documentation-only change. Cleanup
stopped only task-owned servers/container and retained the database/evidence.

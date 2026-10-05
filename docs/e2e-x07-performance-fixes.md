<!--
File: docs/e2e-x07-performance-fixes.md
Purpose: Record authorized performance fixes and comparable local X-07 verification.
Why: Measured improvements, proven causes and release acceptance are different conclusions.
-->

# X-07 performance fixes — 2026-10-01

**Focused fixes verified; X-07 remains BLOCKED for full acceptance.** Approved
performance targets, a physical mid-range device baseline and hosted storage
transfer evidence remain outstanding. The earlier
[baseline report](e2e-x07-performance-verification.md) is retained as historical
evidence; its statement that application behavior was unchanged applies to that
September 26 measurement, not this follow-up.

## Scope and implementation

Continued in the local checkout on `perf/launch-scale-performance`, verified
before editing. Existing partial performance changes, raw evidence, DG-07
documentation and `package-lock.json` were preserved. No worktree, subagent,
commit, push, hosted load test or system permission change was used.

- Teacher dashboard uses authorized aggregate counts and three pending summaries,
  rather than draining every assignment/submission. Assignment cards and queues
  fetch/display 50 records per page, with full totals and Previous/Next controls.
  Summary responses omit essays, revision histories and assignment configs.
- Assignment detail gets one complete config and aggregate status counts; its
  submissions tab pages separately. Grading fetches one full submission and its
  assignment, preserving recording metadata and the reviewed submission version.
  Authoring prerequisites fetch courses without submission history.
- Counts and pages share active course/assignment authorization, including owner
  and active co-teacher access. Admin scope remains all active courses. Pending
  means submitted/late; assignment detail pages include every status.
- Pending cursor navigation explicitly excludes the boundary ID instead of using
  `skip: 1`. A real PostgreSQL diagnostic reproduced a skipped pending record when
  the boundary was already graded. The correction retains native timestamp/ID
  ordering, including PostgreSQL microsecond precision, and permits a graded or
  soft-deleted boundary within the same authorized assignment/course. Foreign
  cursors return 404. Counts are independent of the cursor.
- Grades lists use batches of at most 100 submission IDs; individual grading
  reads are unchanged. Official grade scope, missing-grade omission, feedback
  sanitation, current instant-visible policy gates and per-course participation
  recording are retained. No missing grade becomes a score of zero.
- Reading inline editing memoizes unchanged question controls and stable config
  options. Five questions mount per page, with continuous question numbers and
  Previous/Next question controls. New questions open their last page. Stable
  callbacks read the latest committed draft, preserving passage and answer edits.
- The original hero artwork is retained as 1672×941 and 1280×720 WebP variants,
  selected responsively and preloaded while CMS copy loads. Desktop media rules
  also apply to the preload. No new runtime dependency or regenerated artwork.
- Upload checksum/storage implementation is preserved. Profiling attributes the
  measured stall to test buffer injection, so the browser action harness now
  selects the same PDF from disk.

## Browser results

Production frontend and compiled production API use the retained disposable
PostgreSQL 17 fixture: 100 students, two teachers, one admin, four courses,
120 assignments, 4,800 historical submissions, 3,400 grades and 48 retained drafts.
The runtime role, ten-connection pool, default acquisition timeout, two-CPU/2-GiB
container limits and 86 migrations are unchanged. AI and hosted delivery/storage
remain disabled. No fabricated/intercepted API response is used.

Same installed Chromium, 1365×900 viewport, cache-disabled cold navigations,
**4× CPU slowdown, 150 ms latency, 1.6 Mbps download, 750 Kbps upload**. Browser
measurements are separate from the API load generator. Three cold samples per
route; actions are exploratory single samples, not p95s or field INP. Both runs
share the same machine, but CPU frequency/background work is not controlled.

| Measurement | September 26 baseline | October 1 follow-up |
| --- | ---: | ---: |
| Public LCP median | 10.212 s | 2.308 s [2.244–2.380] |
| Public response-body transfer | 1,763,802 B | 249,074 B |
| Hero transfer at measured viewport | 1,574,061 B PNG | 58,962 B WebP |
| Teacher dashboard ready median | 37.468 s | 2.669 s [2.660–2.672] |
| Teacher dashboard LCP median | 37.420 s | 2.200 s [2.192–2.216] |
| Teacher dashboard body transfer/requests | 6,327,477 B / 60 | 212,020 B / 34 |
| Teacher dashboard sequential submission pages | 25 | 0 |
| Student dashboard ready median | 3.970 s | 3.736 s |
| Queue ready / rendered rows | 36.285 s / 700 | 0.531 s / 50 |
| Queue DOM elements / max long task | 5,748 / 748 ms | 561 / none observed |
| Queue Next / Previous | unavailable | 0.366 s / 0.343 s |
| Student Grades ready / grade requests | 2.752 s / 48 GETs | 0.887 s / one batch POST |
| Reading enter edit / maximum interaction event | 0.858 s / 232 ms | 0.379 s / 88 ms |
| Reading type 20 characters, 50 ms/key / max event | 4.039 s / 224 ms | 1.487 s / 40 ms |
| Switch to Passage 3 / maximum interaction event | 0.576 s / 400 ms | 0.134 s / 88 ms |

Teacher dashboard transfer fell 96.6%; full-size hero transfer fell 96.3%. The
1280-pixel asset is 41,780 B. ImageMagick inspection confirmed dimensions and
42.96 dB PSNR against the original full-size PNG. Rendered screenshots confirm
the same artwork/crop and readable hero copy; PSNR alone is not a visual review.

Queue pages each contain 50 distinct rows; Next has no overlap and Previous
restores the first page. Next/Previous each make one summary request. Complete
teacher queues still contain 700 pending records each; the admin queue contains
1,400. Pagination limits visible work without truncating history. Totals are live
reads, not an atomic snapshot across requests: newly submitted work ahead of a
cursor appears after refreshing the first page, and grading changes the totals.

## Upload and Reading attribution

Retained pre-fix CPU profiles compare identical 2 MiB PDFs selected as a Playwright
buffer and as a native file path under the same browser throttles. The buffer
profile has a **1,039 ms task**, 625 ms sampled self time in injected conversion,
`atob` and allocation/GC frames. Its file read starts about 1,015 ms after that
task starts; asynchronous Web Crypto takes 13.5 ms. The path selection takes
474 ms through the actual local signing error, with **no long task**, a 43.2 ms
async file read and 13.3 ms digest. Application React frames are small compared
with the injected conversion.

The repeated instrumented follow-up records the file `change` event boundary,
async read/digest latency and synchronous invocation cost. Buffer injection still
produces a 548 ms task starting about 535 ms before the application event; its
dominant sampled anonymous frame maps to Playwright's injected
`Uint8Array.from(atob(file.buffer), ...)`. The extracted installed harness source
is retained alongside the profile. Native path selection takes 302 ms with no
long task. Both browser digests match Node SHA-256 of the exact selected bytes.
Native file read/digest work and React rendering do not reproduce the one-second
application stall for this fixture. **This is a harness correction and attribution,
not a claimed upload application speedup.** Larger/native/concurrent file behavior
and storage transfer are not established by this result.

Reading pre-fix profiles show repeated React/Radix control frames for every key
and expensive DOM value/attribute setting on passage switch. Retained pre-fix
typing takes 4.664 s with 21 long tasks (maximum 233 ms); switch takes 533 ms with
a 374 ms task. The follow-up profile takes 1.617 s with no typing long task;
switch takes 142 ms with a 91 ms task. Reduced mounts and unchanged question
subtree rendering explain the correction; the single samples do not establish an
interaction percentile. Component regressions preserve passage/first/last question
edits across both question and passage pages, answer keys and all questions.

## API workload and correctness

The final workload preserves 48 paced student sessions and two paced teacher
sessions, 30-second ramp, 60-second warmup and five-minute measured interval,
3–8 seconds thinking after each activity. Teacher dashboard/detail/list activities
use the new aggregate/summary endpoints; the populated submission scenarios use
the new filtered cursor pages with the same 50/25-row bounds. Student activity
mix and single-grade activity remain unchanged. `--legacy` retains the baseline
collection/offset request model for comparison. This is 50 active accounts, not
50 browser processes or a constant 50 requests in flight.

Final numeric results are retained in
[API summary](performance/x07/fixes-20261001/api-summary.json).

| API measurement | Baseline | Follow-up |
| --- | ---: | ---: |
| Requests / activities in 300 seconds | 6,274 / 2,701 | 5,874 / 2,722 |
| Requests / activities per second | 20.913 / 9.003 | 19.580 / 9.073 |
| Unexpected request / activity errors | 0 / 0 | 0 / 0 |
| Request p50 / p95 / p99 | 42.8 / 95.5 / 128.8 ms | 12.9 / 34.9 / 51.9 ms |
| Teacher dashboard activity p50 / p95 | 707.0 / 803.1 ms | 35.3 / 68.9 ms |
| Draft-save p95 | 126.3 ms | 40.3 ms |
| Response-body bytes | 227,076,412 | 114,843,554 |

The request count falls despite slightly more completed activities, because the
teacher no longer downloads the entire history. Total transfer falls 49.4%.
All 50 actors completed measured activities; teacher dashboard has only 19 samples,
so its nearest-rank p95 is the maximum. The in-flight peak is 16 and final drain
tail is 50 ms. There are 434 successful draft saves; PostgreSQL confirms all 48
workload drafts, 3,400 unchanged grades, four unchanged Reading configs, 86
migrations and zero files. The isolated shared-IP valid-login diagnostic returned
50 HTTP 200s. This short, warmed, shared-machine run establishes neither saturation
capacity nor a causal attribution for every latency difference.

The real API contract harness exhaustively compares authorized IDs/counts with
the old collections for both teachers and admin: assignment pages 50/10 for each
teacher, admin 50/50/20; pending pages 14×50 for each teacher and 28×50 for admin.
It verifies no duplicates or omissions, scoped all-status pages, full payload
detail parity, graded boundary continuity, matching dashboard/detail counts,
and 34 official grades per sampled student with batch/individual response parity.
Anonymous/student staff access, foreign teacher detail, foreign learner grades
and oversized requests are denied/omitted as appropriate. Unit regressions also
cover active co-teacher scopes and provisional draft sanitation/policy gates.

## Verification and limits

Frontend lint, TypeScript, production build, 271 unit tests and 273 component
tests pass. Component tests use `NODE_OPTIONS=--no-experimental-webstorage` to
avoid the Node 26 experimental native-storage/jsdom conflict. Backend lint and
production build pass; the final full suite passed 1,120 tests with 86
environment-gated skips. OpenAPI validation and mounted-route parity pass. Focused formatting is
checked; the existing generated/build-wide formatting issue is not expanded into
unrelated fixes.

Inspected screenshots include public and teacher cold loads, queue footer/page 2,
Reading Passage 3 question controls, student Grades and upload failure/recovery.
Text, totals, artwork and controls are readable at the tested desktop viewport.
No physical device or other viewport performance is claimed. Analytics still
processes qualifying facts server-side; student collections still drain the
learner's own history. These are residual scaling limits beyond the fixed staff
paths. Hosted R2 is absent, so actual signing returns 503 and zero files persist;
successful upload/download latency and concurrent transfers remain unmeasured.
The October browser loads block a Google Fonts stylesheet under the local-only
rule (recorded in `blocked`); baseline recorded no blocked external asset. The
fallback-rendered text is readable in inspected screenshots, but hosted font
delivery and exact cross-run typography are not part of the comparison. No local
load/page errors or action failures were observed.

## Reproduction and retained evidence

Raw October 1 evidence: `/tmp/nce-x07-performance-fixes-20261001`; baseline:
`/tmp/nce-x07-performance-20260926`. Both are retained. Local keys/passwords are
private files, excluded from repository summaries. Production build logs, profiles,
stage timing, screenshots, raw HTTP/activity rows, contracts and environment
metadata are retained. Aborted setup/warmup attempts are not final measurements.
Cleanup stopped only the X-07 API/preview and its disposable container, preserving
the database, all evidence and the separate DG-07 rehearsal. Initial lockfile
and DG-07 document diffs were compared with the captured starting diff and remain
unchanged. Prior ignore-file edits were retained, with one additional exception
for this report.

Repository evidence: [browser load summary](performance/x07/fixes-20261001/browser-load-summary.json),
[browser action summary](performance/x07/fixes-20261001/browser-action-summary.json),
[contract verification](performance/x07/fixes-20261001/fix-contracts.json),
[before profiles](performance/x07/fixes-20261001/profile-before-summary.json),
[after profiles](performance/x07/fixes-20261001/profile-after-summary.json) and
[database/supplement summary](performance/x07/fixes-20261001/supplement-summary.json).

```bash
sudo -n docker start nce-x07-performance-20260926
VITE_API_BASE_URL=http://127.0.0.1:4008/api/v1 npm --prefix frontend run build
npm --prefix backend run build
node docs/performance/x07/setup.mjs start
export X07_EVIDENCE_DIR=/tmp/nce-x07-performance-fixes-20261001
node docs/performance/x07/verify-fixes.mjs
node docs/performance/x07/browser.mjs
node docs/performance/x07/browser.mjs --extra-only
X07_EVIDENCE_DIR=$X07_EVIDENCE_DIR/profile-final node docs/performance/x07/profile.mjs
node docs/performance/x07/load.mjs
node docs/performance/x07/supplement.mjs
X07_SUMMARY_DIR=docs/performance/x07/fixes-20261001 node docs/performance/x07/summarize.mjs
node docs/performance/x07/setup.mjs stop
```

Start only after task-owned API/preview processes have stopped. `setup start`
waits for local readiness. Use a fresh evidence directory with copies of the
retained fixture/credentials to keep prior measurements intact. Full release PASS
requires approved targets and outstanding device/storage evidence.

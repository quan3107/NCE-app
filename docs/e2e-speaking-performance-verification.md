<!--
Location: docs/e2e-speaking-performance-verification.md
Purpose: Record real-app acceptance evidence for STU-10 and X-07.
Why: Separate verified defect fixes from unsupported storage and performance claims.
-->

# Speaking and rendering verification — 2026-09-20

The initial pre-R2 run below left STU-10 and X-07 **BLOCKED for full acceptance**.
The later [real R2 rerun](r2-storage-verification.md) supersedes the storage blocker:
STU-10 now passes after the concurrent upload and metadata fixes; X-07 remains
BLOCKED with performance acceptance deferred by the user. Their recorded rendering
and audit pagination defects are fixed, but successful speaking media persistence
cannot be verified against the application's placeholder storage implementation.
No production performance SLO or mid-range device baseline is defined in the
repository. These results do not claim production-scale performance acceptance.

## Environment

- Actual frontend at `http://127.0.0.1:3011`, actual API at port 4001.
- Disposable PostgreSQL 17 container `nce-speaking-performance-20260920`, bound
  only to `127.0.0.1:55437`, database `nce_speaking_performance`.
- All 77 migrations applied; documented prerequisite roles and pg-boss were
  installed after initial prerequisite failures. Demo, reference, IELTS assignment,
  and IELTS sandbox seeds ran only against this explicitly confirmed database.
- Ten users, six courses, eighteen assignments; 121 additional audit fixtures
  produced 138 visible audit events at pagination verification time.
- Acceptance used the Codex in-app browser. No API responses were fabricated or
  intercepted, and no replacement storage was supplied.
- A local forwarding proxy on port 4002 added 250 ms before forwarding each real
  response, including preflights. It logged paths/status/timing, not credentials or
  bodies. An external Vite test config added only an LCP console observer.
- Evidence: `/tmp/nce-speaking-performance-20260920`. Test setup and measurement
  helpers live in `/tmp/nce-speaking-*`; none change application storage behavior.

## Results

1. **Speaking render fix verified.** Diego's Part 3 speaking assignment and
   Amelia's exact `Speaking S2: Fluency and Coherence Drill` opened the three-part
   attempt dialog without `Maximum update depth exceeded`. Duration inputs and
   scrolling remained usable. The cue card and all three question groups rendered.
2. **Real upload failure and recovery verified.** A valid 1-second PCM WAV selected
   through the native browser file chooser reached the real signing API (200).
   Upload failed because the returned destination is `https://storage.mock/...`.
   The UI displayed failure, allowed removal, and remained interactive. Missing
   recordings blocked Submit. Diego saved an empty-media draft; reload and a SQL
   query confirmed status `draft`, attempt 1, payload version 1. No completed
   recording, replacement of completed media, authorized playback, final speaking
   submission, or manual-grading persistence is claimed. The UI provides file
   selection, not a microphone recorder. Busy transitions on completion/failure
   are covered by the component regression, not claimed as successful real upload.
3. **Shared auth render fix verified.** Teacher dashboard login, reload, Courses
   navigation, and return to Dashboard rendered normally. A related warning was
   reproduced on Home during public sign-out before the final fix. Filtering the
   profile subscription and deferring its notifications removed that warning in
   the repeat student/public sign-out/teacher navigation sequence. The final
   console window contains no errors or original render warnings.
4. **Audit pagination verified.** Pages contained 50, 50, and 38 rows, all 138
   distinct. Requests used `limit=50` and offsets 0, 50, 100. Previous restored the
   exact second-page rows; Refresh stayed on page 2; Next was disabled at the end.
   Five user actions caused five audit GETs, with no automatic page draining.
   Loading feedback appeared and navigation disabled while fetching. Screenshot
   inspection confirmed the footer and the table's horizontal overflow control.
5. **Representative performance scenarios exercised.** With added API latency,
   public/dashboard loading feedback, two-course analytics and filtering, and a
   three-passage/40-question reading editor remained usable. Instructions could
   be edited and Passage 3 selected; Cancel discarded the temporary edit. Teacher
   requests settle after route loading, although existing per-assignment request
   fan-out remains a scaling limitation outside these representative fixtures.
6. **Measurements, not SLO claims.** Development teacher reload LCP observations
   were 1.912–3.460 seconds; recovered public homepage LCP was 1.492 seconds.
   Audit API response-header latency was 25.4–61.0 ms, or 276.7–311.6 ms through
   the proxy (excluding the separate delayed preflight). One captured sample of
   312 non-OPTIONS requests had median 39.6 ms, p95 81.8 ms, max 258.6 ms before
   added latency. This is not browser end-to-end latency, a bandwidth/CPU-throttled
   benchmark, or a production-sized dataset. The proxy exited during a public
   check; the unavailable UI appeared and reload recovered after restart. Those
   error-page LCP observations are excluded from successful-page measurements.

## Checks and evidence

- Frontend TypeScript and ESLint; unit and rendered component suites; production build.
- Backend audit-log route/controller/service/event regressions: 19 tests passed.
- New regressions cover inline busy callbacks, upload completion/failure,
  forward/back/last-page controls, deferred profile notifications, unrelated query
  suppression, and cancelling queued callbacks after unsubscribe.
- Screenshots inspected: `speaking-stable.png`, `speaking-s2-stable.png`,
  `speaking-upload-failure.png`, `teacher-final.png`, `teacher-analytics.png`,
  `reading-authoring.png`, and `audit-pagination-controls.png`.
- Authoritative evidence: `speaking-persistence.txt`, `audit-pages.json`,
  `network.jsonl`, `network-summary.json`, `console-post-fix.json`.
- Cleanup is limited to stopping this task's servers and disposable container;
  the database remains available for reproduction. No shared or production data
  was modified. Pre-existing documentation and root lockfile edits are excluded
  from the task commits.

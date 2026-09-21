<!--
File: docs/e2e-operations-verification.md
Purpose: Record complete OPS recovery acceptance and real-service evidence.
Why: PASS decisions must be traceable to observed UI and authoritative state.
-->

# Operations acceptance — 2026-09-21

OPS-05, OPS-07, OPS-08, OPS-10, OPS-15, and OPS-16 pass the criteria below.
X-03 remains FAIL: fixing settings conflicts does not establish the full
registration/contact/upload/assignment/submission/grade/preferences/CMS/session
race matrix.

## Environment and method

- Saved local repository, branch `fix/operations-recovery-and-admin-controls`.
- Actual Vite UI `http://127.0.0.1:3012`; actual API `http://127.0.0.1:4007/api/v1`.
- Disposable PostgreSQL 17 container `nce-ops-verification-20260921`, database
  `nce_ops`, port 55438. All 77 migrations, pg-boss installation, demo and reference
  seeds applied. Runtime API used the least-privilege `nce_runtime` login.
- Browser plugin operated the in-app Browser and Chrome. No HTTP interception,
  fake responses, acceptance mocks, or alternate application implementations.
- Real failures used a 20-second exclusive lock on the disposable `grades` table;
  application transactions failed after their timeout. The locks rolled back.
- Notification fixtures used in-app delivery only. The actual delivery worker ran
  twice. External queued seed channels were suppressed before running it; no real
  external recipient was contacted. No object-storage operation is required by
  these six stories.
- Raw local evidence: `/tmp/nce-ops-verification` (API assertion scripts, JSON
  results, original/failure/success homepage responses, server/check logs).
  Browser screenshots in this task were visually inspected for validation,
  settings conflicts, notification recovery, CMS failure, audit filters, and CSV
  success/failure. Chrome saved the actual CSV in the host Downloads directory.

## Criterion evidence

| Story | Complete acceptance evidence |
| --- | --- |
| OPS-05 | Admin Dashboard lists bounded delivery metadata without payloads/provider errors. Browser inspected dead-letter fixture `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1` at attempt 3 and resent it: same ID became queued, attempt count 0, retry/failure/dead-letter timestamps cleared, and button disabled. Real API confirmed all resets and rejected queued/delivered resend with 409. A stale failed row changed to sent before its Browser click produced visible conflict guidance; refresh disabled its resend. Actual worker execution twice left one sent row. Teacher/student inspection and resend returned 403. Recipient list omitted attempt count, max attempts, failure reason, and retry/dead-letter timestamps. |
| OPS-07 | Teacher selected IELTS Academic Writing Bootcamp: visible scope showed 1 course, 50% on-time, average 7.0. Chrome Export CSV produced one `teacher-analytics.csv`, 13 headers and 6 data rows (overall, course, four rubric aggregates), valid UTF-8 and CRLF. Downloaded values, course IDs, counts, scores and rubric samples matched actual filtered JSON. API export set CSV content type and filename. A real database lock exposed disabled Exporting controls, then a visible error; retry prepared the CSV. The in-app Browser did not emit a download event, so the UI now explicitly reports CSV preparation and retains a native download link; changing course removes the stale link. Scope is authorized server-side. |
| OPS-08 | Browser rejected one-character name and malformed email with visible field feedback; email has `aria-invalid` and `aria-describedby=admin-email-error`. Created and searched four disposable rows: active student, pending teacher, suspended admin, invited student. Rows rendered correct role/status and persisted in the real users response. Browser discovered duplicate creation returned 500; fixed database uniqueness mapping, reran and observed 409 plus associated duplicate-email feedback. Invalid API input returned 400. User responses contained no password/hash. Teacher/student list/create returned 403. |
| OPS-10 | Two Browser tabs opened student limit 25. A saved 26; stale B tried 27 and showed an explicit conflict alert while preserving 27 and disabling Save. Reload latest settings adopted 26; B retried 27 and reload confirmed persistence. Real API equal-value CAS with stale expectation 99 returned 409; current equal-value CAS returned 200 without an audit row. Only committed 25→26→27→25 changes produced settings audit events. Policy restored to 25. |
| OPS-15 | Browser displayed Refresh Stats only for homepage and disabled it for unsaved local edits. Actual grades-table lock exposed disabled Refreshing statistics, then an actionable error. Public JSON before/after failure was byte-identical. Retry succeeded; admin reload and public homepage showed authoritative values. Found and removed synthetic 7.5 for empty band data: empty data now yields 0; one persisted 6.5 band yields 6.5. Final stats were 6 active students, 6.5 mean band, 2/9 success ratio (22% display). Draft/public statistics matched; hero and how-it-works content remained byte-equivalent as parsed objects. Deleted rows are excluded. Teacher/student refresh calls returned 403. |
| OPS-16 | Browser applied actor/action/entity/entity-ID filters, refreshed, paginated 105 matching persisted events into 50/50/5 rows, then used a nonmatch and clear to verify empty/recovery and page reset. Actual API verified all six filters, including lower/upper date bounds, and 105 unique IDs across pages. Fixtures passed the application's typed audit writer and covered auth, users, profiles, courses, enrollments, assignments, submissions, grades, AI, CMS, settings and NCE. Version 1 and actor/action/entity/time metadata persisted. Event data contained only allowed IDs/markers, no raw token/password/request body/answer/score/feedback/provider body/private content. Teacher/student audit access returned 403. Removed the inert Export control. |

## Regression checks

Focused automated regressions cover admin delivery authorization and metadata
selection, duplicate user conflicts without success audits, associated email
errors, settings reload/retry baselines, attached CSV links and deferred cleanup,
stale export link removal, CMS refresh pending/failure/edit protection, empty
aggregate truthfulness, and audit filter pagination reset.

Backend/frontend lint, TypeScript/build, OpenAPI validation, unit and rendered
component suites were run. Final counts and cleanup are recorded in PROGRESS.md.
The npm entrypoint suite required supplying the official npm runtime's
`npm_execpath`; its initial missing-runtime failure was resolved and rerun.

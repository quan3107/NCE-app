<!-- Scope: DG-06 acceptance evidence. Purpose: Record real deadline, replacement, and reminder behavior. -->
# Assignment deadlines and course reminders verification

Verified on 2026-09-22 using the real local API on port 4012, frontend on port 3017, in-app Browser, and disposable PostgreSQL 17 database `nce_deadlines` on port 55443. All 81 migrations and reference seeds were replayed. Acceptance requests were not mocked. The controlled recipient confirmed receipt of the real reminder email.

## Confirmed contract

- Text, link, file, IELTS Reading, Listening, Writing, and Speaking use the same server-enforced deadline policy. General quizzes remain outside this change.
- Exactly at the deadline is on time. Later submissions are late without automatic score deductions. At or after `dueAt + 24 elapsed hours`, all submission writes, including drafts and replacements, return 409. No deadline means no cutoff. Elapsed hours do not depend on daylight-saving changes.
- Before cutoff, students may replace submitted or graded work without a legacy attempt limit. Previous content and the full official grade are preserved in private revision history. The current grade and derived AI feedback are invalidated; objective IELTS work is scored again. Identical retries preserve the version and side effects.
- Each deadline occurrence queues one in-app reminder and one email per active student. Minute polling targets T-24h and catches up within the remaining pre-deadline window after downtime. It does not promise delivery at an exact second.
- A student's course mute persists across reloads and affects deadline reminders only. Queued reminders recheck enrollment, mute, assignment/course availability, deadline identity, and delivery window. Weekly digests are disabled.

## Real acceptance results

- Browser created an on-time text submission, replaced it during the late window, and retained the new version after reload. PostgreSQL confirmed server timestamps, late status, and revision history.
- With a submission dialog already open, moving the deadline beyond the cutoff caused a real 409. The typed work stayed in the dialog; the stored version/history remained unchanged. Restoring the open window allowed retry of the retained work. Reloading a closed assignment displayed a disabled **Submissions closed** control and **Late — no score penalty** beside the saved work.
- API/PostgreSQL tests verified cutoff rejection for all seven supported assignment types, duplicate concurrent creation, archived grade preservation, regrading without a late deduction, objective replacement beyond a legacy attempt cap, denied outsider access, and no partial mutation after rejection.
- Holding an assignment row lock while changing its deadline verified that a waiting submission rechecks the committed deadline before persistence. Boundary tests cover exact due time, one millisecond later, exact cutoff, drafts, and a daylight-saving transition.
- Browser mute/unmute persisted after reload. A temporary database rejection produced a visible save error and successful retry. A row lock kept **Saving reminders…** disabled; navigation to Dashboard completed before the save, and the late successful result did not navigate away or modify that screen. A timed-out save likewise left the destination intact. Temporary failure triggers were removed.
- API tests verified self-only preference access, denied teacher/outsider/other-course writes, rejected forged user fields, and continued announcement fan-out to a muted student.
- Concurrent and repeated worker runs produced one reminder per channel. Actual in-app delivery displayed the assignment title, course, local deadline, and a working **View assignment** link. Database tests verified queued mute, enrollment removal, changed-deadline suppression, a new deadline occurrence, and no weekly digest output. Browser screenshots of the sidebar, cutoff/error states, and notification list were inspected for readability and layout.

## Email delivery

The real Brevo adapter first received a deliberate invalid-key response (401), exercising the existing retry state. The same notification was retried with the configured key and accepted at **2026-09-22 03:03:01 UTC / 10:03:01 Vietnam time**. The approved recipient explicitly replied **“Received.”** A subsequent worker replay left exactly one email and one in-app notification for that occurrence and did not send again. Automated fixtures used invalid-domain recipients and deferred their email delivery; only the separately approved recipient received the controlled email.

Provider acceptance and inbox confirmation are separate evidence. A send already in flight cannot be recalled by a later mute, removal, or deadline edit. Ambiguous provider outcomes are quarantined as `delivery_unknown`; blind automatic or manual replay is blocked pending provider reconciliation.

## Regression checks

- Backend: 1,086 standard tests passed (62 environment-gated tests skipped); the six real API/PostgreSQL acceptance tests were enabled and passed separately. The suite includes a stale-grade concurrency regression. Lint and TypeScript build passed.
- Frontend: 270 unit tests and 259 rendered component tests passed; lint, typecheck, and production build passed.
- All 81 migration history/replay checks, bidirectional schema diff, database governance checks, and OpenAPI validation passed.
- Local evidence logs are under `/tmp/nce-deadlines`; credentials and personal recipient data are excluded from this document and the patch.

Existing historical grades are not rewritten. Revision history remains private; this change does not add a history-browsing UI. The migration preserves legacy reminder occurrence keys and suppresses duplicate unsent legacy reminders and pending weekly digests.

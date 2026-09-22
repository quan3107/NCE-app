<!--
File: docs/e2e-announcements-verification.md
Purpose: Record the real course-announcement acceptance and delivery evidence.
Why: Browser, PostgreSQL, and delivered email establish behavior beyond isolated mocks.
-->

# Course announcement verification — 2026-09-22

DG-05 **PASSES**. Teachers can draft, publish, read, edit, and delete announcements
for owned or actively co-taught courses. Admins have read/delete moderation;
students can read published announcements only while enrolled. Publication sends
both in-app and email notifications. The controlled recipient confirmed receipt
and supplied an inbox screenshot of the actual announcement email.

## Environment and boundaries

- Saved local repository, branch `course-announcement-delivery`; no worktree.
- In-app Browser against frontend `http://127.0.0.1:3016` and real API
  `http://127.0.0.1:4011/api/v1`.
- Disposable PostgreSQL 17 container `nce-announcements-20260922`, loopback
  port 55442. Browser database `nce_announcements`; independent clean migration
  replay and permanent API/database tests used `nce_announcements_replay`.
- Runtime connections use `nce_runtime` and the existing request/service roles.
  Owner access is confined to migrations and explicit disposable fixtures.
- Required reference data was seeded; six disposable Browser accounts and two
  courses were created. Only the user-designated controlled email recipient was
  eligible for a real send. Automated database fixtures use reserved domains and
  never run email delivery.
- No API response, authentication session, database acceptance flow, or provider
  response was mocked. Isolated component/worker tests supplement these checks.
- Local raw logs and fixtures: `/tmp/nce-announcements`. Credentials, tokens,
  recipient address, and the private inbox screenshot are not committed.

## Publication and recovery contract

- Owners and active co-teachers reuse the existing course assignment access rules.
  Students, unrelated teachers, and admins cannot create/edit/publish.
- Drafts are private to course teachers and admins. First publication atomically
  snapshots all current, non-deleted student enrollments belonging to non-deleted
  student accounts. There is no invitation/status/preference exclusion from that
  confirmed audience. Later enrollment does not backfill a historical notification.
- A unique creator/request ID plus content hash makes create retries idempotent;
  reusing a key with changed input or after deletion returns 409. Serializable
  transactions and a unique announcement/student/channel constraint prevent
  duplicate publication and fan-out. Revision checks reject conflicting edits;
  identical update retries are no-ops.
- Edits update the course reader silently. Notification payloads and email retain
  their original publication snapshot. Published announcements cannot become drafts.
- Deletion is soft and idempotent. Associated notifications disappear from the UI
  and queue. No deletion notification is sent. Email already sent or in flight
  cannot be recalled. Tombstones preserve request deduplication.
- Notification reads and delivery recheck current course/enrollment access.
  Revoked recipients cannot fetch notification content, and pending deliveries
  become suppressed. Normal confirmed provider rejections use existing backoff,
  dead-letter, and admin recovery. A lost response or server-side provider error
  becomes `delivery_unknown`; automatic and manual blind resend are blocked for
  announcements to avoid duplicate mail. Such outcomes need provider reconciliation.
- Email links use the first configured CORS origin, matching the existing app
  origin convention; configure the deployed frontend origin before sending mail.

## Real acceptance results

| Check | Observed result |
| --- | --- |
| Teacher create/draft | Browser saved a real draft; HTTP and PostgreSQL confirmed one row and zero student-visible drafts. Browser reload preserved it. |
| Publish | Browser published the stored draft; PostgreSQL contained exactly one in-app and one email notification for the controlled enrolled student. |
| All enrolled recipients | Permanent real PostgreSQL/API tests publish to two enrolled students and verify exactly one row per student/channel; outsider and teacher recipients are excluded. |
| Authorization | Real bearer-authenticated API tests deny anonymous reads, student/admin authoring, unrelated teacher reads/mutations, and cross-course deletes. Active co-teacher authoring succeeds; revoking that enrollment denies later edits. |
| Student visibility | Browser student dashboard exposes the course announcement entry; reader shows the published edit and no create/edit/delete controls. An unenrolled course shows access denied. Revoked student course and individual-notification reads are denied in real API tests. |
| Notification navigation | Browser shows exactly one announcement item, retaining the original publication text. Its link opens the edited course announcement; reload preserves the reader. |
| Teacher edit | Browser saved a published edit without generating additional notification rows. Conflicting stale revisions return 409 in real API tests. |
| Teacher/admin delete | Both roles deleted their disposable test drafts through Browser confirmations. PostgreSQL confirmed the deletions; admin UI exposes deletion without authoring controls. Real API tests also delete a publication, hide its notifications, and replay deletion safely. |
| Concurrent retries | Three concurrent HTTP create requests return the same ID; three publication requests produce one recipient snapshot. Changed request-key reuse and deleted-key reuse return 409. |
| Atomic failure | A disposable PostgreSQL trigger rejects notification insertion; the real HTTP publication fails with 500 and leaves no announcement. Removing the trigger lets the same request succeed with exactly one notification per channel/recipient. |
| Read error/retry | Temporarily removing announcement SELECT permission in the disposable database produces the actual 500 error and Retry UI. Restoring permission and clicking Retry recovers the list. |
| Write error/retry | Removing INSERT permission makes Browser draft save fail through the real API. The editor retains title/body; restoring permission and retrying creates exactly one draft. |
| Pending/navigation | A PostgreSQL table lock holds a real draft update. Browser shows disabled controls and “Saving announcement…”. `pg_stat_activity` confirms the API waiting on a relation lock. Browser Back navigates to the teacher dashboard; releasing the lock persists the edited body/revision while the dashboard remains unchanged. |
| Visual inspection | Editor, student reader, admin deletion, write-error, pending-save, and destination-dashboard screenshots were inspected. Labels, readable messages, contained text, and disabled pending controls render correctly at the Browser viewport. |

## Actual email evidence

The production Brevo endpoint was called by the existing delivery worker against
the disposable queue. A deliberately invalid key returned HTTP 401 and scheduled
a retry on the same notification. The configured key initially returned HTTP 401
because this machine's sending IP was not authorized. After the user authorized
that IP, the same queued notification was accepted at **02:06:15 UTC**.
The two-minute/four-minute retry schedule was observed; the disposable due time
was advanced explicitly to avoid waiting during verification.

The user confirmed **“Received”** and supplied a screenshot showing the
“Course announcement” email in the inbox, the correct course/title/body, and the
local course-announcement link. This is confirmed inbox delivery, independently
distinguished from provider acceptance. The email contains the original Thursday
publication; Browser displays the later Friday edit, as specified.

A subsequent real worker run produced no new send and retained exactly one
`sent` notification per channel. No unrelated real recipient was contacted.
The successful retry used the production worker's service-role context, with
independent durable claim/status operations.

## Automated validation and limits

- Backend: 1,092 tests passed; database-dependent suites are run separately.
- Permanent announcement real PostgreSQL/API suite: four tests passed, including
  multi-recipient fan-out, concurrent replay, rollback, authorization, and revocation.
- Frontend: 270 unit tests and 256 rendered component tests passed.
- Backend/frontend lint, backend TypeScript build, frontend typecheck/production
  build, focused formatting, and OpenAPI validation passed.
- All 80 migrations replayed on a clean database after documented role/pg-boss
  prerequisites. Exact migration ledger, unchanged base history, bidirectional
  Prisma schema diff, and the SQL governance probe passed.
- The real email test verifies one controlled inbox and one provider acceptance;
  it does not claim load testing, multiple mailbox-provider delivery, or recall of
  email already in flight. General quizzes remain outside this task.

Verification-only permission changes and locks were restored/released. Disposable
servers, databases, and private fixture credentials were removed after acceptance.

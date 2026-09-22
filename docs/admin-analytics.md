<!-- Where: DG-07 reporting. What: metric contract and verification evidence. Why: keep descriptive analytics auditable. -->

# Platform admin analytics

The admin menu exposes `/admin/analytics`. Active administrators can read
`GET /api/v1/analytics/admin` as JSON or CSV. Teachers and students cannot use
the page or either representation. There are no predictive metrics.

## Scope and denominators

- Dates are UTC calendar dates: `from` is inclusive midnight and `to` includes
  the entire day, implemented as an exclusive next midnight. Defaults are the
  last 30 days including today. Ranges must be ordered, at most 366 days, and
  not extend into the future. Today remains an incomplete day.
- Overview and progress are **current state**, even when viewing an older
  period. The course filter applies to every section. Deleted courses, users,
  enrollments, assignments, submissions and grades do not contribute.
- Student and teacher totals include non-deleted accounts of those roles,
  including invited/suspended accounts. A selected course restricts students
  to student enrollments and teachers to its owner/co-teachers. Enrollment
  totals include all course roles and exclude deleted users/enrollments.
- Engagement and progress use distinct **active student accounts currently
  enrolled as students** in the selected non-deleted courses. One student in
  two courses counts once platform-wide, but once in each course's progress.
- Courses have no publication flag. Published-course count is explicitly
  unavailable, alongside the actual course count; assignment publication is
  not used as a proxy for course publication.
- Lesson progress is explicit NCE `completed` records divided by currently
  available, published assigned lessons × eligible enrolled learners. Parent
  book/unit publication and deletion are respected. Assignment course progress
  follows existing semantics: current non-draft submitted work / published
  assignments × eligible enrolled learners. Zero denominators are unavailable.
- Submission counts use the **current version's submitted timestamp** within
  the period. Exactly at the deadline is on time; later is late; no-deadline
  work has its own bucket. Awaiting grading is a subset with no current
  non-deleted grade. Archived replacement content/grades never count.
- Unsubmitted obligations instead use **deadlines in the period**, current
  enrollment established by the deadline, and no current non-draft submission.
  After the deadline but before deadline + 24 elapsed hours, work is in the
  late window. At/after that cutoff it is missing. There are no late penalties.
- Results use current grades for submissions in the period, grouped by
  assignment/course and skill/type. IELTS reading/listening use persisted
  bands; writing/speaking follow existing band/final-score fallback semantics.
  Other scores normalize `finalScore / assignmentConfig.maxScore × 100`, with
  the existing default maximum of 100. Invalid non-positive maxima and absent
  scores are unavailable, never zero. Samples count available scores only.

## Participation and storage

Opening an assignment or viewing a grade is recorded after authorized reads.
The lesson page posts its opened lesson to `/api/v1/analytics/lesson-view`;
the server independently verifies active student enrollment, publication,
parent catalog and availability. Identity and timestamps cannot be supplied
by the client. Login, dashboard, assignment lists and NCE path lists do not
record participation.

Database triggers record successful submission, NCE attempt and lesson
completion writes in their transaction. Successful unchanged submission saves
are recorded by the controller too. The database primary key deduplicates
concurrent retries to **one row per student/course/UTC day**, with database
timestamps. This is participation, not mastery or a count of individual actions.
The table stores no answers, content, grades, IP addresses or user agents.

Coverage begins with the first recorded action, not an invented historical
backfill. Existing submission/progress timestamps cannot reconstruct all
historical opens, edits and grade views. Dates before tracking are unavailable;
partially covered periods show observed minimums and explicitly avoid calling
unobserved students proven inactive. Lesson-view telemetry failure does not
interrupt reading, so reports always describe recorded participation.

Daily facts are retained with the learning data; existing auth/notification
retention jobs do not purge them. User/course hard deletion cascades to daily
facts; soft-deleted populations are excluded at query time. There is no raw
per-request event stream to grow under repeated requests. Any future retention
policy must also advance the reported coverage boundary.

Both activity tables have RLS and no public/Data API grants. Student backend
requests can insert only their own current-day/server-timestamp facts. Admin
aggregation is gated before using the existing trusted NCE read role. Its new
grade/submission grants are **column-only aggregate inputs**; they do not
include answers, feedback, history or grade mutations. The existing runtime
boundary probe still passes. See the [RLS grant/policy guidance](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Bounds, exports and updates

PostgreSQL performs aggregation in a repeatable-read transaction, with a
10-second statement timeout and a 15-second transaction limit. Daily trends
are bounded to 366 buckets. Course/result tables over 500 rows fail with an
instruction to narrow scope. The inactive-name list shows/exports the first
100 ordered names/IDs with a truncation flag and an untruncated total.

JSON and CSV use the same service, filters and authorization. CSV uses quoted
field/value rows, explicit `Unavailable` values and spreadsheet-formula
neutralization. It includes scope, denominators, sample sizes, coverage and
`generatedAt`. Exports are newly generated snapshots: concurrent platform
changes can differ from an older displayed snapshot. Refresh before comparing.
Prepared links are hidden after scope changes or failures; controls prevent
duplicate exports and filter changes during export. Responses are `no-store`.

## Verification — 2026-09-22

Used the actual app at `127.0.0.1:3047`, actual API at `127.0.0.1:4047`, and
isolated PostgreSQL 17 databases on port 55437. The final database was built
from all 86 Prisma migrations and reference seeds, with the application using
`nce_runtime`. No mocked/intercepted API responses were used for acceptance.

The initial disposable fixture contained six accounts, three courses (one
empty), five enrollments (one suspended student), nine assignments, seven
current submissions (including replacement history), six grades, and one
assigned NCE lesson. Its expected report reconciled as follows:

| Metric | Expected and observed |
| --- | --- |
| Students / teachers / eligible learners | 4 / 1 / 3 |
| Courses / enrollments / published courses | 3 / 5 / unavailable |
| Current submissions / on time / late / awaiting grading | 7 / 5 / 2 / 1 |
| Unsubmitted late window / past-cutoff missing | 4 / 2 |
| Alpha lesson completion / assignment progress | 1 of 2 / 6 of 16 |
| Generic percentages | 80 and a genuine 0 |
| IELTS reading / listening / writing / speaking | 7 / 6.5 / 8 / 5.5, separate rows/scales |
| Activity before first tracked action | Unavailable; never inferred as zero |

Real API/database assertions also covered authorized and unauthorized lesson
views, repeated request deduplication, draft/save/submit/replacement writes,
cutoff denial, own/other-student grade access, midnight inclusion/exclusion,
exact-deadline versus one-millisecond-late classification, deleted grade and
enrollment exclusion, full-coverage zero-day fixtures, and the 500-row error
with narrowed-scope recovery. The coverage epoch was changed only in disposable
test fixtures to exercise full-history behavior, then restored.

Browser checks exercised admin navigation, course and date controls, keyboard
Apply, empty and unavailable-history views, expandable daily/student tables,
pending disabled controls, actual API error/retry, role-protected navigation,
and opening/completing a real lesson. Screenshots were inspected for readable
filters, metric cards, tables and empty states. Database reads confirmed that
login/dashboard/path-list browsing created no participation, opening a lesson
created one daily fact, and completion did not duplicate it.

**CSV limitation:** the browser generated a real authorized CSV blob and its
visible download link. Automatic download, direct link activation and the
browser download helper did not emit a download event or save a retrievable
file in the available in-app browser. Real API CSV content was reconciled with
the same scoped server/database report, but browser-to-filesystem saving is
**unverified**, not PASS. A connected browser with file-download support is
needed to close that acceptance item.

Checks: backend 1,105 tests passed (86 explicitly skipped environment-gated
tests); frontend 270 unit and 267 component tests passed. Type checks/builds,
lint, OpenAPI validation, migration history/checksums, both schema-diff
directions, schema governance and activity/runtime-role SQL probes were run.
The focused admin tests cover UTC boundaries, validation, role denial, null/zero
distinctions and formula-safe CSV. Hosted deployment and production-scale
performance were not exercised.

### Assignment-open follow-up — 2026-09-22

The student detail route renders assignment-list cache data, so it now explicitly
calls the authorized single-assignment endpoint after its data loads, including
return navigation with cached data. List/dashboard browsing does not call it.
The server still owns identity/time, enrollment/publication checks and daily
deduplication; a failed activity request does not interrupt reading.

Repeated acceptance used the real Browser/app/API and a fresh PostgreSQL 17
database replayed from all 86 migrations, running as `nce_runtime`. Bob began
with no activity and no submissions. Login, dashboard and assignment list kept
activity at zero; opening an assignment without saving/submitting created one
fact. Repeated opens retained one fact and zero submissions. Clearing only the
disposable fact and returning through the cached list/detail navigation created
it again, proving cached data does not suppress tracking. Revoked enrollment
and unpublished assignment opens created no facts; direct API checks also
returned 404 for these cases and another student's unassigned course.
Fixture access was restored after those checks.

The real admin page, API and CSV reconciled to one observed active learner and
two learners with no observed activity. Assignment and report screenshots were
inspected. Frontend typecheck/lint/build and all 269 component tests passed,
including two new route regressions; 19 backend analytics/authorization tests
passed. Export and the prepared-link download helper were retried in the only
connected browser (in-app browser); neither yielded a retrievable download.
The browser-to-filesystem CSV limitation above remains unverified.

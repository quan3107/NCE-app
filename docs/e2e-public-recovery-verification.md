<!--
Location: docs/e2e-public-recovery-verification.md
Purpose: Record authenticated public navigation and CMS recovery acceptance.
Why: Separate the already-fixed loading defect from the remaining retry change.
-->

# Public page recovery verification — 2026-09-20

## Result and scope

- **SHELL-04: PASS.** Student, teacher, and admin completed Home, Courses,
  About, Contact, navigation away/back, About full reload, account Dashboard,
  Profile, and sign-out followed by reload. Initials were AC, SN, and RM;
  destinations retained the correct role prefix. Anonymous public navigation
  and About reload also passed.
- **X-02: BLOCKED for full acceptance; recorded public-page defect resolved.**
  The public loading/error/retry, empty-list, unknown-course, and unknown-route
  cases below passed. This is not a new five-state matrix for every protected
  route in the application, as the full story requires. Those unrelated routes
  remain unverified by this rerun. X-07 remains outside this task.

## Baseline and diagnosis

Before editing application files, main `6398dc92` rendered About for the signed-in
student and admin, including full reload. The historic indefinite-loading failure
did not reproduce. PR #138 replaced the auth provider's synchronous subscription
to **every** query-cache event with `subscribeToProfileCache`: notifications match
the active actor's profile key, are deferred through `notifyManager.batchCalls`,
and ignore queued delivery after unsubscribe. Previously, creating a route query
could synchronously notify the auth provider during render. That prior fix is
consistent with the successful baseline; this run does not claim to have bisected
the original August failure.

CMS queries still use `auth: 'none'`, the shared query client, and existing session
cache boundaries. No auth, router, backend, authorization, or published-content
selection logic changed. The remaining defect reproduced by stopping the real API:
About displayed an error with no Retry action. Home and Contact had the same gap.
The change adds each query's `refetch` action, disabled during fetching. Initial
retry loading hides unavailable content; failed retries retain the error; success
replaces it. No timeout or artificial success fallback was added.

## Real environment and evidence

- In-app Browser; actual Vite frontend `http://127.0.0.1:3012` and repository API
  `http://127.0.0.1:4004/api/v1`.
- Explicitly disposable database `nce_public_recovery` at `127.0.0.1:55437`,
  inside local PostgreSQL 17 container `nce-speaking-performance-20260920`.
  Created as a separate database by dumping the identified disposable
  `nce_speaking_performance` fixture database, including its roles' grants and
  policies. It contains all 77 applied migrations and 10 fixture users. No shared
  or production database was seeded or changed.
- Demo users: `amelia.chan@ielts.local`, `sarah.tutor@ielts.local`, and
  `rosa.admin@ielts.local`; documented demo password from `backend/src/prisma/seed.ts`.
- Evidence directory: `/tmp/nce-public-recovery-20260920`. `start.mts` imports the
  actual server and passively records request method/path, response status,
  duration, and authorization-header presence. It does not alter requests or
  responses or log credentials/bodies. No acceptance API mocks, interceptions,
  replacement backend, or fabricated responses were used.

## Reproducible cases

1. Baseline and final role runs: sign in, click NCE to return Home, visit each
   public navigation item, return to About, reload, then exercise both account
   destinations and sign out/reload. `final-role-navigation.json` records all
   three completed role sequences; `network.jsonl` records their actual requests.
2. Transport failure: stop only the task API process while a signed-in user is
   on Home, then enter About. The unavailable-server error preserves the account
   menu. Restart the same real API and click Retry; published About returns.
   `baseline-no-retry.png` records the pre-change gap.
3. Database delay/failure: in this disposable database execute
   `BEGIN; LOCK cms_sections IN ACCESS EXCLUSIVE MODE; SELECT pg_sleep(20); ROLLBACK;`
   while navigating to About. `about-loading.png` shows loading; the existing
   database transaction deadline produces a real HTTP 500, shown in
   `about-database-error.png`. Retry after release recovers content and session.
4. Missing published content: temporarily set the chosen `cms_page_contents`
   row's `is_active=false`. Home, About, and Contact show errors, never old
   successful content. Retry while inactive remains an error. Restore the row and
   Retry; all three recover without reload. Contact's submission form is absent
   until the CMS read succeeds. The existing API reports missing CMS as HTTP 500,
   not 404; this patch does not change that contract.
5. Published-only visibility: put `UNPUBLISHED ACCEPTANCE MARKER` in the About
   draft's `content_json.hero.title`. Signed-in student reload still shows
   published `About NCE`, with no marker. Restore the exact draft JSON afterward.
6. Empty: back up course deletion timestamps and temporarily archive all six
   courses in this disposable database. The real public API returns an empty
   list, and Courses shows its empty message, distinct from an error. Restore
   timestamps and reload; course cards return. Evidence: `empty-courses-api.json`,
   `courses-empty.png`, `restoration.txt` (zero mismatched courses/drafts).
7. Not found: open `/courses/00000000-0000-4000-8000-000000000000`; inspect
   `Course not found`, then use Back to Courses. Open `/acceptance-missing-page`;
   inspect Page Not Found and use Go Home. Neither claims successful missing data.

Screenshots were visually inspected for all three signed-in About pages, loading,
error/Retry, empty courses, and missing course. Browser `console.json` contains
expected deliberate failure messages and the existing React Router future warning;
there are no maximum-depth, render-time update, or excessive-render warnings.
`network.jsonl` confirms CMS reads omit bearer headers even during role sessions.
The final missing-About sequence records real 500/500/200 responses.

## Checks

Frontend ESLint, TypeScript, 269 unit tests, 200 component tests, and production
build passed. Three new rendered regressions exercise real query hooks with
test-only fetch stubs: failure, pending retry, successful replacement, no duplicate
request, and no bearer header. These supplement the separate real-app acceptance.
The existing scoped/deferred profile notification regression passes unchanged.
No backend application files changed; a full backend suite was not rerun.

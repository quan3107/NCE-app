<!--
Location: docs/e2e-route-state-verification.md
Purpose: Record protected-route unavailable-data acceptance results.
Why: Replace the previous untested-coverage blocker with observed failures.
-->

# Protected route state verification — 2026-09-20

**X-02: PASS for the recorded route-state matrix after fixes.** All 33 protected route declarations were visited through the
in-app browser against the real frontend, API, and disposable PostgreSQL database.
The initial failures below are retained as reproduction evidence and resolved by
the fix rerun at the end of this report. SHELL-04 and public recovery remain PASS.

## Environment and method

- Frontend `http://127.0.0.1:3012`, API `http://127.0.0.1:4004/api/v1`, database
  `nce_public_recovery` in `nce-speaking-performance-20260920` on port 55437.
- Documented Amelia student, Sarah teacher, and Rosa admin fixtures. Added the
  documented NCE seed and a student enrollment to exercise actual lesson content.
- Evidence: `/tmp/nce-route-states-20260920`, including `evidence.json`, per-state
  DOM snapshots and screenshots, database backups, and restoration logs. Actual
  request/status logs are in `/tmp/nce-public-recovery-20260920/network.jsonl`.
- Genuine read failures were induced by temporarily revoking table SELECT grants
  in this disposable database. Separate user, settings, and book failures were
  tested because the broad domain failure did not affect those queries.
- Empty domain data was tested after a full backup, then restored from that backup.
  Empty NCE mappings were also tested with a valid enrolled course. Admin Users
  used a no-match filter; the signed-in account was retained.
- Initial shared loading was captured during route navigation. Controlled database
  locks independently verified student assignment loading, settings loading, and
  admin Users background refresh. These are not independent delayed-query tests
  of every panel on every page.
- Missing IDs used `00000000-0000-4000-8000-000000000000`. Singleton profiles and
  list routes have no record ID; those missing-ID cells are not applicable.
- No mocked API responses, request interception, or replacement server were used.
  Screenshots were visually inspected for the principal failure cases, empty
  admin tables/teacher courses, and controlled loading. Other rows additionally
  have DOM evidence; this is not a pixel-level visual audit of every screenshot.

## Initial failures (resolved in the fix rerun)

1. **NCE lesson editor hides failed/missing data.** `/teacher/nce-lessons/:id/edit`
   displays an empty editable form and enabled Save Lesson after real read failure
   or an unknown lesson ID. The new editor also hides a failed books lookup.
   `TeacherNceLessonEditorPage.tsx` gates on loading but does not render query errors.
   Evidence: `missing-confirmed--teacher-nce-lessons-…-edit`, `book-error--…`.
2. **Missing submission produces a blank grading page.** `/teacher/grade/:id`
   renders only the shell when the submission is absent. Reproduced with an unknown
   ID and by removing domain fixtures, then confirmed again after restoration.
   `TeacherGradeFormPage.tsx` returns null when submission/assignment is absent.
   Evidence: `missing-confirmed--teacher-grade-…`, `empty--teacher-grade-…`.
3. **Rubrics misreports a failed dependency as empty.** A failed courses query
   leaves the course selector empty and shows “No rubrics yet for this course.”
   Create Rubric remains enabled. The page consumes `coursesQuery.data` without
   rendering its error. Evidence: `read-error--teacher-rubrics`.
4. **Assignment creation hides failed course loading.** The type chooser remains
   available after the resource request fails, with no page-level dependency error.
   With genuinely empty courses, the authoring form still offers Save Draft and
   Create & Publish although no course can be selected. No successful invalid
   mutation is claimed. Evidence: `read-error--teacher-assignments-create`,
   `empty-authoring--teacher-assignments-create`.
5. **Several lists lack explanatory empty content.** Teacher Courses, Assignments,
   and Submissions, admin Courses/Enrollments, and no-match admin Users render
   empty content/tables without an explicit empty message. Evidence: corresponding
   `empty--…` and `users-empty-filter` snapshots.

## Initial route matrix (before fixes)

Every row was visited with healthy data and a genuine failed read (including the
targeted exceptions described above). Healthy data returned after restoring the
fixture/grants and reloading. “Error” means visible unavailable-data copy, not a
claim that every route offers an inline Retry. Initial shared loading was observed
across the route set; controlled per-query delays are limited to the three cases
listed above. Detail-route empty fixtures are equivalent to missing records.

| Route | Empty/missing result | Failed-read result |
| --- | --- | --- |
| `/student/dashboard` | Zero/empty dashboard | Error |
| `/student/assignments` | No assignments found | Error |
| `/student/assignments/:id` | Assignment not found; Back works | Error |
| `/student/nce` | No enrolled courses; valid empty path has no lessons | Error |
| `/student/nce/courses/:courseId/lessons/:lessonId` | Generic unavailable lesson | Error |
| `/student/grades` | No Grades Yet | Error |
| `/student/notifications` | No Notifications | Error |
| `/student/profile` | Singleton; no empty collection | Error; Edit disabled, Retry shown |
| `/teacher/dashboard` | Zero/empty dashboard | Error |
| `/teacher/courses` | No explicit empty message | Error; Refresh shown |
| `/teacher/courses/:id/manage` | Course not found; Back works | Error; Retry recovers |
| `/teacher/nce-lessons` | Empty course selection; valid empty path has no lessons | Accessible-course error |
| `/teacher/nce-lessons/new` | New form | **Hidden book/resource failure** |
| `/teacher/nce-lessons/:id/edit` | **Blank editable form** | **Hidden failure** |
| `/teacher/assignments` | No explicit empty message | Error |
| `/teacher/assignments/create` | Empty course selector in form | **Hidden dependency failure** |
| `/teacher/assignments/:id` | Assignment not found | Error |
| `/teacher/assignments/:id/detail` | Assignment not found | Error |
| `/teacher/assignments/:id/edit` | Assignment not found | Error |
| `/teacher/submissions` | No explicit empty message | Error |
| `/teacher/notifications` | No Notifications | Error |
| `/teacher/grade/:id` | **Blank main content** | Error |
| `/teacher/rubrics` | No rubrics yet | **False empty state on course failure** |
| `/teacher/analytics` | No submissions yet | Error |
| `/teacher/profile` | Singleton; no empty collection | Error; Edit disabled, Retry shown |
| `/admin/dashboard` | Zero metrics | Error; Refresh shown |
| `/admin/users` | No-match table lacks empty message | Targeted user read error; Refresh recovers |
| `/admin/courses` | Table lacks empty message | Error; Refresh shown |
| `/admin/enrollments` | Table lacks empty message | Error; Refresh shown |
| `/admin/logs` | Explicit empty audit state after Refresh | Error; Refresh shown |
| `/admin/content` | Missing required draft/history shown as unavailable | Error |
| `/admin/profile` | Singleton; no empty collection | Error; Retry recovers |
| `/admin/settings` | Missing required policies fails closed | Error; Save disabled |

Unknown NCE course/lesson IDs show generic unavailable copy rather than a specific
not-found label. This run does not classify that as an authorization defect.
Admin Users retains existing rows and enabled Refresh/Delete during background
refetch; this is an observation, not evidence that initial loading enables deletes.

## Recovery, restoration, and limits

Profile Retry, navigation Retry, Users Refresh, course-management Retry, and
missing student-assignment/teacher-course Back actions were exercised. The course
Retry replaced a real error with the populated course form without reloading.
Other recovered route visits used actual reload/navigation after grant restoration.
Student routes were repeated after the full empty-fixture restoration, including
the enrolled NCE lesson. Missing lesson and grading failures were reconfirmed.

Final database checks found 7 courses, 10 users, 2 NCE lessons, 2 restored mappings,
and zero active test-lock sessions. Original grants were reapplied. Only the
separate disposable database was modified; its source database was not changed.

This is route-state acceptance, not a rerun of every mutation, modal, authoring
variant, mobile layout, or external integration. The fix rerun below supersedes
the initial FAIL result. There is no external testing blocker.

## Fix rerun

- NCE editing now gates failed/missing lessons and failed book/unit dependencies
  with an error, Back, and Retry. Required loading/catalog state prevents Save.
  Draft state stays in the route while dependencies recover. A valid seeded edit
  again displays its original text, objectives, exercises, and enabled Save.
- Missing grading records now display Submission not found and Back to Submissions;
  the Back action was exercised against the real application.
- Rubrics distinguishes failed courses from empty rubrics, disables creation until
  required course/rubric data is available, and recovers through Retry.
- Assignment creation gates both generic and IELTS flows on resource loading,
  error, and empty courses, with Back and Retry. The type chooser returns after
  real data recovery; component coverage verifies its Retry action.
- Teacher Courses/Assignments/Submissions and admin Courses/Enrollments/Users now
  have explicit empty messages. All six were rechecked with empty data or a
  no-match search in the real app; clearing the Users filter restored nine action
  rows. Empty authoring and Rubrics were also rechecked.

The rerun used actual denied SELECT grants and empty domain fixtures in the same
disposable database. Book and rubric Retry were exercised in-browser; snapshots
are prefixed `fixed-` in the evidence directory. Error screens, disabled rubric
creation, and empty tables were visually inspected. The database was restored from
`before-fix-empty.sql`; restore output is `fix-restoration.log`.

ESLint, TypeScript, 207 component tests, 269 unit tests, and production build pass.
Seven new rendered regressions cover NCE lesson/book/unit/404 recovery, missing
grading records, authoring prerequisites, and rubric dependency recovery. Existing
lesson add/remove/save coverage also passes after waiting for authoritative data.
The scope limits above still apply: this is route-state verification, not an
exhaustive audit of every panel, mutation, or mobile layout.

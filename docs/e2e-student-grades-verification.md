<!--
File: docs/e2e-student-grades-verification.md
Purpose: Record complete official student grade acceptance and real-service evidence.
Why: STU-14 PASS requires consistent persisted state, truthful scores and recovery.
-->

# Official student grades — 2026-09-21

STU-14 passes the complete acceptance criteria.

## Root cause and changes

The demo seed inserted official grades separately from submissions, retaining
`submitted` or `late` on some graded work. Normal teacher and objective grading
already update grade and submission status in one transaction. The seed now
marks both graded fixture groups correctly; an additive migration repairs active
historical submissions with active grades. Deleted grades and submissions are
excluded, and the repair is idempotent.

Conventional scores with neither raw nor final values now say “Score unavailable”
instead of inventing zero. Official zero still displays zero. Conventional rubric
payloads contain earned points but no criterion maxima: the UI displays those
points without inventing denominators or full-progress bars. IELTS results and
assignment maxima explicitly say “IELTS band.” Grade load errors offer a working
“Try again” action for both prerequisite resources and grades.

## Environment

- Saved local repository, branch `fix/student-official-grade-consistency`.
- Actual Vite UI `http://127.0.0.1:3013`, API `http://127.0.0.1:4008/api/v1`.
- Disposable PostgreSQL 17 container `nce-student-grades-20260921`, database
  `nce_grades`, loopback port 55439; 78 migrations, demo and reference seeds.
- API uses the least-privilege `nce_runtime` login. External delivery and AI
  workers are disabled; this story requires no external storage or AI calls.
- In-app Browser operated the actual UI. No interception, fake responses or
  acceptance mocks. Screenshots of detail, score/feedback cards, error and empty
  states were visually inspected in the task.
- Raw evidence: `/tmp/nce-student-grades`, including `api-evidence.json`,
  `visibility-evidence.json`, HTTP assertion scripts, database lock and check logs.
- During local role bootstrap, a historical migration initially failed; it was
  executed successfully using psql and recorded as applied before deployment
  continued. No historical migration bytes were edited.

## Acceptance evidence

| Criterion | Observed result |
| --- | --- |
| Original reported mismatch | Academic Essay: Technology and Society is Graded in Assignments and detail, including reload. Grades displays official 7.5, teacher feedback, Sarah Nguyen and grading time. Detail has no resubmit action. |
| Conventional score and rubric | Teacher PUT creates a real 15/20 result. Browser shows 75%, Evidence 8 points and Organization 7 points, feedback headings and bullets, grader and time. The fixture references an actual course rubric. |
| IELTS authoritative calculation | Teacher PUT deliberately supplies total/band 1 with four canonical criteria of 7.5. Server persists and returns 7.5; student GET and Browser render 7.5 with the stored criterion breakdown. |
| Unavailable versus zero | Feedback-only official grade shows Score unavailable. Separate official zero shows 0/20 and 0%; neither is confused with ungraded work. |
| Safe readable feedback | `# Result`, `## Next steps` and bullet lines become readable structure. A script-tag string renders literally without an executable element or dialog. |
| Ungraded work | Awaiting teacher remains Submitted, is excluded from the Graded tab and Grades, and its grade endpoint returns 404. Five official learner results agree with the Graded tab count. |
| Persistence | Reloaded detail and Grades retain authoritative status/results; signing out and back in restores the same records. |
| Empty and isolation | Empty Grades Learner sees No Grades Yet with no prior learner data. View Assignments opens that learner's list with Graded 0. |
| Real request failure | An exclusive lock on the disposable grades table causes actual prerequisite API transactions to fail with 500. Browser displays Unable to load grades and Try again. After rollback, one click restores all grade cards. |
| Access and visibility | Anonymous grade GET returns 401; peer and empty learner requests return 404; student educator-only submission detail returns 403. Soft-deleted grade or assignment returns 404; restoring the fixture restores access. |

## Regression checks

- Backend: 1,085 standard tests pass, with 41 gated tests skipped in the general
  run. The new PostgreSQL migration regression was separately enabled and passed
  alongside 22 grade service regressions. It tests submitted/late repair,
  ungraded/deleted preservation and replay idempotence.
- The npm entrypoint test initially required `npm_execpath`; supplying the
  installed npm runtime passed all 12 tests in that suite.
- Frontend: 270 unit tests and 224 rendered component tests pass, including
  score/feedback/retry regressions. Formatting initially changed quote style used
  by existing source assertions; restoring repository single quotes resolved them.
- Backend/frontend lint and TypeScript builds, frontend production build, and
  `git diff --check` pass. Exact database history verification passes for all 78
  migrations against `main`. All task-created servers and the disposable database
  are stopped after verification.

Catalog totals: **115 PASS, 2 FAIL, 1 BLOCKED, 7 DECISION-GATED (125 total)**.

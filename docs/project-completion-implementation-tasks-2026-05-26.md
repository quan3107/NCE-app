<!--
File: docs/project-completion-implementation-tasks-2026-05-26.md
Purpose: Convert the completion assessment and PRD AI feedback requirement into PR-sized tasks.
Why: Provides one concrete, testable backlog for finishing the NCE learning app.
-->

# Project Completion Implementation Tasks

Source: `docs/project-completion-assessment-2026-05-25.md` and `docs/PRD.md`
Date: 2026-05-26
Sizing rule: each task should fit in one focused PR.
AI note: PRD assignment feedback is core product scope, so AI feedback tasks are merged into this file.

## Working Rules

- Keep PRs narrow: one quality gate, one security boundary, one workflow, one migration set, or one UI surface.
- Update OpenAPI/docs when API behavior changes.
- Add tests before implementation when practical.
- Treat AI output as teacher-reviewable draft feedback, never final grading authority.
- The npm security branch already restored lockfile tracking and cleared current audit findings.

## Phase 0: Release Gate

### PR-01: Add GitHub Actions CI Gate

Scope: create `.github/workflows/ci.yml` for root, frontend, and backend install/audit/build/test checks using the current Node policy.
Done: PRs to `main` run `npm ci --ignore-scripts`, audit, frontend tests/build, and backend build/lint/test with safe test env values.
Tests: open a PR and confirm CI passes; locally run the same commands from the workflow.
Out: deployment and database-backed integration tests.

### PR-02: Add Frontend Lint, Typecheck, and Coverage

Scope: add frontend scripts/config for `lint`, `typecheck`, and `test:coverage`.
Done: scripts run cleanly and are documented; any existing TS errors are fixed or narrowed with typed helpers.
Tests: `npm --prefix frontend run lint`, `typecheck`, `test:coverage`, and `build`.
Out: browser automation and visual QA.

### PR-03: Make Backend Tests Env-Self-Contained

Scope: add test defaults/loader so tests do not require real Brevo, Google, JWT, or DB URL secrets for collection.
Done: clean checkout can run backend tests without manually exporting Brevo env; `.env.example` matches runtime validation.
Tests: delete local backend `.env`; run backend `test`, `build`, and `lint`.
Out: real email delivery tests.

### PR-04: Clear Backend Lint Warnings

Scope: remove existing backend ESLint warnings without behavior changes.
Done: backend lint reports zero errors and zero warnings.
Tests: backend `lint`, `build`, and focused tests for touched modules.
Out: weakening lint rules.

## Phase 1: Security and Data Access

### PR-05: Add Credentialed CORS Allowlist

Scope: replace origin reflection in `backend/src/app.ts` with env-configured allowed origins and safe local defaults.
Done: credentialed requests pass only for configured origins; disallowed/no-origin cases fail predictably.
Tests: Supertest allowed, denied, no-origin, and preflight cases; update `.env.example`.
Out: frontend token-storage changes.

### PR-06: Add Auth Rate Limiting and Lockout

Scope: protect login, registration, refresh, and OAuth endpoints with IP/account-aware throttling.
Done: repeated failures return `429`; successful login resets account counters; limits are configurable by env.
Tests: route tests for login/register/refresh throttling, reset after success, and unaffected non-auth routes.
Out: captcha or WAF integration.

### PR-07: Verify Google ID Tokens with JWKS

Scope: replace claim decoding with signature, issuer, audience, expiry, and nonce/state validation.
Done: invalid signature, wrong audience, expired token, and missing email are rejected; mocked valid JWKS flow still works.
Tests: unit tests with generated JWKS fixtures plus OAuth callback route success/failure tests.
Out: OAuth UI redesign.

### PR-08: Detect Refresh Token Reuse

Scope: harden refresh rotation so reused/stolen refresh tokens revoke the session family.
Done: reuse invalidates related active sessions and returns auth error; normal rotation still works.
Tests: auth tests for first refresh, second use of old token, logout after reuse, and separate sessions.
Out: admin session-management UI.

### PR-09: Add Teacher Approval and Invite Backend

Scope: prevent public teacher signup from immediately activating teaching permissions; add admin invite/approval APIs.
Done: public teacher signup creates pending status; admins can approve, reject, or invite with auditable transitions.
Tests: auth/user route tests for pending denial, approval, invite acceptance, and unauthorized admin actions.
Out: polished admin frontend screens.

### PR-10: Enforce Course Owner and Enrollment Role Rules

Scope: validate course owners are teachers and enrollments match allowed student/teacher roles.
Done: invalid owner, invalid enrollment role, duplicate enrollment, and soft-delete reactivation are consistent.
Tests: course/enrollment service tests plus router tests for admin and teacher paths.
Out: course archive/settings.

### PR-11: Add Course-Scoped Assignment Authorization

Scope: require actor/course authorization for assignment create/read/update/delete and teacher detail access.
Done: teachers cannot access outside owned/co-taught courses; students read only published assignments for enrolled courses.
Tests: cross-course denial, co-teacher allow, student enrolled/unenrolled, and route status assertions.
Out: submission and grade authorization.

### PR-12: Derive Submission and Grader Identity Server-Side

Scope: stop trusting client-supplied `studentId` and `graderId` for submission and grading writes.
Done: submission student comes from auth context unless a permitted override exists; grader comes from authenticated teacher/admin.
Tests: spoofed `studentId` rejected, spoofed `graderId` ignored, outside-course grading denied, admin path covered.
Out: grading UI changes.

### PR-13: Enforce Submission Eligibility and Late Policy

Scope: enforce enrollment, publication, draft rules, due date, and late policy before accepting submissions.
Done: typed errors cover unpublished, unenrolled, closed, late-disallowed, and invalid draft transitions.
Tests: submission service tests for each denial and allowed late/draft path; route response-code tests.
Out: attempt history schema.

## Phase 2: Classroom Workflow

### PR-14: Add Course Update, Archive, Restore, and Settings APIs

Scope: implement course update/archive/restore/settings endpoints using existing schema fields where possible.
Done: teachers/admins can update metadata/settings, archive/restore courses, and list archived state correctly.
Tests: service/router tests for owner, co-teacher, admin, archived reads, and forbidden student mutations; OpenAPI updated.
Out: owner transfer and co-teacher management.

### PR-15: Add Co-Teacher Management

Scope: implement add/remove/list co-teacher APIs and apply co-teacher permissions across reads and roster mutations.
Done: owners/admins manage co-teachers; co-teachers perform allowed actions but cannot remove owners.
Tests: add, remove, duplicate, forbidden self-removal, and co-teacher assignment access tests.
Out: frontend course settings polish.

### PR-16: Replace Toast-Only Teacher Course Actions

Scope: wire course-management UI controls to real backend mutations for roster, settings, archive, and restore.
Done: actions update server state, invalidate caches, and show accessible success/error states.
Tests: frontend API/hook/component tests plus backend route tests from course PRs.
Out: drag-and-drop course ordering.

### PR-17: Fix Student Grade Visibility

Scope: allow students to fetch their own grades and feedback while preserving teacher/admin access.
Done: student grade page loads real feedback for authenticated student and denies other students' grades.
Tests: backend grade route tests, frontend query enabling tests, page loading/error/empty/graded states.
Out: IELTS-specific grading UI.

### PR-18: Build Student IELTS Attempt and Submission Flow

Scope: implement student-facing IELTS attempt UI for reading/listening/writing/speaking payloads and submit answers/files.
Done: student can start, save draft where allowed, submit, and see submitted state for each IELTS type.
Tests: answer serialization tests, backend payload validation tests, browser smoke for the route.
Out: NCE lesson attempts.

### PR-19: Add IELTS-Aware Teacher Grading

Scope: extend grading UI/backend validation for IELTS band descriptors, writing/speaking rubrics, and criteria scoring.
Done: teacher grades show IELTS criteria, enforce band ranges, compute totals consistently, and persist feedback.
Tests: scoring service, grade route, frontend grading form, and cross-course denial tests.
Out: AI scoring.

### PR-20: Add Signed File Review and Download

Scope: complete file review/download UI and backend authorization for assignment/submission files.
Done: authorized users access signed URLs; expired/forbidden files fail clearly.
Tests: backend file auth tests, frontend file action tests, student/teacher/admin route tests.
Out: virus scanning and cloud storage migration.

### PR-21: Add End-to-End Classroom Workflow Test

Scope: add one workflow for teacher create/publish, student submit, teacher grade, and student view feedback.
Done: scripted happy path runs in CI or documented local automation against seeded/mocked data.
Tests: Playwright or equivalent workflow plus existing unit/service gates.
Out: full visual regression suite.

## Phase 3: AI Assignment Feedback

### PR-22: Add AI Provider Configuration and Health Check

Scope: add backend env/config for `AI_PROVIDER`, local base URL, model, timeout, feature flag, and admin health endpoint.
Done: backend reports disabled, healthy, unhealthy, and misconfigured AI states without blocking app startup.
Tests: env parsing, health service success/timeout/error, and admin route auth tests.
Out: generating feedback.

### PR-23: Add Local OpenAI-Compatible Provider Adapter

Scope: implement provider interface and local chat-completions adapter for Ollama/LM Studio/llama.cpp style runtimes.
Done: adapter sends structured requests, enforces timeout, parses text/JSON, and maps provider errors.
Tests: mocked `fetch` tests for success, malformed response, timeout, refused connection, and non-2xx.
Out: streaming and multi-provider routing.

### PR-24: Add Feedback Draft Persistence Model

Scope: add Prisma models for AI feedback requests/drafts linked to submission, assignment, rubric, teacher, and grade.
Done: drafts store status, model metadata, prompt version, input hash, generated text, rubric suggestions, decisions, and timestamps.
Tests: migration plus service tests for create, update, reject, approve, list by submission, and unauthorized reads.
Out: prompt quality.

### PR-25: Create Assignment Feedback Prompt Templates

Scope: add versioned prompt builders for IELTS writing, IELTS speaking, generic text assignments, and NCE exercises.
Done: prompts include rubric criteria, instructions, submission text, teacher constraints, and JSON output schema.
Tests: structural/snapshot tests ensuring PII minimization fields and rubric criteria are included.
Out: model calls and UI.

### PR-26: Add Feedback Generation Service

Scope: generate AI feedback drafts for a single submission using provider adapter, prompts, and persisted drafts.
Done: authorized teachers/admins can request drafts; duplicate in-progress requests are prevented; failures are persisted.
Tests: authorized generation, cross-course denial, disabled AI, provider failure, duplicate request, and success tests.
Out: queue and teacher UI.

### PR-27: Queue Feedback Generation Jobs

Scope: run generation through pg-boss jobs instead of long HTTP requests.
Done: requests enqueue jobs, workers process drafts, retries use bounded backoff, and failures expose reasons.
Tests: enqueue/process/retry/fail job tests, status transition tests, offline-provider behavior.
Out: batch generation.

### PR-28: Add Teacher Review and Override API

Scope: add endpoints for viewing draft feedback, editing it, approving into `grades.feedback_md`, or rejecting it.
Done: approval atomically updates grade feedback and records teacher decision; rejection keeps draft for audit.
Tests: approve, edit-approve, reject, missing grade, unauthorized teacher, and already-published draft tests.
Out: frontend review UI.

### PR-29: Build Teacher Feedback Review UI

Scope: add grading-page controls to request AI draft feedback, monitor status, edit draft text, approve, or reject.
Done: no AI text becomes student-visible until teacher approval; states are clear and accessible.
Tests: hook/component tests for disabled/loading/failed/ready/approved states and route smoke with mocked API.
Out: student feedback page changes.

### PR-30: Add Student-Safe Feedback Display

Scope: ensure students only see teacher-approved feedback, never raw AI drafts or rejected draft metadata.
Done: student grade view displays final feedback/rubric breakdown and approved AI-assisted notes only.
Tests: backend grade read tests and frontend grade page tests for approved and draft-hidden states.
Out: grade visibility authorization already covered by PR-17.

### PR-31: Add AI Feedback Audit and Privacy Controls

Scope: audit generation requests, provider errors, teacher decisions, and published feedback updates with redaction.
Done: audit entries include actor, submission, model, prompt version, decision, and redacted payload summary.
Tests: audit tests for generate/approve/reject/fail, redaction tests, and no full submission text in logs.
Out: external compliance review.

### PR-32: Add Assignment Feedback Evaluation Fixtures

Scope: create deterministic fixtures for sample submissions, rubrics, provider outputs, and parser results.
Done: parser/output normalization has regression tests without requiring a real local model.
Tests: valid JSON, partial JSON, hallucinated criteria, unsafe advice, and empty feedback fixture tests.
Out: scoring-model accuracy benchmarks.

### PR-33: Add Local Model Setup Documentation

Scope: document local runtimes, env vars, model-size tradeoffs, startup commands, disable path, and fallback behavior.
Done: docs show local AI feedback with no cloud key and explain safe disablement.
Tests: verify docs commands on a local runtime or mark runtime-specific caveats clearly.
Out: shipping model weights.

### PR-34: Add Batch Draft Feedback for Teachers

Scope: allow teachers to request draft feedback for multiple submissions in one assignment.
Done: batch requests authorize course access, queue one job per submission, show per-submission status, and enforce concurrency limits.
Tests: batch enqueue, partial failure, duplicate suppression, and UI per-row status tests.
Out: automatic publishing.

### PR-35: Add NCE Exercise Feedback Prompts

Scope: add AI feedback for grammar, vocabulary, translation, dictation, sentence transformation, and recitation attempts.
Done: prompts use lesson objectives and expected answers to produce teacher-reviewable feedback and remediation hints.
Tests: prompt tests for each exercise type, parser tests, and mocked provider service tests.
Out: NCE schema creation.

### PR-36: Add Plagiarism and Authenticity Signals

Scope: add teacher-visible advisory signals for suspicious similarity, copied text, and off-task responses.
Done: signals are advisory, never punitive by themselves, and teachers can dismiss or note them.
Tests: copied sample, unrelated response, normal response, and false-positive dismissal fixtures.
Out: external plagiarism provider integration.

## Phase 4: NCE Product Core

### PR-37: Add NCE Content Schema and Seeds

Scope: add Prisma models for NCE books, levels, units, lessons, objectives, exercises, and publish state.
Done: migration applies cleanly; seed/reference script creates representative NCE content; IELTS remains intact.
Tests: Prisma shape tests, seed idempotency tests, migration deploy dry run on local DB.
Out: frontend authoring UI.

### PR-38: Add NCE Content APIs

Scope: create routes/services/schemas for listing books/units/lessons and reading published lesson content.
Done: public/student reads return published content; teacher/admin reads include drafts by permission.
Tests: published filtering, draft access, missing content, role denial, and OpenAPI validation.
Out: mutations and authoring.

### PR-39: Add Teacher NCE Lesson Authoring

Scope: implement teacher/admin create/update/publish/unpublish workflows for lessons and exercises.
Done: teachers author lessons for their courses, validate exercises/answer keys, and publish coherent sequences.
Tests: backend mutation tests, frontend form/hook tests, malformed exercise validation.
Out: student attempt UI.

### PR-40: Add Student NCE Lesson Path and Attempts

Scope: build student route for lesson sequence, exercise attempts, progress saving, and completion state.
Done: student opens assigned lessons, completes exercises, saves attempts, and sees next lesson/progress.
Tests: backend attempt service, frontend route/component tests, browser smoke for seeded lesson.
Out: spaced review.

### PR-41: Add Mastery, Remediation, and Review Scheduling

Scope: track objective mastery, weak areas, remediation recommendations, and spaced review due dates.
Done: attempts update mastery and produce review/remediation items visible to students and teachers.
Tests: mastery threshold, due-date calculation, and dashboard query tests.
Out: analytics exports.

## Phase 5: Operations and Admin Completeness

### PR-42: Add Audit Write Instrumentation

Scope: add audit writer helpers and instrument auth, user, course, assignment, submission, grade, CMS, and admin mutations.
Done: audit logs actor, action, entity, before/after summary, request metadata, and failure-safe behavior.
Tests: mutation tests assert audit entries; audit route tests verify admin-only reads/filtering.
Out: external log shipping.

### PR-43: Add Notification Retry, Dead Letter, and Resend

Scope: persist delivery attempts, failure reasons, retry/backoff, dead-letter state, and admin resend endpoint.
Done: failed deliveries retry predictably, stop after configured attempts, and can be resent by admin.
Tests: pg-boss fake-failure tests, backoff service tests, admin resend route tests.
Out: email provider migration.

### PR-44: Implement Cleanup and Retention Jobs

Scope: replace no-op cleanup handlers with retention for expired sessions, stale drafts, expired signed files, and old job logs.
Done: jobs are idempotent, configurable, logged, and support dry-run where destructive.
Tests: job dry-run/execute tests, cutoff tests, and audit entries for destructive cleanup.
Out: data warehouse archival.

### PR-45: Add CMS Admin Draft, Publish, and Revisions

Scope: build CMS CRUD for homepage/about/contact/CTA with draft/publish, preview, revisions, and audit entries.
Done: admins edit draft content, preview, publish, and roll back revisions.
Tests: backend CMS service/router tests, frontend admin form tests, public route published-only tests.
Out: rich media library.

### PR-46: Add Analytics Filters and Exports

Scope: add date, course, cohort, role filters, and CSV export for admin/teacher analytics.
Done: endpoints support filters, frontend persists selections, and exports match filtered data.
Tests: backend query tests, frontend hook/control tests, export content assertions.
Out: dashboard redesign.

### PR-47: Add Production Migration and Bootstrap Path

Scope: add `prisma migrate deploy` scripts, DB role prerequisite docs, and reference-data bootstrap separate from demo seeds.
Done: production-like clone can deploy migrations and bootstrap reference data without demo data/destructive resets.
Tests: local DB rehearsal docs with outputs, seed idempotency tests, README update.
Out: hosting provider provisioning.

## Phase 6: UX, Contract, and Polish

### PR-48: Sync OpenAPI with Runtime Endpoints

Scope: update OpenAPI for config endpoints, metrics, auth cookies, submission identity, grading, files, and course tabs.
Done: every active frontend-used endpoint has request/response schemas and auth/cookie behavior documented.
Tests: OpenAPI validation, selected backend contract tests, frontend schema conformance checks.
Out: replacing all handwritten frontend API types.

### PR-49: Add Public Mobile Navigation and Real Contact Flow

Scope: add mobile nav menu, live footer destinations, CMS-backed contact/CTA content, and contact submission endpoint/UI.
Done: mobile users navigate all public pages, footer links work, submissions persist/notify safely, and spam controls exist.
Tests: mobile nav browser/component tests, contact route tests, focus/keyboard accessibility checks.
Out: marketing copy rewrite.

### PR-50: Persist Profile and Settings Flows

Scope: wire student/teacher profile edits, admin profile route, and admin settings to API persistence.
Done: save/reload works by role, invalid fields show inline errors, and settings changes are audit logged.
Tests: backend route tests, frontend form tests, role access tests.
Out: avatar upload.

### PR-51: Add Screenshot-Based Visual QA

Scope: add browser smoke and screenshot checks for public pages, dashboards, course management, attempts, grading, and admin screens.
Done: tests run locally/CI, cover mobile/tablet/desktop, and fail on blank pages or layout-breaking console errors.
Tests: Playwright/browser suite with seeded or mocked API data; screenshots attached to CI artifacts.
Out: pixel-perfect thresholds for every component.

### PR-52: Refactor Remaining Oversized Files by Domain

Scope: split files over the 300-line guideline only when a clear domain boundary exists.
Done: each touched file has a header comment, single responsibility, preserved exports, and no behavior drift.
Tests: focused tests for each split domain plus build/typecheck; no broad formatting churn.
Out: mechanical repo-wide rewrites.

<!--
File: PROGRESS.md
Purpose: Track current high-level progress for the English education app by project area.
Why: A concise live log keeps recent backend and frontend status easy to review.
-->

# Progress Log

Earlier entries are archived by area in
[`docs/progress/backend-before-review-fixes-2026-07-24.md`](docs/progress/backend-before-review-fixes-2026-07-24.md)
and
[`docs/progress/frontend-before-review-fixes-2026-07-24.md`](docs/progress/frontend-before-review-fixes-2026-07-24.md).

## Backend

- **2026-07-29:** Required a complete unique upload-limit role set, rejected noncanonical stored byte values, enforced exact whole-MiB database writes, and documented inactive-user 403 profile responses.

- **2026-07-29:** Reused the shared PostgreSQL-safe Unicode boundary for profile names, rejecting NUL and unpaired surrogates before persistence while documenting the exact OpenAPI scalar-value contract.

- **2026-07-29:** Secured runtime upload-policy writes behind an admin-checked database function with optimistic concurrency, made profile updates and audits atomic, aligned name validation with Unicode code-point OpenAPI rules, and bootstrapped admin profile navigation.

- **2026-07-29:** Added authenticated profile-name persistence with bounded audit markers, plus admin-only per-role upload-limit settings backed by the runtime file-upload policy table and documented in OpenAPI.

- **2026-07-29:** Made the bounded contact rate-limit capacity purge scan every tracked expiry, preserving admission after backward wall-clock adjustments reorder expiration times.

- **2026-07-28:** Translated the verified Prisma raw-query envelope for contact idempotency payload mismatches into an exposed HTTP 409, documented the response, and added service and route regressions.

- **2026-07-28:** Validated honeypot type and Unicode-character bounds before spam masking, retained 202 responses for valid nonempty traps, and added real-route regressions for invalid JSON trap values.

- **2026-07-28:** Bound contact idempotency keys to canonical persisted fields with a forward migration, rejected NUL and unpaired-surrogate text before node-postgres encoding, and added real PostgreSQL conflict and Unicode round-trip coverage.

- **2026-07-28:** No backend files changed for the frontend test-runner memory correction.

- **2026-07-28:** No backend files changed for the mobile focus, contact retry identity, field-error persistence, and router-entry lifecycle fixes.

- **2026-07-27:** Kept active contact rate-limit counters stable under identity churn, failed closed at capacity until expiry, and restricted contact triage updates to status timestamps rather than submitted payloads.

- **2026-07-27:** Corrected the contact database boundary to connect as the runtime login before assuming request and service roles, and cast the execute-only function's void result to an adapter-supported type.

- **2026-07-27:** Hardened contact submissions with an execute-only security-definer write, idempotent retries, bounded abuse counters, indistinguishable honeypot outcomes, canonical validation, and a database-boundary regression.

- **2026-07-27:** Added validated, rate-limited, honeypot-protected public contact persistence with request metadata, least-privilege database access, route tests, and an OpenAPI contract.

- **2026-07-27:** Closed OpenAPI review gaps for arbitrary course JSON, objective conflicts, middleware/global errors, invite normalization and validation-safe examples, enabled tab filtering, and the CI validation gate with focused runtime-boundary regressions.

- **2026-07-27:** Synchronized OpenAPI with every mounted backend route, documented security-sensitive cookie, ownership, pagination, metric, and server-derived identity behavior, and added deterministic spec validation.

- **2026-07-27:** Locked and re-read grades inside AI approval/finalization transactions before deriving semantic feedback audit markers, preventing stale concurrent baselines.

- **2026-07-27:** Preserved grade attribution on semantic no-ops and made AI approval/finalization emit grade-feedback audit events only when committed feedback actually changes.

- **2026-07-26:** Restored the typed `AuditLogWriteInput` contract on failure-safe audit writes while retaining runtime handling for cast or untyped malformed values.

- **2026-07-26:** Removed canonical question IDs from AI explanation audit data and made failure-safe audit writes swallow malformed inputs while logging only static validation or persistence codes.

- **2026-07-26:** Split CMS semantic audit-marker regressions into a focused suite so the general CMS admin test remains below the 300-line repository limit.

- **2026-07-26:** Trusted only the configured AI provider model, separated canonical question and audit entity identity schemas from display/reference bounds, and derived course, grade, submission, and CMS audit markers from locked committed before/after values with no-op suppression.

- **2026-07-26:** Made assignment update audit baselines concurrency-safe by locking the scoped assignment row before reading, validating, updating, and deriving semantic markers.

- **2026-07-25:** Derived assignment and AI-policy audit markers from normalized committed before/after values, preventing full-form payloads and materialized defaults from producing false change flags.

- **2026-07-25:** Closed the remaining provider-response audit boundary by accepting only bounded model metadata and falling back to the validated configured model for unauditable provider labels.

- **2026-07-25:** Closed audit review gaps by aligning AI producer bounds with audit contracts, recording only committed retry states, recognizing rubric and adjustment grade mutations, and validating seed audit events against retained grade records.

- **2026-07-25:** Replaced heuristic audit redaction with strict versioned event contracts, migrated every audit producer to identifier/enum/count/marker-only data, removed AI and generic payload escape hatches, and added the intentional preproduction audit-history reset migration plus boundary regressions.

- **2026-07-25:** Refreshed Prisma, ESLint, PostCSS, brace-expansion, and Prisma tooling dependency resolutions after newly published npm advisories caused the upstream dependency-audit gate to fail.

- **2026-07-24:** Closed five database review findings by matching destructive demo seeds to the URL authority port, preflighting `service_role` grant authority, separating reference-lock wait and work budgets, extending standalone CMS seed transactions, and neutralizing ambient PostgreSQL startup options in administrative tests. Added focused policy, documentation, timeout, concurrency, and pool regressions, then clarified that the migration validates a pre-provisioned SET-only runtime grant.

- **2026-07-24:** Closed database-bootstrap review findings by stripping sensitive owner-child environment names case-insensitively, requiring raw demo confirmation, closing the CMS external pool, and making database-test cleanup failure-safe. Added spawned-child and lifecycle regressions, split runbook assertions, and archived older progress entries.

- **Archived milestone:** PR-40 introduced the NCE content schema and `seed:nce-content`; full details remain in the backend archive.

## Frontend

- **2026-07-29:** Reconciled authoritative profile GET and PATCH responses through one identity-guarded session/cache path, preserved save completion across draft cancellation, and cancelled stale settings reads before installing saved values.

- **2026-07-29:** Versioned refresh-time user snapshots so delayed token refreshes preserve newer profile saves, and merged background upload-limit data role-by-role without discarding dirty values or their conflict baselines.

- **2026-07-29:** Propagated abort signals through profile reads and cancelled exact in-flight identity queries before refreshed-auth or successful-save cache writes, preventing older `/me` responses from restoring stale names.

- **2026-07-29:** Kept identity generations stable across same-user token refreshes and synchronized independently cached profile data from refreshed auth responses, preserving successful PATCH retries without stale-name shadowing.

- **2026-07-29:** Bound profile saves and cache entries to session identity, preserved fresh and dirty drafts correctly, submitted only dirty upload-policy roles with conflict detection, exposed admin profile navigation, and hardened Vitest workers against orphaned-process memory growth.

- **2026-07-29:** Added controlled student, teacher, and admin profile editing with inline validation and synchronized auth/cache state; replaced cosmetic admin settings with persisted role upload limits.

- **2026-07-29:** Moved retry-key preparation into the serialized contact mutation lifecycle, surfaced unavailable crypto as a visible error, and restricted form resets to the active submission.

- **2026-07-28:** Kept unresolved contact retry identities authoritative in memory when per-tab storage remains readable but quota-blocked writes fail, with recovery and regression coverage.

- **2026-07-28:** Preserved unresolved contact retry identities across route remounts with a bounded, expiring per-tab registry; rendered mobile destinations as native router links; and aligned no-POST email validation with the backend Zod contract.

- **2026-07-28:** Aligned contact name, email, subject, and message length validation with OpenAPI Unicode code-point semantics and added astral-character boundary tests.

- **2026-07-28:** Preserved unresolved contact retry keys per canonical fingerprint across A/B/A edits and forwarded sheet overlay refs for warning-free Radix Presence cleanup.

- **2026-07-28:** Capped Node and Vitest file-level test concurrency at two workers, preventing multi-gigabyte aggregate memory spikes while retaining parallel execution and regression coverage.

- **2026-07-28:** Restored mobile-sheet trigger focus, closed overlays on full router-entry changes without remounting triggers, preserved canonical retry identities, and cleared only edited validation fields.

- **2026-07-27:** Centralized exact public-route matching through React Router so trailing-slash and case aliases retain desktop and mobile current-page semantics.

- **2026-07-27:** No frontend application files changed for the contact database role and adapter-compatibility CI corrections.

- **2026-07-27:** Froze in-flight contact snapshots, reused idempotency keys for safe retries, rendered canonical and backend field errors, invalidated mobile sheets across routes and desktop breakpoints, and exposed current-page semantics.

- **2026-07-27:** Added a keyboard-accessible mobile public navigation sheet, removed dead-end footer destinations, and connected the CMS contact form to recoverable submission states with component regressions.

- **2026-07-27:** Strengthened OpenAPI regressions with bidirectional route equality, stale-operation detection, runtime error-shape checks, normalization and example constraints, and CI-gate coverage.

- **2026-07-27:** Added a source-backed contract regression that inventories mounted backend routes and protects every frontend-used OpenAPI path plus the named security-sensitive contract details.

- **2026-07-27:** No frontend application files changed for the concurrency-safe AI grade-feedback audit comparison.

- **2026-07-27:** No frontend application files changed for the grade attribution and AI feedback audit-semantic fixes.

- **2026-07-26:** No frontend application files changed for the failure-safe audit writer type-contract correction.

- **2026-07-26:** No frontend application files changed for the audit question-ID privacy and failure-safe logging fixes.

- **2026-07-26:** No frontend application files changed for the CMS audit-test organization follow-up.

- **2026-07-26:** No frontend application files changed for the provider identity boundary and transactional semantic audit-marker fixes.

- **2026-07-26:** Preserved exact unchanged assignment deadlines through minute-only controls, including sub-minute precision and the original occurrence of repeated DST wall times.

- **2026-07-25:** Preserved assignment due-date instants across `datetime-local` editing by formatting API timestamps in the user's local wall-clock timezone before submission.

- **2026-07-25:** No frontend application files changed for the provider-response model metadata boundary fix.

- **2026-07-25:** Preserved audit `entityId` values through admin API mapping and displayed them in the audit table with mapper and rendered-component regressions.

- **2026-07-25:** Updated the admin audit API and table to consume and display `schemaVersion` plus typed `eventData` instead of the legacy `diff` response.

- **2026-07-25:** Refreshed PostCSS and brace-expansion resolutions after newly published npm advisories failed the upstream dependency-audit gate, while retaining the SPA-compatible React Router line because no published release currently has a clean audit.

- **2026-07-24:** No frontend application files changed for the database seed-policy, bootstrap privilege, timeout, administrative test-client fixes, or follow-up runbook clarification.

- **2026-07-24:** No frontend application files changed for the backend owner-job, seed-lifecycle, and database-test cleanup fixes.

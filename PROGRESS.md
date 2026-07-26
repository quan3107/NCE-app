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

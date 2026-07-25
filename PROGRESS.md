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

- **2026-07-25:** Refined audit metadata redaction with an explicit allowlist for CMS and dashboard identifiers while retaining credential, storage, signed-URL, private-content, nested-value, Date, and oversized-text protections.

- **2026-07-25:** Refreshed Prisma, ESLint, PostCSS, brace-expansion, and Prisma tooling dependency resolutions after newly published npm advisories caused the upstream dependency-audit gate to fail.

- **2026-07-24:** Closed five database review findings by matching destructive demo seeds to the URL authority port, preflighting `service_role` grant authority, separating reference-lock wait and work budgets, extending standalone CMS seed transactions, and neutralizing ambient PostgreSQL startup options in administrative tests. Added focused policy, documentation, timeout, concurrency, and pool regressions, then clarified that the migration validates a pre-provisioned SET-only runtime grant.

- **2026-07-24:** Closed database-bootstrap review findings by stripping sensitive owner-child environment names case-insensitively, requiring raw demo confirmation, closing the CMS external pool, and making database-test cleanup failure-safe. Added spawned-child and lifecycle regressions, split runbook assertions, and archived older progress entries.

- **Archived milestone:** PR-40 introduced the NCE content schema and `seed:nce-content`; full details remain in the backend archive.

## Frontend

- **2026-07-25:** No frontend application files changed for the audit metadata redaction refinement.

- **2026-07-25:** Refreshed PostCSS and brace-expansion resolutions after newly published npm advisories failed the upstream dependency-audit gate, while retaining the SPA-compatible React Router line because no published release currently has a clean audit.

- **2026-07-24:** No frontend application files changed for the database seed-policy, bootstrap privilege, timeout, administrative test-client fixes, or follow-up runbook clarification.

- **2026-07-24:** No frontend application files changed for the backend owner-job, seed-lifecycle, and database-test cleanup fixes.

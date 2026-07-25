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

- **2026-07-25:** Removed remaining audit representation gaps by recognizing auth families independent of suffix, detecting credential-shaped authorization schemes generically, restoring lowercase compact private-content keys, and guarding ordinary author/authority/context/sentence metadata from false positives.

- **2026-07-25:** Extracted semantic audit redaction classification to recognize credential key families regardless of position, credential-bearing authorization schemes by meaning, and camel/snake/kebab sensitive-content tokens without misclassifying ordinary `context` metadata.

- **2026-07-25:** Generalized audit credential detection across normalized authentication/session/JWT/bearer key families, authorization-header values, credential-bearing URI schemes, and OAuth code parameters, with descendant checks preventing hashes of every supported representation.

- **2026-07-25:** Closed remaining representation-dependent audit leaks by treating normalized path suffixes as sensitive and detecting credentials in HTTP(S) userinfo, query parameters, and fragments before either direct storage or sensitive-container hashing.

- **2026-07-25:** Hardened centralized audit redaction across before, after, diff, and request metadata by covering normalized credential/path/signed-URI aliases, detecting signed URL values, suppressing hashes for sensitive containers with secret descendants, and independently testing length boundaries and operational-key lookalikes.

- **2026-07-25:** Closed audit-redaction review gaps by preserving broad non-allowlisted key protection, redacting sensitive object and array subtrees, covering real key/path/URL aliases and raw-value absence, and qualifying immutable historical audit behavior.

- **2026-07-25:** Refined audit metadata redaction with an explicit allowlist for CMS and dashboard identifiers while retaining credential, storage, signed-URL, private-content, nested-value, Date, and oversized-text protections.

- **2026-07-25:** Refreshed Prisma, ESLint, PostCSS, brace-expansion, and Prisma tooling dependency resolutions after newly published npm advisories caused the upstream dependency-audit gate to fail.

- **2026-07-24:** Closed five database review findings by matching destructive demo seeds to the URL authority port, preflighting `service_role` grant authority, separating reference-lock wait and work budgets, extending standalone CMS seed transactions, and neutralizing ambient PostgreSQL startup options in administrative tests. Added focused policy, documentation, timeout, concurrency, and pool regressions, then clarified that the migration validates a pre-provisioned SET-only runtime grant.

- **2026-07-24:** Closed database-bootstrap review findings by stripping sensitive owner-child environment names case-insensitively, requiring raw demo confirmation, closing the CMS external pool, and making database-test cleanup failure-safe. Added spawned-child and lifecycle regressions, split runbook assertions, and archived older progress entries.

- **Archived milestone:** PR-40 introduced the NCE content schema and `seed:nce-content`; full details remain in the backend archive.

## Frontend

- **2026-07-25:** No frontend application files changed for the generic auth-family, authorization-scheme, or compact-content audit fix.

- **2026-07-25:** No frontend application files changed for the semantic credential-family and sensitive-content-token audit fix.

- **2026-07-25:** No frontend application files changed for the generalized credential-alias, URI, or authorization-value audit hardening.

- **2026-07-25:** No frontend application files changed for the path-alias and credential-URL audit hardening.

- **2026-07-25:** No frontend application files changed for the audit alias, signed-URL, or nested-credential hardening.

- **2026-07-25:** No frontend application files changed for the audit-redaction review fixes.

- **2026-07-25:** No frontend application files changed for the audit metadata redaction refinement.

- **2026-07-25:** Refreshed PostCSS and brace-expansion resolutions after newly published npm advisories failed the upstream dependency-audit gate, while retaining the SPA-compatible React Router line because no published release currently has a clean audit.

- **2026-07-24:** No frontend application files changed for the database seed-policy, bootstrap privilege, timeout, administrative test-client fixes, or follow-up runbook clarification.

- **2026-07-24:** No frontend application files changed for the backend owner-job, seed-lifecycle, and database-test cleanup fixes.

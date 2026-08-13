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

- **2026-08-13:** Executed PostgreSQL session-family advisory locks as raw commands so Prisma does not deserialize the lock function's `void` result, preserving refresh/logout serialization in live database tests.

- **2026-08-13:** Serialized refresh rotation, logout, and reuse revocation through one PostgreSQL session-family lock; committed reuse/claim revocation before returning 401; and added monotonic, conditional profile revisions across Prisma, migration, service, OpenAPI, unit, and database concurrency coverage.

- **2026-08-10:** No backend files changed while making frontend cancellation preserve server-side refresh rotation ordering; the seeded backend verified all eight live-browser auth and mutation scenarios.

- **2026-08-10:** Bound access tokens to revocable refresh-session families, revoked the full originating family on logout, and made request authority validate the current server-side user role/status so storage-denied clients cannot retain stale access.

- **2026-08-10:** No backend files changed while preventing obsolete queued frontend refreshes from revoking a newer login session.

- **2026-08-10:** No backend files changed while fixing frontend role-scope profile ownership and the local required-auth error contract.

- **2026-08-10:** No backend files changed while closing frontend auth release gaps; real-backend scenarios were migrated to the existing server cookie and `/me` contracts.

- **2026-08-10:** No backend files changed for the frontend auth/session architecture correction; existing API and HttpOnly refresh-cookie contracts remain unchanged.

- **2026-08-10:** No backend files changed while extracting the frontend authentication restoration baseline and profile-save lifecycle into focused modules for file-size compliance.

- **2026-08-10:** Refreshed dependency resolutions for patched brace expansion, URI parsing, and Nano ID releases after newly published high-severity advisories failed the backend audit gate.

- **2026-08-10:** No backend files changed while correcting frontend reload identity fencing and profile write/reconciliation lifecycle reporting.

- **2026-08-03:** No backend files changed while assigning OAuth lease cleanup to exactly one frontend cancellation path and making peers consume ordered logout tombstones from failed-persistence snapshot removals.

- **2026-08-03:** No backend files changed while extending the live-backend browser gate to restore profile and upload-policy mutations after authoritative round-trip checks.

- **2026-08-03:** No backend files changed while namespacing fallback profile publication IDs with stable per-tab entropy.

- **2026-08-03:** No backend files changed while making profile invalidation dual-publish across BroadcastChannel and localStorage with deduplicated peer consumption.

- **2026-08-03:** No backend files changed while disabling automatic browser launches for frontend development servers.

- **2026-08-03:** No backend files changed while compensating rejected browser auth persistence and replacing client-ordered profile propagation with authoritative refetches.

- **2026-08-02:** Added a follow-up upload-policy migration that validates extension arrays by dimension, nullability, and individual canonical tokens, with live PostgreSQL regressions for comma-packed, null, and multidimensional inputs.

- **2026-08-02:** Removed a redundant raw-token duplicate from the upload-policy migration fixture so the live database regression reaches canonical valid-winner repair without failing the preexisting unique constraint.

- **2026-08-02:** Preserved valid upload-type winners during canonical duplicate repair, aligned normalized display-name OpenAPI inputs with runtime trimming, and enforced audit registry/document inventory parity including strict upload-limit settings events.

- **2026-08-02:** No backend files changed while making unavailable-storage authority reductions locally authoritative and removing superseded stronger browser snapshots.

- **2026-08-02:** No backend files changed while separating rejected live-session publication from unavailable-storage logout and role-reduction fencing.

- **2026-08-02:** Matched portable display-name patterns exactly to runtime Unicode control validation and added exhaustive all-scalar contract parity coverage.

- **2026-08-02:** Rejected blank upload MIME requests and malformed normalized allow-list rows, added a repair-and-constraint migration for persisted type data, made display-name OpenAPI patterns portable to default JavaScript regex consumers, and documented strict profile-update audits.

- **2026-08-01:** Moved equal-value upload-limit CAS locking into the security-definer database function so the least-privilege runtime role needs no direct UPDATE grant.

- **2026-08-01:** Enforced optimistic concurrency for equal-value upload-limit submissions with a locked expected-value read, and corrected the documented live-browser CORS allowlist.

- **2026-08-01:** Kept backend behavior unchanged while isolating the real `/me` response asserted by the frontend cross-tab logout ordering regression from concurrent app-owned profile requests.

- **2026-08-01:** No backend files changed while stabilizing the frontend cookie-queue deadline regression under coverage instrumentation.

- **2026-08-01:** No backend files changed while replacing the frontend initials fallback with complete Unicode grapheme segmentation.

- **2026-08-01:** Kept backend runtime behavior unchanged while making the cross-tab logout browser regression obtain and assert its triggering 401 from the real authenticated `/me` boundary.

- **2026-08-01:** Raised the authentication route-attempt allowance only for the seeded live-browser CI server so concurrent cookie restoration and rotation checks do not exhaust the three-attempt test default; runtime defaults remain unchanged.

- **2026-08-01:** Made settings reads lock and authorize administrators in one transaction, restored UUID primary-key actor lookups, quarantined unsafe historical identity names during upgrade, and added PostgreSQL concurrency, plan, role-state, and migration probes.

- **2026-08-01:** Removed fabricated upload-policy limits and file types; absent policy rows or empty allowed-type sets now stop configuration and signing flows with an internal configuration error.

- **2026-07-31:** Preserved persisted upload byte/count limits when type rows are corrupt, allowed the real-browser origin under repository defaults, and added seeded live-backend browser coverage to CI.

- **2026-07-31:** No backend files changed while making the default browser suite require a live backend and dedicated active test accounts.

- **2026-07-31:** Required active persisted users on `/me` reads and active persisted administrators on every settings read/write, locking the settings actor through no-op checks, writes, and audit creation.

- **2026-07-31:** Made upload-policy database actors supply Prisma-managed UUID and update timestamps during raw-SQL fixture creation.

- **2026-07-31:** Corrected upload-policy administrator authorization and its database fixtures to use the quoted physical `users."deletedAt"` column.

- **2026-07-31:** Locked upload-policy writes to the active, non-deleted database administrator row and made display-name responses tolerate legacy stored values while retaining canonical write contracts.

- **2026-07-31:** No backend files changed for the OAuth reservation ownership fallback correction.

- **2026-07-31:** No backend files changed for the IndexedDB-backed OAuth reservation correction.

- **2026-07-31:** No backend files changed for the consistent cross-tab authentication lock-boundary correction.

- **2026-07-31:** Added machine-checkable OpenAPI constraints for whitespace-normalized display-name inputs, including Unicode scalar, control-character, and post-trim length boundaries.

- **2026-07-30:** Required an active database user inside the atomic profile-write transaction and separated whitespace-normalized display-name request contracts from canonical responses and profile PATCH inputs.

- **2026-07-29:** Added an idempotent migration for existing admin Profile navigation, renamed upload-limit API units to MiB, and documented explicit settings runtime failures.

- **2026-07-29:** Routed Google-provisioned display names and email-derived fallbacks through the shared persistence-safe name policy before creating OAuth users.

- **2026-07-29:** No backend files changed for the frontend profile-cache test isolation correction.

- **2026-07-29:** Repaired and constrained upload-policy storage through a forward migration, and unified profile, registration, creation, and invitation display names behind PostgreSQL-safe printable Unicode validation.

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

- **2026-08-13:** No frontend files changed for the backend PostgreSQL advisory-lock adapter correction.

- **2026-08-13:** Compensated cancelled OAuth rotations, deduplicated acknowledged invalidation catch-up, bound request admissions to disposable provider instances with fail-closed bridge reset, and enforced server profile revisions so stale PATCH/GET responses cannot replace newer cache state.

- **2026-08-10:** Separated caller cancellation from active cookie-request cancellation so refresh rotation stays serialized until the server settles, suppressed superseded refresh UI application, and aligned OAuth, timeout, synthetic, and real-backend regressions with the fail-closed queue contract.

- **2026-08-10:** Closed OAuth bootstrap ordering, pre-delivery cross-tab, anonymous optional-request, profile ownership, public IELTS config, and login-profile provenance gaps with lifecycle-bound authority regressions.

- **2026-08-10:** Revalidated queued refresh authority after acquiring the serialized cookie boundary, preventing a superseded peer refresh from rotating and revoking a newer login; added a lock-order regression for the CI-discovered race.

- **2026-08-10:** Restarted active `/me` ownership when the same user changes role without restarting for token rotation, and restored `ApiError` wrapping for anonymous required requests.

- **2026-08-10:** Scoped refresh single-flight to auth revisions, made active `/me` globally observed across routes, hardened auth invalidation publication identity/deduplication, simplified coordinator admission, and migrated Playwright auth setup away from legacy storage authority.

- **2026-08-10:** Replaced persisted bearer/profile replication with one booting/anonymous/authenticated in-memory coordinator, invalidation-only cross-tab revalidation, explicit request auth admission, actor-scoped cancellation/cache isolation, authoritative `/me` cache ownership, retryable transient profile errors, and synthetic auth-race CI coverage.

- **2026-08-10:** Extracted authentication restoration-baseline and profile-save lifecycle state into focused hooks, returning both consuming files below 300 lines and adding a regression that enforces the limit.

- **2026-08-10:** Refreshed dependency resolutions for patched brace expansion, Nano ID, HTTP client, and DOM sanitization releases after newly published advisories failed the frontend audit gate; retained the React Router 6 line pending a separate major-version migration.

- **2026-08-10:** Preserved validated provisional identity/role baselines across reload restoration so same-user refreshes keep peer requests alive, while real account or role changes still advance the shared epoch; committed confirmed profile PATCH responses before guarded reconciliation so GET failures report synchronization issues and late responses preserve newer drafts.

- **2026-08-03:** Assigned OAuth cancellation cleanup to one owner and converted authenticated storage removals into ordered logout tombstones, preventing competing lease release and stale peer authority when notification publication fails.

- **2026-08-03:** Verified destructive auth snapshot removal, kept restored bearers provisional until refresh, made BroadcastChannel notifications exception-safe, derived the Playwright server address from its configured URL, added restorable live profile/settings mutations, and split oversized profile validation coverage.

- **2026-08-03:** Made OAuth cancellation coverage await complete lease cleanup, preventing stale asynchronous teardown from making the following persistence-rejection regression flaky in CI.

- **2026-08-03:** Namespaced fallback profile invalidation IDs with a stable random publisher identity per tab, preventing cross-tab deduplication collisions when `randomUUID` is unavailable.

- **2026-08-03:** Published every profile invalidation through BroadcastChannel and localStorage, deduplicating shared publication IDs so mixed-capability peer tabs refetch exactly once.

- **2026-08-03:** Disabled Vite's automatic browser launch so repeated development-server starts remain in the terminal without stealing focus.

- **2026-08-03:** Revoked refresh cookies with fresh cleanup deadlines after rejected login, registration, refresh, or OAuth persistence, and replaced client-ordered profile response broadcasts with cross-tab invalidation plus guarded authoritative `/me` refetches.

- **2026-08-02:** Revoked cookies from rejected live logins, fenced failed refreshes against complete stored session versions, propagated same-session profile revisions despite storage failure, and made the live backend gates verify cookie revocation plus bearer-authenticated profile identity.

- **2026-08-02:** Cancelled unfinished OAuth completion from the callback route's actual unmount lifecycle and added a route-departure regression alongside the lower-level cancellation check.

- **2026-08-02:** Retired prior actors on unpersistable account switches, surfaced retryable server-logout failures, required authoritative profile baselines for editing, and made OAuth completion and abandoned-lease cleanup lifecycle-cancellable and deadline-bounded.

- **2026-08-02:** Applied volatile same-user role reductions to the initiating session as well as peers, aborted older bearer work, and removed persisted higher-authority snapshots when replacement writes fail.

- **2026-08-02:** Stopped unavailable-storage live logins from broadcasting sessions their initiating tab rejects, while retaining cross-tab fencing for logout and same-identity role downgrades.

- **2026-08-02:** Kept logout request fencing and cross-tab broadcasts active when both auth snapshot stores reject writes, with boundary and real-backend two-page regressions.

- **2026-08-02:** Preserved reload restoration through a per-tab auth snapshot when shared `localStorage` writes fail, while reporting that fallback distinctly from a shared commit.

- **2026-08-01:** Extended shared-epoch validation across bearer response acceptance and refresh retry admission, closing the event-delivery window after initial request admission.

- **2026-08-01:** Blocked bearer requests when storage already carries a newer cross-tab epoch and reset administrator settings drafts on authenticated session-generation changes.

- **2026-08-01:** Scoped the live cross-tab logout assertion to its marked invalid-bearer `/me` request so concurrent navigation/profile fetches cannot inflate the real 401 count.

- **2026-08-01:** Made cookie-queue deadline coverage deterministic by synchronizing a long-lived blocker before enqueuing a separately configured short-deadline operation.

- **2026-08-01:** Replaced the partial initials fallback with deterministic Unicode 17 UAX #29 segmentation, preserving Indic conjuncts, Hangul Jamo syllables, and Prepend sequences even without `Intl.Segmenter`.

- **2026-08-01:** Replaced the synthetic `/me` denial in live cross-tab ordering coverage with an invalid-bearer request to the real API, and added a grapheme-preserving initials fallback for browsers without `Intl.Segmenter`.

- **2026-08-01:** Stabilized the two-worker live-backend browser gate by provisioning enough local test-server refresh attempts for startup restoration and explicit cookie lifecycle coverage; no frontend runtime behavior changed.

- **2026-08-01:** Bound refresh retries to committed cross-tab snapshots, applied last-admitted login intent, ended terminal profile sessions, preserved grapheme initials, split oversized race suites, and expanded real-backend cookie/logout ordering coverage.

- **2026-08-01:** Removed the unsafe IndexedDB cookie-writer fallback and made refresh-cookie operations fail closed without Web Locks, with browser coverage proving no request starts and no cookie session is created.

- **2026-07-31:** Bounded complete auth-cookie lifecycles, renewed and fenced IndexedDB writers, suppressed stale login/registration commits, reused display-name validation across registration and admin creation, and exercised seeded real-backend sessions in CI.

- **2026-07-31:** Restricted default Playwright coverage to live-backend login and profile checks using environment-supplied account passwords, moving route-intercepted workflows behind an explicit mocked command.

- **2026-07-31:** Published ordered cross-tab session epochs, aborted stale bearer requests and refreshes, cleared authenticated caches in every tab, coordinated OAuth cleanup with restoration, preserved persistence on unmount cancellation, and split real-backend Playwright checks from the opt-in synthetic cookie harness.

- **2026-07-31:** Separated OAuth lock admission from network deadlines, invalidated authenticated caches on same-user role changes, preserved only editable profile fields across refresh races, and surfaced complete display-name validation feedback.

- **2026-07-31:** Allowed auth operations to proceed when session storage is unavailable and no authoritative OAuth reservation exists, while failing closed when active reservation ownership cannot be proven.

- **2026-07-31:** Moved OAuth reservations into the authoritative IndexedDB coordination database, so unreadable localStorage cannot make another tab bypass an active OAuth flow.

- **2026-07-31:** Routed every no-Web-Locks auth-cookie operation through one IndexedDB lease boundary, preventing readable, unreadable, and non-enumerable localStorage states from splitting cross-tab coordination.

- **2026-07-31:** Preserved cross-tab auth-cookie serialization through an atomic IndexedDB lease when Web Locks or localStorage locking is unavailable, with two-page access-denial and write-failure regressions.

- **2026-07-30:** Namespaced and atomically cleared authenticated queries across account generations, rejected late prior-session responses, recovered OAuth leases on cancellation and password fallback, made auth persistence failure-safe, terminated sessions on authorization drift, and added bounded upload-policy revalidation.

- **2026-07-29:** Added a recoverable localStorage mutex when Web Locks are unavailable and reconciled stale tabs to the authoritative identity returned by the shared refresh cookie.

- **2026-07-29:** Coordinated auth-cookie mutations across tabs and OAuth redirects, isolated upload-policy caches by role/session with cancellation, reused Unicode-safe shell initials, dedicated the E2E frontend port, labeled upload limits as MiB, and restored the profile header action layout.

- **2026-07-29:** Bound 401 retries to their initiating session, added abortable deadlines to every serialized auth-cookie mutation with late-response browser coverage, and made profile initials Unicode code-point safe.

- **2026-07-29:** Extracted refresh, restore, cancellation, and auth-bridge lifecycle coordination into a focused runtime hook, returning `AuthProvider` to its user-facing action and context boundary under the 300-line limit.

- **2026-07-29:** Made refresh-cookie serialization interruptible with a hard timeout, cleared logout identity immediately and again at its queued boundary, and verified hung-refresh cancellation with component, queue, and real-browser cookie regressions.

- **2026-07-29:** Serialized refresh-cookie mutations across refresh, login, registration, and logout so delayed responses cannot overwrite a newer account cookie; added a real Chromium/HTTP regression for the cross-session `Set-Cookie` race.

- **2026-07-29:** Mounted the authoritative identity profile observer in the profile commit-order regression, preventing zero-GC cache cleanup from making parallel component CI flaky.

- **2026-07-29:** Bound refresh retries and returned tokens to the initiating session, and scoped asynchronous profile commit ordering by account identity and generation.

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

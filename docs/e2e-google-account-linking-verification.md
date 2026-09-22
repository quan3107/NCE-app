<!-- Scope: DG-03. Purpose: Record real Google OAuth and account-linking verification. -->
# Google and password account linking verification

**DG-03: PASS — 2026-09-22.** Verified with the in-app Browser, the actual application API at `http://localhost:4000`, frontend at `http://localhost:3000`, and a disposable PostgreSQL 17 database named `nce_google_link` on port 55444. Google authorization used the configured real OAuth client and an existing signed-in Google account. The test-provider fixture was disabled. No browser/API responses, Google authorization, token verification, or provider acceptance were mocked in this acceptance run.

## Implemented contract

- A verified Google email matching an active password account produces a confirmation dialog, without creating an identity, session, or duplicate user. The user must explicitly select **Link accounts** and verify the existing account's password.
- Five-minute proofs live in a service-role-only table. The browser receives a random HttpOnly, SameSite=Lax cookie (Secure in production); the database stores its hash. Mutations additionally require the challenge ID obtained by the same browser. Subject, issuer, account, email, and password fingerprint come from server state, never from the confirmation body.
- Confirmation locks the original account, rechecks expiry, status, deletion, email, and password, rejects identity conflicts, and atomically creates the identity and consumes the proof. Cancellation takes the same lock. A cancelled, expired, replaced, or consumed proof cannot authorize a link. A confirmation that wins a race cannot be misreported as a successful cancellation.
- Incorrect passwords leave identities unlinked and share the existing account/IP password-login limiter. New Google attempts replace earlier proofs for the same account. Unique identity constraints remain authoritative for concurrent conflicts.
- Linking preserves the original account and data. It does not issue a session: the success dialog offers **Continue with Google** and **Sign in with password**, both using the existing authentication flow. A lost success response can be recovered by starting sign-in again. Existing suspended, pending, deleted-account, and identity restrictions remain enforced.

## Real Browser/API/database acceptance

1. Created a disposable password account matching the signed-in Google account. Real Google OAuth returned the new linking dialog. PostgreSQL showed one account, zero Google identities, and zero sessions before consent.
2. Submitted an incorrect password. The dialog displayed the server rejection, cleared the password, and allowed retry. Database checks confirmed zero identities and sessions.
3. Selected **Cancel**. Browser returned to login; the server removed the proof and left the account unlinked. Repeated real OAuth issued a fresh proof.
4. With the user's explicit local-test confirmation, submitted the correct existing password. Browser showed **Google account linked**. PostgreSQL confirmed one identity on the original account, no duplicate email owner, and zero remaining proofs. Complete account-row and enrollment-row snapshots were identical before and after linking, including the existing password hash, display name, course enrollment, and reminder preference.
5. Selected **Continue with Google**, completed real Google OAuth again, and reached the original student's dashboard with its preserved name and course. Logged out, signed in with the original password, and reached the same dashboard. Server audit rows recorded both login methods for the same original user ID.
6. Suspended only the disposable account and repeated genuine Google authentication. The application denied sign-in and issued no additional successful-login event. Restored the fixture afterward.
7. Removed only the disposable identity to test another fresh real OAuth proof. Moved that proof's server expiry into the past while the dialog was open. Correct-password confirmation failed; no identity was created. The dialog disabled further confirmation and provided a working return to login.
8. Obtained another proof through real Google OAuth. Inserted a controlled identity conflict in the disposable database after the callback, then submitted the correct password. The server rejected the link; database checks confirmed the conflicting identity retained its owner and the target account remained unlinked.
9. Changed the target account to pending, then soft-deleted, while that genuine proof existed. Reloading the dialog denied access in both cases. Restored the fixture, cancelled the pending proof through the real API, and revisited the callback URL: it was rejected as invalid/expired and could not confirm a link.

Confirmation, password-error, success, dashboard, suspension, and conflict screenshots were inspected for readable layout and usable controls. All live test data belonged to this disposable database; production data and Google account settings were unchanged.

## Regression and database checks

- Backend: 1,092 standard tests passed; 80 environment-gated tests were skipped in that run. Separately enabled 29 real PostgreSQL authentication tests passed, including 16 linking tests plus password-recovery/session regressions. Lint and TypeScript build passed.
- Frontend: 270 unit tests and 267 component tests passed; lint, typecheck, and production build passed. Component coverage includes explicit consent, password rejection, cancellation, expiry recovery, and cancellation completing after navigation.
- All 83 migrations applied; authoritative migration history and bidirectional Prisma schema comparisons passed. Linking-table privilege checks denied Data API and ordinary backend request roles. OpenAPI validation and the source-backed route/contract inventory passed.
- Linking database tests use explicitly synthetic verified-profile inputs to isolate persistence, concurrency, rollback, issuer/subject conflicts, status/password/email changes, cancellation races, and rate limits. Those tests do not stand in for the real Google acceptance above. Real database failures and concurrent transactions are exercised without mocking persistence.
- The existing local-provider Playwright helper now supplies explicit consent/password when a seeded account needs linking. That separate synthetic-provider suite was not used or run for this acceptance; the real Google Browser flow above was used instead.

Evidence logs are under `/tmp/nce-google-link`. Credentials, Google subject IDs, browser cookies, personal email addresses, and disposable passwords are excluded from this document and the patch. Disposable verification resources are cleaned up after checks. The password limiter retains the application's existing process-local scope; this change does not introduce a distributed limiter.

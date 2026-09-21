<!--
File: docs/e2e-password-recovery-verification.md
Purpose: Record real password-recovery acceptance evidence and delivery limitations.
Why: Implementation and isolated tests must not be mistaken for a delivered-email E2E pass.
-->

# Password recovery verification — 2026-09-21

DG-01 **PASSES** the real Browser/API/database acceptance flow. After the user
reactivated the API key and authorized the sending IP, the real Browser retry
at 12:17 UTC was accepted by Brevo. The user confirmed receipt of the reset
email. The message was then read directly in Gmail through in-app Browser, and
its actual link opened the reset form. Its SHA-256 digest matches PostgreSQL's
stored, unexpired token with the expected 30-minute lifetime.
The user completed password entry and submission through the emailed link.
At 12:27 UTC, live verification proved the token was consumed, all prior sessions
were revoked, and the old password was rejected. In-app Browser then signed in
successfully with the new test password and displayed the student dashboard.
Earlier disabled-key and unauthorized-IP attempts returned 401; their failed
issuances were invalidated.

## Environment and boundaries

- Saved repository, branch `implement-password-recovery`; no worktree.
- Frontend `http://127.0.0.1:3015`, real API `http://127.0.0.1:4010/api/v1`.
- Disposable PostgreSQL 17 container `nce-password-recovery-20260921`, database
  `nce_recovery` on loopback port 55441. Runtime uses the least-privilege
  `nce_runtime` login; owner credentials are limited to fixtures and migrations.
- All 79 migrations replayed from a fresh database, with pg-boss installed first.
  Exact deployed history, unchanged base migration history, both Prisma schema
  diffs, and the SQL governance probe pass.
- Existing Brevo integration and configured credentials were used. Only the
  recipient explicitly supplied by the user was targeted by a live send.
- No API responses, session validation, or database acceptance behavior were mocked.
  Initial provider-independent valid/expired cases used explicit database
  fixtures. The final successful reset used the actual Brevo-delivered email
  link, read in Gmail through Browser, with user-assisted credential submission.
- Local raw evidence is under `/tmp/nce-password-recovery`; temporary tokens,
  passwords, private keys, and session cookies are not committed.

## Results

| Check | Evidence and result |
| --- | --- |
| Login entry point | In-app Browser followed the real Forgot password link to the request form. |
| Existing email | Browser submitted the controlled account email; real API returned the generic acknowledgment. After key/IP configuration was corrected, Brevo accepted the retry. Receipt was confirmed by the user and directly in Gmail through Browser. The actual email link opened the reset form and its digest matched the live database token. Earlier failed issuances were invalidated. |
| Unknown email | Browser submitted a nonexistent reserved-domain email; the same generic acknowledgment appeared. No mail was sent. |
| Account policy | Real database tests reject pending, suspended, Google-only, and soft-deleted accounts. HTTP requests for unknown and suspended accounts return identical 200/message responses. |
| Token security | Unit checks verify random 256-bit token, SHA-256-only storage, normalized recipient, 30-minute expiry, and fragment link. Real DB checks verify one concurrent consumption succeeds and the token is cleared. |
| Cooldown and rate limits | Database cooldown preserves a newly issued token without sending another email. Both HTTP routes pass the existing IP rate-limit regression tests. |
| Valid reset | Initial real HTTP fixture reset returned 200. Final acceptance used the actual delivered link: the user submitted the new password, the live database confirmed token consumption, and Browser sign-in with the new password succeeded. |
| Password policy | Short passwords return 400 without consuming the token; the subsequent compliant reset succeeds. |
| Expiry and reuse | Real external HTTP requests reject expired and consumed fixture tokens with 400. Reuse of the actual emailed token also returned 400 after the user completed the reset. |
| Old/new password | Real HTTP login rejects the old password with 401. In-app Browser signs in with the user-supplied new test password and displays the student dashboard and success notification. |
| All sessions revoked | After the actual emailed-link reset, both saved independent sessions returned 401 for bearer access to `/me` and refresh-cookie access. Both access tokens were still within their original expiry. PostgreSQL showed zero unrevoked sessions before the new-password login. |
| Concurrent login/refresh | PostgreSQL lock-barrier test makes login and refresh read old credentials while reset waits. After reset commits, both fail with 401 and no unrevoked session survives. |
| Atomic failure | A temporary PostgreSQL trigger rejects session revocation; password and token changes roll back. The trigger is removed in test cleanup. |
| Browser layout | Request acknowledgment and reset form screenshots were visually inspected. Labels, one page heading, keyboard form controls, feedback focus, and recovery/sign-in links are present. |
| Browser reset submission | User performed credential entry/submission, then returned to sign-in. The post-reset state was independently verified through the real API/database and successful Browser login. The transient reset-success screen was not captured; the subsequent dashboard screenshot was visually inspected. |

## Automated validation

- Backend full suite: 1,090 passed; 49 skipped at that run. Subsequent focused
  auth checks pass; database-only recovery/family tests run separately.
- PostgreSQL recovery and existing family-serialization tests: 13 passed.
- Frontend: 270 unit tests and 249 rendered component tests passed.
- Backend/frontend lint, backend TypeScript build, frontend typecheck and
  production build, new-file formatting, OpenAPI validation, and migration
  checks passed.

## Deployment and follow-up

Deploy the forward migration before the backend. Recovery links use the first
configured `CORS_ALLOWED_ORIGINS` entry; it must be the intended frontend origin
and use HTTPS in production. Request delivery is asynchronous and best-effort;
provider failure invalidates that issuance without changing the generic response.
The recipient cooldown is database-backed; IP throttling retains the app's
existing per-process limiter behavior.

The key and sending-IP configuration are now working. Controlled-recipient
delivery, the user-assisted emailed-link reset, new-password Browser sign-in,
and rejection of retained pre-reset sessions are verified. All PR checks passed
on the implementation head. No production account or database was modified.

After verification, the Browser session was signed out, the temporary API and
frontend servers were stopped, and the disposable PostgreSQL container and its
volume were removed. Temporary signing keys and saved session fixtures were
deleted.

## Delayed reset navigation follow-up

A review found that a successful reset finishing after navigation could rewrite
the address bar to `/reset-password` while the request form remained visible.
The recovery form now uses the existing mutation lifetime guard before applying
success, error, pending-state, or URL effects after an asynchronous response.
Successful active forms clear pending state before removing the token fragment.

Permanent BrowserRouter regressions cover late success and failure after using
“Request a new reset link,” with the production reset/request route keys. The
destination URL, email draft, feedback, and enabled submit button stay intact.
All 251 component tests, frontend lint, typecheck, and build pass.

The real Chromium/API/PostgreSQL rerun used a disposable account and explicit
database token fixture; it did not send another email or mock any API response.
A PostgreSQL row lock held the actual reset pending, and the test observed the
API connection waiting on that lock before navigating to `/forgot-password`.
Releasing the lock returned HTTP 200. The destination URL and email draft stayed
intact, reload showed the request form, and PostgreSQL confirmed the password
changed and token was consumed. The reload screenshot was visually inspected.
Evidence: `/tmp/nce-password-recovery/navigation-evidence.json` and
`navigation-after-reload.png`. The disposable environment was removed afterward.

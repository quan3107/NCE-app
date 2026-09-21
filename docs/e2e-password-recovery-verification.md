<!--
File: docs/e2e-password-recovery-verification.md
Purpose: Record real password-recovery acceptance evidence and delivery limitations.
Why: Implementation and isolated tests must not be mistaken for a delivered-email E2E pass.
-->

# Password recovery verification — 2026-09-21

DG-01 is implemented but **BLOCKED for full acceptance**. After the user
reactivated the API key, the real Browser retry at 12:15 UTC returned a new
Brevo HTTP 401: the sending machine's IP is not authorized. The previous attempt
returned `API Key is not enabled`. No email delivery or emailed-link round trip
is claimed. The failed retry token was invalidated in PostgreSQL.

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
  Provider-independent valid/expired tokens were explicit database fixtures;
  they were not recovered from a delivered email.
- Local raw evidence is under `/tmp/nce-password-recovery`; temporary tokens,
  passwords, private keys, and session cookies are not committed.

## Results

| Check | Evidence and result |
| --- | --- |
| Login entry point | In-app Browser followed the real Forgot password link to the request form. |
| Existing email | Browser submitted the controlled account email; real API returned the generic acknowledgment. Brevo rejected delivery with 401. The failed issuance was invalidated. |
| Unknown email | Browser submitted a nonexistent reserved-domain email; the same generic acknowledgment appeared. No mail was sent. |
| Account policy | Real database tests reject pending, suspended, Google-only, and soft-deleted accounts. HTTP requests for unknown and suspended accounts return identical 200/message responses. |
| Token security | Unit checks verify random 256-bit token, SHA-256-only storage, normalized recipient, 30-minute expiry, and fragment link. Real DB checks verify one concurrent consumption succeeds and the token is cleared. |
| Cooldown and rate limits | Database cooldown preserves a newly issued token without sending another email. Both HTTP routes pass the existing IP rate-limit regression tests. |
| Valid reset | Real external HTTP request changes the password with a fixture token and returns 200. |
| Password policy | Short passwords return 400 without consuming the token; the subsequent compliant reset succeeds. |
| Expiry and reuse | Real external HTTP requests reject expired and consumed fixture tokens with 400. |
| Old/new password | Real HTTP login rejects the old password with 401 and accepts the new password with 200. |
| All sessions revoked | Two independently created HTTP sessions lose both bearer access to `/me` and refresh-cookie access with 401 after reset. |
| Concurrent login/refresh | PostgreSQL lock-barrier test makes login and refresh read old credentials while reset waits. After reset commits, both fail with 401 and no unrevoked session survives. |
| Atomic failure | A temporary PostgreSQL trigger rejects session revocation; password and token changes roll back. The trigger is removed in test cleanup. |
| Browser layout | Request acknowledgment and reset form screenshots were visually inspected. Labels, one page heading, keyboard form controls, feedback focus, and recovery/sign-in links are present. |
| Browser reset submission | Manual credential-entry handoff requested under Browser Use policy; completion is not yet verified. |

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

Authorize the sending machine's IP in Brevo and repeat the controlled-recipient
delivered-email round trip before marking DG-01 PASS. The key has been reactivated;
the remaining provider blocker is the IP allowlist. All PR checks passed on the
implementation head. Complete the Browser
credential-entry handoff and verify the success screen and subsequent sign-in.

<!--
Location: docs/r2-storage-verification.md
Purpose: Record real Cloudflare R2 acceptance and remaining speaking defects.
Why: Separate working storage from complete user-story acceptance.
-->

# R2 acceptance — September 20, 2026

The storage blocker and speaking defects are resolved in the local working tree.
STU-10 is **PASS** after the fix verification below. X-07 remains **BLOCKED**
on the production/device baseline and agreed SLOs, deferred by the user. This was a focused rerun of
the storage-dependent speaking flow, not a new run of all 125 stories.

## Environment and implementation

Real frontend `http://127.0.0.1:3011`, API port 4001, and the existing disposable
PostgreSQL database `nce_speaking_performance` were used. The actual private
Cloudflare bucket is `nce-app`; no storage or application responses were mocked.
The local user token expires October 20, 2026 and grants Object Read & Write only
to that bucket. Credentials remain in ignored `backend/.env` with mode 0600.

The previously unfinished R2 adapter was connected for this run. Upload signing
now returns an expiring owner-bound `uploadToken`, required at completion along
with a SHA-256 checksum. The server verifies object size, content type and actual
bytes before promoting the staging object to a final key and creating a file
record. Downloads retain application authorization and expire after five minutes.
Backend and frontend must be updated together for the completion contract.

Bucket CORS permits GET/PUT/HEAD only from `http://127.0.0.1:3011`, allows the
Content-Type header, and exposes ETag/Content-Length/Content-Type. Public access
stays disabled. Other deployment origins need their own exact CORS entries.

## Initial rerun (before the speaking fixes)

- Real browser selection uploaded a 32,044-byte, one-second WAV successfully.
  Save Draft and Submit were disabled while uploads were busy.
- Removing a completed recording worked. Submit without required recordings
  displayed the expected validation error.
- **Failure:** start all three uploads before the first finishes; only the last
  part remains in the form after completion. All uploads reach storage, but form
  updates overwrite earlier completed parts. Sequential uploads retain all three.
- Sequential recordings survived Save Draft and a full reload, then submitted.
  SQL confirmed status `submitted`, attempt 1, payload version 1 and all three
  recording IDs. No grade was assigned by this run.
- **Display defect:** persisted recordings show `Uploaded recording`, `0 B`, and
  `application/octet-stream` in the summary despite real WAV metadata in storage.
- Download opened the native browser media player. An independent authenticated
  API check downloaded byte-identical audio. Playback timing was not confirmed:
  interacting with the native media control timed out in browser automation.
- Nine live R2/API assertions passed: signed direct PUT, verified completion,
  exact-byte owner download, rejection of another owner's completion token,
  rejection of arbitrary object keys, peer download denial, unsigned object
  denial (R2 returned 400), repeat completion returning the same file ID, and
  checksum mismatch rejection.

Evidence: `/tmp/nce-speaking-performance-20260920/r2-api-acceptance.json`,
`r2-speaking-submitted.png`, `api-r2.log`, and `frontend-r2.log`. Test objects and
the disposable database are retained for diagnosis. Failed checksum uploads can
leave staging objects; a production `pending/` expiry rule is not configured yet.

## Local configuration

Set `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY` in
the backend environment. Optional `R2_JURISDICTION` is `default`, `eu`, `us`, or
`fedramp`. Missing/invalid configuration returns a safe 503 when storage is used.
Never place these values in frontend environment variables or version control.

## Code checks

Backend and frontend TypeScript checks pass. Focused backend lint and all 13 file
service tests pass; all six frontend upload helper tests pass. Full repository
builds and test suites were not rerun for this focused acceptance pass.

## Fix verification

Upload completions call the latest parent callback and merge synchronously into
the latest speaking attempt, including multiple completions before React renders.
Submission responses resolve recording metadata from non-deleted file records
owned by the student, with one batched lookup. Existing ID-only submissions and
draft editors now recover the real filename, byte size, MIME and checksum.

Real browser verification on Speaking S1 started all three R2 uploads together:
all three remained after completion. Removing/replacing Part 2 kept Parts 1 and 3.
Save Draft, full reload and reopening the editor preserved three recordings with
`recording.wav`, `31 KB`, and `audio/wav`. Final submission succeeded; SQL confirmed
status `submitted`, three recording references and zero grades. Existing Speaking
S2 also displayed correct metadata on reload. Screenshot: `r2-speaking-fixed.png`
in the evidence directory. Performance acceptance was deliberately deferred.

Checks passed: 27 backend submission tests, four uploader component tests, twelve
student attempt logic/source tests, both TypeScript checks and focused lint.

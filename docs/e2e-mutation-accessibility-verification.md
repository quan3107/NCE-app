<!--
File: docs/e2e-mutation-accessibility-verification.md
Purpose: Record X-03 and X-04 acceptance against the real application.
Why: Individual fixes and regression tests do not establish whole-story acceptance.
-->

# Mutation and accessibility verification — 2026-09-21

Status: PASS for the documented matrix, including the review rerun below.
The original claim missed retained-media removal, return navigation and actual
Reading sorting; those gaps were fixed and reverified against the real application.

## Environment

Saved local repository on `fix/mutation-isolation-keyboard-accessibility`.
Actual UI at `http://127.0.0.1:3011`, actual API at
`http://127.0.0.1:4007/api/v1`, disposable PostgreSQL container
`nce-ops-verification-20260921`, database `nce_ops` on port 55438.
The existing stopped fixture container was started for this run. API uses its
least-privilege runtime role. External delivery credentials are nonworking test
values. No request interception or acceptance mocks are used.

## Observed evidence

- In-app Browser: password login with the documented teacher fixture succeeded.
- Reading skill card is named, keyboard reachable and visibly outlined. The
  screenshot was inspected at 1280×720; the card and focus ring are fully visible.
- Reading authoring now exposes named title/course/instructions/timing/due-date,
  passage title/content, question type/prompt/options/answer, delete and reorder
  controls. Its original inaccessible expansion header now has a named button.
- Real `SHARE` lock on `assignments` held for 15 seconds: double-click Save Draft
  disabled both create actions. Navigation to Profile while pending remained on
  Profile after the write failed. No stale success appeared. SQL found zero
  `X03 disposable text` rows after failure.
- Teacher preferences expose named switches in the live accessibility tree.
- A 4-second PostgreSQL trigger delayed assignment and submission writes. Repeated
  publication produced one assignment. Text submission double activation produced
  one version-1 submission; closing the dialog and opening Profile before completion
  did not navigate or announce a stale success. Empty response errors are associated
  with the response field; Escape restores focus to Submit Assignment.
- Real R2 upload from its already permitted localhost origin completed successfully.
  Selecting the same PNG twice while pending yielded one upload item and one `files`
  row (1,574,061 bytes). The upload exposes a named progressbar and live stages.
  Repeated submission of that file yielded one submission. Profile remained open
  after completion. Earlier origin 3012 was rejected by the bucket's existing CORS;
  no bucket permissions were changed.
- At 390×844, the mobile workspace drawer has a visible focus ring, correctly sized
  layout, a named dialog, and a keyboard focus loop from first item to Close and back.
  Escape closes it and restores focus to Open workspace navigation.
- Grading exposes named Raw Score and Teacher feedback controls. Negative-score
  validation renders a persistent alert associated through `aria-describedby`.
  Double posting disables the action. An intentionally overlong combined delay
  caused the real transaction to roll back; navigation remained isolated. The
  success rerun with only the grade write delayed produced exactly one grade,
  raw score 81; Profile remained open with no stale success notification.
- Repeated Weekly Digest activation while delayed disabled all preference actions;
  SQL recorded a single disabled preference, and Dashboard remained open afterward.
- Registration double activation disabled Create Account. Navigation to About
  before the delayed user insert completed kept the browser signed out on About.
  SQL found one account and one revoked session, with zero active sessions.
- Contact double activation disabled its fieldset. Navigation to About before
  completion stayed there; SQL found one contact row for the disposable address.
- Settings double activation disabled all fields and Save. Navigation to Content
  before completion stayed there. SQL confirmed only the requested student limit
  changed, from 25 to 24 MiB; the browser subsequently restored 25 MiB.
- CMS Save draft disabled Save/Publish/Marketing page. Publish double activation
  followed by immediate navigation to Profile created exactly one published
  revision and left Profile open. Rollback double activation kept its dialog open
  with a disabled pending action, then produced one new rollback revision.
  Escape restored the historical revision trigger. Successful rollback refreshes
  replaced that trigger node; stable trigger IDs now restore focus to its replacement.
  The final live mobile check and regression test confirm this restoration.
- Two concurrent real `/files/complete` requests after one signed R2 PUT both
  returned HTTP 201 with the same file ID. No duplicate metadata record resulted.
- A disposable database trigger rejected creation of `X03 partial audio` after
  its WAV upload completed in real R2. The visible persistent alert states that
  one file uploaded but the assignment was not saved. Repeated failed saves kept
  one audio file. Removing the trigger and retrying created one draft assignment,
  still with one audio file. No API response was intercepted.

## Review rerun

- Listening: real R2 upload succeeded and a disposable database trigger rejected
  assignment creation. Explicit Remove followed by a successful save persisted
  `audioFileId: null` in assignment `11b10ea8-3280-4057-9768-a2e5d7ae415a`.
- Writing: real image upload succeeded before API validation rejected empty prompts.
  The retained-image removal action stayed available. After removal and completing
  the prompts, assignment `704fb235-cc7f-4d4f-8d97-d98e9c948475` persisted
  `imageFileId: null`. Each scenario uploaded exactly one file.
- With a real four-second database delay, saved assignment A, visited the list,
  opened assignment B, then used Back twice to return to A before completion.
  B displayed its own title. A's newer local description survived completion with
  no stale success or navigation; SQL contained only the earlier submitted value.
  The first rerun exposed cache refresh overwriting the draft; initialization now
  runs once per resource. Edit and grade routes also remount per resource ID.
- Permanent hook regressions cover a reused component across A→B→A, including
  React Router POP to the original entry, without checking the callback while away.
  Navigation generations and permanent abandonment prevent callback revival.
- Real dnd-kit keyboard sorting used Space, Down, Space. Screenshot inspection
  confirmed movement and focus; no ref warning occurred. Saved Reading assignment
  `f1aaaf2f-2671-4cbf-82f5-21080a7f6bc6` persisted Passage 2, Passage 1, Passage 3.
  A real dnd-kit regression verifies its registered node is an HTMLElement.

## Keyboard and semantic matrix

Desktop and 390×844 mobile used the real in-app Browser. Keyboard actions used
Enter, Tab, Shift+Tab, Escape, Space and arrow keys. Screenshots were inspected
for the Reading skill focus ring, mobile login, workspace drawer, writing editor,
assignment actions, settings, upload dialog and rollback dialog.

| Flow | Observed checks |
| --- | --- |
| Public navigation/auth | Named mobile drawer, Escape restoration; email-to-password Tab order, visible login focus; keyboard role selection and registration activation |
| Contact | Named fields, associated validation errors, pending disabled fieldset, route isolation |
| Authoring | Keyboard skill selection; valid Reading tab/delete semantics; named passage, question, option and reorder controls; Speaking arrow-key tabs; rich-text Tab exits to the next control; named Writing rubrics/media and Listening upload controls |
| Submission/upload | Associated empty-response error; named progress and live upload stages; keyboard file chooser; mobile dialog fits viewport; Escape restores Submit/Resubmit Assignment |
| Grading | Named score/feedback, associated negative-score alert, disabled Posting action |
| Profile/preferences | Keyboard edit/cancel, Name error association and alert; named preference switches; pending actions disabled and saved status announced |
| Settings | Field error association and alert; mobile Tab order and visible focus; disabled pending fields and saved status |
| CMS | Named editor fields/page selector; unsaved-change dialog; pending page selection blocked; rollback cancel and successful-focus restoration; publication status |

Shared authenticated pages remount on account/session-generation changes. Local
IELTS drafts now use account-owned keys; legacy unowned keys are left untouched
and are not automatically restored. Regression tests cover this boundary and a
queued autosave that finishes after an account change. Other regression coverage
includes route/unmount/session fences, duplicate upload selection and late upload
callbacks, late registration compensation, and listening partial batches.

This verifies keyboard behavior and exposed accessibility semantics, not a full
WCAG audit or spoken output from a physical screen reader. Real AI-provider
execution was not needed for this cross-cutting matrix; AI delivery stayed disabled.

## Separate existing issue

The teacher Dashboard Grade action navigates to `/teacher/submissions/:id`, which
has no route. The submissions queue uses the working `/teacher/grade/:id` route.

## Regression checks

Final checks passed: 244 component tests across 67 files, 270 unit tests, lint,
TypeScript and production build. The first final suite caught one outdated test
locator after the audio Remove action received a specific accessible name; that
locator was updated and the complete component suite passed again.

## Cleanup

Temporary triggers/functions are removed, the student upload limit is restored,
and only this run's three original plus two review R2 fixture objects are deleted
(each review deletion was verified with a 404 HEAD response). Disposable database
records remain in the stopped verification container as evidence. Only API/Vite
processes started for this verification are stopped; browser viewport overrides
are reset. No production database, bucket policy, mail delivery, or AI provider
configuration is changed.

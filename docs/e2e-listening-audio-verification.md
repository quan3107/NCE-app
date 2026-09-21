<!-- Location: docs/e2e-listening-audio-verification.md
Purpose: Record full ASG-09 real-app acceptance. Why: Keep evidence reviewable. -->

# Listening authoring verification — September 21, 2026

**ASG-09: PASS.** The final rerun closes the validation, ordering, bulk mapping,
preview, upload/save locking, and private-content defects from the initial run.

## Environment

Actual Vite frontend at `http://127.0.0.1:3011`, repository API at
`http://127.0.0.1:4006/api/v1`, and configured private R2 bucket. No intercepted
acceptance requests, fake responses, mocked storage, or bucket/CORS changes.
Generated one-second WAV fixtures contain 16,044 bytes. Teacher Sarah and enrolled
learner Amelia use documented demo accounts.

Disposable PostgreSQL database `nce_listening_validation` is cloned from
`nce_public_recovery` in container `nce-speaking-performance-20260920`, port 55437.
Original databases are unchanged. API uses the fixture owner connection and test
mode with background jobs disabled; this is not a runtime-role deployment audit.
Evidence is retained under `/tmp/nce-listening-validation`, final run in `full/`.
One browser tab crashed; its local draft recovered, files were reselected, and
preview/save verification completed in a new tab.

## Acceptance

| Criterion | Final result |
| --- | --- |
| Individual rejection | PASS: selecting `upload.txt` twice produces precise rejection; a valid WAV survives invalid replacement. `full/rejection.png` and initial `unsupported-file.png`. |
| Mixed bulk selection | PASS: WAV plus text is rejected before mapping/upload; the invalid filename is shown and valid prior audio retained. |
| Add/remove sections and questions | PASS: Create adds sections/questions and removes sections; queued audio is cleared without affecting siblings. Initial Edit run also saved section removal. |
| Reorder | PASS: keyboard drag moves Section 1 after Section 2. Preview and saved config retain reordered IDs, questions, transcripts, and audio. Sortable ref now targets a DOM wrapper. |
| Duplicate/unassigned mapping | PASS: reusing one file displays a duplicate warning and disables Apply. Distinct same-name WAVs are labeled file 1/file 2 and independently selectable. Correcting the mapping enables Apply; `extra.wav` stays explicitly unassigned/excluded. `full/duplicate-blocked.png`, visually inspected. |
| Real individual/bulk upload | PASS: initial bulk save persisted both mapped files in assignment `ab6b9a7e-33a8-496a-96f3-66d78ed7232d`. Final individual save persists two distinct same-name WAVs; authenticated file-content lookup and signed R2 GET return exact source bytes. |
| Transcript/playback persistence | PASS: final teacher GET retains private transcripts and playback limits 2 and 1 in reordered sections. Initial Edit run also persisted unlimited playback (`limitPlays: 0`). |
| Preview | PASS: real student attempt controls display reordered sections, play limits, native audio, and interactive answers, without transcript/key controls. Audio reaches readyState 4 and playback advances. Edit preserves queued files. `full/preview.png`, visually inspected. |
| Upload/save lock | PASS: Save Draft immediately disables save/publish, preview/type controls, and fields with upload/save status. Real uploads finish before navigation; exactly one assignment exists. Regression tests cover synchronous duplicate invocation and retry after failure. |
| Learner privacy | PASS: student list/detail omit private transcripts and answer keys before submission; detail stays filtered afterward. Teacher data is intact. Learner attempt loads R2 audio and public choices. `full/api-evidence.json`, `full/learner-attempt.png`, visually inspected. |
| Legitimate behavior | PASS: real learner submission scores rawScore 2 for two correct answers using stored keys. Writing immediate samples remain visible in list/detail; after-grading samples remain hidden beforehand. `full/scoring-evidence.json`, `full/writing-release-evidence.json`. |

Final assignment: `2f69f1ef-5699-427d-9e13-654f116b2654`; audio files
`c4ab1987-15fe-4dd4-99ba-84e5d7c13a91` and `39f4827e-c06c-488d-895d-92be220cab60`.
`full/assignment.json` records teacher configuration; `full/api-evidence.json`
records matching SHA-256 hashes and policy. This two-question fixture uses the
existing IELTS band conversion: rawScore, not band, is the scoring assertion.

## Checks and review

- All 217 frontend component tests pass, including nine listening regressions.
- Frontend TypeScript, focused ESLint, and production build pass.
- Backend assignment/submission/scoring tests, TypeScript, and focused ESLint pass.
- Student projection tests cover nested scorer aliases, both read boundaries,
  teacher/scoring preservation, and four Writing sample-release modes.
- Source review checked list/detail sinks and raw scoring reads. Response filtering
  does not mutate persisted configuration; public prompts/options and authorized
  score/explanation flows remain available.
- Test servers and the previously stopped container are stopped after verification;
  fixture data and evidence are retained.

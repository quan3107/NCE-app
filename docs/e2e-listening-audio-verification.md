<!--
Location: docs/e2e-listening-audio-verification.md
Purpose: Record real-app verification of listening audio selection and ASG-09 limits.
Why: Distinguish the fixed file-selection defect from full story acceptance.
-->

# Listening audio verification — September 21, 2026

The recorded unsupported-file defect is fixed. **ASG-09 remains FAIL** because
the wider acceptance run exposed private transcript disclosure and did not
establish working section reordering or upload-busy save protection.

## Environment

- In-app Browser against the actual Vite frontend and repository API, with no
  intercepted requests, fake responses, or mocked storage.
- Final frontend `http://127.0.0.1:3011`; API `http://127.0.0.1:4006/api/v1`.
  An initial run on port 3016 rejected files and played local audio, but R2 PUTs
  failed because the bucket only permits Browser uploads from port 3011.
  Moving to the documented permitted origin resolved this without changing CORS.
- Separate disposable PostgreSQL database `nce_listening_validation`, cloned
  from the existing `nce_public_recovery` fixture in the previously stopped
  `nce-speaking-performance-20260920` container at port 55437. Existing databases
  were not edited. The test API used the fixture owner connection and test mode;
  this is not a runtime-role deployment audit.
- Actual configured private R2 storage. Original generated one-second WAV files
  contain 16,044 bytes. Teacher Sarah and enrolled learner Amelia use documented
  demo accounts. Local evidence: `/tmp/nce-listening-validation`.

## Observations

| Criterion | Result and concrete evidence |
| --- | --- |
| Reject unsupported individual files | PASS: `upload.txt` produces `Unsupported file type: upload.txt Choose a supported audio file (audio files).`; no audio player replaces the empty section. Input resets for retries. `unsupported-file.png` and `.txt`; screenshot visually inspected. |
| Preserve valid selection | PASS: WAV displays `0:01`, playback advances to about 0.44 seconds, and a subsequent `.txt` selection leaves the WAV player intact. |
| Bulk rejection and mapping | PASS: mixed WAV/text selection reports the text file and opens no mapping dialog. Corrected audio selection maps `section1.wav` and `section2.wav` to the matching sections. `extra.wav` appears under `Unassigned Files (1)`. |
| Duplicate mapping | Both Section 1 and Section 2 can visibly select `section1.wav`; Apply reports two files. There is no separate duplicate warning. Screenshot `bulk-duplicate.png` visually inspected. Same-name files from different directories were not tested. |
| Supported real upload/save | PASS: Browser Save Draft uploads WAV to real R2 and returns to the assignment list. Assignment `705dbdfc-a92e-4b1f-a989-35e1e5073055` references file `06558356-4a56-48f0-86b5-fba0e14b8968`. Authenticated API content lookup and signed R2 GET return bytes identical to the source. Bulk draft also saves both matching section files. |
| Add/remove sections and questions | PASS across Create and Edit: Create adds Section 5 and another question; Edit removes Sections 4, 3, and 2 and saves one section. Create has no section-removal control. |
| Reorder | NOT PASSED: keyboard Space/ArrowDown/Space announces a drop but leaves headings in their original order. Console reports that `SortableSectionCard` passes a ref to the non-forwarding `Card` component. Pointer reordering was not established. |
| Transcript/playback persistence | PASS in Edit: save a private transcript marker, prompt/option/answer, and Unlimited playback; authoritative teacher GET retains one section, transcript, question, audio ID, and `limitPlays: 0`. Create offers a separate two-play option. |
| Preview | Edit preview shows timing and section/question summary without transcript. Create's Preview changes the button to Edit but leaves authoring controls visible; a full student rendering was not established there. |
| Upload save gating | Save returns only after successful upload, but Save Draft remains enabled immediately after starting real bulk uploads. Duplicate-click prevention is not established; creation only tracks the later assignment mutation. |
| Private transcript | FAIL: publish the disposable assignment through the actual teacher API, then GET as enrolled Amelia. HTTP 200 includes `Private transcript validation marker` and the question's `correctAnswer`, despite Edit saying transcripts are instructor-only. `student-assignment.json` and `api-results.json` record this. |

The transcript disclosure is an existing backend/learner-content issue outside
this file-picker patch and needs a separate fix. The story status is deliberately
unchanged; upload success does not establish full acceptance.

## Checks

- Frontend TypeScript, focused ESLint, and production build pass.
- All 55 component test files pass: 212 tests, including four new rendered-form
  regressions for rejection/preservation, mixed bulk input, unavailable policy,
  oversized files, and extension fallback. Component dependencies are stubbed
  only in regression tests; acceptance above uses actual services.
- No backend application code changed. Test servers and the container started
  by this task are stopped after verification; fixture data/evidence are retained.

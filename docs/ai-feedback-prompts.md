# AI Feedback Prompt Contracts

This document records the first-release provider-neutral prompt and parser contracts
for AI writing feedback and objective explanations.

## Prompt Versions

| Task | Version | Builder |
| --- | --- | --- |
| IELTS writing feedback | `ielts-writing-feedback-v1` | `buildIeltsWritingFeedbackPrompt` |
| Reading/listening objective explanation | `objective-explanation-v1` | `buildObjectiveExplanationPrompt` |

Prompt builders return assembled provider requests with deterministic system and
user messages. Provider adapters should pass those messages through and should not
assemble grading instructions themselves.

## IELTS Writing Feedback

The writing builder includes:

- Assignment title, type, config version, instructions, and AI policy.
- Task 1 and Task 2 prompts plus known visual type metadata.
- Submitted Task 1 and Task 2 text.
- Teacher constraints.
- Rubric criteria keyed by stable `criterion_id` values.

The builder intentionally avoids student identifiers and only copies whitelisted
submission fields into the prompt.

The model must return JSON only:

```json
{
  "band_estimate": 6.5,
  "criterion_band_suggestions": [
    {
      "criterion_id": "task_response",
      "band": 6.5,
      "rationale": "The position is clear but needs fuller support."
    }
  ],
  "rationale": "Overall explanation of the feedback.",
  "strengths": ["Specific strength"],
  "improvement_areas": ["Specific area to improve"],
  "next_steps": ["Concrete next action"],
  "teacher_notes": "Review notes for the teacher.",
  "confidence": 0.74,
  "safety_flags": {
    "unsafe": false,
    "reasons": []
  }
}
```

Writing output is advisory. It must never override the teacher-final grade, and
it must use only supplied criterion IDs.

## Objective Explanations

The objective explanation builder includes:

- Assignment title, type, config version, and AI policy.
- Question ID, question text, accepted answer, student answer, and deterministic
  result.
- Reading passage, listening transcript, audio-file-only marker, or explicit no
  context limitation.

Reading and listening explanations explain deterministic scoring. They must never
override the answer key.

When a listening request only has an audio file ID, the prompt tells the model not
to pretend it inspected audio or quote unavailable audio content.

The model must return JSON only:

```json
{
  "result": "incorrect",
  "short_explanation": "The accepted answer is supported by the passage.",
  "evidence": "Relevant passage or transcript evidence.",
  "misconception": "Likely misunderstanding.",
  "study_tip": "Concrete study tip."
}
```

## Parser Failure Policy

`parseWritingFeedbackOutput` and `parseObjectiveExplanationOutput` fail closed.
Malformed or unsafe output becomes a failed AI record and is not publishable
feedback.

Failure codes:

| Code | Meaning |
| --- | --- |
| `empty_feedback` | Provider returned no text. |
| `malformed_json` | Provider output did not contain parseable JSON. |
| `schema_invalid` | JSON did not match the expected task schema. |
| `unknown_criteria` | Writing output used a criterion ID that was not supplied. |
| `missing_criteria` | Writing output omitted an expected criterion ID. |
| `unsafe_output` | Output contained unsafe advice or unsafe safety flags. |
| `off_task_output` | Output appeared to be for another task. |
| `score_override_attempt` | Objective explanation result conflicted with deterministic scoring. |

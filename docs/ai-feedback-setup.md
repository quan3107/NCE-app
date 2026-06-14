<!--
File: docs/ai-feedback-setup.md
Purpose: Document hosted AI feedback configuration and operations.
Why: Lets maintainers run AI feedback safely, cheaply, and without exposing provider calls to browsers.
-->

# AI Feedback Setup and Operations

This app runs AI feedback through the backend only. Student browsers never call
hosted AI providers, never receive provider credentials, and never choose model
IDs directly. The backend validates assignment policy, image availability,
provider route capability, parser output, criteria IDs, and teacher visibility
before feedback can become visible to a student.

## Default Hosted OpenAI Routes

The first hosted provider is `openai-compatible` with `AI_BASE_URL` defaulting to
`https://api.openai.com/v1`. Two routes are configured:

| Route | Default model | Default reasoning | Intended use |
| --- | --- | --- | --- |
| `low_cost` | `gpt-5.4-nano` | `medium` | Objective explanations and ordinary writing drafts where cost matters. |
| `premium` | `gpt-5.4-mini` | `high` | Explicit premium requests and image-required writing feedback. |

Assignment policy can request `auto`, `low_cost`, or `premium`. In `auto`, the
current prompt builders pass assignment route preference and image requirements
to the router. If a request requires image input, the router only uses routes
marked as image-capable. The router also has internal support for high-stakes,
retry, and low-confidence escalation if future workers pass those signals, but
the current generation workers do not send those fields.

Before enabling a route in a real environment, confirm that the configured model
ID exists for the account, supports the requested reasoning effort, and supports
the needed image-input shape. Use the provider account dashboard, provider model
list, and the admin AI health endpoint rather than assuming defaults are
available for every account.

## Environment Variables

AI feedback is disabled by default. A minimal hosted OpenAI setup looks like:

```env
AI_FEEDBACK_ENABLED=true
AI_PROVIDER=openai-compatible
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=sk-...
AI_TIMEOUT_MS=10000
AI_MAX_INPUT_CHARS=12000
AI_MAX_OUTPUT_TOKENS=1200
AI_HEALTH_PATH=/models

AI_LOW_COST_MODEL=gpt-5.4-nano
AI_LOW_COST_REASONING_EFFORT=medium
AI_LOW_COST_SUPPORTS_IMAGE_INPUT=false

AI_PREMIUM_MODEL=gpt-5.4-mini
AI_PREMIUM_REASONING_EFFORT=high
AI_PREMIUM_SUPPORTS_IMAGE_INPUT=true

AI_IMAGE_MAX_BYTES=20971520
AI_IMAGE_SUPPORTED_MIME_TYPES=image/png,image/jpeg,image/webp,image/gif
```

Set `AI_FEEDBACK_ENABLED=false` to disable generation without a code change.
Existing drafts remain stored, but new provider-backed generation should report
the disabled state instead of calling the provider.

The accepted reasoning effort values are `none`, `low`, `medium`, `high`, and
`xhigh`. Use `none` for OpenAI-compatible providers or model routes that do not
accept a `reasoning_effort` field.

## Health and Readiness

Admins can inspect provider readiness through:

```http
GET /api/v1/ai-feedback/health
```

The response reports `disabled`, `configured`, `healthy`, `unhealthy`,
`timeout`, or `misconfigured`, plus redacted provider metadata, route models,
reasoning efforts, image capability flags, and limits. It never returns
`AI_API_KEY`.

Use this endpoint after changing route config, before enabling image-required
assignments, and when investigating provider outages. A healthy status confirms
the health path responded, not that every model feature is available; run
fixture-based harness checks and an env-gated live benchmark before trusting a
new route for production-quality feedback.

## Latency, Timeouts, Rate Limits, and Budgets

`AI_TIMEOUT_MS` caps provider calls and health probes. The default is 10 seconds,
which keeps classroom workflows responsive but may be too short for large
Writing Task 1 plus Task 2 payloads. Increase cautiously and keep teacher review
as the fallback for slow or failed jobs.

Budget controls are layered:

- `AI_MAX_INPUT_CHARS` rejects oversized IELTS writing feedback prompt inputs
  before provider calls. Objective explanations currently rely on prompt
  whitelisting and output-token limits rather than this input-size guard.
- `AI_MAX_OUTPUT_TOKENS` limits response length.
- Assignment policy chooses `auto`, `low_cost`, or `premium`.
- Route defaults keep ordinary objective explanations on the lower-cost route.
- The provider router can escalate retry and low-confidence requests if those
  signals are supplied by future workers.

Provider-side rate limits still apply. Treat `429` and transient 5xx responses
as retryable operational failures, not as student-visible feedback. Failed or
review-required drafts should stay in teacher review until a teacher approves
the final wording.

## Image Input for IELTS Writing Task 1

First release visual feedback uses hosted image input through the backend. To
enable it safely:

1. Verify the route model supports image input for the configured account.
2. Set the route capability flag, usually
   `AI_PREMIUM_SUPPORTS_IMAGE_INPUT=true`.
3. Keep `AI_LOW_COST_SUPPORTS_IMAGE_INPUT=false` unless that route has also been
   tested with image content.
4. Confirm image MIME types and byte limits match backend file validation.
5. Run visual Task 1 harness fixtures before enabling student-facing use.

If required image context is missing, inaccessible, too large, unsupported, or
sent to a non-image route, the pipeline must fail into review or failure. It
must not accept student-visible feedback that pretends the model inspected the
visual. Text-only fallback feedback is allowed only when a teacher explicitly
approves the fallback context.

## Teacher Control and Visibility

AI output is always a draft until product policy allows visibility:

- Writing feedback is assignment-controlled. It can require teacher review or be
  instant provisional feedback, depending on the assignment policy.
- Teacher-final grades override AI suggestions.
- AI writing bands are advisory suggestions validated by the app-owned criteria
  layer.
- Reading and listening AI explains deterministic scoring only. It must not
  change answer keys or override the deterministic result.
- Speaking AI is deferred and should remain disabled in first-release
  operations.

## Safe Disable and Fallback Paths

Use these fallback paths when cost, provider health, or safety requires it:

- Set `AI_FEEDBACK_ENABLED=false` to stop provider calls.
- Leave `AI_API_KEY` empty in local and CI environments that only run
  provider-free tests.
- Set `AI_HEALTH_PATH=` only when a compatible provider has no useful health
  endpoint; the service will report configured instead of probing.
- Keep image-required assignments in teacher review if image capability is not
  validated.
- Regenerate failed drafts through teacher/admin workflows after provider
  recovery.

Provider errors, parser failures, unsafe output, invented criteria, and missing
image context should produce failed or review-required drafts rather than
student-visible feedback.

## Criteria and Harness Operations

The app owns IELTS writing criteria, criterion IDs, task weights, and valid band
increments. Providers receive those rules in the prompt and must return only the
supplied criterion IDs. They cannot invent criteria, change weights, or use band
values outside valid 0.5 increments from 0 to 9.

The backend harness is the normal development and CI path. It runs prompt
builders, criteria validation, parser validation, normalization, and fixture
reports without API keys, network access, browser inference, or local model
weights. Live-provider benchmarks are later, env-gated checks for route quality,
latency, and cost; they are not required for deterministic CI.

DeepSeek, MiniMax, and other hosted providers are later evaluation candidates
after the OpenAI-backed AI layer is stable. They are not immediate
implementation requirements for this release.

/**
 * File: tests/modules/ai-feedback/provider.openai.test.ts
 * Purpose: Verify server-side OpenAI chat completion provider behavior.
 * Why: Keeps downstream AI services independent from OpenAI request details.
 */
import { describe, expect, it, vi } from 'vitest'

import { AiProviderError } from '../../../src/modules/ai-feedback/provider.errors.js'
import { OpenAIProvider } from '../../../src/modules/ai-feedback/provider.openai.js'
import type { AiProviderRequest } from '../../../src/modules/ai-feedback/provider.types.js'

const baseRequest = {
  taskType: 'objective_explanation',
  messages: [
    { role: 'system', content: 'Return JSON.' },
    { role: 'user', content: 'Explain this objective.' },
  ],
  expectJson: true,
} satisfies AiProviderRequest

function provider(
  fetchImpl: typeof fetch,
  overrides: Partial<ConstructorParameters<typeof OpenAIProvider>[0]> = {},
): OpenAIProvider {
  return new OpenAIProvider({
    routeKey: 'low_cost',
    baseUrl: 'https://provider.example/v1',
    apiKey: 'sk-test',
    model: 'gpt-5.6-luna',
    reasoningEffort: 'medium',
    supportsReasoningEffort: true,
    supportsImageInput: false,
    timeoutMs: 500,
    maxOutputTokens: 600,
    maxResponseBytes: 4096,
    fetch: fetchImpl,
    now: () => 1_000,
    ...overrides,
  })
}

function jsonResponse(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  const headers = new Headers(init.headers)
  headers.set('content-type', 'application/json')

  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers,
  })
}

describe('OpenAIProvider', () => {
  it('posts chat completions with model, reasoning effort, JSON instructions, and returns parsed metadata', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          model: 'gpt-5.6-luna',
          choices: [
            {
              message: {
                content: '{"summary":"Use articles with singular count nouns."}',
              },
            },
          ],
          usage: {
            prompt_tokens: 12,
            completion_tokens: 8,
            total_tokens: 20,
          },
        },
        { headers: { 'x-request-id': 'req_123' } },
      ),
    )

    const result = await provider(fetchImpl).generate(baseRequest)

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://provider.example/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: 'Bearer sk-test',
          accept: 'application/json',
          'content-type': 'application/json',
        }),
      }),
    )

    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))
    expect(body).toMatchObject({
      model: 'gpt-5.6-luna',
      reasoning_effort: 'medium',
      max_completion_tokens: 600,
      response_format: { type: 'json_object' },
    })
    expect(body.max_tokens).toBeUndefined()
    expect(body.temperature).toBeUndefined()
    expect(body.messages).toEqual([
      { role: 'system', content: 'Return JSON.' },
      { role: 'user', content: 'Explain this objective.' },
    ])

    expect(result).toMatchObject({
      rawText: '{"summary":"Use articles with singular count nouns."}',
      parsedJson: { summary: 'Use articles with singular count nouns.' },
      model: 'gpt-5.6-luna',
      routeKey: 'low_cost',
      latencyMs: expect.any(Number),
      providerRequestId: 'req_123',
      tokenUsage: {
        promptTokens: 12,
        completionTokens: 8,
        totalTokens: 20,
      },
    })
  })

  it('accepts structured content arrays from provider responses', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        choices: [
          {
            message: {
              content: [
                { type: 'text', text: '{"score":' },
                { type: 'output_text', text: '7}' },
              ],
            },
          },
        ],
      }),
    )

    const result = await provider(fetchImpl).generate({
      ...baseRequest,
      taskType: 'writing_feedback',
    })

    expect(result.rawText).toBe('{"score":7}')
    expect(result.parsedJson).toEqual({ score: 7 })
  })

  it('ignores provider-supplied model metadata', async () => {
    const responseForModel = (model: string) =>
      vi.fn().mockResolvedValue(
        jsonResponse({
          model,
          choices: [{ message: { content: '{"score":7}' } }],
        }),
      )

    await expect(
      provider(responseForModel('student response echoed as model')).generate(
        baseRequest,
      ),
    ).resolves.toMatchObject({ model: 'gpt-5.6-luna' })
  })

  it('omits reasoning effort for providers that do not support it', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        choices: [{ message: { content: 'plain feedback' } }],
      }),
    )

    await provider(fetchImpl, {
      routeKey: 'low_cost',
      supportsReasoningEffort: false,
      reasoningEffort: 'none',
    }).generate({
      ...baseRequest,
      expectJson: false,
    })

    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))
    expect(body.reasoning_effort).toBeUndefined()
  })

  it('passes custom temperature for chat models that support it', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        choices: [{ message: { content: 'plain feedback' } }],
      }),
    )

    await provider(fetchImpl, {
      model: 'gpt-4o-mini',
      reasoningEffort: 'none',
    }).generate({
      ...baseRequest,
      expectJson: false,
      temperature: 0,
    })

    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))
    expect(body.temperature).toBe(0)
  })

  it('maps provider-neutral image parts to hosted OpenAI image content', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        choices: [{ message: { content: '{"ok":true}' } }],
      }),
    )

    await provider(fetchImpl, { supportsImageInput: true }).generate({
      ...baseRequest,
      requiresImageInput: true,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Assess the visual Task 1 response.' },
            {
              type: 'image',
              imageUrl: 'https://storage.mock/nce/task1.png',
              mimeType: 'image/png',
              detail: 'high',
            },
          ],
        },
      ],
    })

    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))
    expect(body.messages).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Assess the visual Task 1 response.' },
          {
            type: 'image_url',
            image_url: {
              url: 'https://storage.mock/nce/task1.png',
              detail: 'high',
            },
          },
        ],
      },
    ])
  })

  it('rejects image content when the hosted route has no image capability', async () => {
    await expect(
      provider(vi.fn()).generate({
        ...baseRequest,
        requiresImageInput: true,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Assess the chart.' },
              {
                type: 'image',
                imageUrl: 'https://storage.mock/nce/task1.png',
                mimeType: 'image/png',
              },
            ],
          },
        ],
      }),
    ).rejects.toMatchObject({
      code: 'unsupported_image_input',
      routeKey: 'low_cost',
    })
  })

  it.each([
    ['missing_model', { model: '' }],
    [
      'unsupported_reasoning_effort',
      { reasoningEffort: 'xhigh', supportsReasoningEffort: false },
    ],
  ] as const)('rejects invalid request config: %s', async (code, overrides) => {
    await expect(
      provider(vi.fn(), overrides).generate(baseRequest),
    ).rejects.toMatchObject({
      code,
    })
  })

  it.each([
    [
      'http_error',
      () => ({
        response: jsonResponse({ error: { message: 'rate limited' } }, { status: 429 }),
      }),
    ],
    ['malformed_json', () => ({ response: new Response('{', { status: 200 }) })],
    [
      'empty_content',
      () => ({ response: jsonResponse({ choices: [{ message: { content: '' } }] }) }),
    ],
    [
      'response_too_large',
      () => ({
        response: jsonResponse({ choices: [{ message: { content: 'x'.repeat(40) } }] }),
        maxResponseBytes: 32,
      }),
    ],
  ] as const)(
    'normalizes provider response failures: %s',
    async (code, responseFactory) => {
      const failure = responseFactory()

      await expect(
        provider(vi.fn().mockResolvedValue(failure.response), {
          maxResponseBytes: failure.maxResponseBytes,
        }).generate(baseRequest),
      ).rejects.toMatchObject({
        code,
      })
    },
  )

  it('maps non-JSON provider error responses to retryable HTTP errors', async () => {
    await expect(
      provider(
        vi.fn().mockResolvedValue(
          new Response('Too many requests', {
            status: 429,
            headers: { 'content-type': 'text/plain' },
          }),
        ),
      ).generate(baseRequest),
    ).rejects.toMatchObject({
      code: 'http_error',
      retryable: true,
      details: { status: 429 },
    })
  })

  it('classifies output-budget exhaustion without retaining provider content', async () => {
    await expect(
      provider(
        vi.fn().mockResolvedValue(
          jsonResponse({
            choices: [
              {
                finish_reason: 'length',
                message: { content: null },
              },
            ],
            usage: {
              completion_tokens: 600,
              completion_tokens_details: { reasoning_tokens: 590 },
            },
          }),
        ),
      ).generate(baseRequest),
    ).rejects.toMatchObject({
      code: 'output_budget_exhausted',
      retryable: true,
      details: {
        finishReason: 'length',
        refusalPresent: false,
        completionTokens: 600,
        reasoningTokens: 590,
        maxOutputTokens: 600,
      },
    })
  })

  it('classifies refusals with a bounded category and no refusal prose', async () => {
    let caught: unknown
    try {
      await provider(
        vi.fn().mockResolvedValue(
          jsonResponse({
            choices: [
              {
                finish_reason: 'stop',
                message: {
                  content: '',
                  refusal: 'Private provider refusal prose must not be retained.',
                },
              },
            ],
          }),
        ),
      ).generate(baseRequest)
    } catch (error) {
      caught = error
    }

    expect(caught).toMatchObject({
      code: 'refusal',
      retryable: false,
      details: {
        finishReason: 'stop',
        refusalPresent: true,
        refusalCategory: 'unspecified',
      },
    })
    expect(JSON.stringify(caught)).not.toContain('Private provider refusal prose')
  })

  it('distinguishes malformed success shapes from empty message content', async () => {
    await expect(
      provider(vi.fn().mockResolvedValue(jsonResponse({ choices: [] }))).generate(
        baseRequest,
      ),
    ).rejects.toMatchObject({
      code: 'malformed_response',
      retryable: false,
      details: {
        finishReason: 'missing',
        refusalPresent: false,
      },
    })
  })

  it('classifies genuinely empty content with safe completion metadata', async () => {
    await expect(
      provider(
        vi.fn().mockResolvedValue(
          jsonResponse({
            choices: [
              {
                finish_reason: 'stop',
                message: { content: '   ' },
              },
            ],
            usage: {
              completion_tokens: 4,
              completion_tokens_details: { reasoning_tokens: 0 },
            },
          }),
        ),
      ).generate(baseRequest),
    ).rejects.toMatchObject({
      code: 'empty_content',
      retryable: true,
      details: {
        finishReason: 'stop',
        refusalPresent: false,
        completionTokens: 4,
        reasoningTokens: 0,
        maxOutputTokens: 600,
      },
    })
  })

  it.each([
    ['timeout', () => Object.assign(new Error('aborted'), { name: 'AbortError' })],
    [
      'connection_refused',
      () => Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }),
    ],
  ] as const)('normalizes network failures: %s', async (code, errorFactory) => {
    await expect(
      provider(vi.fn().mockRejectedValue(errorFactory())).generate(baseRequest),
    ).rejects.toMatchObject({
      code,
    })
  })

  it('exposes stable provider errors for app-level handling', () => {
    const error = new AiProviderError({
      code: 'empty_content',
      message: 'Provider returned empty content.',
      routeKey: 'premium',
      retryable: true,
    })

    expect(error.name).toBe('AiProviderError')
    expect(error.statusCode).toBe(502)
    expect(error.retryable).toBe(true)
  })
})

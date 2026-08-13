/**
 * File: tests/modules/ai-feedback/ai-feedback.writing-feedback-routing.test.ts
 * Purpose: Verify queued IELTS writing drafts use the intended configured route metadata.
 * Why: Assignment auto and explicit tiers must preserve the Luna high/medium policy.
 */
import { describe, expect, it } from 'vitest'

import {
  modelForRouteKey,
  reasoningEffortForRouteKey,
  routeKeyForWritingFeedback,
} from '../../../src/modules/ai-feedback/ai-feedback.writing-feedback.support.js'
import type { WritingAssignmentConfig } from '../../../src/modules/ai-feedback/ai-feedback.writing-feedback.types.js'

function assignmentConfig(
  providerTier: 'auto' | 'low_cost' | 'premium',
): WritingAssignmentConfig {
  return {
    aiPolicy: { providerTier },
    task1: { prompt: 'Summarise the chart.' },
    task2: { prompt: 'Discuss both views.' },
  }
}

describe('IELTS writing feedback route metadata', () => {
  it.each([
    ['auto', 'premium', 'high'],
    ['low_cost', 'low_cost', 'medium'],
    ['premium', 'premium', 'high'],
  ] as const)(
    'maps %s policy to the %s Luna route',
    (providerTier, expectedRoute, expectedEffort) => {
      const routeKey = routeKeyForWritingFeedback(assignmentConfig(providerTier))

      expect(routeKey).toBe(expectedRoute)
      expect(modelForRouteKey(routeKey)).toBe('gpt-5.6-luna')
      expect(reasoningEffortForRouteKey(routeKey)).toBe(expectedEffort)
    },
  )
})

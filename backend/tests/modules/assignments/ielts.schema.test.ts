/**
 * File: tests/modules/assignments/ielts.schema.test.ts
 * Purpose: Validate IELTS assignment config schemas.
 * Why: Keeps optional rubric IDs nullable while rejecting invalid selector strings.
 */
import { describe, expect, it } from 'vitest'
import { ZodError } from 'zod'

import { AssignmentType } from '../../../src/prisma/index.js'
import { parseAssignmentConfigForType } from '../../../src/modules/assignments/ielts.schema.js'

const writingConfig = {
  version: 1,
  task1: {
    prompt: 'Describe the chart.',
    rubricId: null,
  },
  task2: {
    prompt: 'Discuss both views.',
    rubricId: null,
  },
}

describe('parseAssignmentConfigForType writing rubric IDs', () => {
  it('accepts nullable rubric IDs for writing tasks', () => {
    expect(() =>
      parseAssignmentConfigForType(AssignmentType.writing, writingConfig),
    ).not.toThrow()
  })

  it('rejects empty strings for writing task rubric IDs', () => {
    expect(() =>
      parseAssignmentConfigForType(AssignmentType.writing, {
        ...writingConfig,
        task1: {
          ...writingConfig.task1,
          rubricId: '',
        },
      }),
    ).toThrow(ZodError)
  })
})

describe('parseAssignmentConfigForType question IDs', () => {
  it('preserves long and whitespace-bearing canonical IDs', () => {
    const questionId = ` question-${'q'.repeat(161)} `
    const parsed = parseAssignmentConfigForType(AssignmentType.reading, {
      version: 1,
      sections: [
        {
          id: 'section-1',
          title: 'Reading section',
          passage: 'Read this passage.',
          questions: [{ id: questionId, prompt: 'Choose the answer.' }],
        },
      ],
    }) as { sections: Array<{ questions: Array<{ id: string }> }> }

    expect(parsed.sections[0]?.questions[0]?.id).toBe(questionId)
  })
})

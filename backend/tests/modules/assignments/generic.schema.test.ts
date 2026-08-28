/**
 * File: tests/modules/assignments/generic.schema.test.ts
 * Purpose: Verify supported generic assignment and submission contracts.
 * Why: Text, link, and file workflows must reject arbitrary or unsafe payloads.
 */
import { describe, expect, it } from 'vitest'

import {
  parseGenericAssignmentConfig,
  parseGenericSubmissionPayload,
} from '../../../src/modules/assignments/generic.schema.js'

describe('generic assignment config validation', () => {
  it('accepts a bounded maximum score for supported generic types', () => {
    expect(parseGenericAssignmentConfig('text', { version: 1, maxScore: 75 })).toEqual({
      version: 1,
      maxScore: 75,
    })
  })

  it('rejects missing, non-positive, excessive, and extended configs', () => {
    expect(() => parseGenericAssignmentConfig('file', undefined)).toThrow()
    expect(() =>
      parseGenericAssignmentConfig('link', { version: 1, maxScore: 0 }),
    ).toThrow()
    expect(() =>
      parseGenericAssignmentConfig('text', { version: 1, maxScore: 10_001 }),
    ).toThrow()
    expect(() =>
      parseGenericAssignmentConfig('text', {
        version: 1,
        maxScore: 100,
        clientOwned: true,
      }),
    ).toThrow()
  })
})

describe('generic submission payload validation', () => {
  it('trims meaningful text and rejects blank or extended payloads', () => {
    expect(parseGenericSubmissionPayload('text', { content: '  My answer  ' })).toEqual({
      content: 'My answer',
    })
    expect(() => parseGenericSubmissionPayload('text', { content: '   ' })).toThrow()
    expect(() =>
      parseGenericSubmissionPayload('text', {
        content: 'Answer',
        studentId: 'spoofed',
      }),
    ).toThrow()
  })

  it('accepts only http and https links', () => {
    expect(
      parseGenericSubmissionPayload('link', {
        link: 'https://example.com/work',
      }),
    ).toEqual({ link: 'https://example.com/work' })
    expect(() =>
      parseGenericSubmissionPayload('link', { link: 'javascript:alert(1)' }),
    ).toThrow()
    expect(() => parseGenericSubmissionPayload('link', { link: 'not a link' })).toThrow()
  })

  it('accepts unique file IDs only and rejects client metadata', () => {
    const fileId = '11111111-1111-4111-8111-111111111111'
    expect(parseGenericSubmissionPayload('file', { files: [{ id: fileId }] })).toEqual({
      files: [{ id: fileId }],
    })
    expect(() => parseGenericSubmissionPayload('file', { files: [] })).toThrow()
    expect(() =>
      parseGenericSubmissionPayload('file', {
        files: [{ id: fileId }, { id: fileId }],
      }),
    ).toThrow()
    expect(() =>
      parseGenericSubmissionPayload('file', {
        files: [{ id: fileId, objectKey: '../../forged' }],
      }),
    ).toThrow()
  })
})

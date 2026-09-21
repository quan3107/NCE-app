/**
 * File: tests/modules/assignments/assignments.student-content.test.ts
 * Purpose: Exercise both learner read boundaries and legitimate author/release behavior.
 * Why: Nested answer aliases and list responses must not bypass detail filtering.
 */
import { beforeEach, expect, test, vi } from 'vitest'
import { UserRole } from '../../../src/prisma/index.js'
import { assignmentForStudent } from '../../../src/modules/assignments/assignments.student-content.js'
import { scoreIeltsSubmission } from '../../../src/modules/scoring/ieltsScoring.utils.js'

vi.mock('../../../src/prisma/client.js', () => ({
  prisma: {
    assignment: { findMany: vi.fn(), findFirst: vi.fn() },
  },
}))
const { prisma } = await import('../../../src/prisma/client.js')
const { listAssignments, getAssignment } =
  await import('../../../src/modules/assignments/assignments.service.js')
const courseId = '7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2'
const assignmentId = '4c67e29f-7a7b-4c3e-8d56-52e5487e59a2'
const actor = { id: 'student', role: UserRole.student }
const config = {
  version: 1,
  sections: [
    {
      id: 'one',
      title: 'One',
      audioFileId: null,
      transcript: 'private transcript',
      playback: { limitPlays: 2 },
      questions: [
        {
          id: 'q1',
          type: 'multiple_choice',
          prompt: 'Pick one',
          options: ['First', 'Second'],
          correctAnswer: 'Second',
          matchingItems: [{ id: 'm1', statement: 'Match me', matchId: 'secret' }],
          diagramLabels: [{ id: 'd1', letter: 'A', position: 'top', answer: 'secret' }],
          items: [
            {
              id: 'i1',
              text: 'Public',
              answerId: 'secret',
              answerParagraph: 'secret',
              answerHeadingId: 'secret',
              answerFeatureId: 'secret',
            },
          ],
        },
      ],
    },
  ],
}
beforeEach(() => vi.clearAllMocks())

test.each(['list', 'detail'])(
  '%s removes private content recursively without mutating teacher/scoring data',
  async (route) => {
    const stored = {
      id: assignmentId,
      type: 'listening',
      assignmentConfig: structuredClone(config),
    }
    vi.mocked(prisma.assignment.findMany).mockResolvedValue([stored] as never)
    vi.mocked(prisma.assignment.findFirst).mockResolvedValue(stored as never)
    const result =
      route === 'list'
        ? (await listAssignments({ courseId }, actor))[0]
        : await getAssignment({ courseId, assignmentId }, actor)
    const text = JSON.stringify(result)
    expect(text).not.toMatch(/private transcript|secret|correctAnswer|matchId|answerId/)
    expect(text).toContain('Match me')
    expect(text).toContain('Second') // Public choices remain available.
    expect(stored.assignmentConfig).toEqual(config)
    const teacher = await getAssignment(
      { courseId, assignmentId },
      { id: 'owner', role: UserRole.teacher },
    )
    expect(teacher.assignmentConfig).toEqual(config)
  },
)

test('stored answer keys still score submissions after learner projection', () => {
  const scoringConfig = {
    version: 1,
    sections: [
      {
        id: 'one',
        title: 'One',
        audioFileId: null,
        questions: [
          {
            id: 'q1',
            type: 'multiple_choice',
            options: ['First', 'Second'],
            correctAnswer: 'Second',
          },
        ],
      },
    ],
  }
  assignmentForStudent({ type: 'listening', assignmentConfig: scoringConfig })
  const result = scoreIeltsSubmission({
    assignmentType: 'listening',
    assignmentConfig: scoringConfig,
    submissionPayload: { version: 1, answers: [{ questionId: 'q1', value: 'Second' }] },
  })
  expect(result?.correctCount).toBe(1)
})

test.each([
  ['immediate', undefined, undefined, true],
  ['after_submission', 'draft', undefined, false],
  ['after_submission', 'submitted', undefined, true],
  ['after_grading', 'submitted', undefined, false],
  ['after_grading', 'graded', new Date(), true],
  ['specific_date', undefined, undefined, true],
] as const)(
  'preserves Writing sample release %s (%s)',
  (timing, status, gradedAt, visible) => {
    const result = assignmentForStudent({
      type: 'writing',
      assignmentConfig: {
        task1: {
          prompt: 'Write',
          sampleResponse: 'Intended sample',
          showSampleToStudents: true,
          showSampleTiming: timing,
          showSampleDate: '2020-01-01T00:00:00Z',
        },
        task2: { prompt: 'Essay' },
      },
      submissions: status
        ? [{ id: 's1', status, grade: { gradedAt: gradedAt ?? null } }]
        : [],
    })
    expect(JSON.stringify(result).includes('Intended sample')).toBe(visible)
    expect(result).not.toHaveProperty('submissions')
  },
)

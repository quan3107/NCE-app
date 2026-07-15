/**
 * File: tests/modules/analytics/analytics.service.test.ts
 * Purpose: Verify analytics filter validation, scoped queries, and CSV parity.
 * Why: Prevents filters and exports from widening teacher course access or drifting from JSON data.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../src/config/prismaClient.js', () => ({
  prisma: {
    course: { findMany: vi.fn() },
    assignment: { findMany: vi.fn() },
    submission: { findMany: vi.fn() },
  },
}))

const prismaModule = await import('../../../src/config/prismaClient.js')
const prisma = vi.mocked(prismaModule.prisma, true)
const { analyticsQuerySchema } =
  await import('../../../src/modules/analytics/analytics.schema.js')
const { getTeacherAnalytics } =
  await import('../../../src/modules/analytics/analytics.service.js')
const { serializeTeacherAnalyticsCsv } =
  await import('../../../src/modules/analytics/analytics.csv.js')

const teacher = { id: '11111111-1111-4111-8111-111111111111', role: 'teacher' }
const courseId = '22222222-2222-4222-8222-222222222222'

describe('analytics filters', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prisma.course.findMany.mockResolvedValue([])
    prisma.assignment.findMany.mockResolvedValue([])
    prisma.submission.findMany.mockResolvedValue([])
  })

  it('validates UTC date ranges, UUIDs, course roles, and formats', () => {
    expect(
      analyticsQuerySchema.parse({
        from: '2026-06-01',
        to: '2026-06-30',
        courseId,
        cohort: 'Evening Cohort',
        role: 'coTeacher',
        format: 'csv',
      }),
    ).toMatchObject({
      courseId,
      cohort: 'Evening Cohort',
      role: 'coTeacher',
      format: 'csv',
      from: new Date('2026-06-01T00:00:00.000Z'),
      toExclusive: new Date('2026-07-01T00:00:00.000Z'),
    })

    expect(() =>
      analyticsQuerySchema.parse({ from: '2026-07-02', to: '2026-07-01' }),
    ).toThrow()
    expect(() => analyticsQuerySchema.parse({ courseId: 'not-a-uuid' })).toThrow()
    expect(() => analyticsQuerySchema.parse({ role: 'student' })).toThrow()
    expect(() => analyticsQuerySchema.parse({ format: 'xlsx' })).toThrow()
  })

  it('ANDs course, cohort, and relationship filters with teacher scope', async () => {
    const filters = analyticsQuerySchema.parse({
      courseId,
      cohort: 'Evening Cohort',
      role: 'coTeacher',
    })

    await getTeacherAnalytics(teacher, filters)

    expect(prisma.course.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: expect.arrayContaining([
            expect.objectContaining({ deletedAt: null }),
            expect.objectContaining({ OR: expect.any(Array) }),
            { id: courseId },
            { scheduleJson: { path: ['label'], equals: 'Evening Cohort' } },
            expect.objectContaining({ enrollments: { some: expect.any(Object) } }),
          ]),
        },
      }),
    )
  })

  it('applies inclusive UTC dates to submittedAt with createdAt fallback', async () => {
    prisma.course.findMany.mockResolvedValue([{ id: courseId, title: 'Writing' }])
    prisma.assignment.findMany.mockResolvedValue([
      { id: 'assignment-1', courseId, dueAt: null },
    ])

    const filters = analyticsQuerySchema.parse({
      from: '2026-06-01',
      to: '2026-06-30',
    })
    await getTeacherAnalytics(teacher, filters)

    expect(prisma.submission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            {
              submittedAt: {
                not: null,
                gte: new Date('2026-06-01T00:00:00.000Z'),
                lt: new Date('2026-07-01T00:00:00.000Z'),
              },
            },
            {
              submittedAt: null,
              createdAt: {
                gte: new Date('2026-06-01T00:00:00.000Z'),
                lt: new Date('2026-07-01T00:00:00.000Z'),
              },
            },
          ],
        }),
      }),
    )
  })

  it('exports stable columns and values from the filtered JSON payload', () => {
    const payload = {
      teacherId: teacher.id,
      courseCount: 1,
      onTimeRate: 50,
      averageScore: null,
      averageTurnaroundDays: 1.25,
      courses: [
        {
          courseId,
          courseTitle: 'Writing, "Advanced"',
          submissionCount: 2,
          gradedCount: 1,
          onTimeRate: 50,
          averageScore: null,
          averageTurnaroundDays: 1.25,
        },
      ],
      rubricAverages: [{ criterion: 'Task response', averageScore: 6.5, sampleSize: 1 }],
      generatedAt: '2026-07-15T00:00:00.000Z',
    }

    const csv = serializeTeacherAnalyticsCsv(payload)
    const lines = csv.trimEnd().split('\r\n')

    expect(lines[0]).toBe(
      'row_type,teacher_id,course_id,course_title,criterion,course_count,submission_count,graded_count,on_time_rate,average_score,average_turnaround_days,sample_size,generated_at',
    )
    expect(lines).toHaveLength(4)
    expect(lines[1]).toContain(',,,,1,,,50,,1.25,,2026-07-15T00:00:00.000Z')
    expect(lines[2]).toContain('"Writing, ""Advanced"""')
    expect(lines[3]).toContain('Task response')
  })
})

/**
 * File: tests/modules/courses/courses.audit-semantics.test.ts
 * Purpose: Verify course update audits describe committed semantic changes.
 * Why: Full-form saves and equivalent JSON must not create false change markers.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UserRole } from '../../../src/prisma/index.js'

vi.mock('../../../src/prisma/client.js', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
    course: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}))
vi.mock('../../../src/modules/audit-logs/audit-logs.service.js', () => ({
  writeAuditLogSafely: vi.fn(),
}))

const prismaModule = await import('../../../src/prisma/client.js')
const prisma = vi.mocked(prismaModule.prisma, true)
const auditModule = await import('../../../src/modules/audit-logs/audit-logs.service.js')
const writeAuditLogSafely = vi.mocked(auditModule.writeAuditLogSafely)
const { updateCourse } = await import('../../../src/modules/courses/courses.service.js')

const courseId = '22222222-2222-4222-8222-222222222222'
const ownerId = '11111111-1111-4111-8111-111111111111'
const actor = { id: ownerId, role: UserRole.teacher }
const currentCourse = {
  id: courseId,
  ownerId,
  title: 'IELTS Writing',
  description: 'Current description',
  learningOutcomes: ['Write clearly'],
  structureSummary: 'Weekly lessons',
  prerequisitesSummary: 'Band 5.5+',
  scheduleJson: { weekday: 'Monday', cadence: 'weekly' },
  deletedAt: null,
}

describe('courses.service.updateCourse audit semantics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prisma.$transaction.mockImplementation(async (callback) => callback(prisma))
    prisma.course.findFirst.mockResolvedValue(currentCourse as never)
  })

  it('suppresses a semantically unchanged full-form update audit', async () => {
    prisma.course.update.mockResolvedValueOnce(currentCourse as never)

    await updateCourse(
      { courseId },
      {
        title: currentCourse.title,
        description: currentCourse.description,
        learningOutcomes: currentCourse.learningOutcomes,
        structureSummary: currentCourse.structureSummary,
        prerequisitesSummary: currentCourse.prerequisitesSummary,
        schedule: { cadence: 'weekly', weekday: 'Monday' },
      },
      actor,
    )

    expect(writeAuditLogSafely).not.toHaveBeenCalled()
  })

  it('emits only the field that changed in a full-form update', async () => {
    prisma.course.update.mockResolvedValueOnce({
      ...currentCourse,
      description: 'Updated description',
    } as never)

    await updateCourse(
      { courseId },
      {
        title: currentCourse.title,
        description: 'Updated description',
        learningOutcomes: currentCourse.learningOutcomes,
        structureSummary: currentCourse.structureSummary,
        prerequisitesSummary: currentCourse.prerequisitesSummary,
        schedule: currentCourse.scheduleJson,
      },
      actor,
    )

    expect(writeAuditLogSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventData: { descriptionChanged: true },
      }),
    )
  })
})

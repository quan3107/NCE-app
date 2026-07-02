/**
 * File: tests/modules/notifications/notifications.service.test.ts
 * Purpose: Validate admin notification recovery workflows.
 * Why: Resend must make dead-lettered notifications eligible for delivery again.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../src/prisma/client.js', () => ({
  prisma: {
    notification: {
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}))

const prismaModule = await import('../../../src/prisma/client.js')
const prismaTypes = await import('../../../src/prisma/index.js')
const prisma = vi.mocked(prismaModule.prisma, true)
const { UserRole } = prismaTypes

const { getNotificationById, markNotificationsRead, resendNotification } =
  await import('../../../src/modules/notifications/notifications.service.js')

describe('notifications.service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('resets retry metadata for admin resend', async () => {
    prisma.notification.findFirst.mockResolvedValueOnce({
      id: '7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2',
      status: 'dead_letter',
      deletedAt: null,
    })
    prisma.notification.updateMany.mockResolvedValueOnce({ count: 1 })
    prisma.notification.findFirst.mockResolvedValueOnce({
      id: '7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2',
      status: 'queued',
      attemptCount: 0,
      failureReason: null,
      deadLetteredAt: null,
      nextAttemptAt: null,
      lastAttemptAt: null,
    })

    const result = await resendNotification({
      notificationId: '7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2',
    })

    expect(prisma.notification.findFirst).toHaveBeenCalledWith({
      where: {
        id: '7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2',
        deletedAt: null,
      },
    })
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: {
        id: '7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2',
        deletedAt: null,
        status: 'dead_letter',
      },
      data: {
        attemptCount: 0,
        deadLetteredAt: null,
        failureReason: null,
        lastAttemptAt: null,
        nextAttemptAt: null,
        readAt: null,
        sentAt: null,
        status: 'queued',
      },
    })
    expect(prisma.notification.update).not.toHaveBeenCalled()
    expect(result.status).toBe('queued')
  })

  it('rejects resend for missing notifications', async () => {
    prisma.notification.findFirst.mockResolvedValueOnce(null)

    await expect(
      resendNotification({
        notificationId: '7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2',
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
    })

    expect(prisma.notification.updateMany).not.toHaveBeenCalled()
  })

  it('allows admin resend for unknown delivery state', async () => {
    prisma.notification.findFirst.mockResolvedValueOnce({
      id: '7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2',
      status: 'delivery_unknown',
      deletedAt: null,
    })
    prisma.notification.updateMany.mockResolvedValueOnce({ count: 1 })
    prisma.notification.findFirst.mockResolvedValueOnce({
      id: '7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2',
      status: 'queued',
    })

    const result = await resendNotification({
      notificationId: '7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2',
    })

    expect(result.status).toBe('queued')
  })

  it('rejects resend when the notification state changes before update', async () => {
    prisma.notification.findFirst.mockResolvedValueOnce({
      id: '7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2',
      status: 'failed',
      deletedAt: null,
    })
    prisma.notification.updateMany.mockResolvedValueOnce({ count: 0 })

    await expect(
      resendNotification({
        notificationId: '7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2',
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
    })
  })

  it('rejects resend for already delivered notifications', async () => {
    prisma.notification.findFirst.mockResolvedValueOnce({
      id: '7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2',
      status: 'sent',
      deletedAt: null,
    })

    await expect(
      resendNotification({
        notificationId: '7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2',
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
    })

    expect(prisma.notification.updateMany).not.toHaveBeenCalled()
  })

  it('marks notifications read without changing delivery status', async () => {
    prisma.notification.updateMany.mockResolvedValueOnce({ count: 2 })

    const result = await markNotificationsRead(
      { userId: '8f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c3' },
      {
        id: '8f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c3',
        role: UserRole.student,
      },
    )

    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: {
        userId: '8f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c3',
        deletedAt: null,
        readAt: null,
      },
      data: {
        readAt: expect.any(Date),
      },
    })
    expect(result.updatedCount).toBe(2)
  })

  it('lets admins inspect notification failure details by id', async () => {
    prisma.notification.findFirst.mockResolvedValueOnce({
      id: '7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2',
      userId: '8f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c3',
      status: 'dead_letter',
      failureReason: 'mailbox unavailable',
      deletedAt: null,
    })

    const result = await getNotificationById(
      { notificationId: '7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2' },
      {
        id: '9f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c4',
        role: UserRole.admin,
      },
    )

    expect(prisma.notification.findFirst).toHaveBeenCalledWith({
      where: {
        id: '7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2',
        deletedAt: null,
      },
    })
    expect(result.failureReason).toBe('mailbox unavailable')
  })
})

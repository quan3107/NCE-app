/**
 * File: tests/modules/notifications/notifications.service.test.ts
 * Purpose: Validate admin notification recovery workflows.
 * Why: Resend must make dead-lettered notifications eligible for delivery again.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../src/prisma/client.js', () => ({
  prisma: {
    notification: {
      create: vi.fn(),
      findMany: vi.fn(),
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

const {
  createNotification,
  getNotificationById,
  listNotifications,
  markNotificationsRead,
  resendNotification,
} = await import('../../../src/modules/notifications/notifications.service.js')

const notificationWithRecoveryMetadata = {
  id: '7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2',
  userId: '8f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c3',
  type: 'due_soon',
  payload: { title: 'Due soon' },
  channel: 'email',
  status: 'dead_letter',
  sentAt: null,
  readAt: null,
  attemptCount: 3,
  maxAttempts: 3,
  nextAttemptAt: null,
  lastAttemptAt: new Date('2026-06-30T10:00:00.000Z'),
  failureReason: 'SMTP token [redacted] failed',
  deadLetteredAt: new Date('2026-06-30T10:00:00.000Z'),
  createdAt: new Date('2026-06-30T09:00:00.000Z'),
  updatedAt: new Date('2026-06-30T10:00:00.000Z'),
  deletedAt: null,
}

const expectNoRecoveryMetadata = (notification: Record<string, unknown>) => {
  expect(notification).not.toHaveProperty('attemptCount')
  expect(notification).not.toHaveProperty('maxAttempts')
  expect(notification).not.toHaveProperty('nextAttemptAt')
  expect(notification).not.toHaveProperty('lastAttemptAt')
  expect(notification).not.toHaveProperty('failureReason')
  expect(notification).not.toHaveProperty('deadLetteredAt')
}

describe('notifications.service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('hides recovery metadata from notification list results', async () => {
    prisma.notification.findMany.mockResolvedValueOnce([notificationWithRecoveryMetadata])

    const result = await listNotifications(
      {
        id: '8f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c3',
        role: UserRole.student,
      },
      {},
    )

    expect(result.data).toHaveLength(1)
    expect(result.data[0]).toMatchObject({
      id: '7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2',
      userId: '8f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c3',
      type: 'due_soon',
      status: 'dead_letter',
    })
    expectNoRecoveryMetadata(result.data[0] as Record<string, unknown>)
  })

  it('hides recovery metadata from non-admin notification lookup', async () => {
    prisma.notification.findFirst.mockResolvedValueOnce(notificationWithRecoveryMetadata)

    const result = await getNotificationById(
      { notificationId: '7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2' },
      {
        id: '8f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c3',
        role: UserRole.student,
      },
    )

    expect(result).toMatchObject({
      id: '7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2',
      userId: '8f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c3',
      type: 'due_soon',
      status: 'dead_letter',
    })
    expectNoRecoveryMetadata(result as Record<string, unknown>)
  })

  it('hides recovery metadata from created notification responses', async () => {
    prisma.notification.create.mockResolvedValueOnce({
      ...notificationWithRecoveryMetadata,
      status: 'queued',
      attemptCount: 0,
      maxAttempts: 3,
      failureReason: null,
      deadLetteredAt: null,
    })

    const result = await createNotification({
      userId: '8f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c3',
      template: 'due_soon',
      channel: 'email',
      payload: { title: 'Due soon' },
    })

    expect(result).toMatchObject({
      id: '7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2',
      userId: '8f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c3',
      type: 'due_soon',
      status: 'queued',
    })
    expectNoRecoveryMetadata(result as Record<string, unknown>)
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
      attemptCount: 3,
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
    expect(result.attemptCount).toBe(3)
  })
})

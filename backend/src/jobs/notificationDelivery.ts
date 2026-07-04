/**
 * File: src/jobs/notificationDelivery.ts
 * Purpose: Deliver queued notifications through in-app or email channels.
 * Why: Separates delivery concerns from scheduling and reminder logic.
 */
import { logger } from '../config/logger.js'
import { resolveNotificationTypeEnabledForUsers } from '../modules/notification-preferences/notification-preferences.service.js'
import { prisma } from '../prisma/client.js'
import { sendNotificationEmail } from '../utils/emailClient.js'

const DELIVERY_BATCH_SIZE = 50
const DEFAULT_MAX_DELIVERY_ATTEMPTS = 3
const SENDING_LEASE_MINUTES = 15

const EMAIL_SUBJECTS: Record<string, string> = {
  due_soon: 'Assignment due soon',
  graded: 'Assignment graded',
  new_submission: 'New student submission',
  weekly_digest: 'Weekly assignment digest',
}

export async function handleDeliverQueuedJob(): Promise<void> {
  const now = new Date()
  const staleSendingBefore = new Date(now.getTime() - SENDING_LEASE_MINUTES * 60 * 1000)
  await recoverStaleSendingNotifications(staleSendingBefore)

  const queuedNotifications = await prisma.notification.findMany({
    where: {
      status: 'queued',
      deletedAt: null,
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
    },
    include: {
      user: {
        select: {
          email: true,
          fullName: true,
          role: true,
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
    take: DELIVERY_BATCH_SIZE,
  })

  if (queuedNotifications.length === 0) {
    logger.debug('Delivery job found no queued notifications')
    return
  }

  const teacherPreferenceCache = new Map<string, boolean>()

  for (const notification of queuedNotifications) {
    try {
      const claimResult = await prisma.notification.updateMany({
        where: {
          id: notification.id,
          deletedAt: null,
          OR: [
            {
              status: 'queued',
              OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
            },
          ],
        },
        data: {
          lastAttemptAt: now,
          status: 'sending',
        },
      })
      if (claimResult.count !== 1) {
        logger.info(
          {
            event: 'notification_delivery_claim_lost',
            notification_id: notification.id,
          },
          'Queued notification delivery claim skipped',
        )
        continue
      }
    } catch (error) {
      logger.error(
        {
          err: error,
          event: 'notification_delivery_claim_failed',
          notification_id: notification.id,
        },
        'Notification delivery claim failed',
      )
      continue
    }

    try {
      if (notification.user.role === 'teacher') {
        const cacheKey = `${notification.userId}:${notification.type}`
        let enabled = teacherPreferenceCache.get(cacheKey)
        if (enabled === undefined) {
          const enabledMap = await resolveNotificationTypeEnabledForUsers({
            role: 'teacher',
            type: notification.type,
            userIds: [notification.userId],
          })
          enabled = enabledMap.get(notification.userId) ?? false
          teacherPreferenceCache.set(cacheKey, enabled)
        }

        if (!enabled) {
          logger.info(
            {
              event: 'notification_delivery_suppressed_by_preference',
              notification_id: notification.id,
              user_id: notification.userId,
              type: notification.type,
            },
            'Queued notification delivery suppressed because preference is disabled',
          )
          const suppressionResult = await prisma.notification.updateMany({
            where: {
              id: notification.id,
              deletedAt: null,
              status: 'sending',
            },
            data: {
              failureReason: 'suppressed_by_preference',
              lastAttemptAt: now,
              status: 'suppressed',
            },
          })
          if (suppressionResult.count !== 1) {
            logger.info(
              {
                event: 'notification_delivery_suppression_transition_lost',
                notification_id: notification.id,
              },
              'Notification suppression skipped because delivery state changed',
            )
          }
          continue
        }
      }

      if (notification.channel === 'email') {
        const subject = EMAIL_SUBJECTS[notification.type] ?? 'Notification update'
        const bodyText = [
          subject,
          '',
          `Recipient: ${notification.user.fullName}`,
          '',
          'Payload:',
          JSON.stringify(notification.payload ?? {}, null, 2),
        ].join('\n')

        if (!notification.user.email) {
          throw new Error('Missing recipient email')
        }

        await sendNotificationEmail({
          to: notification.user.email,
          toName: notification.user.fullName,
          subject,
          bodyText,
        })
      }
    } catch (error) {
      await recordDeliveryFailure(notification, error, now)
      continue
    }

    try {
      const sentResult = await prisma.notification.updateMany({
        where: {
          id: notification.id,
          deletedAt: null,
          status: 'sending',
        },
        data: {
          failureReason: null,
          lastAttemptAt: now,
          nextAttemptAt: null,
          status: 'sent',
          sentAt: now,
        },
      })
      if (sentResult.count !== 1) {
        logger.info(
          {
            event: 'notification_delivery_sent_transition_lost',
            notification_id: notification.id,
          },
          'Notification sent status skipped because delivery state changed',
        )
        continue
      }
      logger.info(
        {
          event: 'notification_delivery_sent',
          notification_id: notification.id,
          user_id: notification.userId,
          type: notification.type,
          channel: notification.channel,
        },
        'Queued notification delivered',
      )
    } catch (error) {
      await markDeliveryUnknown(notification.id)
      logger.error(
        {
          err: error,
          event: 'notification_delivery_sent_persistence_failed',
          notification_id: notification.id,
          user_id: notification.userId,
          type: notification.type,
          channel: notification.channel,
        },
        'Notification sent but status persistence failed',
      )
    }
  }
}

type QueuedNotification = Awaited<ReturnType<typeof prisma.notification.findMany>>[number]

async function recoverStaleSendingNotifications(staleSendingBefore: Date): Promise<void> {
  const result = await prisma.notification.updateMany({
    where: {
      status: 'sending',
      deletedAt: null,
      lastAttemptAt: { lte: staleSendingBefore },
    },
    data: {
      failureReason: 'delivery_state_unknown',
      nextAttemptAt: null,
      status: 'delivery_unknown',
    },
  })

  if (result.count > 0) {
    logger.error(
      {
        event: 'notification_delivery_unknown_recovered',
        recovered_count: result.count,
      },
      'Stale notification delivery claims require manual review',
    )
  }
}

async function markDeliveryUnknown(notificationId: string): Promise<void> {
  try {
    await prisma.notification.updateMany({
      where: {
        id: notificationId,
        deletedAt: null,
        status: 'sending',
      },
      data: {
        failureReason: 'delivery_state_unknown',
        nextAttemptAt: null,
        status: 'delivery_unknown',
      },
    })
  } catch (error) {
    logger.error(
      {
        err: error,
        event: 'notification_delivery_unknown_persistence_failed',
        notification_id: notificationId,
      },
      'Notification delivery state could not be marked unknown',
    )
  }
}

async function recordDeliveryFailure(
  notification: QueuedNotification,
  error: unknown,
  attemptedAt: Date,
): Promise<void> {
  const attemptCount = notification.attemptCount + 1
  const maxAttempts =
    notification.maxAttempts > 0
      ? notification.maxAttempts
      : DEFAULT_MAX_DELIVERY_ATTEMPTS
  const failureReason = redactFailureReason(error)

  if (attemptCount >= maxAttempts) {
    logger.error(
      {
        err: error,
        event: 'notification_delivery_dead_lettered',
        notification_id: notification.id,
        attempt_count: attemptCount,
        max_attempts: maxAttempts,
      },
      'Notification delivery dead-lettered',
    )
    const failureResult = await prisma.notification.updateMany({
      where: {
        id: notification.id,
        deletedAt: null,
        status: 'sending',
      },
      data: {
        attemptCount: { increment: 1 },
        deadLetteredAt: attemptedAt,
        failureReason,
        lastAttemptAt: attemptedAt,
        nextAttemptAt: null,
        status: 'dead_letter',
      },
    })
    if (failureResult.count !== 1) {
      logger.info(
        {
          event: 'notification_delivery_failure_transition_lost',
          notification_id: notification.id,
        },
        'Notification dead-letter transition skipped because delivery state changed',
      )
    }
    return
  }

  const nextAttemptAt = calculateNextAttemptAt(attemptCount, attemptedAt)
  logger.info(
    {
      err: error,
      event: 'notification_delivery_retry_scheduled',
      notification_id: notification.id,
      attempt_count: attemptCount,
      max_attempts: maxAttempts,
      next_attempt_at: nextAttemptAt.toISOString(),
    },
    'Notification delivery retry scheduled',
  )
  const failureResult = await prisma.notification.updateMany({
    where: {
      id: notification.id,
      deletedAt: null,
      status: 'sending',
    },
    data: {
      attemptCount: { increment: 1 },
      failureReason,
      lastAttemptAt: attemptedAt,
      nextAttemptAt,
      status: 'queued',
    },
  })
  if (failureResult.count !== 1) {
    logger.info(
      {
        event: 'notification_delivery_failure_transition_lost',
        notification_id: notification.id,
      },
      'Notification retry transition skipped because delivery state changed',
    )
  }
}

function calculateNextAttemptAt(attemptCount: number, attemptedAt: Date): Date {
  const delayMinutes = Math.min(60, 2 ** attemptCount)
  return new Date(attemptedAt.getTime() + delayMinutes * 60 * 1000)
}

function redactFailureReason(error: unknown): string {
  const rawReason = error instanceof Error ? error.message : String(error)
  let redactedReason = rawReason.replace(
    /\b(authorization)\b\s*[:=]\s*(?:bearer|basic)?\s*[^\s,;]+/gi,
    (_match, label: string) => `${label}: [redacted]`,
  )
  redactedReason = redactedReason.replace(
    /\b(password|token|secret|api[_-]?key)\b\s*[:=]?\s*\S+/gi,
    (_match, label: string) => `${label} [redacted]`,
  )
  return redactedReason.slice(0, 500)
}

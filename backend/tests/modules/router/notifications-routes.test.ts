/**
 * File: tests/modules/router/notifications-routes.test.ts
 * Purpose: Verify notification recovery routes are mounted and protected.
 * Why: Resend is an admin-only recovery action and must not be callable by regular users.
 */
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { UserRole } from '../../../src/prisma/index.js'

const notificationId = '7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2'
const adminId = '8f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c3'
const teacherId = '9f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c4'

vi.mock('../../../src/modules/notifications/notifications.service.js', () => ({
  createNotification: vi.fn(),
  getNotificationById: vi.fn(),
  listNotifications: vi.fn(),
  markNotificationsRead: vi.fn(),
  resendNotification: vi.fn(async () => ({
    id: notificationId,
    status: 'queued',
  })),
}))

const notificationService =
  await import('../../../src/modules/notifications/notifications.service.js')
const { app } = await import('../../../src/app.js')

const asRole = (userId: string, role: UserRole) => ({
  'x-user-id': userId,
  'x-user-role': role,
})

describe('modules.router notification routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('forbids non-admin users from resending notifications', async () => {
    const response = await request(app)
      .post(`/api/v1/notifications/${notificationId}/resend`)
      .set(asRole(teacherId, UserRole.teacher))

    expect(response.status).toBe(403)
    expect(response.body).toEqual({ message: 'Forbidden' })
    expect(notificationService.resendNotification).not.toHaveBeenCalled()
  })

  it('allows admins to resend notifications', async () => {
    const response = await request(app)
      .post(`/api/v1/notifications/${notificationId}/resend`)
      .set(asRole(adminId, UserRole.admin))

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      id: notificationId,
      status: 'queued',
    })
    expect(notificationService.resendNotification).toHaveBeenCalledWith({
      notificationId,
    })
  })
})

/**
 * File: tests/modules/router/users-routes.test.ts
 * Purpose: Verify user administration routes are mounted and protected.
 * Why: Ensures teacher approval and invite actions remain admin-only.
 */
import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { app } from '../../../src/app.js'

const validUserId = '7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2'

describe('modules.router users routes', () => {
  it.each([
    ['post', 'invite', '/api/v1/users/invite'],
    ['post', 'approve', `/api/v1/users/${validUserId}/approve-teacher`],
    ['post', 'reject', `/api/v1/users/${validUserId}/reject-teacher`],
    ['patch', 'status', `/api/v1/users/${validUserId}/status`],
    ['delete', 'delete', `/api/v1/users/${validUserId}`],
  ])('requires auth for %s', async (method, _name, path) => {
    const response = await request(app)[method](path)

    expect(response.status).not.toBe(404)
    expect(response.status).toBe(401)
  })

  it.each([
    ['post', 'invite', '/api/v1/users/invite'],
    ['post', 'approve', `/api/v1/users/${validUserId}/approve-teacher`],
    ['post', 'reject', `/api/v1/users/${validUserId}/reject-teacher`],
    ['patch', 'status', `/api/v1/users/${validUserId}/status`],
    ['delete', 'delete', `/api/v1/users/${validUserId}`],
  ])('forbids non-admin users for %s', async (method, _name, path) => {
    const response = await request(app)
      [method](path)
      .set('x-user-id', validUserId)
      .set('x-user-role', 'teacher')

    expect(response.status).not.toBe(404)
    expect(response.status).toBe(403)
  })
})

/**
 * File: tests/modules/router/cms-routes.test.ts
 * Purpose: Verify CMS endpoints are mounted and access controls are enforced.
 * Why: Prevents regressions in public marketing reads and admin-only stats refresh.
 */

import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { app } from '../../../src/app.js'

describe('modules.router cms routes', () => {
  it('mounts GET /api/v1/cms/homepage-content', async () => {
    const response = await request(app).get('/api/v1/cms/homepage-content')

    expect(response.status).not.toBe(404)
  })

  it('mounts GET /api/v1/cms/about-page-content', async () => {
    const response = await request(app).get('/api/v1/cms/about-page-content')

    expect(response.status).not.toBe(404)
  })

  it('requires auth for POST /api/v1/cms/refresh-stats', async () => {
    const response = await request(app).post('/api/v1/cms/refresh-stats')

    expect(response.status).not.toBe(404)
    expect(response.status).toBe(401)
  })

  it('forbids non-admin users for POST /api/v1/cms/refresh-stats', async () => {
    const response = await request(app)
      .post('/api/v1/cms/refresh-stats')
      .set('x-user-id', '7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2')
      .set('x-user-role', 'teacher')

    expect(response.status).not.toBe(404)
    expect(response.status).toBe(403)
  })
})

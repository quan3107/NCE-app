/**
 * File: tests/modules/router/cms-routes.test.ts
 * Purpose: Verify CMS endpoints are mounted and access controls are enforced.
 * Why: Prevents regressions in public marketing reads and admin-only stats refresh.
 */

import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../src/modules/cms/cms.service.js', () => ({
  getHomepageContent: vi.fn(async () => ({
    hero: {
      title: 'Test hero',
      subtitle: 'Test subtitle',
      description: 'Test description',
      image: '/test.png',
      cta: { label: 'Start', href: '/courses' },
    },
    stats: [],
    howItWorks: {
      title: 'How it works',
      description: 'Test description',
      features: [],
    },
  })),
  getAboutPageContent: vi.fn(async () => ({
    hero: {
      title: 'About NCE',
      subtitle: 'Test subtitle',
      description: 'Test description',
      image: '/about.png',
    },
    values: [],
    story: { sections: [] },
  })),
  getContactPageContent: vi.fn(async () => ({
    header: { title: 'Contact', description: 'Get in touch.' },
    form: { title: 'Message us', description: 'We can help.', submitLabel: 'Send' },
    details: { email: 'support@example.com', phone: '+1 555 0100', address: 'Office' },
    hours: [],
  })),
  listCmsPages: vi.fn(async () => ({ pages: [] })),
  getCmsDraft: vi.fn(async () => ({ pageKey: 'homepage', content: {} })),
  updateCmsDraft: vi.fn(async () => ({ pageKey: 'homepage', content: {} })),
  getCmsPreview: vi.fn(async () => ({ pageKey: 'homepage', content: {} })),
  publishCmsDraft: vi.fn(async () => ({ pageKey: 'homepage', content: {} })),
  listCmsRevisions: vi.fn(async () => ({ revisions: [] })),
  rollbackCmsRevision: vi.fn(async () => ({ pageKey: 'homepage', content: {} })),
  updateHomepageStatsWithRealtimeData: vi.fn(async () => undefined),
}))

import { app } from '../../../src/app.js'
import * as cmsService from '../../../src/modules/cms/cms.service.js'

describe('modules.router cms routes', () => {
  it('mounts GET /api/v1/cms/homepage-content', async () => {
    const response = await request(app).get('/api/v1/cms/homepage-content')

    expect(response.status).not.toBe(404)
  })

  it('mounts GET /api/v1/cms/about-page-content', async () => {
    const response = await request(app).get('/api/v1/cms/about-page-content')

    expect(response.status).not.toBe(404)
  })

  it('mounts GET /api/v1/cms/contact-page-content', async () => {
    const response = await request(app).get('/api/v1/cms/contact-page-content')

    expect(response.status).toBe(200)
  })

  it('requires admin auth for CMS draft and revision routes', async () => {
    const endpoints = [
      request(app).get('/api/v1/cms/admin/pages'),
      request(app).get('/api/v1/cms/admin/pages/homepage/draft'),
      request(app).put('/api/v1/cms/admin/pages/homepage/draft').send({ content: {} }),
      request(app).get('/api/v1/cms/admin/pages/homepage/preview'),
      request(app).post('/api/v1/cms/admin/pages/homepage/publish'),
      request(app).get('/api/v1/cms/admin/pages/homepage/revisions'),
      request(app).post('/api/v1/cms/admin/pages/homepage/revisions/revision-1/rollback'),
    ]

    const responses = await Promise.all(endpoints)
    expect(responses.every((response) => response.status === 401)).toBe(true)
  })

  it('publishes the reviewed content only at the expected draft version', async () => {
    const content = {
      hero: {
        badge: 'Badge',
        title: 'Reviewed title',
        description: 'Description',
        cta_primary: 'Browse',
        cta_secondary: 'Sign in',
      },
      stats: [],
      howItWorks: { title: 'How it works', description: 'Steps', features: [] },
    }
    const response = await request(app)
      .post('/api/v1/cms/admin/pages/homepage/publish')
      .set('x-user-id', '15eb1f4b-09a0-48e1-8844-c8f5cf7fa30b')
      .set('x-user-role', 'admin')
      .send({ content, expectedDraftVersion: 4 })

    expect(response.status).toBe(200)
    expect(cmsService.publishCmsDraft).toHaveBeenCalledWith(
      'homepage',
      content,
      4,
      expect.objectContaining({ id: '15eb1f4b-09a0-48e1-8844-c8f5cf7fa30b' }),
    )
  })

  it('rejects unknown publish request properties', async () => {
    const response = await request(app)
      .post('/api/v1/cms/admin/pages/homepage/publish')
      .set('x-user-id', '15eb1f4b-09a0-48e1-8844-c8f5cf7fa30b')
      .set('x-user-role', 'admin')
      .send({ content: {}, expectedDraftVersion: 4, unexpected: true })

    expect(response.status).toBe(400)
  })

  it('requires auth for POST /api/v1/cms/refresh-stats', async () => {
    const response = await request(app).post('/api/v1/cms/refresh-stats')

    expect(response.status).not.toBe(404)
    expect(response.status).toBe(401)
  })

  it('forbids non-admin users for POST /api/v1/cms/refresh-stats', async () => {
    // Header-based auth (x-user-id/x-user-role) is dev/test-only and is
    // rejected in production. This test relies on NODE_ENV=test to use headers.
    const response = await request(app)
      .post('/api/v1/cms/refresh-stats')
      .set('x-user-id', '7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2')
      .set('x-user-role', 'teacher')

    expect(response.status).not.toBe(404)
    expect(response.status).toBe(403)
  })
})

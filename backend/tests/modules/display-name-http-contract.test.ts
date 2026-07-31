/**
 * File: tests/modules/display-name-http-contract.test.ts
 * Purpose: Exercise normalized display names through the public HTTP entry points.
 * Why: OpenAPI request schemas must accept every representation normalized at runtime.
 */
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authService = vi.hoisted(() => ({
  REFRESH_TOKEN_TTL_MS: 60_000,
  buildGoogleAuthorizationUrl: vi.fn(),
  completeGoogleAuthorization: vi.fn(),
  handleLogout: vi.fn(),
  handlePasswordLogin: vi.fn(),
  handleRegisterAccount: vi.fn(),
  handleSessionRefresh: vi.fn(),
}))
const usersService = vi.hoisted(() => ({
  approveTeacherRequest: vi.fn(),
  createUser: vi.fn(),
  getUserById: vi.fn(),
  inviteUser: vi.fn(),
  listUsers: vi.fn(),
  rejectTeacherRequest: vi.fn(),
}))

vi.mock('../../src/modules/auth/auth.service.js', () => authService)
vi.mock('../../src/modules/users/users.service.js', () => usersService)

const { registerAccountSchema } = await import('../../src/modules/auth/auth.schema.js')
const { createUserSchema, inviteUserSchema } =
  await import('../../src/modules/users/users.schema.js')
const { app } = await import('../../src/app.js')

const adminId = '7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2'
const responseUser = (fullName: string) => ({
  id: '498f18ef-5414-4d79-a729-f68bdcc6d6df',
  email: 'ada@example.com',
  fullName,
  role: 'student' as const,
  status: 'active' as const,
})

describe('normalized display-name HTTP contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authService.handleRegisterAccount.mockImplementation(async (input) => {
      const parsed = registerAccountSchema.parse(input)
      return {
        user: responseUser(parsed.fullName),
        accessToken: 'access',
        refreshToken: 'refresh',
        refreshTokenExpiresAt: new Date(Date.now() + 60_000),
      }
    })
    usersService.createUser.mockImplementation(async (input) => {
      const parsed = createUserSchema.parse(input)
      return responseUser(parsed.fullName)
    })
    usersService.inviteUser.mockImplementation(async (input) => {
      const parsed = inviteUserSchema.parse(input)
      return responseUser(parsed.fullName)
    })
  })

  it('accepts and normalizes registration whitespace', async () => {
    const response = await request(app).post('/api/v1/auth/register').send({
      fullName: '  Ada Lovelace  ',
      email: 'ada@example.com',
      password: 'password',
      role: 'student',
    })

    expect(response.status).toBe(201)
    expect(response.body.user.fullName).toBe('Ada Lovelace')
  })

  it.each([
    ['creation', '/api/v1/users'],
    ['invitation', '/api/v1/users/invite'],
  ])('accepts and normalizes admin user %s whitespace', async (_label, path) => {
    const response = await request(app)
      .post(path)
      .set('x-user-id', adminId)
      .set('x-user-role', 'admin')
      .set('x-user-status', 'active')
      .send({
        fullName: '  Ada Lovelace  ',
        email: 'ada@example.com',
        role: 'student',
        status: 'active',
      })

    expect(response.status).toBe(201)
    expect(response.body.fullName).toBe('Ada Lovelace')
  })
})

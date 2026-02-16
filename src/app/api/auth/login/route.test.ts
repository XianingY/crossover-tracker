import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  consumeRateLimit: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  createSupabaseAnonClient: vi.fn(),
  isAdminAuthConfigured: vi.fn(),
  isAdminRole: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  consumeRateLimit: mocks.consumeRateLimit,
}))

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseAnonClient: mocks.createSupabaseAnonClient,
}))

vi.mock('@/lib/admin-auth', () => ({
  ADMIN_ACCESS_COOKIE: 'ct_access_token',
  ADMIN_REFRESH_COOKIE: 'ct_refresh_token',
  isAdminAuthConfigured: mocks.isAdminAuthConfigured,
  isAdminRole: mocks.isAdminRole,
}))

import { POST } from './route'

function buildRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/auth/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': '10.0.0.1',
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.consumeRateLimit.mockResolvedValue({ ok: true, retryAfterMs: 0, remaining: 19 })
    mocks.createSupabaseAnonClient.mockReturnValue({
      auth: {
        signInWithPassword: mocks.signInWithPassword,
        signOut: mocks.signOut,
      },
    })
    mocks.isAdminAuthConfigured.mockReturnValue(true)
  })

  it('rejects non-admin users', async () => {
    mocks.signInWithPassword.mockResolvedValue({
      error: null,
      data: {
        user: { id: 'user-1', email: 'u@example.com', app_metadata: { role: 'user' } },
        session: { access_token: 'token', refresh_token: 'refresh', expires_in: 3600 },
      },
    })
    mocks.isAdminRole.mockReturnValue(false)

    const response = await POST(buildRequest({ email: 'u@example.com', password: '12345678' }))
    const payload = (await response.json()) as { error?: string }

    expect(response.status).toBe(403)
    expect(payload.error).toBe('Account is not an admin')
    expect(mocks.signOut).toHaveBeenCalledTimes(1)
  })

  it('returns 429 when rate-limited', async () => {
    mocks.consumeRateLimit.mockResolvedValue({ ok: false, retryAfterMs: 2500, remaining: 0 })

    const response = await POST(buildRequest({ email: 'u@example.com', password: '12345678' }))
    const payload = (await response.json()) as { error?: string }

    expect(response.status).toBe(429)
    expect(payload.error).toContain('Too many login attempts')
    expect(response.headers.get('Retry-After')).toBe('3')
  })
})

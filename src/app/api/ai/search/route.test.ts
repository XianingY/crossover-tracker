import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  consumeRateLimit: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  consumeRateLimit: mocks.consumeRateLimit,
}))

import { GET } from './route'

describe('GET /api/ai/search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 429 when rate limited', async () => {
    mocks.consumeRateLimit.mockResolvedValue({ ok: false, retryAfterMs: 1400, remaining: 0 })
    const request = new NextRequest('http://localhost/api/ai/search?mode=identify&q=test')

    const response = await GET(request)
    const payload = (await response.json()) as { error?: string }

    expect(response.status).toBe(429)
    expect(payload.error).toContain('Too many AI search requests')
    expect(response.headers.get('Retry-After')).toBe('2')
  })
})

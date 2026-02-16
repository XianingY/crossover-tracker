import { describe, expect, it, vi } from 'vitest'
import { consumeRateLimit } from './rate-limit'

describe('consumeRateLimit', () => {
  it('blocks requests after reaching the limit', async () => {
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_000)
    const key = `test-rate-limit-${crypto.randomUUID()}`

    const first = await consumeRateLimit(key, 2, 60_000)
    const second = await consumeRateLimit(key, 2, 60_000)
    const third = await consumeRateLimit(key, 2, 60_000)

    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    expect(third.ok).toBe(false)
    expect(third.retryAfterMs).toBeGreaterThan(0)

    nowSpy.mockRestore()
  })

  it('resets after the window expires', async () => {
    const nowSpy = vi.spyOn(Date, 'now')
    const key = `test-rate-limit-reset-${crypto.randomUUID()}`

    nowSpy.mockReturnValue(10_000)
    expect((await consumeRateLimit(key, 1, 5_000)).ok).toBe(true)
    expect((await consumeRateLimit(key, 1, 5_000)).ok).toBe(false)

    nowSpy.mockReturnValue(16_000)
    expect((await consumeRateLimit(key, 1, 5_000)).ok).toBe(true)

    nowSpy.mockRestore()
  })
})

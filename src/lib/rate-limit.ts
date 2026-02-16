interface RateLimitEntry {
  count: number
  resetAt: number
}

interface RateLimitStore {
  entries: Map<string, RateLimitEntry>
}

const globalForRateLimit = globalThis as unknown as {
  crossoverRateLimitStore?: RateLimitStore
}

const store: RateLimitStore =
  globalForRateLimit.crossoverRateLimitStore ??
  {
    entries: new Map<string, RateLimitEntry>(),
  }

if (!globalForRateLimit.crossoverRateLimitStore) {
  globalForRateLimit.crossoverRateLimitStore = store
}

function gc(now: number): void {
  for (const [key, entry] of store.entries.entries()) {
    if (entry.resetAt <= now) {
      store.entries.delete(key)
    }
  }
}

export function consumeRateLimit(key: string, limit: number, windowMs: number): {
  ok: boolean
  remaining: number
  retryAfterMs: number
} {
  const now = Date.now()
  gc(now)

  const existing = store.entries.get(key)
  if (!existing || existing.resetAt <= now) {
    store.entries.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: Math.max(0, limit - 1), retryAfterMs: 0 }
  }

  if (existing.count >= limit) {
    return { ok: false, remaining: 0, retryAfterMs: Math.max(0, existing.resetAt - now) }
  }

  existing.count += 1
  store.entries.set(key, existing)
  return { ok: true, remaining: Math.max(0, limit - existing.count), retryAfterMs: 0 }
}

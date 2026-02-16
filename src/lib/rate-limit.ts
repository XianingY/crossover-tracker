import { getUpstashRedis } from '@/lib/upstash'

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

function windowKey(baseKey: string, nowMs: number, windowMs: number): string {
  const bucket = Math.floor(nowMs / windowMs)
  return `ct:rl:${baseKey}:${bucket}`
}

async function consumeRateLimitInRedis(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ ok: boolean; remaining: number; retryAfterMs: number }> {
  const redis = getUpstashRedis()
  if (!redis) {
    return consumeRateLimitInMemory(key, limit, windowMs)
  }

  const nowMs = Date.now()
  const ttlSeconds = Math.max(1, Math.ceil(windowMs / 1000))
  const redisKey = windowKey(key, nowMs, windowMs)

  const multi = redis.multi()
  multi.incr(redisKey)
  multi.expire(redisKey, ttlSeconds)
  const results = await multi.exec<[number, number]>()

  const current = Number(results[0] ?? 0)
  if (current > limit) {
    const pttl = await redis.pttl(redisKey)
    return {
      ok: false,
      remaining: 0,
      retryAfterMs: typeof pttl === 'number' && pttl > 0 ? pttl : windowMs,
    }
  }

  return {
    ok: true,
    remaining: Math.max(0, limit - current),
    retryAfterMs: 0,
  }
}

function consumeRateLimitInMemory(
  key: string,
  limit: number,
  windowMs: number
): { ok: boolean; remaining: number; retryAfterMs: number } {
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

export async function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<{
  ok: boolean
  remaining: number
  retryAfterMs: number
}> {
  try {
    return await consumeRateLimitInRedis(key, limit, windowMs)
  } catch (error) {
    console.error('Rate limit backend failed; falling back to in-memory store:', error)
    return consumeRateLimitInMemory(key, limit, windowMs)
  }
}

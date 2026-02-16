import { getUpstashRedis } from '@/lib/upstash'

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

interface CacheStore {
  entries: Map<string, CacheEntry<unknown>>
}

const globalForRequestCache = globalThis as unknown as {
  crossoverRequestCacheStore?: CacheStore
}

const store: CacheStore =
  globalForRequestCache.crossoverRequestCacheStore ??
  {
    entries: new Map<string, CacheEntry<unknown>>(),
  }

if (!globalForRequestCache.crossoverRequestCacheStore) {
  globalForRequestCache.crossoverRequestCacheStore = store
}

function now(): number {
  return Date.now()
}

function getValidMemoryEntry<T>(key: string): CacheEntry<T> | null {
  const cached = store.entries.get(key) as CacheEntry<T> | undefined
  if (!cached) return null

  if (cached.expiresAt <= now()) {
    store.entries.delete(key)
    return null
  }

  return cached
}

async function getFromRedis<T>(key: string): Promise<T | null> {
  const redis = getUpstashRedis()
  if (!redis) return null

  const cacheKey = `ct:cache:${key}`
  const value = await redis.get<string>(cacheKey)
  if (!value) return null

  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

async function setInRedis<T>(key: string, value: T, ttlMs: number): Promise<void> {
  const redis = getUpstashRedis()
  if (!redis) return

  const cacheKey = `ct:cache:${key}`
  const ttlSeconds = Math.max(1, Math.ceil(ttlMs / 1000))
  await redis.set(cacheKey, JSON.stringify(value), { ex: ttlSeconds })
}

export async function getCachedValue<T>(key: string): Promise<T | null> {
  try {
    const redisValue = await getFromRedis<T>(key)
    if (redisValue !== null) {
      return redisValue
    }
  } catch (error) {
    console.error('Redis cache get failed; falling back to memory cache:', error)
  }

  const entry = getValidMemoryEntry<T>(key)
  return entry ? entry.value : null
}

export async function setCachedValue<T>(key: string, value: T, ttlMs: number): Promise<void> {
  store.entries.set(key, {
    value,
    expiresAt: now() + ttlMs,
  })

  try {
    await setInRedis(key, value, ttlMs)
  } catch (error) {
    console.error('Redis cache set failed; using memory cache only:', error)
  }
}

export async function getOrSetCachedValue<T>(
  key: string,
  ttlMs: number,
  producer: () => Promise<T>
): Promise<{ value: T; hit: boolean }> {
  const cached = await getCachedValue<T>(key)
  if (cached !== null) {
    return { value: cached, hit: true }
  }

  const value = await producer()
  await setCachedValue(key, value, ttlMs)
  return { value, hit: false }
}

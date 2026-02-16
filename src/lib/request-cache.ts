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

function getValidEntry<T>(key: string): CacheEntry<T> | null {
  const cached = store.entries.get(key) as CacheEntry<T> | undefined
  if (!cached) return null

  if (cached.expiresAt <= now()) {
    store.entries.delete(key)
    return null
  }

  return cached
}

export function getCachedValue<T>(key: string): T | null {
  const entry = getValidEntry<T>(key)
  return entry ? entry.value : null
}

export function setCachedValue<T>(key: string, value: T, ttlMs: number): void {
  store.entries.set(key, {
    value,
    expiresAt: now() + ttlMs,
  })
}

export async function getOrSetCachedValue<T>(
  key: string,
  ttlMs: number,
  producer: () => Promise<T>
): Promise<{ value: T; hit: boolean }> {
  const cached = getCachedValue<T>(key)
  if (cached !== null) {
    return { value: cached, hit: true }
  }

  const value = await producer()
  setCachedValue(key, value, ttlMs)
  return { value, hit: false }
}

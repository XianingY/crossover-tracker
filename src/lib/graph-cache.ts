import { getUpstashRedis } from '@/lib/upstash'

const GRAPH_VERSION_KEY = 'ct:graph:version'
const GRAPH_SNAPSHOT_KEY_PREFIX = 'ct:graph:snapshot'
const DEFAULT_GRAPH_CACHE_TTL_MS = 60 * 1000

interface GraphCacheEntry<TNode, TLink> {
  value: GraphSnapshot<TNode, TLink>
  expiresAt: number
}

interface GraphCacheStore {
  version: number
  entries: Map<string, GraphCacheEntry<unknown, unknown>>
}

export interface GraphSnapshot<TNode = unknown, TLink = unknown> {
  nodes: TNode[]
  links: TLink[]
  cachedAt: string
}

const globalForGraphCache = globalThis as unknown as {
  crossoverGraphCacheStore?: GraphCacheStore
}

const store: GraphCacheStore =
  globalForGraphCache.crossoverGraphCacheStore ??
  {
    version: 1,
    entries: new Map<string, GraphCacheEntry<unknown, unknown>>(),
  }

if (!globalForGraphCache.crossoverGraphCacheStore) {
  globalForGraphCache.crossoverGraphCacheStore = store
}

function parseVersion(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return Math.floor(raw)
  }

  if (typeof raw === 'string') {
    const parsed = Number.parseInt(raw, 10)
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed
    }
  }

  return null
}

async function getGraphVersion(): Promise<number> {
  const redis = getUpstashRedis()
  if (!redis) {
    return store.version
  }

  const redisVersion = parseVersion(await redis.get<number | string>(GRAPH_VERSION_KEY))
  if (redisVersion) {
    store.version = redisVersion
    return store.version
  }

  await redis.set(GRAPH_VERSION_KEY, store.version)
  return store.version
}

function memoryEntryKey(centralId: string, version: number): string {
  return `${version}:${centralId}`
}

function redisEntryKey(centralId: string, version: number): string {
  return `${GRAPH_SNAPSHOT_KEY_PREFIX}:${version}:${centralId}`
}

function getMemorySnapshot<TNode, TLink>(
  centralId: string,
  version: number
): GraphSnapshot<TNode, TLink> | null {
  const key = memoryEntryKey(centralId, version)
  const cached = store.entries.get(key)
  if (!cached) {
    return null
  }

  if (cached.expiresAt <= Date.now()) {
    store.entries.delete(key)
    return null
  }

  return cached.value as GraphSnapshot<TNode, TLink>
}

function setMemorySnapshot<TNode, TLink>(
  centralId: string,
  version: number,
  value: GraphSnapshot<TNode, TLink>,
  ttlMs: number
): void {
  const key = memoryEntryKey(centralId, version)
  store.entries.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  })
}

async function getRedisSnapshot<TNode, TLink>(
  centralId: string,
  version: number
): Promise<GraphSnapshot<TNode, TLink> | null> {
  const redis = getUpstashRedis()
  if (!redis) {
    return null
  }

  const key = redisEntryKey(centralId, version)
  const cached = await redis.get<GraphSnapshot<TNode, TLink>>(key)
  if (!cached || typeof cached !== 'object') {
    return null
  }

  if (!Array.isArray(cached.nodes) || !Array.isArray(cached.links)) {
    return null
  }

  return cached
}

async function setRedisSnapshot<TNode, TLink>(
  centralId: string,
  version: number,
  value: GraphSnapshot<TNode, TLink>,
  ttlMs: number
): Promise<void> {
  const redis = getUpstashRedis()
  if (!redis) {
    return
  }

  const key = redisEntryKey(centralId, version)
  const ttlSeconds = Math.max(1, Math.ceil(ttlMs / 1000))
  await redis.set(key, value, { ex: ttlSeconds })
}

export async function withGraphSnapshotCache<TNode, TLink>(
  centralId: string,
  producer: () => Promise<GraphSnapshot<TNode, TLink>>,
  ttlMs: number = DEFAULT_GRAPH_CACHE_TTL_MS
): Promise<{ value: GraphSnapshot<TNode, TLink>; hit: boolean }> {
  const version = await getGraphVersion()
  const memoryCached = getMemorySnapshot<TNode, TLink>(centralId, version)
  if (memoryCached) {
    return { value: memoryCached, hit: true }
  }

  try {
    const redisCached = await getRedisSnapshot<TNode, TLink>(centralId, version)
    if (redisCached) {
      setMemorySnapshot(centralId, version, redisCached, ttlMs)
      return { value: redisCached, hit: true }
    }
  } catch (error) {
    console.error('Graph cache get failed; falling back to local cache:', error)
  }

  const value = await producer()
  setMemorySnapshot(centralId, version, value, ttlMs)

  try {
    await setRedisSnapshot(centralId, version, value, ttlMs)
  } catch (error) {
    console.error('Graph cache set failed; using local cache only:', error)
  }

  return { value, hit: false }
}

export async function invalidateGraphSnapshotCache(): Promise<number> {
  store.version += 1
  store.entries.clear()

  const redis = getUpstashRedis()
  if (!redis) {
    return store.version
  }

  try {
    const newVersion = parseVersion(await redis.incr(GRAPH_VERSION_KEY))
    if (newVersion) {
      store.version = newVersion
    }
  } catch (error) {
    console.error('Graph cache invalidation failed in Redis; local cache invalidated only:', error)
  }

  return store.version
}

import { Redis } from '@upstash/redis'

let redisClient: Redis | null | undefined

function getUpstashUrl(): string | undefined {
  return process.env.UPSTASH_REDIS_REST_URL
}

function getUpstashToken(): string | undefined {
  return process.env.UPSTASH_REDIS_REST_TOKEN
}

export function isUpstashConfigured(): boolean {
  return Boolean(getUpstashUrl() && getUpstashToken())
}

export function getUpstashRedis(): Redis | null {
  if (redisClient !== undefined) {
    return redisClient
  }

  const url = getUpstashUrl()
  const token = getUpstashToken()
  if (!url || !token) {
    redisClient = null
    return redisClient
  }

  redisClient = new Redis({ url, token })
  return redisClient
}

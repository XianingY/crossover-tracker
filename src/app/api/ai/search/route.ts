import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { searchConnections, searchEvidence, identifyWorks } from '@/services/ai.service'
import { prisma } from '@/lib/prisma'
import { consumeRateLimit } from '@/lib/rate-limit'
import { getOrSetCachedValue } from '@/lib/request-cache'
import { captureApiException } from '@/lib/observability'

const modeSchema = z.enum(['identify', 'connections', 'evidence'])

interface ApiConnection {
  fromWork: string
  toWork: string
  relationType: string
  evidence: string
  evidenceUrl: string
  source: 'db' | 'ai'
  fromImage?: string
  toImage?: string
  sourceName?: string
  sourceLevel?: 'official' | 'trusted' | 'other'
}

interface IdentifyResponse {
  type: 'identify'
  query: string
  workCandidates: Awaited<ReturnType<typeof identifyWorks>>
  foundInDb: Awaited<ReturnType<typeof prisma.work.findMany>>
}

interface ConnectionsResponse {
  type: 'connections'
  query: string
  connections: ApiConnection[]
}

interface EvidenceResponse {
  type: 'evidence'
  workA: string
  workB: string
  evidence: Awaited<ReturnType<typeof searchEvidence>>
}

type AiSearchResponse = IdentifyResponse | ConnectionsResponse | EvidenceResponse

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown'
  }
  return request.headers.get('x-real-ip') || 'unknown'
}

function getCacheTtlMs(mode: z.infer<typeof modeSchema>): number {
  if (mode === 'identify') return 60 * 1000
  if (mode === 'connections') return 90 * 1000
  return 120 * 1000
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  const rateLimit = await consumeRateLimit(`ai-search:${ip}`, 40, 10 * 60 * 1000)
  if (!rateLimit.ok) {
    const retryAfterSeconds = Math.ceil(rateLimit.retryAfterMs / 1000)
    return NextResponse.json(
      { error: 'Too many AI search requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfterSeconds),
        },
      }
    )
  }

  const searchParams = request.nextUrl.searchParams
  const rawMode = searchParams.get('mode') || 'identify'
  const modeResult = modeSchema.safeParse(rawMode)
  if (!modeResult.success) {
    return NextResponse.json({ error: `Invalid mode: ${rawMode}` }, { status: 400 })
  }

  const mode = modeResult.data
  const query = searchParams.get('q')?.trim() || ''
  const workA = searchParams.get('workA')?.trim() || ''
  const workB = searchParams.get('workB')?.trim() || ''

  if ((mode === 'identify' || mode === 'connections') && !query) {
    return NextResponse.json({ error: 'Missing query parameter: q' }, { status: 400 })
  }

  if (mode === 'evidence' && (!workA || !workB)) {
    return NextResponse.json({ error: 'Missing workA or workB parameter' }, { status: 400 })
  }

  if (query.length > 120 || workA.length > 120 || workB.length > 120) {
    return NextResponse.json({ error: 'Query is too long (max 120 characters)' }, { status: 400 })
  }

  const cacheKey = `ai-search:v2:${mode}:${query.toLowerCase()}:${workA.toLowerCase()}:${workB.toLowerCase()}`
  const cacheTtlMs = getCacheTtlMs(mode)

  try {
    const { value: responsePayload } = await getOrSetCachedValue<AiSearchResponse>(
      cacheKey,
      cacheTtlMs,
      async () => {
        switch (mode) {
          case 'identify': {
            const workCandidates = await identifyWorks(query)
            const foundInDb = await prisma.work.findMany({
              where: {
                title: { contains: query, mode: 'insensitive' },
              },
            })

            return {
              type: 'identify',
              query,
              workCandidates,
              foundInDb,
            }
          }

          case 'connections': {
            const dbConnections: ApiConnection[] = []
            const dbWorks = await prisma.work.findMany({
              where: { title: { contains: query, mode: 'insensitive' } },
              include: {
                connectionsFrom: {
                  include: { toWork: true },
                },
                connectionsTo: {
                  include: { fromWork: true },
                },
              },
            })

            for (const work of dbWorks) {
              for (const conn of work.connectionsFrom) {
                dbConnections.push({
                  fromWork: work.title,
                  toWork: conn.toWork.title,
                  relationType: conn.relationType,
                  evidence: conn.description || '数据库已有记录',
                  evidenceUrl: '',
                  source: 'db',
                })
              }
              for (const conn of work.connectionsTo) {
                dbConnections.push({
                  fromWork: conn.fromWork.title,
                  toWork: work.title,
                  relationType: conn.relationType,
                  evidence: conn.description || '数据库已有记录',
                  evidenceUrl: '',
                  source: 'db',
                })
              }
            }

            const aiConnections = await searchConnections(query)
            const aiWithSource: ApiConnection[] = aiConnections.map(connection => ({
              ...connection,
              source: 'ai',
            }))

            const seen = new Set<string>()
            const merged: ApiConnection[] = []
            for (const connection of [...dbConnections, ...aiWithSource]) {
              const key = `${connection.fromWork}-${connection.toWork}`.toLowerCase()
              const reverseKey = `${connection.toWork}-${connection.fromWork}`.toLowerCase()
              if (!seen.has(key) && !seen.has(reverseKey)) {
                seen.add(key)
                merged.push(connection)
              }
            }

            return {
              type: 'connections',
              query,
              connections: merged,
            }
          }

          case 'evidence': {
            const evidence = await searchEvidence(workA, workB)
            return {
              type: 'evidence',
              workA,
              workB,
              evidence,
            }
          }
        }
      }
    )

    return NextResponse.json(responsePayload)
  } catch (error) {
    console.error('AI search error:', error)
    captureApiException('/api/ai/search', error, {
      mode,
      query,
      workA,
      workB,
    })
    const message = error instanceof Error ? error.message : 'Search failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

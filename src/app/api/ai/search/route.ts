import { NextRequest, NextResponse } from 'next/server'
import { searchConnections, searchEvidence, identifyWorks } from '@/services/ai.service'
import { prisma } from '@/lib/prisma'
import { consumeRateLimit } from '@/lib/rate-limit'

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

export async function GET(request: NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for')
  const ip = forwardedFor?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
  const rateLimit = consumeRateLimit(`ai-search:${ip}`, 40, 10 * 60 * 1000)
  if (!rateLimit.ok) {
    const retryAfterSeconds = Math.ceil(rateLimit.retryAfterMs / 1000)
    return NextResponse.json(
      { error: 'Too many AI search requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfterSeconds)
        }
      }
    )
  }

  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q')
  const mode = searchParams.get('mode') || 'identify'

  if (!query) {
    return NextResponse.json({ error: 'Missing query parameter: q' }, { status: 400 })
  }

  try {
    switch (mode) {
      case 'identify': {
        const workCandidates = await identifyWorks(query)

        const foundInDb = await prisma.work.findMany({
          where: {
            title: { contains: query, mode: 'insensitive' }
          }
        })

        return NextResponse.json({
          type: 'identify',
          query,
          workCandidates,
          foundInDb
        })
      }

      case 'connections': {
        // First, check the local database for existing connections
        const dbConnections: ApiConnection[] = []
        const dbWorks = await prisma.work.findMany({
          where: { title: { contains: query, mode: 'insensitive' } },
          include: {
            connectionsFrom: {
              include: { toWork: true }
            },
            connectionsTo: {
              include: { fromWork: true }
            }
          }
        })

        for (const work of dbWorks) {
          for (const conn of work.connectionsFrom) {
            dbConnections.push({
              fromWork: work.title,
              toWork: conn.toWork.title,
              relationType: conn.relationType,
              evidence: conn.description || '数据库已有记录',
              evidenceUrl: '',
              source: 'db'
            })
          }
          for (const conn of work.connectionsTo) {
            dbConnections.push({
              fromWork: conn.fromWork.title,
              toWork: work.title,
              relationType: conn.relationType,
              evidence: conn.description || '数据库已有记录',
              evidenceUrl: '',
              source: 'db'
            })
          }
        }

        // Then search the web for more connections
        const aiConnections = await searchConnections(query)
        const aiWithSource: ApiConnection[] = aiConnections.map(c => ({ ...c, source: 'ai' }))

        // Merge and deduplicate by target work name
        const seen = new Set<string>()
        const merged: ApiConnection[] = []
        for (const conn of [...dbConnections, ...aiWithSource]) {
          const key = `${conn.fromWork}-${conn.toWork}`.toLowerCase()
          const reverseKey = `${conn.toWork}-${conn.fromWork}`.toLowerCase()
          if (!seen.has(key) && !seen.has(reverseKey)) {
            seen.add(key)
            merged.push(conn)
          }
        }

        return NextResponse.json({ type: 'connections', query, connections: merged })
      }

      case 'evidence': {
        const workA = searchParams.get('workA')
        const workB = searchParams.get('workB')
        if (!workA || !workB) {
          return NextResponse.json({ error: 'Missing workA or workB parameter' }, { status: 400 })
        }
        const evidence = await searchEvidence(workA, workB)
        return NextResponse.json({ type: 'evidence', workA, workB, evidence })
      }

      default:
        return NextResponse.json({ error: `Invalid mode: ${mode}` }, { status: 400 })
    }
  } catch (error) {
    console.error('AI search error:', error)
    const message = error instanceof Error ? error.message : 'Search failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { searchWeb, searchConnections, searchEvidence, identifyWorks } from '@/services/ai.service'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
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
        const connections = await searchConnections(query)
        return NextResponse.json({ type: 'connections', query, connections })
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

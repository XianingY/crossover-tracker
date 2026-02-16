import { NextRequest, NextResponse } from 'next/server'
import { searchEvidence } from '@/services/ai.service'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { workA, workB, connectionId } = body

    if (!workA || !workB) {
      return NextResponse.json({ error: 'Missing workA or workB parameter' }, { status: 400 })
    }

    const webEvidence = await searchEvidence(workA, workB)

    const savedEvidence = []
    for (const evidence of webEvidence) {
      if (connectionId) {
        const saved = await prisma.evidence.create({
          data: {
            connectionId,
            type: 'link',
            url: evidence.url,
            description: evidence.snippet,
            status: 'PENDING',
            submittedBy: 'AI'
          }
        })
        savedEvidence.push(saved)
      }
    }

    return NextResponse.json({
      success: true,
      webEvidence,
      savedEvidence
    })
  } catch (error) {
    console.error('Evidence save error:', error)
    const message = error instanceof Error ? error.message : 'Failed to save evidence'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

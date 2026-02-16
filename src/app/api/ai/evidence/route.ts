import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { searchEvidence } from '@/services/ai.service'
import { prisma } from '@/lib/prisma'
import { consumeRateLimit } from '@/lib/rate-limit'
import { getOrSetCachedValue } from '@/lib/request-cache'

const requestSchema = z.object({
  workA: z.string().trim().min(1).max(120),
  workB: z.string().trim().min(1).max(120),
  connectionId: z.preprocess(
    value => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().trim().min(1).optional()
  ),
})

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown'
  }
  return request.headers.get('x-real-ip') || 'unknown'
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const rateLimit = consumeRateLimit(`ai-evidence:${ip}`, 20, 10 * 60 * 1000)
  if (!rateLimit.ok) {
    const retryAfterSeconds = Math.ceil(rateLimit.retryAfterMs / 1000)
    return NextResponse.json(
      { error: 'Too many AI evidence requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfterSeconds),
        },
      }
    )
  }

  try {
    const body = await request.json()
    const parsed = requestSchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues.map(issue => issue.message).join('; ')
      return NextResponse.json({ error: message || 'Invalid request body' }, { status: 400 })
    }

    const { workA, workB, connectionId } = parsed.data
    const cacheKey = `ai-evidence:${workA.toLowerCase()}:${workB.toLowerCase()}`
    const { value: webEvidence } = await getOrSetCachedValue(
      cacheKey,
      120 * 1000,
      () => searchEvidence(workA, workB)
    )

    const savedEvidence = []
    for (const evidence of webEvidence) {
      if (!connectionId) continue

      const saved = await prisma.evidence.create({
        data: {
          connectionId,
          type: 'link',
          url: evidence.url,
          description: evidence.snippet,
          status: 'PENDING',
          submittedBy: 'AI',
          source: 'AI',
          scrapedAt: new Date(),
        },
      })
      savedEvidence.push(saved)
    }

    return NextResponse.json({
      success: true,
      webEvidence,
      savedEvidence,
    })
  } catch (error) {
    console.error('Evidence save error:', error)
    const message = error instanceof Error ? error.message : 'Failed to save evidence'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

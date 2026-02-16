import { NextRequest, NextResponse } from 'next/server'
import { analyzeImage } from '@/services/ai.service'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { imageUrl, prompt } = body

    if (!imageUrl) {
      return NextResponse.json({ error: 'Missing imageUrl parameter' }, { status: 400 })
    }

    const analysis = await analyzeImage(imageUrl, prompt)

    const matchedWorks = analysis.workName 
      ? await prisma.work.findMany({
          where: {
            title: { contains: analysis.workName, mode: 'insensitive' }
          }
        })
      : []

    return NextResponse.json({
      analysis,
      matchedWorks,
      suggestions: analysis.workName ? [analysis.workName, ...(analysis.characters || [])] : []
    })
  } catch (error) {
    console.error('Image analysis error:', error)
    const message = error instanceof Error ? error.message : 'Analysis failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

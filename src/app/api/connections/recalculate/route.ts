import { NextResponse } from 'next/server'
import { GraphService } from '@/services/graph.service'

/**
 * Re-calculate levels for all nodes in the graph relative to the central work.
 */
export async function POST() {
  try {
    const result = await GraphService.recalculateLevels()

    if (!result.success) {
      return NextResponse.json(
        { error: 'No central work found to calculate limits from.' },
        { status: 400 }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Recalculation failed:', error)
    const message = error instanceof Error ? error.message : 'Internal server error during recalculation'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}

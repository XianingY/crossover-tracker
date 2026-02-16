import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { GraphService } from '@/services/graph.service'

// 审核证据
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  
  try {
    const body = await request.json()
    const { status, rejectReason } = body
    
    const evidence = await prisma.evidence.update({
      where: { id },
      data: {
        status: status.toUpperCase(),
        rejectReason
      }
    })
    
    // 如果批准了证据，触发层级重新计算
    if (status.toUpperCase() === 'APPROVED') {
      await GraphService.recalculateLevels()
    }
    
    return NextResponse.json(evidence)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to review evidence' },
      { status: 400 }
    )
  }
}

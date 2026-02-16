import { NextRequest, NextResponse } from 'next/server'
import { invalidateGraphSnapshotCache } from '@/lib/graph-cache'
import { prisma } from '@/lib/prisma'
import { GraphService } from '@/services/graph.service'

// 获取联动详情
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  
  const connection = await prisma.connection.findUnique({
    where: { id },
    include: {
      fromWork: true,
      toWork: true,
      evidences: {
        include: {
          work: true
        }
      }
    }
  })
  
  if (!connection) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  
  return NextResponse.json(connection)
}

// 删除联动
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  
  try {
    await prisma.$transaction(async (tx) => {
      await tx.evidence.deleteMany({
        where: { connectionId: id }
      })

      await tx.connection.delete({
        where: { id }
      })
    })
    
    // 重新计算层级
    const recalcResult = await GraphService.recalculateLevels()
    if (!recalcResult.success) {
      await invalidateGraphSnapshotCache()
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete connection'
    return NextResponse.json(
      { error: message },
      { status: 400 }
    )
  }
}

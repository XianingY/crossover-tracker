import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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
      await recalculateLevels()
    }
    
    return NextResponse.json(evidence)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to review evidence' },
      { status: 400 }
    )
  }
}

async function recalculateLevels() {
  const centralWork = await prisma.work.findFirst({
    where: { isCentral: true }
  })
  
  if (!centralWork) return
  
  const levels = new Map<string, number>()
  levels.set(centralWork.id, 0)
  
  let queue = [centralWork.id]
  
  while (queue.length > 0) {
    const currentIds = [...queue]
    queue = []
    
    for (const currentId of currentIds) {
      const currentLevel = levels.get(currentId)!
      
      const connections = await prisma.connection.findMany({
        where: {
          fromWorkId: currentId,
          evidences: {
            some: { status: 'APPROVED' }
          }
        }
      })
      
      for (const conn of connections) {
        if (!levels.has(conn.toWorkId)) {
          levels.set(conn.toWorkId, currentLevel + 1)
          queue.push(conn.toWorkId)
        }
      }
    }
  }
  
  const updates = Array.from(levels.entries()).map(([workId, level]) =>
    prisma.connection.updateMany({
      where: { toWorkId: workId },
      data: { level }
    })
  )
  
  await prisma.$transaction(updates)
}

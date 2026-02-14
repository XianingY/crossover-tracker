import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 重新计算层级
export async function POST() {
  const centralWork = await prisma.work.findFirst({
    where: { isCentral: true }
  })
  
  if (!centralWork) {
    return NextResponse.json(
      { error: 'No central work set' },
      { status: 400 }
    )
  }
  
  // BFS 计算层级
  const levels = new Map<string, number>()
  levels.set(centralWork.id, 0)
  
  let queue = [centralWork.id]
  
  while (queue.length > 0) {
    const currentIds = [...queue]
    queue = []
    
    for (const currentId of currentIds) {
      const currentLevel = levels.get(currentId)!
      
      // 找出所有有效的联动（有通过证据的）
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
  
  // 批量更新层级
  const updates = Array.from(levels.entries()).map(([workId, level]) =>
    prisma.connection.updateMany({
      where: { toWorkId: workId },
      data: { level }
    })
  )
  
  await prisma.$transaction(updates)
  
  return NextResponse.json({
    success: true,
    updated: levels.size
  })
}

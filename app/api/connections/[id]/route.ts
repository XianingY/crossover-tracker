import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 获取联动详情
export async function GET(
  request: NextRequest,
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
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  
  try {
    // 先删除关联的证据
    await prisma.evidence.deleteMany({
      where: { connectionId: id }
    })
    
    // 删除联动
    await prisma.connection.delete({
      where: { id }
    })
    
    // 重新计算层级
    await recalculateLevels()
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to delete connection' },
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
  
  let queue: string[] = [centralWork.id]
  
  while (queue.length > 0) {
    const currentId = queue.shift()!
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
  
  for (const [workId, level] of levels) {
    await prisma.connection.updateMany({
      where: { toWorkId: workId },
      data: { level }
    })
  }
}

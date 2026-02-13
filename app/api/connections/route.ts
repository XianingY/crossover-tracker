import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 获取联动列表
export async function GET(request: NextRequest) {
  const connections = await prisma.connection.findMany({
    include: {
      fromWork: true,
      toWork: true,
      _count: {
        select: { evidences: true }
      }
    }
  })
  
  return NextResponse.json(connections)
}

// 创建联动关系
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fromWorkId, toWorkId, relationType, description } = body
    
    // 检查是否已存在相同联动
    const existing = await prisma.connection.findUnique({
      where: {
        fromWorkId_toWorkId_relationType: {
          fromWorkId,
          toWorkId,
          relationType
        }
      }
    })
    
    if (existing) {
      return NextResponse.json(
        { error: 'Connection already exists' },
        { status: 400 }
      )
    }
    
    const connection = await prisma.connection.create({
      data: {
        fromWorkId,
        toWorkId,
        relationType,
        description,
        level: 1 // 初始为1，创建后会重新计算
      }
    })
    
    // 触发层级重新计算
    await recalculateLevels()
    
    return NextResponse.json(connection, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to create connection' },
      { status: 400 }
    )
  }
}

// 层级计算函数
async function recalculateLevels() {
  const centralWork = await prisma.work.findFirst({
    where: { isCentral: true }
  })
  
  if (!centralWork) return
  
  // BFS 计算从中心到每个作品的最短距离
  const levels = new Map<string, number>()
  levels.set(centralWork.id, 0)
  
  let queue: string[] = [centralWork.id]
  
  while (queue.length > 0) {
    const currentId = queue.shift()!
    const currentLevel = levels.get(currentId)!
    
    // 找出所有从当前作品出发的联动（有通过证据的）
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
  
  // 更新所有联动的层级
  for (const [workId, level] of levels) {
    await prisma.connection.updateMany({
      where: { toWorkId: workId },
      data: { level }
    })
  }
}

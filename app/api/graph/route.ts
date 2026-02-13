import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const centralWork = await prisma.work.findFirst({
    where: { isCentral: true }
  })
  
  if (!centralWork) {
    return NextResponse.json({ nodes: [], links: [] })
  }
  
  // 获取所有与中心作品直接或间接关联的作品（有通过证据的联动）
  const connections = await prisma.connection.findMany({
    where: {
      // 只包含有通过证据的联动
      evidences: {
        some: { status: 'APPROVED' }
      }
    },
    include: {
      fromWork: true,
      toWork: true
    }
  })
  
  // 构建节点列表
  const nodeIds = new Set<string>([centralWork.id])
  const nodes: any[] = [{
    id: centralWork.id,
    title: centralWork.title,
    type: centralWork.type,
    isCentral: true,
    coverUrl: centralWork.coverUrl,
    level: 0
  }]
  
  const links: any[] = []
  
  for (const conn of connections) {
    nodeIds.add(conn.toWorkId)
    
    // 添加目标节点
    nodes.push({
      id: conn.toWork.id,
      title: conn.toWork.title,
      type: conn.toWork.type,
      isCentral: conn.toWork.isCentral,
      coverUrl: conn.toWork.coverUrl,
      level: conn.level
    })
    
    links.push({
      source: conn.fromWorkId,
      target: conn.toWorkId,
      relationType: conn.relationType,
      level: conn.level
    })
  }
  
  return NextResponse.json({ nodes, links })
}

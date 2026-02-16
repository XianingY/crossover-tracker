import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { GraphService } from '@/services/graph.service'

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
    await GraphService.recalculateLevels()
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to delete connection' },
      { status: 400 }
    )
  }
}

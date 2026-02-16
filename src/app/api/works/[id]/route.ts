import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { GraphService } from '@/services/graph.service'

// 获取作品详情
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  
  const work = await prisma.work.findUnique({
    where: { id },
    include: {
      connectionsFrom: {
        include: {
          toWork: true,
          evidences: {
            where: { status: 'APPROVED' }
          }
        }
      },
      connectionsTo: {
        include: {
          fromWork: true,
          evidences: {
            where: { status: 'APPROVED' }
          }
        }
      }
    }
  })
  
  if (!work) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  
  return NextResponse.json(work)
}

// 更新作品
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  
  try {
    const body = await request.json()

    const work = await prisma.work.update({
      where: { id },
      data: {
        title: body.title,
        type: body.type?.toUpperCase(),
        description: body.description,
        coverUrl: body.coverUrl,
        isCentral: body.isCentral
      }
    })
    
    return NextResponse.json(work)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update work'
    return NextResponse.json(
      { error: message },
      { status: 400 }
    )
  }
}

// 删除作品
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  
  try {
    await prisma.$transaction(async (tx) => {
      // 找到所有关联 connection
      const connections = await tx.connection.findMany({
        where: {
          OR: [
            { fromWorkId: id },
            { toWorkId: id }
          ]
        },
        select: { id: true }
      })

      const connectionIds = connections.map(c => c.id)

      // 删除证据
      await tx.evidence.deleteMany({
        where: {
          OR: [
            { connectionId: { in: connectionIds } },
            { workId: id }
          ]
        }
      })

      // 删除联动
      await tx.connection.deleteMany({
        where: {
          OR: [
            { fromWorkId: id },
            { toWorkId: id }
          ]
        }
      })

      // 删除作品
      await tx.work.delete({
        where: { id }
      })
    })

    await GraphService.recalculateLevels()
    
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete work'
    return NextResponse.json(
      { error: message },
      { status: 400 }
    )
  }
}

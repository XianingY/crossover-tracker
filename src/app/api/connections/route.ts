import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { GraphService } from '@/services/graph.service'

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
    await GraphService.recalculateLevels()

    return NextResponse.json(connection, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to create connection' },
      { status: 400 }
    )
  }
}

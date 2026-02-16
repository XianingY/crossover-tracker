import { WorkType } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { invalidateGraphSnapshotCache } from '@/lib/graph-cache'
import { prisma } from '@/lib/prisma'
import { GraphService } from '@/services/graph.service'

const workTypeSchema = z
  .string()
  .trim()
  .transform(value => value.toUpperCase())
  .pipe(z.nativeEnum(WorkType))

const nullableTextSchema = z.preprocess(
  value => {
    if (value === null) return null
    if (typeof value !== 'string') return value
    const trimmed = value.trim()
    return trimmed.length === 0 ? null : trimmed
  },
  z.string().max(2000).nullable().optional()
)

const nullableUrlSchema = z.preprocess(
  value => {
    if (value === null) return null
    if (typeof value !== 'string') return value
    const trimmed = value.trim()
    return trimmed.length === 0 ? null : trimmed
  },
  z.string().url().max(2000).nullable().optional()
)

const updateWorkSchema = z
  .object({
    title: z.preprocess(
      value => (typeof value === 'string' ? value.trim() : value),
      z.string().min(1).max(200)
    ).optional(),
    type: workTypeSchema.optional(),
    description: nullableTextSchema,
    coverUrl: nullableUrlSchema,
    isCentral: z.boolean().optional(),
  })
  .refine(data => Object.values(data).some(value => value !== undefined), {
    message: 'At least one valid field must be provided',
  })

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
    const parsed = updateWorkSchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues.map(issue => issue.message).join('; ')
      return NextResponse.json({ error: message || 'Invalid request body' }, { status: 400 })
    }

    const work = await prisma.work.update({
      where: { id },
      data: {
        title: parsed.data.title,
        type: parsed.data.type,
        description: parsed.data.description,
        coverUrl: parsed.data.coverUrl,
        isCentral: parsed.data.isCentral,
      }
    })

    await invalidateGraphSnapshotCache()
    
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

    const recalcResult = await GraphService.recalculateLevels()
    if (!recalcResult.success) {
      await invalidateGraphSnapshotCache()
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete work'
    return NextResponse.json(
      { error: message },
      { status: 400 }
    )
  }
}

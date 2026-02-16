import { WorkType } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { invalidateGraphSnapshotCache } from '@/lib/graph-cache'
import { prisma } from '@/lib/prisma'
import { buildAliasRecords } from '@/lib/work-alias'
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
    aliases: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
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
      aliases: {
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      },
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

    const work = await prisma.$transaction(async tx => {
      const existing = await tx.work.findUnique({
        where: { id },
        select: { id: true, title: true },
      })
      if (!existing) {
        throw new Error('Work not found')
      }

      const nextTitle = parsed.data.title || existing.title
      const updated = await tx.work.update({
        where: { id },
        data: {
          title: parsed.data.title,
          type: parsed.data.type,
          description: parsed.data.description,
          coverUrl: parsed.data.coverUrl,
          isCentral: parsed.data.isCentral,
        }
      })

      if (parsed.data.aliases !== undefined) {
        const aliasRecords = buildAliasRecords(nextTitle, parsed.data.aliases)
        await tx.workAlias.deleteMany({
          where: { workId: id },
        })

        if (aliasRecords.length > 0) {
          await tx.workAlias.createMany({
            data: aliasRecords.map(record => ({
              workId: id,
              alias: record.alias,
              normalizedAlias: record.normalizedAlias,
              isPrimary: record.isPrimary,
            })),
            skipDuplicates: true,
          })
        }
      } else if (nextTitle !== existing.title) {
        const titleAlias = buildAliasRecords(nextTitle, [])[0]
        if (titleAlias) {
          await tx.workAlias.updateMany({
            where: { workId: id, isPrimary: true },
            data: { isPrimary: false },
          })

          await tx.workAlias.createMany({
            data: [
              {
                workId: id,
                alias: titleAlias.alias,
                normalizedAlias: titleAlias.normalizedAlias,
                isPrimary: true,
              },
            ],
            skipDuplicates: true,
          })

          await tx.workAlias.updateMany({
            where: {
              workId: id,
              normalizedAlias: titleAlias.normalizedAlias,
            },
            data: {
              alias: titleAlias.alias,
              isPrimary: true,
            },
          })
        }
      }

      return tx.work.findUniqueOrThrow({
        where: { id: updated.id },
        include: {
          aliases: {
            orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          },
        },
      })
    })

    await invalidateGraphSnapshotCache()
    
    return NextResponse.json(work)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update work'
    if (message === 'Work not found') {
      return NextResponse.json({ error: message }, { status: 404 })
    }
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

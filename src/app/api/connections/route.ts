import { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { attachPaginationHeaders, parsePaginationParams } from '@/lib/pagination'
import { GraphService } from '@/services/graph.service'

const relationTypeQuerySchema = z.string().trim().min(1).max(50)

const createConnectionSchema = z.object({
  fromWorkId: z.string().trim().min(1),
  toWorkId: z.string().trim().min(1),
  relationType: relationTypeQuerySchema,
  description: z.preprocess(
    value => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().trim().max(2000).optional()
  ),
})

// 获取联动列表
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const fromWorkId = searchParams.get('fromWorkId')?.trim() || undefined
  const toWorkId = searchParams.get('toWorkId')?.trim() || undefined
  const rawRelationType = searchParams.get('relationType')

  let relationType: string | undefined
  if (rawRelationType) {
    const parsedRelationType = relationTypeQuerySchema.safeParse(rawRelationType)
    if (!parsedRelationType.success) {
      return NextResponse.json({ error: 'Invalid relationType parameter' }, { status: 400 })
    }
    relationType = parsedRelationType.data
  }

  const paginationResult = parsePaginationParams(searchParams, {
    defaultPageSize: 30,
    maxPageSize: 100,
  })
  if (!paginationResult.ok) {
    return NextResponse.json({ error: paginationResult.error }, { status: 400 })
  }

  const { pagination } = paginationResult
  const where: Prisma.ConnectionWhereInput = {}
  if (fromWorkId) where.fromWorkId = fromWorkId
  if (toWorkId) where.toWorkId = toWorkId
  if (relationType) where.relationType = relationType

  const queryOptions: Prisma.ConnectionFindManyArgs = {
    where,
    include: {
      fromWork: true,
      toWork: true,
      _count: {
        select: { evidences: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  }

  let total = 0
  if (pagination.enabled) {
    queryOptions.skip = pagination.skip
    queryOptions.take = pagination.take
    total = await prisma.connection.count({ where })
  }

  const connections = await prisma.connection.findMany(queryOptions)
  const response = NextResponse.json(connections)
  if (pagination.enabled) {
    attachPaginationHeaders(response, total, pagination)
  }

  return response
}

// 创建联动关系
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = createConnectionSchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues.map(issue => issue.message).join('; ')
      return NextResponse.json({ error: message || 'Invalid request body' }, { status: 400 })
    }

    const { fromWorkId, toWorkId, relationType, description } = parsed.data
    if (fromWorkId === toWorkId) {
      return NextResponse.json(
        { error: 'fromWorkId and toWorkId cannot be the same work' },
        { status: 400 }
      )
    }

    const existing = await prisma.connection.findUnique({
      where: {
        fromWorkId_toWorkId_relationType: {
          fromWorkId,
          toWorkId,
          relationType,
        },
      },
    })

    if (existing) {
      return NextResponse.json({ error: 'Connection already exists' }, { status: 400 })
    }

    const connection = await prisma.connection.create({
      data: {
        fromWorkId,
        toWorkId,
        relationType,
        description,
        level: 1,
      },
    })

    await GraphService.recalculateLevels()
    return NextResponse.json(connection, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create connection'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

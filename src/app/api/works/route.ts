import { Prisma, WorkType } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { attachPaginationHeaders, parsePaginationParams } from '@/lib/pagination'

const workTypeParamSchema = z
  .string()
  .trim()
  .transform(value => value.toUpperCase())
  .pipe(z.nativeEnum(WorkType))

const optionalTextSchema = z.preprocess(
  value => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().max(2000).optional()
)

const optionalUrlSchema = z.preprocess(
  value => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().url().max(2000).optional()
)

const createWorkSchema = z.object({
  title: z.string().trim().min(1).max(200),
  type: workTypeParamSchema,
  description: optionalTextSchema,
  coverUrl: optionalUrlSchema,
  isCentral: z.boolean().optional().default(false),
})

// 作品列表 API
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const rawType = searchParams.get('type')
  const rawSearch = searchParams.get('search')

  let parsedType: WorkType | undefined
  if (rawType) {
    const typeResult = workTypeParamSchema.safeParse(rawType)
    if (!typeResult.success) {
      return NextResponse.json(
        { error: 'Invalid type parameter' },
        { status: 400 }
      )
    }
    parsedType = typeResult.data
  }

  const search = typeof rawSearch === 'string' ? rawSearch.trim() : ''
  if (search.length > 120) {
    return NextResponse.json(
      { error: 'search parameter is too long (max 120 characters)' },
      { status: 400 }
    )
  }

  const paginationResult = parsePaginationParams(searchParams, {
    defaultPageSize: 20,
    maxPageSize: 100,
  })
  if (!paginationResult.ok) {
    return NextResponse.json({ error: paginationResult.error }, { status: 400 })
  }

  const { pagination } = paginationResult

  const where: Prisma.WorkWhereInput = {}
  if (parsedType) {
    where.type = parsedType
  }

  if (search.length > 0) {
    where.title = {
      contains: search,
      mode: 'insensitive',
    }
  }

  const queryOptions: Prisma.WorkFindManyArgs = {
    where,
    include: {
      _count: {
        select: {
          connectionsFrom: true,
          connectionsTo: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  }

  let total = 0
  if (pagination.enabled) {
    queryOptions.skip = pagination.skip
    queryOptions.take = pagination.take
    total = await prisma.work.count({ where })
  }

  const works = await prisma.work.findMany(queryOptions)
  const response = NextResponse.json(works)
  if (pagination.enabled) {
    attachPaginationHeaders(response, total, pagination)
  }

  return response
}

// 创建作品 API
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = createWorkSchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues.map(issue => issue.message).join('; ')
      return NextResponse.json({ error: message || 'Invalid request body' }, { status: 400 })
    }

    const { title, type, description, coverUrl, isCentral } = parsed.data
    const work = await prisma.work.create({
      data: {
        title,
        type,
        description,
        coverUrl,
        isCentral,
      },
    })

    return NextResponse.json(work, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create work'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

import { EvidenceStatus, Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { attachPaginationHeaders, parsePaginationParams } from '@/lib/pagination'

const statusQuerySchema = z
  .string()
  .trim()
  .transform(value => value.toUpperCase())
  .pipe(z.nativeEnum(EvidenceStatus))

const optionalUrlSchema = z.preprocess(
  value => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().url().max(2000).optional()
)

const optionalTextSchema = z.preprocess(
  value => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().max(2000).optional()
)

const createEvidenceSchema = z
  .object({
    connectionId: z.string().trim().min(1),
    workId: z.preprocess(
      value => (typeof value === 'string' && value.trim() === '' ? undefined : value),
      z.string().trim().min(1).optional()
    ),
    type: z.enum(['link', 'file']),
    url: optionalUrlSchema,
    fileUrl: optionalUrlSchema,
    fileName: optionalTextSchema,
    description: optionalTextSchema,
    submittedBy: optionalTextSchema,
  })
  .superRefine((value, ctx) => {
    if (value.type === 'link' && !value.url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['url'],
        message: 'url is required when type is link',
      })
    }

    if (value.type === 'file' && !value.fileUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['fileUrl'],
        message: 'fileUrl is required when type is file',
      })
    }
  })

// 获取证据列表
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const connectionId = searchParams.get('connectionId')?.trim() || undefined
  const rawStatus = searchParams.get('status')

  let status: EvidenceStatus | undefined
  if (rawStatus) {
    const parsedStatus = statusQuerySchema.safeParse(rawStatus)
    if (!parsedStatus.success) {
      return NextResponse.json({ error: 'Invalid status parameter' }, { status: 400 })
    }
    status = parsedStatus.data
  }

  const paginationResult = parsePaginationParams(searchParams, {
    defaultPageSize: 30,
    maxPageSize: 100,
  })
  if (!paginationResult.ok) {
    return NextResponse.json({ error: paginationResult.error }, { status: 400 })
  }

  const { pagination } = paginationResult
  const where: Prisma.EvidenceWhereInput = {}
  if (connectionId) where.connectionId = connectionId
  if (status) where.status = status

  const queryOptions: Prisma.EvidenceFindManyArgs = {
    where,
    include: {
      connection: {
        include: {
          fromWork: true,
          toWork: true,
        },
      },
      work: true,
    },
    orderBy: { createdAt: 'desc' },
  }

  let total = 0
  if (pagination.enabled) {
    queryOptions.skip = pagination.skip
    queryOptions.take = pagination.take
    total = await prisma.evidence.count({ where })
  }

  const evidences = await prisma.evidence.findMany(queryOptions)
  const response = NextResponse.json(evidences)
  if (pagination.enabled) {
    attachPaginationHeaders(response, total, pagination)
  }

  return response
}

// 提交证据
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = createEvidenceSchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues.map(issue => issue.message).join('; ')
      return NextResponse.json({ error: message || 'Invalid request body' }, { status: 400 })
    }

    const { connectionId, workId, type, url, fileUrl, fileName, description, submittedBy } = parsed.data
    const evidence = await prisma.evidence.create({
      data: {
        connectionId,
        workId,
        type,
        url,
        fileUrl,
        fileName,
        description,
        submittedBy: submittedBy || 'USER',
        status: 'PENDING',
      },
    })

    return NextResponse.json(evidence, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to submit evidence'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

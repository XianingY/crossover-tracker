import { EvidenceStatus, Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { invalidateGraphSnapshotCache } from '@/lib/graph-cache'
import { prisma } from '@/lib/prisma'
import { attachPaginationHeaders, parsePaginationParams } from '@/lib/pagination'
import { createSupabaseServiceRoleClient, EVIDENCE_BUCKET } from '@/lib/supabase-server'

const SIGNED_URL_EXPIRES_IN_SECONDS = 10 * 60

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

const optionalStoragePathSchema = z.preprocess(
  value => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().max(512).optional()
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
    storagePath: optionalStoragePathSchema,
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

    if (value.type === 'file' && !value.storagePath) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['storagePath'],
        message: 'storagePath is required when type is file',
      })
    }
  })

function normalizeUrl(url: string | null | undefined): string | null {
  if (!url) return null

  try {
    const parsed = new URL(url)
    parsed.hash = ''
    parsed.searchParams.delete('utm_source')
    parsed.searchParams.delete('utm_medium')
    parsed.searchParams.delete('utm_campaign')
    parsed.searchParams.delete('utm_content')
    parsed.searchParams.delete('utm_term')

    let normalized = parsed.toString().toLowerCase()
    if (normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1)
    }
    return normalized
  } catch {
    return url.trim().toLowerCase()
  }
}

type EvidenceWithRelations = Awaited<
  ReturnType<typeof prisma.evidence.findMany>
>[number] & {
  duplicateGroupSize?: number
}

async function attachSignedFileUrls(evidences: EvidenceWithRelations[]): Promise<void> {
  const supabase = createSupabaseServiceRoleClient()
  if (!supabase) return

  await Promise.all(
    evidences.map(async evidence => {
      if (evidence.type !== 'file' || !evidence.storagePath) {
        return
      }

      const signed = await supabase.storage
        .from(EVIDENCE_BUCKET)
        .createSignedUrl(evidence.storagePath, SIGNED_URL_EXPIRES_IN_SECONDS)

      if (!signed.error && signed.data?.signedUrl) {
        evidence.fileUrl = signed.data.signedUrl
      }
    })
  )
}

function attachDuplicateSignals(evidences: EvidenceWithRelations[]): void {
  const counts = new Map<string, number>()

  for (const evidence of evidences) {
    const key =
      evidence.type === 'link'
        ? `link:${normalizeUrl(evidence.url)}`
        : `file:${evidence.storagePath || evidence.fileName || ''}`
    if (key.endsWith(':') || key.endsWith(':null')) continue
    counts.set(key, (counts.get(key) || 0) + 1)
  }

  for (const evidence of evidences) {
    const key =
      evidence.type === 'link'
        ? `link:${normalizeUrl(evidence.url)}`
        : `file:${evidence.storagePath || evidence.fileName || ''}`
    const duplicateGroupSize = counts.get(key) || 1
    evidence.duplicateGroupSize = duplicateGroupSize
  }
}

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
      reviewLogs: {
        orderBy: { reviewedAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
  }

  let total = 0
  if (pagination.enabled) {
    queryOptions.skip = pagination.skip
    queryOptions.take = pagination.take
    total = await prisma.evidence.count({ where })
  }

  const evidences = (await prisma.evidence.findMany(queryOptions)) as EvidenceWithRelations[]
  attachDuplicateSignals(evidences)
  await attachSignedFileUrls(evidences)

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

    const { connectionId, workId, type, url, fileUrl, storagePath, fileName, description, submittedBy } =
      parsed.data

    const evidence = await prisma.evidence.create({
      data: {
        connectionId,
        workId,
        type,
        url,
        fileUrl: type === 'file' ? null : fileUrl,
        storagePath: type === 'file' ? storagePath || null : null,
        fileName,
        description,
        submittedBy: submittedBy || 'USER',
        status: 'PENDING',
      },
      include: {
        connection: {
          include: {
            fromWork: true,
            toWork: true,
          },
        },
      },
    })

    if (type === 'file' && storagePath) {
      await prisma.uploadAuditLog.create({
        data: {
          evidenceId: evidence.id,
          storagePath,
          uploader: submittedBy || 'USER',
        },
      })
    }

    await invalidateGraphSnapshotCache()

    return NextResponse.json(evidence, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to submit evidence'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

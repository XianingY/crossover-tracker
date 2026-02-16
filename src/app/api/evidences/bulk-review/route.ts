import { EvidenceStatus } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedAdmin } from '@/lib/admin-auth'
import { invalidateGraphSnapshotCache } from '@/lib/graph-cache'
import { captureApiException } from '@/lib/observability'
import { prisma } from '@/lib/prisma'
import { GraphService } from '@/services/graph.service'

const bulkReviewSchema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1).max(200),
  status: z
    .string()
    .trim()
    .transform(value => value.toUpperCase())
    .pipe(z.nativeEnum(EvidenceStatus)),
  rejectReason: z.preprocess(
    value => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().trim().max(2000).optional()
  ),
})

export async function POST(request: NextRequest) {
  try {
    const admin = await getAuthenticatedAdmin(request)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = bulkReviewSchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues.map(issue => issue.message).join('; ')
      return NextResponse.json({ error: message || 'Invalid bulk review payload' }, { status: 400 })
    }

    const { ids, status } = parsed.data
    const rejectReason = status === 'REJECTED' ? parsed.data.rejectReason || null : null
    const now = new Date()

    const existing = await prisma.evidence.findMany({
      where: { id: { in: ids } },
      select: { id: true, status: true },
    })

    if (existing.length === 0) {
      return NextResponse.json({ error: 'No evidences found for provided ids' }, { status: 404 })
    }

    const existingMap = new Map(existing.map(item => [item.id, item]))
    const foundIds = Array.from(existingMap.keys())

    await prisma.$transaction(async tx => {
      await tx.evidence.updateMany({
        where: { id: { in: foundIds } },
        data: {
          status,
          rejectReason,
          reviewedBy: admin.email || `user:${admin.id}`,
          reviewedAt: now,
        },
      })

      const reviewLogs = foundIds.map(id => {
        const beforeStatus = existingMap.get(id)?.status || 'PENDING'
        return tx.evidenceReviewLog.create({
          data: {
            evidenceId: id,
            beforeStatus,
            afterStatus: status,
            reason: rejectReason,
            reviewedBy: admin.email || null,
            reviewerUserId: admin.id,
            reviewedAt: now,
          },
        })
      })

      await Promise.all(reviewLogs)
    })

    const touchesApproved = existing.some(item => item.status === 'APPROVED') || status === 'APPROVED'
    if (touchesApproved) {
      await GraphService.recalculateLevels()
    } else {
      await invalidateGraphSnapshotCache()
    }

    return NextResponse.json({
      success: true,
      updatedCount: foundIds.length,
      status,
    })
  } catch (error) {
    captureApiException('/api/evidences/bulk-review', error)
    const message = error instanceof Error ? error.message : 'Bulk review failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

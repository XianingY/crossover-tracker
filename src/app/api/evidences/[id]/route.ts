import { EvidenceStatus } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedAdmin } from '@/lib/admin-auth'
import { invalidateGraphSnapshotCache } from '@/lib/graph-cache'
import { captureApiException } from '@/lib/observability'
import { prisma } from '@/lib/prisma'
import { GraphService } from '@/services/graph.service'

const reviewSchema = z.object({
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

// 审核证据
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const admin = await getAuthenticatedAdmin(request)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = reviewSchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues.map(issue => issue.message).join('; ')
      return NextResponse.json({ error: message || 'Invalid review payload' }, { status: 400 })
    }

    const nextStatus = parsed.data.status
    const rejectReason = nextStatus === 'REJECTED' ? parsed.data.rejectReason || null : null

    const existing = await prisma.evidence.findUnique({
      where: { id },
      select: { id: true, status: true, rejectReason: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Evidence not found' }, { status: 404 })
    }

    const evidence = await prisma.evidence.update({
      where: { id },
      data: {
        status: nextStatus,
        rejectReason,
        reviewedBy: admin.email || `user:${admin.id}`,
        reviewedAt: new Date(),
      },
    })

    if (existing.status !== nextStatus || (existing.rejectReason || null) !== rejectReason) {
      await prisma.evidenceReviewLog.create({
        data: {
          evidenceId: id,
          beforeStatus: existing.status,
          afterStatus: nextStatus,
          reason: rejectReason,
          reviewedBy: admin.email || null,
          reviewerUserId: admin.id,
        },
      })
    }

    const statusChanged = existing.status !== nextStatus
    const touchesApproved = existing.status === 'APPROVED' || nextStatus === 'APPROVED'
    if (statusChanged && touchesApproved) {
      await GraphService.recalculateLevels()
    } else if (statusChanged) {
      await invalidateGraphSnapshotCache()
    }

    return NextResponse.json(evidence)
  } catch (error) {
    captureApiException('/api/evidences/[id]', error, { id })
    const message = error instanceof Error ? error.message : 'Failed to review evidence'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

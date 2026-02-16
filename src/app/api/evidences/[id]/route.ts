import { NextRequest, NextResponse } from 'next/server'
import { EvidenceStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { GraphService } from '@/services/graph.service'

function parseEvidenceStatus(value: unknown): EvidenceStatus | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.toUpperCase()
  if (normalized === 'PENDING' || normalized === 'APPROVED' || normalized === 'REJECTED') {
    return normalized
  }

  return null
}

// 审核证据
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  
  try {
    const body = await request.json()
    const nextStatus = parseEvidenceStatus(body.status)
    const rejectReason =
      typeof body.rejectReason === 'string' && body.rejectReason.trim().length > 0
        ? body.rejectReason.trim()
        : null

    if (!nextStatus) {
      return NextResponse.json(
        { error: 'Invalid status. Expected PENDING, APPROVED, or REJECTED.' },
        { status: 400 }
      )
    }

    const existing = await prisma.evidence.findUnique({
      where: { id },
      select: { status: true }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Evidence not found' }, { status: 404 })
    }

    const evidence = await prisma.evidence.update({
      where: { id },
      data: {
        status: nextStatus,
        rejectReason: nextStatus === 'REJECTED' ? rejectReason : null
      }
    })
    
    // 任何涉及 APPROVED 的状态切换都可能改变图谱层级
    const statusChanged = existing.status !== nextStatus
    const touchesApproved = existing.status === 'APPROVED' || nextStatus === 'APPROVED'
    if (statusChanged && touchesApproved) {
      await GraphService.recalculateLevels()
    }
    
    return NextResponse.json(evidence)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to review evidence'
    return NextResponse.json(
      { error: message },
      { status: 400 }
    )
  }
}

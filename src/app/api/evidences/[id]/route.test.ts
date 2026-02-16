import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getAuthenticatedAdmin: vi.fn(),
  invalidateGraphSnapshotCache: vi.fn(),
  evidenceFindUnique: vi.fn(),
  evidenceUpdate: vi.fn(),
  evidenceReviewLogCreate: vi.fn(),
  recalculateLevels: vi.fn(),
}))

vi.mock('@/lib/admin-auth', () => ({
  getAuthenticatedAdmin: mocks.getAuthenticatedAdmin,
}))

vi.mock('@/lib/graph-cache', () => ({
  invalidateGraphSnapshotCache: mocks.invalidateGraphSnapshotCache,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    evidence: {
      findUnique: mocks.evidenceFindUnique,
      update: mocks.evidenceUpdate,
    },
    evidenceReviewLog: {
      create: mocks.evidenceReviewLogCreate,
    },
  },
}))

vi.mock('@/services/graph.service', () => ({
  GraphService: {
    recalculateLevels: mocks.recalculateLevels,
  },
}))

import { PATCH } from './route'

describe('PATCH /api/evidences/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getAuthenticatedAdmin.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@example.com',
      role: 'admin',
      accessToken: 'token',
    })
  })

  it('recalculates graph when evidence is downgraded from APPROVED to REJECTED', async () => {
    mocks.evidenceFindUnique.mockResolvedValue({
      id: 'ev-1',
      status: 'APPROVED',
      rejectReason: null,
    })
    mocks.evidenceUpdate.mockResolvedValue({
      id: 'ev-1',
      status: 'REJECTED',
    })
    mocks.evidenceReviewLogCreate.mockResolvedValue({ id: 'log-1' })
    mocks.recalculateLevels.mockResolvedValue({ success: true, updated: 3 })

    const request = new NextRequest('http://localhost/api/evidences/ev-1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'REJECTED', rejectReason: 'bad evidence' }),
    })

    const response = await PATCH(request, { params: Promise.resolve({ id: 'ev-1' }) })
    const payload = (await response.json()) as { id?: string; status?: string }

    expect(response.status).toBe(200)
    expect(payload.id).toBe('ev-1')
    expect(mocks.recalculateLevels).toHaveBeenCalledTimes(1)
    expect(mocks.invalidateGraphSnapshotCache).not.toHaveBeenCalled()
    expect(mocks.evidenceReviewLogCreate).toHaveBeenCalledTimes(1)
  })

  it('invalidates snapshot cache for non-approved status changes', async () => {
    mocks.evidenceFindUnique.mockResolvedValue({
      id: 'ev-2',
      status: 'PENDING',
      rejectReason: null,
    })
    mocks.evidenceUpdate.mockResolvedValue({
      id: 'ev-2',
      status: 'REJECTED',
    })
    mocks.evidenceReviewLogCreate.mockResolvedValue({ id: 'log-2' })
    mocks.invalidateGraphSnapshotCache.mockResolvedValue(2)

    const request = new NextRequest('http://localhost/api/evidences/ev-2', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'REJECTED' }),
    })

    const response = await PATCH(request, { params: Promise.resolve({ id: 'ev-2' }) })
    expect(response.status).toBe(200)
    expect(mocks.recalculateLevels).not.toHaveBeenCalled()
    expect(mocks.invalidateGraphSnapshotCache).toHaveBeenCalledTimes(1)
  })
})

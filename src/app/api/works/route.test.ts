import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  workCount: vi.fn(),
  workFindMany: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    work: {
      count: mocks.workCount,
      findMany: mocks.workFindMany,
    },
  },
}))

import { GET } from './route'

describe('GET /api/works', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('applies pagination and returns pagination headers', async () => {
    mocks.workCount.mockResolvedValue(35)
    mocks.workFindMany.mockResolvedValue([
      {
        id: 'w1',
        title: 'Work 1',
        type: 'ANIME',
        description: null,
        coverUrl: null,
        isCentral: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        _count: { connectionsFrom: 0, connectionsTo: 0 },
      },
    ])

    const request = new NextRequest('http://localhost/api/works?page=2&pageSize=10')
    const response = await GET(request)
    const payload = (await response.json()) as Array<{ id: string }>

    expect(response.status).toBe(200)
    expect(payload).toHaveLength(1)
    expect(mocks.workCount).toHaveBeenCalledTimes(1)
    expect(mocks.workFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
      })
    )
    expect(response.headers.get('X-Total-Count')).toBe('35')
    expect(response.headers.get('X-Page')).toBe('2')
    expect(response.headers.get('X-Page-Size')).toBe('10')
    expect(response.headers.get('X-Total-Pages')).toBe('4')
  })
})

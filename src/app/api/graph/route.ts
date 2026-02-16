import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export interface GraphNode {
  id: string
  title: string
  type: string
  isCentral: boolean
  coverUrl?: string | null
  level: number
}

export interface GraphLink {
  source: string
  target: string
  relationType: string
  level: number
  isUnreviewed: boolean
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const centralId = searchParams.get('centralId')

  if (!centralId) {
    return NextResponse.json({ error: 'Central ID is required' }, { status: 400 })
  }

  const centralWork = await prisma.work.findUnique({
    where: { id: centralId }
  })

  if (!centralWork) {
    return NextResponse.json({ nodes: [], links: [] })
  }

  // BFS to build graph (bidirectional)
  const nodes = new Map<string, GraphNode>()
  const links: GraphLink[] = []
  const visited = new Set<string>()
  const linkSet = new Set<string>() // prevent duplicate links
  const queue: { id: string; level: number }[] = []

  // Add central node
  nodes.set(centralWork.id, {
    id: centralWork.id,
    title: centralWork.title,
    type: centralWork.type,
    isCentral: true,
    coverUrl: centralWork.coverUrl,
    level: 0
  })
  visited.add(centralWork.id)
  queue.push({ id: centralWork.id, level: 0 })

  // Max depth to prevent infinite loops or huge graphs
  const MAX_LEVEL = 5

  while (queue.length > 0) {
    const { id, level } = queue.shift()!

    if (level >= MAX_LEVEL) continue

    // Find all outgoing connections from this node
    const outgoing = await prisma.connection.findMany({
      where: { fromWorkId: id },
      include: {
        toWork: true,
        evidences: { select: { status: true } }
      }
    })

    // Find all incoming connections to this node
    const incoming = await prisma.connection.findMany({
      where: { toWorkId: id },
      include: {
        fromWork: true,
        evidences: { select: { status: true } }
      }
    })

    for (const conn of outgoing) {
      const linkKey = `${conn.fromWorkId}-${conn.toWorkId}`
      if (!linkSet.has(linkKey)) {
        linkSet.add(linkKey)
        const isUnreviewed = conn.evidences.length === 0 || conn.evidences.some((e) => e.status === 'PENDING')
        links.push({
          source: conn.fromWorkId,
          target: conn.toWorkId,
          relationType: conn.relationType,
          level: level + 1,
          isUnreviewed
        })
      }

      if (!visited.has(conn.toWorkId)) {
        visited.add(conn.toWorkId)
        nodes.set(conn.toWorkId, {
          id: conn.toWork.id,
          title: conn.toWork.title,
          type: conn.toWork.type,
          isCentral: conn.toWork.isCentral,
          coverUrl: conn.toWork.coverUrl,
          level: level + 1
        })
        queue.push({ id: conn.toWorkId, level: level + 1 })
      }
    }

    for (const conn of incoming) {
      const linkKey = `${conn.fromWorkId}-${conn.toWorkId}`
      if (!linkSet.has(linkKey)) {
        linkSet.add(linkKey)
        const isUnreviewed = conn.evidences.length === 0 || conn.evidences.some((e) => e.status === 'PENDING')
        links.push({
          source: conn.fromWorkId,
          target: conn.toWorkId,
          relationType: conn.relationType,
          level: level + 1,
          isUnreviewed
        })
      }

      if (!visited.has(conn.fromWorkId)) {
        visited.add(conn.fromWorkId)
        nodes.set(conn.fromWorkId, {
          id: conn.fromWork.id,
          title: conn.fromWork.title,
          type: conn.fromWork.type,
          isCentral: conn.fromWork.isCentral,
          coverUrl: conn.fromWork.coverUrl,
          level: level + 1
        })
        queue.push({ id: conn.fromWorkId, level: level + 1 })
      }
    }
  }

  return NextResponse.json({
    nodes: Array.from(nodes.values()),
    links
  })
}

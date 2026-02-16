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

  // BFS to build graph
  const nodes = new Map<string, GraphNode>()
  const links: GraphLink[] = []
  const visited = new Set<string>()
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
    const connections = await prisma.connection.findMany({
      where: {
        fromWorkId: id,
        evidences: {
          some: { status: 'APPROVED' }
        }
      },
      include: {
        toWork: true
      }
    })

    for (const conn of connections) {
      // Add node if not visited
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
      } else {
        // If visited, we update level if we found a shorter path (BFS guarantees shortest path first, but for general graph completeness)
        // Actually BFS guarantees finding node at shortest path first, so we don't need to update level.
      }

      // Add link
      links.push({
        source: conn.fromWorkId,
        target: conn.toWorkId,
        relationType: conn.relationType,
        level: level + 1
      })
    }
  }

  return NextResponse.json({
    nodes: Array.from(nodes.values()),
    links
  })
}

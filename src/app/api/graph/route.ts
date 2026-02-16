import { NextRequest, NextResponse } from 'next/server'
import { EvidenceStatus } from '@prisma/client'
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

interface GraphConnectionRecord {
  fromWorkId: string
  toWorkId: string
  relationType: string
  fromWork: {
    id: string
    title: string
    type: string
    isCentral: boolean
    coverUrl: string | null
  }
  toWork: {
    id: string
    title: string
    type: string
    isCentral: boolean
    coverUrl: string | null
  }
  evidences: {
    status: EvidenceStatus
  }[]
}

function buildNode(
  work: GraphConnectionRecord['fromWork'] | GraphConnectionRecord['toWork'],
  level: number
): GraphNode {
  return {
    id: work.id,
    title: work.title,
    type: work.type,
    isCentral: work.isCentral,
    coverUrl: work.coverUrl,
    level,
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const centralId = searchParams.get('centralId')

  if (!centralId) {
    return NextResponse.json({ error: 'Central ID is required' }, { status: 400 })
  }

  const centralWork = await prisma.work.findUnique({
    where: { id: centralId },
  })

  if (!centralWork) {
    return NextResponse.json({ nodes: [], links: [] })
  }

  const connections = await prisma.connection.findMany({
    include: {
      fromWork: true,
      toWork: true,
      evidences: { select: { status: true } },
    },
  })

  const outgoingByFrom = new Map<string, GraphConnectionRecord[]>()
  const incomingByTo = new Map<string, GraphConnectionRecord[]>()
  for (const connection of connections as GraphConnectionRecord[]) {
    const outgoing = outgoingByFrom.get(connection.fromWorkId) || []
    outgoing.push(connection)
    outgoingByFrom.set(connection.fromWorkId, outgoing)

    const incoming = incomingByTo.get(connection.toWorkId) || []
    incoming.push(connection)
    incomingByTo.set(connection.toWorkId, incoming)
  }

  const nodes = new Map<string, GraphNode>()
  const links: GraphLink[] = []
  const visited = new Set<string>()
  const linkSet = new Set<string>()
  const queue: Array<{ id: string; level: number }> = []
  const MAX_LEVEL = 5

  nodes.set(centralWork.id, {
    id: centralWork.id,
    title: centralWork.title,
    type: centralWork.type,
    isCentral: true,
    coverUrl: centralWork.coverUrl,
    level: 0,
  })
  visited.add(centralWork.id)
  queue.push({ id: centralWork.id, level: 0 })

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) continue

    const { id, level } = current
    if (level >= MAX_LEVEL) continue

    const outgoing = outgoingByFrom.get(id) || []
    const incoming = incomingByTo.get(id) || []

    for (const connection of outgoing) {
      const linkKey = `${connection.fromWorkId}-${connection.toWorkId}`
      if (!linkSet.has(linkKey)) {
        linkSet.add(linkKey)
        const hasApprovedEvidence = connection.evidences.some(
          evidence => evidence.status === 'APPROVED'
        )
        links.push({
          source: connection.fromWorkId,
          target: connection.toWorkId,
          relationType: connection.relationType,
          level: level + 1,
          isUnreviewed: !hasApprovedEvidence,
        })
      }

      if (!visited.has(connection.toWorkId)) {
        visited.add(connection.toWorkId)
        nodes.set(connection.toWorkId, buildNode(connection.toWork, level + 1))
        queue.push({ id: connection.toWorkId, level: level + 1 })
      }
    }

    for (const connection of incoming) {
      const linkKey = `${connection.fromWorkId}-${connection.toWorkId}`
      if (!linkSet.has(linkKey)) {
        linkSet.add(linkKey)
        const hasApprovedEvidence = connection.evidences.some(
          evidence => evidence.status === 'APPROVED'
        )
        links.push({
          source: connection.fromWorkId,
          target: connection.toWorkId,
          relationType: connection.relationType,
          level: level + 1,
          isUnreviewed: !hasApprovedEvidence,
        })
      }

      if (!visited.has(connection.fromWorkId)) {
        visited.add(connection.fromWorkId)
        nodes.set(connection.fromWorkId, buildNode(connection.fromWork, level + 1))
        queue.push({ id: connection.fromWorkId, level: level + 1 })
      }
    }
  }

  return NextResponse.json({
    nodes: Array.from(nodes.values()),
    links,
  })
}

import { prisma } from '@/lib/prisma'

/**
 * Service to handle graph-related operations
 */
export class GraphService {
  /**
   * Recalculates the distance (level) of all works from central works.
   * Only connections with at least one APPROVED evidence are used.
   */
  static async recalculateLevels(): Promise<{ success: boolean; updated: number }> {
    const centralWorks = await prisma.work.findMany({
      where: { isCentral: true },
      select: { id: true },
    })

    if (centralWorks.length === 0) {
      return { success: false, updated: 0 }
    }

    const approvedConnections = await prisma.connection.findMany({
      where: {
        evidences: {
          some: { status: 'APPROVED' },
        },
      },
      select: {
        fromWorkId: true,
        toWorkId: true,
      },
    })

    const adjacency = new Map<string, string[]>()
    for (const connection of approvedConnections) {
      const next = adjacency.get(connection.fromWorkId) || []
      next.push(connection.toWorkId)
      adjacency.set(connection.fromWorkId, next)
    }

    const levels = new Map<string, number>()
    const queue: string[] = []

    for (const centralWork of centralWorks) {
      if (!levels.has(centralWork.id)) {
        levels.set(centralWork.id, 0)
        queue.push(centralWork.id)
      }
    }

    let pointer = 0
    while (pointer < queue.length) {
      const currentId = queue[pointer]
      pointer += 1

      const currentLevel = levels.get(currentId)
      if (typeof currentLevel !== 'number') continue

      const neighbors = adjacency.get(currentId) || []
      for (const neighborId of neighbors) {
        if (levels.has(neighborId)) continue
        levels.set(neighborId, currentLevel + 1)
        queue.push(neighborId)
      }
    }

    const resetLevels = prisma.connection.updateMany({
      data: { level: 1 },
    })

    const levelBuckets = new Map<number, string[]>()
    for (const [workId, level] of levels.entries()) {
      const bucket = levelBuckets.get(level) || []
      bucket.push(workId)
      levelBuckets.set(level, bucket)
    }

    const levelUpdates = Array.from(levelBuckets.entries()).map(([level, workIds]) =>
      prisma.connection.updateMany({
        where: { toWorkId: { in: workIds } },
        data: { level },
      })
    )

    await prisma.$transaction([resetLevels, ...levelUpdates])

    return {
      success: true,
      updated: levels.size,
    }
  }
}

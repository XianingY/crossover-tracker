import { prisma } from '@/lib/prisma'

/**
 * Service to handle graph-related operations
 */
export class GraphService {
    /**
     * Recalculates the distance (level) of all works from the central work.
     * Uses BFS to traverse the graph of connections.
     * Only considers 'APPROVED' evidence for connections.
     */
    static async recalculateLevels(): Promise<{ success: boolean; updated: number }> {
        const centralWorks = await prisma.work.findMany({
            where: { isCentral: true },
            select: { id: true }
        })

        if (centralWorks.length === 0) {
            return { success: false, updated: 0 }
        }

        const levels = new Map<string, number>()
        const queue: string[] = []

        for (const centralWork of centralWorks) {
            levels.set(centralWork.id, 0)
            queue.push(centralWork.id)
        }

        while (queue.length > 0) {
            const currentId = queue.shift()!
            const currentLevel = levels.get(currentId)!

            const connections = await prisma.connection.findMany({
                where: {
                    fromWorkId: currentId,
                    evidences: {
                        some: { status: 'APPROVED' }
                    }
                },
                select: { toWorkId: true }
            })

            for (const conn of connections) {
                if (!levels.has(conn.toWorkId)) {
                    levels.set(conn.toWorkId, currentLevel + 1)
                    queue.push(conn.toWorkId)
                }
            }
        }

        const resetLevels = prisma.connection.updateMany({
            data: { level: 1 }
        })

        const levelUpdates = Array.from(levels.entries()).map(([workId, level]) =>
            prisma.connection.updateMany({
                where: { toWorkId: workId },
                data: { level }
            })
        )

        await prisma.$transaction([resetLevels, ...levelUpdates])

        return {
            success: true,
            updated: levels.size
        }
    }
}

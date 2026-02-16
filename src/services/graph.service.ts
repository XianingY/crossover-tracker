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
        const centralWork = await prisma.work.findFirst({
            where: { isCentral: true }
        })

        if (!centralWork) {
            return { success: false, updated: 0 }
        }

        // BFS implementation
        const levels = new Map<string, number>()
        levels.set(centralWork.id, 0)

        let queue: string[] = [centralWork.id]

        while (queue.length > 0) {
            const currentIds = [...queue]
            queue = [] // Clear for next level

            // Batch fetch connections for current level nodes
            // Optimization: Fetch all potentially relevant connections in one query if possible, 
            // but strictly following BFS level-by-level is safer for correctness to avoid race conditions in logic.
            // However, to keep it simple and consistent with previous logic but slightly better:

            for (const currentId of currentIds) {
                const currentLevel = levels.get(currentId)!

                // Find all outgoing connections with approved evidences
                const connections = await prisma.connection.findMany({
                    where: {
                        fromWorkId: currentId,
                        evidences: {
                            some: { status: 'APPROVED' }
                        }
                    },
                    select: { toWorkId: true } // We only need the ID
                })

                for (const conn of connections) {
                    if (!levels.has(conn.toWorkId)) {
                        levels.set(conn.toWorkId, currentLevel + 1)
                        queue.push(conn.toWorkId)
                    }
                }
            }
        }

        // Batch update using transaction
        // Note: prisma.updateMany doesn't support setting different values for different rows in one go easily
        // without raw SQL or multiple queries. We'll use a transaction of updateMany calls.

        const updates = Array.from(levels.entries()).map(([workId, level]) =>
            prisma.connection.updateMany({
                where: { toWorkId: workId },
                data: { level }
            })
        )

        if (updates.length > 0) {
            await prisma.$transaction(updates)
        }

        return {
            success: true,
            updated: levels.size
        }
    }
}

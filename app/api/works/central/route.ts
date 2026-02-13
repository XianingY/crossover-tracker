import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 获取中心作品
export async function GET() {
  const centralWork = await prisma.work.findFirst({
    where: { isCentral: true },
    include: {
      connectionsFrom: {
        include: {
          toWork: {
            include: {
              _count: {
                select: { connectionsFrom: true }
              }
            }
          },
          evidences: {
            where: { status: 'APPROVED' }
          }
        }
      }
    }
  })
  
  if (!centralWork) {
    return NextResponse.json({ error: 'No central work set' }, { status: 404 })
  }
  
  return NextResponse.json(centralWork)
}

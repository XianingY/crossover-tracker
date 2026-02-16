import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 获取所有中心作品
export async function GET() {
  const centralWorks = await prisma.work.findMany({
    where: { isCentral: true },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      type: true,
      coverUrl: true,
      updatedAt: true
    }
  })

  return NextResponse.json(centralWorks)
}

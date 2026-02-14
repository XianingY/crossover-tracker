import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 作品列表 API
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const type = searchParams.get('type')
  const search = searchParams.get('search')
  
  const where: any = {}
  
  if (type) {
    where.type = type.toUpperCase()
  }
  
  if (search) {
    where.title = {
      contains: search,
      mode: 'insensitive'
    }
  }
  
  const works = await prisma.work.findMany({
    where,
    include: {
      _count: {
        select: {
          connectionsFrom: true,
          connectionsTo: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  })
  
  return NextResponse.json(works)
}

// 创建作品 API
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, type, description, coverUrl, isCentral } = body
    
    // 如果设为中心作品，先取消其他中心
    if (isCentral) {
      await prisma.work.updateMany({
        where: { isCentral: true },
        data: { isCentral: false }
      })
    }
    
    const work = await prisma.work.create({
      data: {
        title,
        type: type.toUpperCase(),
        description,
        coverUrl,
        isCentral: isCentral || false
      }
    })
    
    return NextResponse.json(work, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to create work' },
      { status: 400 }
    )
  }
}

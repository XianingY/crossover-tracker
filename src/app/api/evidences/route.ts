import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 获取证据列表
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const connectionId = searchParams.get('connectionId')
  const status = searchParams.get('status')
  
  const where: any = {}
  
  if (connectionId) {
    where.connectionId = connectionId
  }
  
  if (status) {
    where.status = status.toUpperCase()
  }
  
  const evidences = await prisma.evidence.findMany({
    where,
    include: {
      connection: {
        include: {
          fromWork: true,
          toWork: true
        }
      },
      work: true
    },
    orderBy: { createdAt: 'desc' }
  })
  
  return NextResponse.json(evidences)
}

// 提交证据
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { connectionId, workId, type, url, fileUrl, fileName, description, submittedBy } = body
    
    const evidence = await prisma.evidence.create({
      data: {
        connectionId,
        workId,
        type,
        url,
        fileUrl,
        fileName,
        description,
        submittedBy,
        status: 'PENDING'
      }
    })
    
    return NextResponse.json(evidence, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to submit evidence' },
      { status: 400 }
    )
  }
}

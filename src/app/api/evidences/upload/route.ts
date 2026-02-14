import { NextRequest, NextResponse } from 'next/server'

// Supabase 客户端 - 延迟初始化
function getSupabase() {
  const { createClient } = require('@supabase/supabase-js')
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('[YOUR-')) {
    return null
  }
  
  return createClient(supabaseUrl, supabaseKey)
}

// 文件上传 API
export async function POST(request: NextRequest) {
  const supabase = getSupabase()
  
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase not configured. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env' },
      { status: 500 }
    )
  }
  
  const formData = await request.formData()
  const file = formData.get('file') as File
  
  if (!file) {
    return NextResponse.json(
      { error: 'No file provided' },
      { status: 400 }
    )
  }
  
  // 验证文件类型
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf']
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      { error: 'Invalid file type' },
      { status: 400 }
    )
  }
  
  // 验证文件大小 (最大 10MB)
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json(
      { error: 'File too large (max 10MB)' },
      { status: 400 }
    )
  }
  
  // 生成唯一文件名
  const timestamp = Date.now()
  const filename = `${timestamp}-${file.name}`
  
  // 上传到 Supabase Storage
  const buffer = Buffer.from(await file.arrayBuffer())
  const { data, error } = await supabase.storage
    .from('evidences')
    .upload(filename, buffer, {
      contentType: file.type,
      upsert: false
    })
  
  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
  
  // 获取公开 URL
  const { data: urlData } = supabase.storage
    .from('evidences')
    .getPublicUrl(filename)
  
  return NextResponse.json({
    url: urlData.publicUrl,
    filename: file.name
  })
}

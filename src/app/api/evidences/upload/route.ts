import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { consumeRateLimit } from '@/lib/rate-limit'

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
const UPLOAD_LIMIT_PER_10_MINUTES = 20
const UPLOAD_WINDOW_MS = 10 * 60 * 1000
const ALLOWED_TYPES = new Map<string, string>([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/gif', 'gif'],
  ['application/pdf', 'pdf'],
])

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('[YOUR-')) {
    return null
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  })
}

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown'
  }

  const realIp = request.headers.get('x-real-ip')
  return realIp?.trim() || 'unknown'
}

async function matchesFileSignature(file: File): Promise<boolean> {
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer())

  if (file.type === 'image/jpeg') {
    return header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff
  }

  if (file.type === 'image/png') {
    return (
      header[0] === 0x89 &&
      header[1] === 0x50 &&
      header[2] === 0x4e &&
      header[3] === 0x47 &&
      header[4] === 0x0d &&
      header[5] === 0x0a &&
      header[6] === 0x1a &&
      header[7] === 0x0a
    )
  }

  if (file.type === 'image/gif') {
    return header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x38
  }

  if (file.type === 'application/pdf') {
    return header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46
  }

  return false
}

// 文件上传 API
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request)
    const rateLimit = consumeRateLimit(
      `upload:${ip}`,
      UPLOAD_LIMIT_PER_10_MINUTES,
      UPLOAD_WINDOW_MS
    )
    if (!rateLimit.ok) {
      const retryAfterSeconds = Math.ceil(rateLimit.retryAfterMs / 1000)
      return NextResponse.json(
        { error: 'Too many upload requests. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfterSeconds),
          },
        }
      )
    }

    const supabase = getSupabase()
    if (!supabase) {
      return NextResponse.json(
        {
          error:
            'Supabase not configured. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env',
        },
        { status: 500 }
      )
    }

    const formData = await request.formData()
    const fileEntry = formData.get('file')
    if (!(fileEntry instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const file = fileEntry
    const extension = ALLOWED_TYPES.get(file.type)
    if (!extension) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })
    }

    const validSignature = await matchesFileSignature(file)
    if (!validSignature) {
      return NextResponse.json({ error: 'Invalid file content signature' }, { status: 400 })
    }

    const filename = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`
    const buffer = Buffer.from(await file.arrayBuffer())
    const { error } = await supabase.storage.from('evidences').upload(filename, buffer, {
      contentType: file.type,
      upsert: false,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const { data: urlData } = supabase.storage.from('evidences').getPublicUrl(filename)

    return NextResponse.json({
      url: urlData.publicUrl,
      filename: file.name,
    })
  } catch (error) {
    console.error('Evidence upload error:', error)
    const message = error instanceof Error ? error.message : 'Upload failed'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}

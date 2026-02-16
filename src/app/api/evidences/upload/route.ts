import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { consumeRateLimit } from '@/lib/rate-limit'
import { createSupabaseServiceRoleClient, EVIDENCE_BUCKET } from '@/lib/supabase-server'

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
const UPLOAD_LIMIT_PER_10_MINUTES = 20
const UPLOAD_WINDOW_MS = 10 * 60 * 1000
const SIGNED_URL_EXPIRES_IN_SECONDS = 10 * 60

const ALLOWED_TYPES = new Map<string, string>([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/gif', 'gif'],
  ['application/pdf', 'pdf'],
])

let bucketChecked = false

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown'
  }

  const realIp = request.headers.get('x-real-ip')
  return realIp?.trim() || 'unknown'
}

async function ensurePrivateEvidenceBucket(
  supabase: NonNullable<ReturnType<typeof createSupabaseServiceRoleClient>>
): Promise<void> {
  if (bucketChecked) return

  const { data, error } = await supabase.storage.getBucket(EVIDENCE_BUCKET)
  if (!error && data) {
    bucketChecked = true
    return
  }

  const createResult = await supabase.storage.createBucket(EVIDENCE_BUCKET, {
    public: false,
    fileSizeLimit: `${MAX_FILE_SIZE_BYTES}`,
    allowedMimeTypes: Array.from(ALLOWED_TYPES.keys()),
  })

  if (createResult.error && !createResult.error.message.toLowerCase().includes('already')) {
    throw new Error(createResult.error.message)
  }

  bucketChecked = true
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

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request)
    const rateLimit = await consumeRateLimit(
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

    const supabase = createSupabaseServiceRoleClient()
    if (!supabase) {
      return NextResponse.json(
        {
          error:
            'Supabase not configured. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env',
        },
        { status: 500 }
      )
    }

    await ensurePrivateEvidenceBucket(supabase)

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

    const storagePath = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`
    const buffer = Buffer.from(await file.arrayBuffer())
    const uploadResult = await supabase.storage.from(EVIDENCE_BUCKET).upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    })

    if (uploadResult.error) {
      return NextResponse.json({ error: uploadResult.error.message }, { status: 500 })
    }

    const signedResult = await supabase.storage
      .from(EVIDENCE_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_EXPIRES_IN_SECONDS)

    if (signedResult.error || !signedResult.data?.signedUrl) {
      return NextResponse.json(
        { error: signedResult.error?.message || 'Failed to create signed URL' },
        { status: 500 }
      )
    }

    const admin = await getAuthenticatedAdmin(request)
    await prisma.uploadAuditLog.create({
      data: {
        evidenceId: null,
        storagePath,
        uploader: admin?.email || null,
        uploaderId: admin?.id || null,
        ipAddress: ip,
      },
    })

    return NextResponse.json({
      storagePath,
      signedUrl: signedResult.data.signedUrl,
      filename: file.name,
      expiresIn: SIGNED_URL_EXPIRES_IN_SECONDS,
    })
  } catch (error) {
    console.error('Evidence upload error:', error)
    const message = error instanceof Error ? error.message : 'Upload failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

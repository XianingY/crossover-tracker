import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  ADMIN_ACCESS_COOKIE,
  ADMIN_REFRESH_COOKIE,
  isAdminAuthConfigured,
  isAdminRole,
} from '@/lib/admin-auth'
import { consumeRateLimit } from '@/lib/rate-limit'
import { createSupabaseAnonClient } from '@/lib/supabase-server'

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(200),
})

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown'
  }
  return request.headers.get('x-real-ip') || 'unknown'
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const rateLimit = await consumeRateLimit(`admin-login:${ip}`, 20, 10 * 60 * 1000)
  if (!rateLimit.ok) {
    const retryAfterSeconds = Math.ceil(rateLimit.retryAfterMs / 1000)
    return NextResponse.json(
      { error: 'Too many login attempts. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfterSeconds),
        },
      }
    )
  }

  if (!isAdminAuthConfigured()) {
    return NextResponse.json(
      {
        error:
          'Admin auth not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
      },
      { status: 503 }
    )
  }

  const supabase = createSupabaseAnonClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase auth is not configured' }, { status: 503 })
  }

  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = loginSchema.safeParse(rawBody)
  if (!parsed.success) {
    const message = parsed.error.issues.map(issue => issue.message).join('; ')
    return NextResponse.json({ error: message || 'Invalid login payload' }, { status: 400 })
  }

  const { email, password } = parsed.data
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.session || !data.user) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  if (!isAdminRole(data.user)) {
    await supabase.auth.signOut()
    return NextResponse.json({ error: 'Account is not an admin' }, { status: 403 })
  }

  const response = NextResponse.json({
    success: true,
    user: { id: data.user.id, email: data.user.email || null },
  })

  response.cookies.set({
    name: ADMIN_ACCESS_COOKIE,
    value: data.session.access_token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: data.session.expires_in || 60 * 60,
  })

  if (data.session.refresh_token) {
    response.cookies.set({
      name: ADMIN_REFRESH_COOKIE,
      value: data.session.refresh_token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })
  }

  return response
}

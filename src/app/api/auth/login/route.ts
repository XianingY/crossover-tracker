import { NextRequest, NextResponse } from 'next/server'
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  getExpectedSessionToken,
  isAdminAuthConfigured,
  verifyAdminCredentials,
} from '@/lib/admin-auth'
import { consumeRateLimit } from '@/lib/rate-limit'

interface LoginBody {
  username?: string
  password?: string
}

export async function POST(request: NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for')
  const ip = forwardedFor?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
  const rateLimit = consumeRateLimit(`admin-login:${ip}`, 20, 10 * 60 * 1000)
  if (!rateLimit.ok) {
    const retryAfterSeconds = Math.ceil(rateLimit.retryAfterMs / 1000)
    return NextResponse.json(
      { error: 'Too many login attempts. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfterSeconds)
        }
      }
    )
  }

  if (!isAdminAuthConfigured()) {
    return NextResponse.json(
      { error: 'Admin auth not configured. Set ADMIN_USERNAME and ADMIN_PASSWORD.' },
      { status: 503 }
    )
  }

  let body: LoginBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const username = (body.username || '').trim()
  const password = body.password || ''
  if (!username || !password) {
    return NextResponse.json({ error: 'Missing username or password' }, { status: 400 })
  }

  if (!verifyAdminCredentials(username, password)) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const token = await getExpectedSessionToken()
  if (!token) {
    return NextResponse.json({ error: 'Failed to create admin session' }, { status: 500 })
  }

  const response = NextResponse.json({ success: true })
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  })

  return response
}

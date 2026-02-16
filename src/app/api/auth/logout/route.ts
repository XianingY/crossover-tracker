import { NextResponse } from 'next/server'
import { ADMIN_ACCESS_COOKIE, ADMIN_REFRESH_COOKIE } from '@/lib/admin-auth'

export async function POST() {
  const response = NextResponse.json({ success: true })
  response.cookies.set({
    name: ADMIN_ACCESS_COOKIE,
    value: '',
    path: '/',
    maxAge: 0,
  })
  response.cookies.set({
    name: ADMIN_REFRESH_COOKIE,
    value: '',
    path: '/',
    maxAge: 0,
  })

  return response
}

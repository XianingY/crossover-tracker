import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthenticated, isAdminAuthConfigured } from './src/lib/admin-auth'

function isReadMethod(method: string): boolean {
  return method === 'GET' || method === 'HEAD' || method === 'OPTIONS'
}

function isEvidenceApi(pathname: string): boolean {
  return pathname === '/api/evidences' || pathname.startsWith('/api/evidences/')
}

function shouldProtect(pathname: string, method: string): boolean {
  if (method === 'OPTIONS') {
    return false
  }

  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    return true
  }

  if (pathname.startsWith('/api/auth/login') || pathname.startsWith('/api/auth/logout')) {
    return false
  }

  if (isEvidenceApi(pathname)) {
    return true
  }

  if (pathname.startsWith('/api') && !isReadMethod(method)) {
    return true
  }

  return false
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (!shouldProtect(pathname, request.method)) {
    return NextResponse.next()
  }

  if (!isAdminAuthConfigured()) {
    if (pathname.startsWith('/api')) {
      return NextResponse.json(
        { error: 'Admin auth not configured. Set ADMIN_USERNAME and ADMIN_PASSWORD.' },
        { status: 503 }
      )
    }

    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/admin/login'
    loginUrl.searchParams.set('next', pathname)
    loginUrl.searchParams.set('error', 'not_configured')
    return NextResponse.redirect(loginUrl)
  }

  const authenticated = await isAdminAuthenticated(request)
  if (authenticated) {
    return NextResponse.next()
  }

  if (pathname.startsWith('/api')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const loginUrl = request.nextUrl.clone()
  loginUrl.pathname = '/admin/login'
  loginUrl.searchParams.set('next', pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}

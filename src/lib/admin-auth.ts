import { NextRequest } from 'next/server'

export const ADMIN_SESSION_COOKIE = 'ct_admin_session'
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12 // 12 hours

function getAdminUsername(): string {
  return process.env.ADMIN_USERNAME || ''
}

function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD || ''
}

export function isAdminAuthConfigured(): boolean {
  return Boolean(getAdminUsername() && getAdminPassword())
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return toHex(new Uint8Array(digest))
}

export async function getExpectedSessionToken(): Promise<string | null> {
  if (!isAdminAuthConfigured()) {
    return null
  }

  const raw = `crossover-tracker-admin:${getAdminUsername()}:${getAdminPassword()}`
  return sha256Hex(raw)
}

export function verifyAdminCredentials(username: string, password: string): boolean {
  if (!isAdminAuthConfigured()) {
    return false
  }

  return username === getAdminUsername() && password === getAdminPassword()
}

function getBearerToken(authorization: string | null): string | null {
  if (!authorization?.startsWith('Bearer ')) {
    return null
  }

  const token = authorization.slice('Bearer '.length).trim()
  return token.length > 0 ? token : null
}

export async function isAdminAuthenticated(request: NextRequest): Promise<boolean> {
  const expectedToken = await getExpectedSessionToken()
  if (!expectedToken) {
    return false
  }

  const sessionCookie = request.cookies.get(ADMIN_SESSION_COOKIE)?.value
  if (sessionCookie && sessionCookie === expectedToken) {
    return true
  }

  const adminTokenHeader = request.headers.get('x-admin-token')?.trim()
  if (adminTokenHeader && adminTokenHeader === expectedToken) {
    return true
  }

  const bearerToken = getBearerToken(request.headers.get('authorization'))
  if (bearerToken && bearerToken === expectedToken) {
    return true
  }

  return false
}

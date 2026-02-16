import { NextRequest } from 'next/server'

export const ADMIN_ACCESS_COOKIE = 'ct_access_token'
export const ADMIN_REFRESH_COOKIE = 'ct_refresh_token'
const ADMIN_ROLE = 'admin'

interface SupabaseRolePayload {
  app_metadata?: {
    role?: string
    [key: string]: unknown
  }
  role?: string
}

interface SupabaseUserResponse extends SupabaseRolePayload {
  id: string
  email?: string
  user_metadata?: Record<string, unknown>
}

export interface AuthenticatedAdmin {
  id: string
  email: string | null
  role: string
  accessToken: string
}

function getSupabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL
}

function getSupabaseAnonKey(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
}

export function isAdminAuthConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey())
}

export function getAccessTokenFromRequest(request: NextRequest): string | null {
  const cookieToken = request.cookies.get(ADMIN_ACCESS_COOKIE)?.value
  if (cookieToken) {
    return cookieToken
  }

  const headerToken = request.headers.get('x-admin-token')?.trim()
  if (headerToken) {
    return headerToken
  }

  const authorization = request.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) {
    return null
  }

  const bearerToken = authorization.slice('Bearer '.length).trim()
  return bearerToken.length > 0 ? bearerToken : null
}

async function fetchSupabaseUser(accessToken: string): Promise<SupabaseUserResponse | null> {
  const supabaseUrl = getSupabaseUrl()
  const supabaseAnonKey = getSupabaseAnonKey()
  if (!supabaseUrl || !supabaseAnonKey) {
    return null
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: 'GET',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    return null
  }

  const user = (await response.json()) as SupabaseUserResponse
  return user
}

export function isAdminRole(user: SupabaseRolePayload): boolean {
  return user.app_metadata?.role === ADMIN_ROLE || user.role === ADMIN_ROLE
}

export async function getAuthenticatedAdmin(
  request: NextRequest
): Promise<AuthenticatedAdmin | null> {
  if (!isAdminAuthConfigured()) {
    return null
  }

  const accessToken = getAccessTokenFromRequest(request)
  if (!accessToken) {
    return null
  }

  const user = await fetchSupabaseUser(accessToken)
  if (!user || !isAdminRole(user)) {
    return null
  }

  return {
    id: user.id,
    email: user.email || null,
    role: user.app_metadata?.role || user.role || ADMIN_ROLE,
    accessToken,
  }
}

export async function isAdminAuthenticated(request: NextRequest): Promise<boolean> {
  const admin = await getAuthenticatedAdmin(request)
  return Boolean(admin)
}

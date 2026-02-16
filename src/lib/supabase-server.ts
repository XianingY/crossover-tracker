import { createClient } from '@supabase/supabase-js'

export const EVIDENCE_BUCKET = 'evidences-private'

export function getSupabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL
}

export function getSupabaseAnonKey(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
}

export function getSupabaseServiceRoleKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY
}

export function createSupabaseServiceRoleClient() {
  const url = getSupabaseUrl()
  const key = getSupabaseServiceRoleKey()
  if (!url || !key) {
    return null
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  })
}

export function createSupabaseAnonClient() {
  const url = getSupabaseUrl()
  const key = getSupabaseAnonKey()
  if (!url || !key) {
    return null
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  })
}

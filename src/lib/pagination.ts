import { NextResponse } from 'next/server'
import { z } from 'zod'

interface ParsePaginationOptions {
  defaultPageSize?: number
  maxPageSize?: number
}

export interface ParsedPagination {
  enabled: boolean
  page: number
  pageSize: number
  skip: number
  take: number
}

type ParsedPaginationResult =
  | { ok: true; pagination: ParsedPagination }
  | { ok: false; error: string }

export function parsePaginationParams(
  searchParams: URLSearchParams,
  options: ParsePaginationOptions = {}
): ParsedPaginationResult {
  const defaultPageSize = options.defaultPageSize ?? 20
  const maxPageSize = options.maxPageSize ?? 100

  const hasPage = searchParams.has('page')
  const hasPageSize = searchParams.has('pageSize')
  const enabled = hasPage || hasPageSize

  const schema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(maxPageSize).default(defaultPageSize),
  })

  const parsed = schema.safeParse({
    page: searchParams.get('page') ?? undefined,
    pageSize: searchParams.get('pageSize') ?? undefined,
  })

  if (!parsed.success) {
    const errorMessage = parsed.error.issues.map(issue => issue.message).join('; ')
    return {
      ok: false,
      error: `Invalid pagination params: ${errorMessage || 'page/pageSize are invalid'}`,
    }
  }

  const { page, pageSize } = parsed.data
  return {
    ok: true,
    pagination: {
      enabled,
      page,
      pageSize,
      skip: (page - 1) * pageSize,
      take: pageSize,
    },
  }
}

export function attachPaginationHeaders(
  response: NextResponse,
  total: number,
  pagination: ParsedPagination
): void {
  if (!pagination.enabled) {
    return
  }

  const totalPages = Math.max(1, Math.ceil(total / pagination.pageSize))
  response.headers.set('X-Total-Count', String(total))
  response.headers.set('X-Page', String(pagination.page))
  response.headers.set('X-Page-Size', String(pagination.pageSize))
  response.headers.set('X-Total-Pages', String(totalPages))
}

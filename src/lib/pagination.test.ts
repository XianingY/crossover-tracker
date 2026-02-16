import { describe, expect, it } from 'vitest'
import { parsePaginationParams } from './pagination'

describe('parsePaginationParams', () => {
  it('parses explicit pagination params', () => {
    const params = new URLSearchParams({
      page: '2',
      pageSize: '15',
    })

    const result = parsePaginationParams(params)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.pagination.enabled).toBe(true)
    expect(result.pagination.page).toBe(2)
    expect(result.pagination.pageSize).toBe(15)
    expect(result.pagination.skip).toBe(15)
    expect(result.pagination.take).toBe(15)
  })

  it('returns error for invalid page', () => {
    const params = new URLSearchParams({
      page: '0',
    })

    const result = parsePaginationParams(params)
    expect(result.ok).toBe(false)
  })
})

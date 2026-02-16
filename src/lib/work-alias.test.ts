import { describe, expect, it } from 'vitest'
import { buildAliasRecords, normalizeAlias } from './work-alias'

describe('work-alias helpers', () => {
  it('normalizes alias text consistently', () => {
    expect(normalizeAlias(' 海 贼 王 ')).toBe('海贼王')
    expect(normalizeAlias('One-Piece')).toBe('onepiece')
  })

  it('builds deduped alias records and keeps title as primary', () => {
    const aliases = buildAliasRecords('海贼王', ['  海 贼 王 ', 'ONE PIECE', 'one-piece'])
    expect(aliases).toHaveLength(2)

    const primary = aliases.find(item => item.isPrimary)
    expect(primary?.alias).toBe('海贼王')
    expect(aliases.map(item => item.normalizedAlias)).toEqual(['海贼王', 'onepiece'])
  })
})

const MAX_ALIAS_LENGTH = 120

export function normalizeAlias(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}_]+/gu, '')
}

export function buildAliasRecords(
  title: string,
  aliases?: Array<string | null | undefined>
): Array<{ alias: string; normalizedAlias: string; isPrimary: boolean }> {
  const input = [title, ...(aliases || [])]
  const dedup = new Map<string, { alias: string; normalizedAlias: string; isPrimary: boolean }>()
  const normalizedTitle = normalizeAlias(title)

  for (const raw of input) {
    if (typeof raw !== 'string') continue
    const alias = raw.trim()
    if (!alias || alias.length > MAX_ALIAS_LENGTH) continue

    const normalizedAlias = normalizeAlias(alias)
    if (!normalizedAlias) continue

    const existing = dedup.get(normalizedAlias)
    if (existing) {
      if (normalizedAlias === normalizedTitle) {
        existing.isPrimary = true
      }
      continue
    }

    dedup.set(normalizedAlias, {
      alias,
      normalizedAlias,
      isPrimary: normalizedAlias === normalizedTitle,
    })
  }

  return Array.from(dedup.values())
}

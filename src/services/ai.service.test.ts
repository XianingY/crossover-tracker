import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { generateCrossoverReport } from './ai.service'

const originalFetch = global.fetch
const originalApiKey = process.env.TAVILY_API_KEY

describe('generateCrossoverReport', () => {
  beforeEach(() => {
    process.env.TAVILY_API_KEY = 'test-key'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    global.fetch = originalFetch
    if (typeof originalApiKey === 'undefined') {
      delete process.env.TAVILY_API_KEY
    } else {
      process.env.TAVILY_API_KEY = originalApiKey
    }
  })

  it('keeps only true crossover evidence and filters profile/unrelated pages', async () => {
    const tavilyPayload = {
      results: [
        {
          title: 'My Hero Academia x Overwatch 2',
          url: 'https://www.youtube.com/watch?v=official-mha-ow2',
          content: 'Official collaboration event trailer for My Hero Academia x Overwatch 2.',
        },
        {
          title: 'MarvelTW - YouTube',
          url: 'https://www.youtube.com/@MarvelTW',
          content: 'Marvel official channel, subscribe for more videos.',
        },
        {
          title: 'Newer Isn’t Always Better…6th Gen vs 5th Gen Toyota 4Runner',
          url: 'https://www.youtube.com/watch?v=4runner-compare',
          content: 'Engine and drivetrain comparison for Toyota 4Runner models.',
        },
      ],
    }

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => tavilyPayload,
    })
    global.fetch = fetchMock as unknown as typeof fetch

    const report = await generateCrossoverReport('我的英雄学院')
    const claims = report.sections.flatMap(section => section.claims)
    const claimTargets = claims.map(claim => claim.targetWork.toLowerCase())
    const citationUrls = claims.flatMap(claim => claim.citations.map(citation => citation.url))

    expect(claimTargets.some(target => target.includes('overwatch'))).toBe(true)
    expect(claimTargets.some(target => target.includes('4runner'))).toBe(false)
    expect(citationUrls.some(url => url.includes('/@MarvelTW'))).toBe(false)
    expect(citationUrls.some(url => url.includes('4runner'))).toBe(false)
  })

  it('drops claims that do not meet evidence threshold', async () => {
    const tavilyPayload = {
      results: [
        {
          title: 'My Hero Academia x Sanrio collaboration',
          url: 'https://en.wikipedia.org/wiki/My_Hero_Academia_x_Sanrio',
          content: 'My Hero Academia x Sanrio collaboration merchandise campaign.',
        },
      ],
    }

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => tavilyPayload,
    })
    global.fetch = fetchMock as unknown as typeof fetch

    const report = await generateCrossoverReport('我的英雄学院')

    expect(report.stats.claims).toBe(0)
    expect(report.sections).toHaveLength(0)
  })
})

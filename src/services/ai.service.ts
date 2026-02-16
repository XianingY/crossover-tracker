/**
 * AI Search Service
 * 
 * 使用 Tavily Search API
 */
import { z } from 'zod'

export interface SearchResult {
  title: string
  url: string
  snippet: string
  imageUrl?: string
  sourceName?: string
  sourceLevel?: SourceLevel
}

export type SourceLevel = 'official' | 'trusted' | 'other'

export interface ImageAnalysisResult {
  description: string
  workName?: string
  characters?: string[]
  confidence: number
}

export interface WorkConnection {
  fromWork: string
  toWork: string
  relationType: string
  evidence: string
  evidenceUrl: string
  confidence?: number
  fromImage?: string
  toImage?: string
  sourceName?: string
  sourceLevel?: SourceLevel
}

export interface WorkCandidate {
  name: string
  type: string
  source: string
  url: string
  imageUrl?: string
}

function getTavilyApiKey(): string | undefined {
  return process.env.TAVILY_API_KEY
}

interface SearchWebOptions {
  preferOfficial?: boolean
  officialOrTrustedOnly?: boolean
  maxResults?: number
  includeDomains?: string[]
}

interface TavilySearchItem {
  title?: string
  url?: string
  content?: string
  snippet?: string
  images?: string[]
}

interface TavilySearchResponse {
  results?: TavilySearchItem[]
}

interface RankedSearchResult extends SearchResult {
  priority: number
  sourceName: string
  sourceLevel: SourceLevel
}

const relationTypeSchema = z.enum([
  'adaptation',
  'spin_off',
  'crossover',
  'reference',
  'inspired',
])

const structuredConnectionSchema = z.object({
  fromWork: z.string().min(1),
  toWork: z.string().min(1),
  relationType: relationTypeSchema,
  evidence: z.string().min(1),
  evidenceUrl: z.string().url(),
  confidence: z.number().min(0).max(1),
})

const BLOCKED_DOMAIN_FRAGMENTS = [
  // Adult / NSFW
  '91porn', 'pornhub', 'xvideos', 'xnxx', 'xhamster', 'redtube',
  'youporn', 'tube8', 'spankbang', 'eporner', 'beeg',
  'javbus', 'javdb', 'javlibrary', 'javmost', 'avgle',
  'jable', 'hanime1', 'hanime', 'hentai', 'nhentai', 'hitomi',
  'r18', 'dmm.co.jp/digital/video', 'fanza', 'fc2',
  'missav', 'supjav', 'thisav', 'myavsuper',
  // Piracy / file hosting
  'xunlei', 'pan.baidu', 'uploaded', 'rapidgator', 'mega.nz',
  'torrent', 'magnet', 'piratebay', '1337x', 'rarbg', 'nyaa',
  'bt.byr', 'btschool', 'kickass', 'limetorrent',
  'k2s.cc', 'filefactory', 'nitroflare', 'turbobit',
  // Spam / SEO junk
  'acgyhw', '51chigua', 'qianp.com', 'sodaa.net',
  'hao123', '360doc', 'toutiao.io', 'scribd.com',
  // Gambling
  'casino', 'bet365', 'poker', 'slots', 'gambling',
  // URL shorteners (often spam)
  'bit.ly/adult', 'tinyurl.com/nsfw',
]

const BLOCKED_HOST_TOKENS = [
  'porn', 'adult', 'xxx', 'sex', 'nsfw', 'hentai', 'erotic'
]

const BLOCKED_TLDS = ['.xxx', '.sex', '.porn', '.adult']

// Keywords in title/snippet that indicate adult/spam content
const BLOCKED_CONTENT_KEYWORDS = [
  '色情', '成人', 'AV女优', '女优', '番号', '无码', '有码',
  '裸体', '性爱', '做爱', '约炮', '一夜情', '情色',
  '赌场', '赌博', '博彩', '棋牌', '彩票计划',
  '代孕', '壮阳', '伟哥', '催情',
  'hentai', 'erotic', 'nude', 'naked', 'nsfw',
]

// Keywords that usually indicate junk pages rather than authoritative references
const LOW_QUALITY_CONTENT_KEYWORDS = [
  '免费在线观看', '在线看', '下载地址', '磁力', 'bt下载', '迅雷下载',
  '网盘', '资源分享', '最新地址', '点击进入', '备用网址',
  '破解版', '无删减', '福利视频'
]

const WORK_HINT_KEYWORDS = [
  '作品', '系列', '漫画', '动画', '小说', '轻小说', '电影', '剧场版', '电视剧', '游戏',
  '连载', '原作', '改编', '上映', '播出', 'manga', 'anime', 'novel', 'movie', 'game',
  'series', 'franchise'
]

const PERSON_HINT_KEYWORDS = [
  '声优', '演员', '歌手', '配音', 'cv', '人物', '个人资料', '出生', '生日', '身高', '血型',
  '代表作', '经纪公司', 'biography', 'actor', 'actress', 'voice actor', 'singer'
]

const OFFICIAL_TEXT_MARKERS = [
  '官方', '官网', '官宣', '官方公告', '官方新闻', '制作委员会',
  'official', 'official site', 'official website', 'official announcement',
  'press release', 'news release', '公式', '公式サイト', '公式発表'
]

const OFFICIAL_PLATFORM_DOMAINS = [
  'weibo.com',
  'bilibili.com',
  'youtube.com',
  'x.com',
  'twitter.com',
  'instagram.com',
  'facebook.com',
  'tiktok.com'
]

const OFFICIAL_DOMAIN_WHITELIST = [
  ...OFFICIAL_PLATFORM_DOMAINS,
  'shonenjump.com',
  'kodansha.co.jp',
  'aniplex.co.jp',
  'toei-anim.co.jp',
  'kadokawa.co.jp',
]

const TRUSTED_DOMAIN_WHITELIST = [
  'wikipedia.org',
  'baike.baidu.com',
  'bangumi.tv',
  'myanimelist.net',
  'anilist.co',
  'anidb.net',
  'douban.com',
]

const TAVILY_EXCLUDE_DOMAINS = [
  'pornhub.com', 'xvideos.com', 'xnxx.com', 'xhamster.com',
  '91porn.com', 'javbus.com', 'jable.tv', 'hanime1.me',
  'nhentai.net', 'hitomi.la', 'missav.com', 'avgle.com',
  'supjav.com', 'thisav.com', 'myavsuper.com', 'fanza.com',
  'torrentgalaxy.to', 'thepiratebay.org', '1337x.to'
]

const AUTHORITY_SOURCES = [
  { pattern: 'baike.baidu.com', name: '百度百科', priority: 18 },
  { pattern: 'wikipedia.org', name: '维基百科', priority: 18 },
  { pattern: 'bilibili.com', name: 'Bilibili', priority: 16 },
  { pattern: 'douban.com', name: '豆瓣', priority: 14 },
  { pattern: 'weibo.com', name: '微博', priority: 15 },
  { pattern: 'youtube.com', name: 'YouTube', priority: 15 },
  { pattern: 'pixiv.net', name: 'Pixiv', priority: 10 },
  { pattern: 'twitter.com', name: 'Twitter', priority: 12 },
  { pattern: 'x.com', name: 'X', priority: 12 },
  { pattern: 'instagram.com', name: 'Instagram', priority: 10 },
  { pattern: 'zhihu.com', name: '知乎', priority: 10 },
  { pattern: 'myanimelist.net', name: 'MyAnimeList', priority: 13 },
  { pattern: 'anidb.net', name: 'AniDB', priority: 12 },
  { pattern: 'bangumi.tv', name: 'Bangumi', priority: 14 },
  { pattern: 'anilist.co', name: 'AniList', priority: 12 },
]

function normalizeHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, '')
}

function safeParseUrl(url: string): URL | null {
  try {
    return new URL(url)
  } catch {
    return null
  }
}

function domainMatches(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`)
}

function findAuthoritySource(url: string) {
  const parsed = safeParseUrl(url)
  if (!parsed) return null

  const host = normalizeHost(parsed.hostname)
  for (const source of AUTHORITY_SOURCES) {
    if (domainMatches(host, source.pattern)) {
      return source
    }
  }

  return null
}

function getSourcePriority(url: string): number {
  const source = findAuthoritySource(url)
  if (source) return source.priority
  return 0
}

function isBlocked(url: string): boolean {
  const parsed = safeParseUrl(url)
  if (!parsed) return true

  const host = normalizeHost(parsed.hostname)
  const lowerUrl = url.toLowerCase()

  if (BLOCKED_TLDS.some(tld => host.endsWith(tld))) {
    return true
  }

  const hostTokens = host.split(/[.-]/).filter(Boolean)
  if (hostTokens.some(token => BLOCKED_HOST_TOKENS.includes(token))) {
    return true
  }

  return BLOCKED_DOMAIN_FRAGMENTS.some(fragment => {
    if (fragment.includes('/')) {
      return lowerUrl.includes(fragment)
    }
    return host.includes(fragment)
  })
}

function isContentBlocked(title: string, snippet: string): boolean {
  const text = (title + ' ' + snippet).toLowerCase()
  return BLOCKED_CONTENT_KEYWORDS.some(keyword => text.includes(keyword.toLowerCase()))
}

function isLowQualityContent(title: string, snippet: string): boolean {
  const text = (title + ' ' + snippet).toLowerCase()
  return LOW_QUALITY_CONTENT_KEYWORDS.some(keyword => text.includes(keyword.toLowerCase()))
}

function classifySourceLevel(url: string, title: string, snippet: string): SourceLevel {
  const parsed = safeParseUrl(url)
  if (!parsed) return 'other'

  const host = normalizeHost(parsed.hostname)
  const path = parsed.pathname.toLowerCase()
  const text = `${title} ${snippet}`.toLowerCase()

  const hasOfficialMarker = OFFICIAL_TEXT_MARKERS.some(marker => text.includes(marker.toLowerCase()))
  const hasOfficialInUrl = host.includes('official') || path.includes('/official')
  const isOfficialPlatform = OFFICIAL_PLATFORM_DOMAINS.some(domain => domainMatches(host, domain))
  const authorityPriority = getSourcePriority(url)

  if (hasOfficialInUrl) {
    return 'official'
  }

  if (hasOfficialMarker && (isOfficialPlatform || authorityPriority >= 12)) {
    return 'official'
  }

  if (isOfficialPlatform || authorityPriority >= 12) {
    return 'trusted'
  }

  return 'other'
}

function getSourceName(url: string): string {
  const source = findAuthoritySource(url)
  if (source) {
    return source.name
  }

  const parsed = safeParseUrl(url)
  if (!parsed) {
    return '网络'
  }

  return normalizeHost(parsed.hostname)
}

function scoreSearchResult(url: string, sourceLevel: SourceLevel, preferOfficial: boolean): number {
  const base = getSourcePriority(url)
  const levelBonus = sourceLevel === 'official' ? 100 : sourceLevel === 'trusted' ? 40 : 0
  const nonOfficialPenalty = preferOfficial && sourceLevel === 'other' ? -20 : 0
  return base + levelBonus + nonOfficialPenalty
}

function normalizeForMatch(value: string): string {
  return value.toLowerCase().replace(/[\s\p{P}\p{S}_]+/gu, '')
}

function containsAny(text: string, keywords: string[]): boolean {
  return keywords.some(keyword => text.includes(keyword.toLowerCase()))
}

function looksLikePersonEntry(title: string, snippet: string): boolean {
  const text = `${title} ${snippet}`.toLowerCase()
  const hasPersonHint = containsAny(text, PERSON_HINT_KEYWORDS)
  const hasWorkHint = containsAny(text, WORK_HINT_KEYWORDS) || /《[^》]+》/.test(`${title}${snippet}`)
  return hasPersonHint && !hasWorkHint
}

function dedupeResults(results: RankedSearchResult[]): RankedSearchResult[] {
  const seen = new Set<string>()

  return results.filter(result => {
    const parsed = safeParseUrl(result.url)
    const host = parsed ? normalizeHost(parsed.hostname) : result.url
    const key = `${host}|${result.title.trim().toLowerCase()}`

    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

function mergeSearchResults(primary: SearchResult[], secondary: SearchResult[]): SearchResult[] {
  const merged: SearchResult[] = []
  const seen = new Set<string>()

  for (const result of [...primary, ...secondary]) {
    const key = result.url.trim().toLowerCase()
    if (!key || seen.has(key)) {
      continue
    }

    seen.add(key)
    merged.push(result)
  }

  return merged
}

export async function searchWeb(query: string, options: SearchWebOptions = {}): Promise<SearchResult[]> {
  const preferOfficial = options.preferOfficial ?? false
  const officialOrTrustedOnly = options.officialOrTrustedOnly ?? false
  const maxResults = options.maxResults ?? 20

  if (options.includeDomains && options.includeDomains.length > 0) {
    return queryTavily(query, options)
  }

  if (!preferOfficial) {
    return queryTavily(query, options)
  }

  const officialResults = await queryTavily(query, {
    ...options,
    includeDomains: OFFICIAL_DOMAIN_WHITELIST,
  })

  if (officialResults.length >= maxResults) {
    return officialResults.slice(0, maxResults)
  }

  const trustedResults = await queryTavily(query, {
    ...options,
    includeDomains: [...OFFICIAL_DOMAIN_WHITELIST, ...TRUSTED_DOMAIN_WHITELIST],
  })

  const mergedTrusted = mergeSearchResults(officialResults, trustedResults)
  if (officialOrTrustedOnly || mergedTrusted.length >= maxResults) {
    return mergedTrusted.slice(0, maxResults)
  }

  const fallbackResults = await queryTavily(query, {
    ...options,
    includeDomains: undefined,
  })

  return mergeSearchResults(mergedTrusted, fallbackResults).slice(0, maxResults)
}

async function queryTavily(query: string, options: SearchWebOptions = {}): Promise<SearchResult[]> {
  const apiKey = getTavilyApiKey()
  if (!apiKey) {
    throw new Error('搜索服务未配置。请在 Vercel 后台配置 TAVILY_API_KEY')
  }

  const preferOfficial = options.preferOfficial ?? false
  const officialOrTrustedOnly = options.officialOrTrustedOnly ?? false
  const maxResults = options.maxResults ?? 20
  const includeDomains = options.includeDomains

  const refinedQuery = preferOfficial
    ? `${query} 官方 官网 官方公告 官宣 公式サイト official announcement press release`
    : query

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: refinedQuery,
        max_results: Math.max(maxResults * 2, 20),
        include_answer: false,
        include_raw_content: false,
        include_images: true,
        exclude_domains: TAVILY_EXCLUDE_DOMAINS,
        ...(includeDomains && includeDomains.length > 0
          ? { include_domains: Array.from(new Set(includeDomains)) }
          : {}),
      }),
    })

    if (!response.ok) {
      throw new Error(`Tavily API error: ${response.status}`)
    }

    const data = (await response.json()) as TavilySearchResponse
    if (!Array.isArray(data.results)) {
      return []
    }

    const rankedResults = data.results
      .map((item): RankedSearchResult | null => {
        const url = (item.url || '').trim()
        const title = (item.title || '').trim()
        const snippet = (item.content || item.snippet || '').trim()

        if (!url) {
          return null
        }

        if (isBlocked(url) || isContentBlocked(title, snippet) || isLowQualityContent(title, snippet)) {
          return null
        }

        const sourceLevel = classifySourceLevel(url, title, snippet)
        if (officialOrTrustedOnly && sourceLevel === 'other') {
          return null
        }

        const sourceName = getSourceName(url)
        return {
          title,
          url,
          snippet,
          imageUrl: item.images?.[0] || undefined,
          sourceName,
          sourceLevel,
          priority: scoreSearchResult(url, sourceLevel, preferOfficial),
        }
      })
      .filter((item): item is RankedSearchResult => item !== null)

    return dedupeResults(rankedResults)
      .sort((a, b) => b.priority - a.priority)
      .slice(0, maxResults)
      .map(result => ({
        title: result.title,
        url: result.url,
        snippet: result.snippet,
        imageUrl: result.imageUrl,
        sourceName: result.sourceName,
        sourceLevel: result.sourceLevel,
      }))
  } catch (error) {
    console.error('Tavily search error:', error)
    throw new Error('搜索失败，请稍后重试')
  }
}

export async function analyzeImage(
  imageUrl: string,
  prompt: string = '这张图片是什么作品？请给出作品名称、类型。'
): Promise<ImageAnalysisResult> {
  return {
    description: `图片分析功能需要配置付费API。提示词: ${prompt}。当前图片: ${imageUrl.substring(0, 30)}...`,
    workName: undefined,
    characters: [],
    confidence: 0
  }
}

export async function searchConnections(workName: string): Promise<WorkConnection[]> {
  const query = `${workName} 联动 改编 衍生 客串 crossover`
  const results = await searchWeb(query, {
    preferOfficial: true,
    officialOrTrustedOnly: true,
    maxResults: 20
  })

  const connections: WorkConnection[] = []

  for (const result of results.slice(0, 10)) {
    const connection = extractConnectionInfo(workName, result)
    if (connection) {
      connections.push(connection)
    }
  }

  return connections
}

export async function searchEvidence(workA: string, workB: string): Promise<SearchResult[]> {
  const query = `${workA} ${workB} 联动 合作 客串 改编`
  const results = await searchWeb(query, {
    preferOfficial: true,
    officialOrTrustedOnly: true,
    maxResults: 10
  })

  return results.slice(0, 5)
}

export async function identifyWorks(query: string): Promise<WorkCandidate[]> {
  const strictResults = await searchWeb(`${query} 作品 动画 漫画 小说 游戏`, {
    preferOfficial: true,
    officialOrTrustedOnly: true,
    maxResults: 20
  })

  let results = strictResults
  if (strictResults.length < 5) {
    const fallbackResults = await searchWeb(query, {
      preferOfficial: true,
      maxResults: 20
    })
    results = mergeSearchResults(strictResults, fallbackResults)
  }

  const scoredCandidates: Array<{ candidate: WorkCandidate; score: number }> = []
  const seen = new Set<string>()

  for (const result of results) {
    const extracted = extractWorkInfo(result, query)
    if (!extracted) continue

    const candidateKey = normalizeForMatch(extracted.candidate.name)
    if (!candidateKey || seen.has(candidateKey)) {
      continue
    }

    seen.add(candidateKey)
    scoredCandidates.push(extracted)
  }

  const candidates = scoredCandidates
    .sort((a, b) => b.score - a.score)
    .map(item => item.candidate)
    .slice(0, 10)

  if (candidates.length === 0 && query.trim()) {
    candidates.push({
      name: query.trim(),
      type: '未知',
      source: '用户输入',
      url: '',
    })
  }

  return candidates
}

function extractWorkInfo(
  result: SearchResult,
  query: string
): { candidate: WorkCandidate; score: number } | null {
  const { title, snippet, url, imageUrl } = result
  const text = title + ' ' + snippet
  const lowerText = text.toLowerCase()
  const normalizedQuery = normalizeForMatch(query)

  let workName = ''
  let workType = '未知'

  const titleMatch = text.match(/[《]([^》]+)[》]/)
  if (titleMatch) {
    workName = titleMatch[1]
  }

  if (!workName) {
    const cleanTitle = title.split(' - ')[0].split('|')[0].trim()
    if (cleanTitle.length >= 2 && cleanTitle.length <= 30) {
      workName = cleanTitle
    }
  }

  if (!workName) return null

  const normalizedName = normalizeForMatch(workName)
  const normalizedText = normalizeForMatch(text)
  const queryMatched =
    normalizedQuery.length === 0 ||
    normalizedName.includes(normalizedQuery) ||
    normalizedText.includes(normalizedQuery)

  const isPersonEntry = looksLikePersonEntry(title, snippet)
  if (!queryMatched && isPersonEntry) {
    return null
  }

  if (isPersonEntry && /维基百科/i.test(title) && !queryMatched) {
    return null
  }

  if (!queryMatched && result.sourceLevel === 'other') {
    return null
  }

  if (lowerText.includes('漫画') || lowerText.includes(' manga') || lowerText.includes(' comics')) {
    workType = '漫画'
  } else if (lowerText.includes('动画') || lowerText.includes(' anime')) {
    workType = '动画'
  } else if (lowerText.includes('小说') || lowerText.includes(' novel')) {
    workType = '小说'
  } else if (lowerText.includes('电影') || lowerText.includes(' movie') || lowerText.includes('film')) {
    workType = '电影'
  } else if (lowerText.includes('游戏') || lowerText.includes(' game')) {
    workType = '游戏'
  } else if (lowerText.includes('电视剧') || lowerText.includes(' tv') || lowerText.includes('剧集')) {
    workType = '电视剧'
  } else if (lowerText.includes('轻小说')) {
    workType = '轻小说'
  }

  const source = getSourceName(url)
  const sourceLevel = result.sourceLevel || 'other'

  let score = 0
  if (queryMatched) {
    score += 120
  } else {
    score -= 40
  }

  if (sourceLevel === 'official') {
    score += 60
  } else if (sourceLevel === 'trusted') {
    score += 30
  }

  if (/《[^》]+》/.test(text)) {
    score += 20
  }

  if (isPersonEntry) {
    score -= 80
  }

  if (score < 20) {
    return null
  }

  return {
    candidate: {
      name: workName,
      type: workType,
      source,
      url,
      imageUrl
    },
    score
  }
}

function extractConnectionInfo(workName: string, result: SearchResult): WorkConnection | null {
  const text = `${result.title} ${result.snippet}`
  const lowerText = text.toLowerCase()

  let relationType: z.infer<typeof relationTypeSchema> = 'crossover'
  if (lowerText.includes('改编') || lowerText.includes('adaptation')) {
    relationType = 'adaptation'
  } else if (lowerText.includes('衍生') || lowerText.includes('spin-off') || lowerText.includes('续作')) {
    relationType = 'spin_off'
  } else if (lowerText.includes('参考') || lowerText.includes('reference')) {
    relationType = 'reference'
  } else if (lowerText.includes('灵感') || lowerText.includes('inspired')) {
    relationType = 'inspired'
  }

  const targetWork = extractTargetWork(text, workName)
  if (!targetWork || normalizeForMatch(targetWork) === normalizeForMatch(workName)) {
    return null
  }

  const confidence = scoreConnectionConfidence(text, result.sourceLevel || 'other', relationType)
  if (confidence < 0.35) {
    return null
  }

  const parsed = structuredConnectionSchema.safeParse({
    fromWork: workName,
    toWork: targetWork,
    relationType,
    evidence: (result.snippet || result.title || result.url).slice(0, 500),
    evidenceUrl: result.url,
    confidence,
  })

  if (!parsed.success) {
    return null
  }

  return {
    ...parsed.data,
    fromImage: result.imageUrl,
    sourceName: result.sourceName,
    sourceLevel: result.sourceLevel,
  }
}

function scoreConnectionConfidence(
  text: string,
  sourceLevel: SourceLevel,
  relationType: z.infer<typeof relationTypeSchema>
): number {
  let score = 0.35
  const lowerText = text.toLowerCase()

  if (sourceLevel === 'official') {
    score += 0.35
  } else if (sourceLevel === 'trusted') {
    score += 0.2
  }

  if (/《[^》]+》/.test(text)) {
    score += 0.15
  }

  if (
    lowerText.includes('联动') ||
    lowerText.includes('crossover') ||
    lowerText.includes('合作') ||
    lowerText.includes('改编') ||
    lowerText.includes('衍生')
  ) {
    score += 0.2
  }

  if (relationType === 'reference' || relationType === 'inspired') {
    score -= 0.05
  }

  return Math.max(0, Math.min(1, score))
}

function extractTargetWork(text: string, sourceWork: string): string | null {
  const cleaned = text.replaceAll(sourceWork, '').trim()

  const match = cleaned.match(/[《]([^》]+)[》]/)
  if (match) {
    return sanitizeExtractedWorkName(match[1])
  }

  const nameMatch = cleaned.match(/([A-Za-z0-9\u4e00-\u9fa5]{2,20}(?:作品|漫画|动画|小说|游戏|电影|剧))/g)
  if (nameMatch && nameMatch.length > 0) {
    const normalized = nameMatch[0].replace(/(作品|漫画|动画|小说|游戏|电影|剧)$/, '')
    return sanitizeExtractedWorkName(normalized)
  }

  return null
}

function sanitizeExtractedWorkName(value: string): string | null {
  const cleaned = value.replace(/[\[\]【】()（）]/g, '').trim()
  if (!cleaned) return null
  if (cleaned.length < 2 || cleaned.length > 40) return null

  const lowered = cleaned.toLowerCase()
  const blocked = ['维基百科', '自由的百科全书', '百科', 'official', 'news', 'press release']
  if (blocked.some(keyword => lowered.includes(keyword))) {
    return null
  }

  return cleaned
}

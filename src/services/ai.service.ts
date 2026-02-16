/**
 * AI Search Service
 * 
 * 使用 Tavily Search API
 */

export interface SearchResult {
  title: string
  url: string
  snippet: string
  imageUrl?: string
  sourceName?: string
  sourceLevel?: SourceLevel
}

export type SourceLevel = 'official' | 'trusted' | 'other'
export type RelationType = 'adaptation' | 'spin_off' | 'crossover' | 'reference' | 'inspired'

export interface ImageAnalysisResult {
  description: string
  workName?: string
  characters?: string[]
  confidence: number
}

export interface WorkConnection {
  fromWork: string
  toWork: string
  relationType: RelationType
  evidence: string
  evidenceUrl: string
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

export interface ReportCitation {
  title: string
  url: string
  snippet: string
  sourceName: string
  sourceLevel: SourceLevel
}

export interface ReportClaim {
  id: string
  category: string
  targetWork: string
  relationType: RelationType
  summary: string
  confidence: number
  citations: ReportCitation[]
}

export interface ReportSection {
  id: string
  title: string
  description: string
  claims: ReportClaim[]
}

export interface WorkCrossoverReport {
  workName: string
  generatedAt: string
  summary: string
  sections: ReportSection[]
  stats: {
    claims: number
    citations: number
    official: number
    trusted: number
    other: number
  }
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
  'tohoanimationstore.com',
]

const TRUSTED_DOMAIN_WHITELIST = [
  'wikipedia.org',
  'baike.baidu.com',
  'bangumi.tv',
  'myanimelist.net',
  'anilist.co',
  'anidb.net',
  'douban.com',
  'ign.com',
  'polygon.com',
  'gamespot.com',
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

interface ReportQueryConfig {
  id: string
  sectionTitle: string
  sectionDescription: string
  sectionKeywords: string[]
  query: (workName: string) => string
}

const REPORT_QUERY_CONFIGS: ReportQueryConfig[] = [
  {
    id: 'comics-film',
    sectionTitle: '美漫与影视联动',
    sectionDescription: '包含漫画客串、电影宣传联动、超级英雄类官方合作。',
    sectionKeywords: [
      '漫威', 'dc', '电影', '漫画', '剧场版', 'marvel', 'avengers', 'deadpool', 'superhero',
    ],
    query: workName =>
      `${workName} 漫威 DC 电影 宣传 联动 crossover collaboration official announcement`,
  },
  {
    id: 'games',
    sectionTitle: '电子游戏联动',
    sectionDescription: '重点覆盖大型在线游戏、联动皮肤、活动公告与版本更新说明。',
    sectionKeywords: [
      '游戏', '活动', '皮肤', '联动', '版本', 'game', 'gaming', 'event', 'skin', 'collaboration',
      'fortnite', 'overwatch',
    ],
    query: workName =>
      `${workName} 游戏 联动 collaboration game event skin official announcement`,
  },
  {
    id: 'anime-merch',
    sectionTitle: '动漫/品牌/周边联动',
    sectionDescription: '包含动画、特摄、品牌周边、限定联名商品与官方商店信息。',
    sectionKeywords: [
      '联名', '周边', '商品', '限定', '官方商店', 'merch', 'merchandise', 'goods', 'store', 'sanrio',
    ],
    query: workName =>
      `${workName} 联名 周边 collaboration merchandise official store anime crossover`,
  },
  {
    id: 'sports-cross',
    sectionTitle: '体育与跨界合作',
    sectionDescription: '包含体育联盟、服饰品牌、线下活动等跨界合作场景。',
    sectionKeywords: [
      '体育', '球队', '联赛', '服饰', '运动', 'sports', 'nba', 'campaign', 'apparel', 'jersey',
    ],
    query: workName =>
      `${workName} NBA sports collaboration apparel campaign official`,
  },
]

const STRONG_CROSSOVER_KEYWORDS = [
  '联动', '联名', '合作', '联乘', '跨界', '客串',
  'collaboration', 'crossover', 'cross-over', 'tie-in', 'partnership',
  'guest appearance', 'cameo', 'team up',
]

const PROFILE_OR_CHANNEL_HINTS = [
  'up主', '频道', '主页', '粉丝', '订阅', '播放列表', '合集', '更多精彩视频', 'redirecting to',
  'channel', 'profile', 'followers', 'subscribe', 'playlist',
]

const TARGET_WORK_BLOCKED_KEYWORDS = [
  '维基百科', '自由的百科全书', '百科', 'official', 'press release', 'news', 'announcement', '更新',
  '活动', '联动', '频道', '主页', '合集', '播放列表', '视频', '官方账号', 'official channel',
  'youtube', 'bilibili', 'facebook', 'twitter', 'x.com', 'weibo',
  'collaboration', 'crossover', 'event', 'trailer', 'campaign', 'comparison', 'review',
]

const KNOWN_WORK_ALIASES: Record<string, string[]> = {
  我的英雄学院: ['我的英雄學院', 'my hero academia', 'boku no hero academia', '僕のヒーローアカデミア', 'mha'],
  myheroacademia: ['我的英雄学院', '我的英雄學院', 'boku no hero academia', '僕のヒーローアカデミア', 'mha'],
}

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

function detectRelationType(text: string): RelationType {
  const lower = text.toLowerCase()
  if (
    lower.includes('改编') ||
    lower.includes('adaptation') ||
    lower.includes('adapted from')
  ) {
    return 'adaptation'
  }

  if (lower.includes('衍生') || lower.includes('spin-off') || lower.includes('续作')) {
    return 'spin_off'
  }

  if (lower.includes('参考') || lower.includes('reference')) {
    return 'reference'
  }

  if (lower.includes('灵感') || lower.includes('inspired')) {
    return 'inspired'
  }

  return 'crossover'
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function stripQueryTerms(value: string, queryTerms: string[]): string {
  let result = value
  for (const term of queryTerms) {
    if (!term) continue
    const pattern = new RegExp(escapeRegExp(term), 'giu')
    result = result.replace(pattern, ' ')
  }
  return result.replace(/\s+/g, ' ').trim()
}

function extractTargetFromTitleOrSnippet(value: string, queryTerms: string[]): string | null {
  const noQueryText = stripQueryTerms(value, queryTerms)

  const pairMatches = noQueryText.matchAll(
    /([A-Za-z0-9\u4e00-\u9fa5][A-Za-z0-9\u4e00-\u9fa5\s:：'’\-]{1,36})\s*[xX×&]\s*([A-Za-z0-9\u4e00-\u9fa5][A-Za-z0-9\u4e00-\u9fa5\s:：'’\-]{1,36})/gu
  )

  for (const match of pairMatches) {
    const left = sanitizeExtractedWorkName(match[1])
    const right = sanitizeExtractedWorkName(match[2])
    const bestSide = [left, right]
      .filter((item): item is string => Boolean(item))
      .filter(side => isValidTargetWorkName(side) && !isSameWork(side, queryTerms))
      .sort((a, b) => scoreTargetCandidate(b) - scoreTargetCandidate(a))[0]

    if (bestSide && scoreTargetCandidate(bestSide) > 0) {
      return bestSide
    }
  }

  const bracketMatch = noQueryText.match(/[《【\[]([^》】\]]+)[》】\]]/)
  if (bracketMatch) {
    const candidate = sanitizeExtractedWorkName(bracketMatch[1])
    if (candidate && isValidTargetWorkName(candidate) && !isSameWork(candidate, queryTerms)) {
      return candidate
    }
  }

  const titleHead = noQueryText.split(' - ')[0].split('|')[0].trim()
  if (titleHead.length >= 2 && titleHead.length <= 40) {
    const cleaned = sanitizeExtractedWorkName(titleHead)
    if (
      cleaned &&
      isValidTargetWorkName(cleaned) &&
      !isSameWork(cleaned, queryTerms) &&
      scoreTargetCandidate(cleaned) > 0
    ) {
      return cleaned
    }
  }

  const pattern =
    /([A-Za-z0-9\u4e00-\u9fa5][A-Za-z0-9\u4e00-\u9fa5\s:：'’\-]{1,40}(?:动画|漫画|电影|游戏|作品|series|anime|manga|movie|game)?)/g
  const candidates = noQueryText.match(pattern) || []
  for (const raw of candidates) {
    const candidate = sanitizeExtractedWorkName(raw.replace(/(动画|漫画|电影|游戏|作品)$/u, '').trim())
    if (!candidate) continue
    if (candidate.length < 2 || candidate.length > 40) continue
    if (!isValidTargetWorkName(candidate) || isSameWork(candidate, queryTerms)) continue
    if (scoreTargetCandidate(candidate) <= 0) continue
    return candidate
  }

  return null
}

function sanitizeExtractedWorkName(value: string): string | null {
  const cleaned = value.replace(/[\[\]【】()（）]/g, '').replace(/\s+/g, ' ').trim()
  if (!cleaned || cleaned.length < 2 || cleaned.length > 40) return null

  const lowered = cleaned.toLowerCase()
  if (TARGET_WORK_BLOCKED_KEYWORDS.some(keyword => lowered.includes(keyword.toLowerCase()))) {
    return null
  }

  return cleaned
}

function getWorkAliases(workName: string): string[] {
  const aliases = new Set<string>()
  const trimmed = workName.trim()
  if (trimmed) {
    aliases.add(trimmed)
  }

  const normalizedKey = normalizeForMatch(trimmed)
  const knownAliases = KNOWN_WORK_ALIASES[normalizedKey] || KNOWN_WORK_ALIASES[trimmed] || []
  for (const alias of knownAliases) {
    if (alias.trim()) {
      aliases.add(alias.trim())
    }
  }

  const bracketAlias = trimmed.match(/[（(]([^）)]+)[）)]/)
  if (bracketAlias?.[1]) {
    aliases.add(bracketAlias[1].trim())
  }

  return Array.from(aliases)
}

function hasSourceWorkMention(text: string, workName: string): boolean {
  const normalizedText = normalizeForMatch(text)
  if (!normalizedText) {
    return false
  }

  const aliases = getWorkAliases(workName)
  for (const alias of aliases) {
    const normalizedAlias = normalizeForMatch(alias)
    if (normalizedAlias && normalizedText.includes(normalizedAlias)) {
      return true
    }
  }

  const hanOnly = workName.replace(/[^\p{Script=Han}]/gu, '')
  if (hanOnly.length >= 4) {
    const grams = new Set<string>()
    for (let i = 0; i < hanOnly.length - 1; i += 1) {
      grams.add(hanOnly.slice(i, i + 2))
    }

    let hitCount = 0
    for (const gram of grams) {
      if (normalizedText.includes(gram)) {
        hitCount += 1
      }
      if (hitCount >= 2) {
        return true
      }
    }
  }

  const latinTokens = workName
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(token => token.length >= 3)
  if (latinTokens.length > 0) {
    const tokenHits = latinTokens.filter(token => normalizedText.includes(token)).length
    if (tokenHits >= Math.min(2, latinTokens.length)) {
      return true
    }
  }

  return false
}

function hasStrongCrossoverSignal(text: string): boolean {
  const lower = text.toLowerCase()
  if (STRONG_CROSSOVER_KEYWORDS.some(keyword => lower.includes(keyword.toLowerCase()))) {
    return true
  }

  return /([A-Za-z0-9\u4e00-\u9fa5]{2,30})\s*[xX×&]\s*([A-Za-z0-9\u4e00-\u9fa5]{2,30})/u.test(text)
}

function matchesSectionKeywords(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase()
  return keywords.some(keyword => lower.includes(keyword.toLowerCase()))
}

function isLikelyChannelOrProfilePage(result: SearchResult): boolean {
  const parsed = safeParseUrl(result.url)
  const host = parsed ? normalizeHost(parsed.hostname) : ''
  const path = parsed ? parsed.pathname.toLowerCase() : ''
  const text = `${result.title} ${result.snippet}`.toLowerCase()

  if (host.includes('youtube.com')) {
    if (
      path.startsWith('/@') ||
      path.startsWith('/channel/') ||
      path.startsWith('/user/') ||
      path.startsWith('/c/') ||
      path.startsWith('/playlist')
    ) {
      return true
    }
  }

  if (host.includes('bilibili.com')) {
    if (path.startsWith('/space') || path.startsWith('/read/cv')) {
      return true
    }
  }

  if (PROFILE_OR_CHANNEL_HINTS.some(keyword => text.includes(keyword.toLowerCase()))) {
    return true
  }

  return false
}

function isValidTargetWorkName(value: string): boolean {
  const cleaned = value.trim()
  if (!cleaned || cleaned.length < 2 || cleaned.length > 40) {
    return false
  }

  if (!/[A-Za-z\u4e00-\u9fa5]/u.test(cleaned)) {
    return false
  }

  if (/^\d+$/u.test(cleaned)) {
    return false
  }

  if (cleaned.split(/\s+/).length > 8) {
    return false
  }

  const lower = cleaned.toLowerCase()
  if (TARGET_WORK_BLOCKED_KEYWORDS.some(keyword => lower.includes(keyword.toLowerCase()))) {
    return false
  }

  return true
}

function scoreTargetCandidate(value: string): number {
  const cleaned = value.trim()
  if (!cleaned) {
    return -10
  }

  const lower = cleaned.toLowerCase()
  const words = cleaned.split(/\s+/).filter(Boolean)
  let score = 0

  if (/《[^》]+》/.test(cleaned)) score += 3
  if (/[A-Za-z\u4e00-\u9fa5]/u.test(cleaned)) score += 2
  if (words.length <= 4) score += 2
  else if (words.length >= 7) score -= 3

  const noisyWords = ['collaboration', 'event', 'trailer', 'campaign', 'official', 'announcement', 'video']
  for (const word of noisyWords) {
    if (lower.includes(word)) {
      score -= 4
    }
  }

  if (cleaned.length > 26) score -= 2
  return score
}

function isSameWork(candidate: string, names: string[]): boolean {
  const normalizedCandidate = normalizeForMatch(candidate)
  if (!normalizedCandidate) {
    return false
  }

  return names.some(name => {
    const normalizedName = normalizeForMatch(name)
    if (!normalizedName) return false
    return (
      normalizedCandidate === normalizedName ||
      normalizedCandidate.includes(normalizedName) ||
      normalizedName.includes(normalizedCandidate)
    )
  })
}

function scoreClaimConfidence(
  sourceLevel: SourceLevel,
  text: string,
  relationType: RelationType,
  targetWork: string,
  workName: string
): number {
  let score = 0.35

  if (sourceLevel === 'official') score += 0.35
  else if (sourceLevel === 'trusted') score += 0.2

  const lower = text.toLowerCase()
  if (
    lower.includes('联动') ||
    lower.includes('collaboration') ||
    lower.includes('crossover') ||
    lower.includes('客串') ||
    lower.includes('joint')
  ) {
    score += 0.2
  }

  if (/《[^》]+》/.test(text)) score += 0.1

  if (relationType === 'reference' || relationType === 'inspired') {
    score -= 0.05
  }

  if (normalizeForMatch(targetWork) === normalizeForMatch(workName)) {
    score = 0
  }

  return Math.max(0, Math.min(1, score))
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

async function queryTavily(query: string, options: SearchWebOptions): Promise<SearchResult[]> {
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

    const data = await response.json() as TavilySearchResponse

    if (data.results && Array.isArray(data.results)) {
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
            priority: scoreSearchResult(url, sourceLevel, preferOfficial)
          }
        })
        .filter((item): item is RankedSearchResult => item !== null)

      const results = dedupeResults(rankedResults)
        .sort((a, b) => b.priority - a.priority)
        .slice(0, maxResults)
        .map(result => ({
          title: result.title,
          url: result.url,
          snippet: result.snippet,
          imageUrl: result.imageUrl,
          sourceName: result.sourceName,
          sourceLevel: result.sourceLevel
        }))

      return results
    }

    return []
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

export async function generateCrossoverReport(workName: string): Promise<WorkCrossoverReport> {
  const trimmedWorkName = workName.trim()
  if (!trimmedWorkName) {
    throw new Error('workName is required')
  }

  const sectionResults = await Promise.all(
    REPORT_QUERY_CONFIGS.map(async config => {
      const strict = await searchWeb(config.query(trimmedWorkName), {
        preferOfficial: true,
        officialOrTrustedOnly: true,
        maxResults: 12,
      })

      let merged = strict
      if (strict.length < 6) {
        const fallback = await searchWeb(config.query(trimmedWorkName), {
          preferOfficial: true,
          maxResults: 14,
        })
        merged = mergeSearchResults(strict, fallback)
      }

      return { config, results: merged }
    })
  )

  const sections: ReportSection[] = sectionResults
    .map(({ config, results }) => {
      const claims = buildSectionClaims(trimmedWorkName, config, results)
      return {
        id: config.id,
        title: config.sectionTitle,
        description: config.sectionDescription,
        claims,
      }
    })
    .filter(section => section.claims.length > 0)

  const stats = computeReportStats(sections)
  const summary = buildReportSummary(trimmedWorkName, sections, stats)

  return {
    workName: trimmedWorkName,
    generatedAt: new Date().toISOString(),
    summary,
    sections,
    stats,
  }
}

function buildSectionClaims(
  workName: string,
  config: ReportQueryConfig,
  results: SearchResult[]
): ReportClaim[] {
  const claimMap = new Map<string, ReportClaim>()
  const queryTerms = getWorkAliases(workName)

  for (const result of results) {
    if (isLikelyChannelOrProfilePage(result)) {
      continue
    }

    const text = `${result.title} ${result.snippet}`.trim()
    if (!text) {
      continue
    }

    if (!matchesSectionKeywords(text, config.sectionKeywords)) {
      continue
    }

    if (!hasSourceWorkMention(text, workName)) {
      continue
    }

    if (!hasStrongCrossoverSignal(text)) {
      continue
    }

    const targetWork = extractTargetFromTitleOrSnippet(text, queryTerms)
    if (!targetWork) {
      continue
    }

    if (!isValidTargetWorkName(targetWork) || isSameWork(targetWork, queryTerms)) {
      continue
    }

    const relationType = detectRelationType(text)
    const confidence = scoreClaimConfidence(
      result.sourceLevel || 'other',
      text,
      relationType,
      targetWork,
      workName
    )
    if (confidence < 0.55) {
      continue
    }

    const summary = (result.snippet || result.title || result.url).trim().slice(0, 220)
    const claimKey = `${config.id}:${normalizeForMatch(targetWork)}:${relationType}`
    const citation: ReportCitation = {
      title: result.title || targetWork,
      url: result.url,
      snippet: result.snippet || result.title || result.url,
      sourceName: result.sourceName || getSourceName(result.url),
      sourceLevel: result.sourceLevel || 'other',
    }

    const existing = claimMap.get(claimKey)
    if (!existing) {
      claimMap.set(claimKey, {
        id: claimKey,
        category: config.id,
        targetWork,
        relationType,
        summary,
        confidence,
        citations: [citation],
      })
      continue
    }

    existing.confidence = Math.max(existing.confidence, confidence)
    if (summary.length > existing.summary.length) {
      existing.summary = summary
    }
    if (!existing.citations.some(item => item.url.toLowerCase() === citation.url.toLowerCase())) {
      existing.citations.push(citation)
    }
  }

  return Array.from(claimMap.values())
    .filter(claimHasStrongEvidence)
    .map(claim => ({
      ...claim,
      citations: claim.citations
        .sort((a, b) => sourceLevelWeight(b.sourceLevel) - sourceLevelWeight(a.sourceLevel))
        .slice(0, 3),
    }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 8)
}

function sourceLevelWeight(level: SourceLevel): number {
  if (level === 'official') return 3
  if (level === 'trusted') return 2
  return 1
}

function claimHasStrongEvidence(claim: ReportClaim): boolean {
  const officialCount = claim.citations.filter(citation => citation.sourceLevel === 'official').length
  if (officialCount >= 1) {
    return true
  }

  const trustedHosts = new Set<string>()
  for (const citation of claim.citations) {
    if (citation.sourceLevel !== 'trusted') {
      continue
    }

    const parsed = safeParseUrl(citation.url)
    if (!parsed) {
      continue
    }

    trustedHosts.add(normalizeHost(parsed.hostname))
  }

  return trustedHosts.size >= 2
}

function computeReportStats(sections: ReportSection[]): WorkCrossoverReport['stats'] {
  let citations = 0
  let official = 0
  let trusted = 0
  let other = 0

  for (const section of sections) {
    for (const claim of section.claims) {
      citations += claim.citations.length
      for (const citation of claim.citations) {
        if (citation.sourceLevel === 'official') official += 1
        else if (citation.sourceLevel === 'trusted') trusted += 1
        else other += 1
      }
    }
  }

  return {
    claims: sections.reduce((sum, section) => sum + section.claims.length, 0),
    citations,
    official,
    trusted,
    other,
  }
}

function buildReportSummary(
  workName: string,
  sections: ReportSection[],
  stats: WorkCrossoverReport['stats']
): string {
  if (sections.length === 0 || stats.claims === 0) {
    return `按“同证据同时提及《${workName}》与目标作品、且出现联动动作词、并满足证据阈值（1条官方或2个权威来源）”的标准，暂未检索到可用联动。可尝试补充英文名/别名或直接加目标作品关键词。`
  }

  return `基于严格联动规则（同证据需命中源作品+目标作品+联动词，且至少1条官方或2个权威来源），围绕《${workName}》识别到 ${stats.claims} 条可用联动 claim（${stats.citations} 条证据）。其中官方来源 ${stats.official} 条，权威来源 ${stats.trusted} 条。`
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
  const text = result.title + ' ' + result.snippet

  const relationType = detectRelationType(text)

  const targetWork = extractTargetWork(text, workName)
  if (!targetWork) return null

  return {
    fromWork: workName,
    toWork: targetWork,
    relationType,
    evidence: result.snippet || result.url,
    evidenceUrl: result.url,
    fromImage: result.imageUrl,
    sourceName: result.sourceName,
    sourceLevel: result.sourceLevel
  }
}

function extractTargetWork(text: string, sourceWork: string): string | null {
  const cleaned = text.replaceAll(sourceWork, '').trim()

  const match = cleaned.match(/[《]([^》]+)[》]/)
  if (match) return sanitizeExtractedWorkName(match[1])

  const nameMatch = cleaned.match(/([A-Za-z0-9\u4e00-\u9fa5]{2,20}(?:作品|漫画|动画|小说|游戏|电影|剧))/g)
  if (nameMatch && nameMatch.length > 0) {
    return sanitizeExtractedWorkName(nameMatch[0].replace(/(作品|漫画|动画|小说|游戏|电影|剧)$/, ''))
  }

  return null
}

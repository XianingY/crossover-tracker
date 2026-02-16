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
}

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
  fromImage?: string
  toImage?: string
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

const BLOCKED_DOMAINS = [
  // Adult / NSFW
  '91porn', 'pornhub', 'xvideos', 'xnxx', 'xhamster', 'redtube',
  'youporn', 'tube8', 'spankbang', 'eporner', 'beeg',
  'jav', 'javbus', 'javdb', 'javlibrary', 'javmost', 'avgle',
  'jable', 'hanime1', 'hanime', 'hentai', 'nhentai', 'hitomi',
  'porn', 'adult', 'xxx', 'sex', 'nude', 'nsfw', 'erotic',
  'r18', 'dmm.co.jp/digital/video', 'fanza', 'fc2',
  'missav', 'supjav', 'thisav', 'myavsuper',
  // Piracy / file hosting
  'xunlei', 'pan.baidu', 'uploaded', 'rapidgator', 'mega.nz',
  'torrent', 'magnet', 'piratebay', '1337x', 'rarbg', 'nyaa',
  'bt.byr', 'btschool', 'kickass', 'limetorrent',
  'k2s.cc', 'filefactory', 'nitroflare', 'turbobit',
  // Spam / SEO junk
  'acgyhw', '51chigua', 'qianp.com', 'sodaa.net',
  'hao123', '360doc', 'toutiao.io',
  // Gambling
  'casino', 'bet365', 'poker', 'slots', 'gambling',
  // URL shorteners (often spam)
  'bit.ly/adult', 'tinyurl.com/nsfw',
]

// Keywords in title/snippet that indicate adult or spam content
const BLOCKED_CONTENT_KEYWORDS = [
  '色情', '成人', 'AV女优', '女优', '番号', '无码', '有码',
  '裸体', '性爱', '做爱', '约炮', '一夜情', '情色',
  '赌场', '赌博', '博彩', '棋牌', '彩票计划',
  '代孕', '壮阳', '伟哥', '催情',
  'hentai', 'erotic', 'nude', 'naked', 'nsfw',
]

const AUTHORITY_SOURCES = [
  { pattern: 'baike.baidu.com', name: '百度百科', priority: 10 },
  { pattern: 'wikipedia.org', name: '维基百科', priority: 9 },
  { pattern: 'bilibili.com', name: 'Bilibili', priority: 8 },
  { pattern: 'douban.com', name: '豆瓣', priority: 7 },
  { pattern: 'weibo.com', name: '微博', priority: 6 },
  { pattern: 'youtube.com', name: 'YouTube', priority: 5 },
  { pattern: 'pixiv.net', name: 'Pixiv', priority: 4 },
  { pattern: 'twitter.com', name: 'Twitter', priority: 3 },
  { pattern: 'instagram.com', name: 'Instagram', priority: 2 },
  { pattern: 'zhihu.com', name: '知乎', priority: 3 },
  { pattern: 'myanimelist.net', name: 'MyAnimeList', priority: 6 },
  { pattern: 'anidb.net', name: 'AniDB', priority: 5 },
  { pattern: 'bangumi.tv', name: 'Bangumi', priority: 7 },
  { pattern: 'anilist.co', name: 'AniList', priority: 5 },
]

function getSourcePriority(url: string): number {
  for (const source of AUTHORITY_SOURCES) {
    if (url.includes(source.pattern)) {
      return source.priority
    }
  }
  return 0
}

function isBlocked(url: string): boolean {
  const lowerUrl = url.toLowerCase()
  return BLOCKED_DOMAINS.some(blocked => lowerUrl.includes(blocked))
}

function isContentBlocked(title: string, snippet: string): boolean {
  const text = (title + ' ' + snippet).toLowerCase()
  return BLOCKED_CONTENT_KEYWORDS.some(keyword => text.includes(keyword.toLowerCase()))
}

function getSourceName(url: string): string {
  for (const source of AUTHORITY_SOURCES) {
    if (url.includes(source.pattern)) {
      return source.name
    }
  }
  return '网络'
}

export async function searchWeb(query: string): Promise<SearchResult[]> {
  const apiKey = getTavilyApiKey()

  if (!apiKey) {
    throw new Error('搜索服务未配置。请在 Vercel 后台配置 TAVILY_API_KEY')
  }

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: 20,
        include_answer: false,
        include_raw_content: false,
        include_images: true,
        exclude_domains: [
          'pornhub.com', 'xvideos.com', 'xnxx.com', 'xhamster.com',
          '91porn.com', 'javbus.com', 'jable.tv', 'hanime1.me',
          'nhentai.net', 'hitomi.la', 'missav.com', 'avgle.com',
        ]
      })
    })

    if (!response.ok) {
      throw new Error(`Tavily API error: ${response.status}`)
    }

    const data = await response.json()

    if (data.results && Array.isArray(data.results)) {
      const results = data.results
        .filter((item: any) => {
          const url = item.url || ''
          const title = item.title || ''
          const snippet = item.content || item.snippet || ''
          // Filter by both domain AND content keywords
          return !isBlocked(url) && !isContentBlocked(title, snippet)
        })
        .map((item: any) => ({
          title: item.title || '',
          url: item.url || '',
          snippet: item.content || item.snippet || '',
          imageUrl: item.images?.[0] || undefined,
          priority: getSourcePriority(item.url || '')
        }))
        .sort((a: any, b: any) => b.priority - a.priority)

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
    description: `图片分析功能需要配置付费API。当前图片: ${imageUrl.substring(0, 30)}...`,
    workName: undefined,
    characters: [],
    confidence: 0
  }
}

export async function searchConnections(workName: string): Promise<WorkConnection[]> {
  const query = `${workName} 联动 改编 衍生 客串 crossover`
  const results = await searchWeb(query)

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
  const results = await searchWeb(query)

  return results.slice(0, 5)
}

export async function identifyWorks(query: string): Promise<WorkCandidate[]> {
  const results = await searchWeb(query)

  const candidates: WorkCandidate[] = []
  const seen = new Set<string>()

  for (const result of results) {
    const workInfo = extractWorkInfo(result.title, result.snippet, result.url, result.imageUrl)
    if (workInfo && !seen.has(workInfo.name)) {
      seen.add(workInfo.name)
      candidates.push(workInfo)
    }
  }

  return candidates.slice(0, 10)
}

function extractWorkInfo(title: string, snippet: string, url: string, imageUrl?: string): WorkCandidate | null {
  const text = title + ' ' + snippet

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

  if (text.includes('漫画') || text.includes(' manga') || text.includes(' Comics')) {
    workType = '漫画'
  } else if (text.includes('动画') || text.includes(' anime') || text.includes(' Anime')) {
    workType = '动画'
  } else if (text.includes('小说') || text.includes(' novel') || text.includes(' Novel')) {
    workType = '小说'
  } else if (text.includes('电影') || text.includes(' movie') || text.includes(' Movie') || text.includes('Film')) {
    workType = '电影'
  } else if (text.includes('游戏') || text.includes(' game') || text.includes(' Game')) {
    workType = '游戏'
  } else if (text.includes('电视剧') || text.includes(' TV') || text.includes('剧集')) {
    workType = '电视剧'
  } else if (text.includes('轻小说')) {
    workType = '轻小说'
  }

  const source = getSourceName(url)

  return {
    name: workName,
    type: workType,
    source,
    url,
    imageUrl
  }
}

function extractConnectionInfo(workName: string, result: SearchResult): WorkConnection | null {
  const text = result.title + ' ' + result.snippet

  let relationType = 'crossover'
  if (text.includes('改编') || text.includes('adaptation')) {
    relationType = 'adaptation'
  } else if (text.includes('衍生') || text.includes('spin-off') || text.includes('续作')) {
    relationType = 'spin_off'
  } else if (text.includes('客串') || text.includes('crossover')) {
    relationType = 'crossover'
  } else if (text.includes('参考') || text.includes('reference')) {
    relationType = 'reference'
  } else if (text.includes('灵感') || text.includes('inspired')) {
    relationType = 'inspired'
  }

  const targetWork = extractTargetWork(text, workName)
  if (!targetWork) return null

  return {
    fromWork: workName,
    toWork: targetWork,
    relationType,
    evidence: result.snippet || result.url,
    evidenceUrl: result.url,
    fromImage: result.imageUrl
  }
}

function extractTargetWork(text: string, sourceWork: string): string | null {
  const cleaned = text.replace(sourceWork, '').trim()

  const match = cleaned.match(/[《]([^》]+)[》]/)
  if (match) return match[1]

  const nameMatch = cleaned.match(/([A-Za-z0-9\u4e00-\u9fa5]{2,20}(?:作品|漫画|动画|小说|游戏|电影|剧))/g)
  if (nameMatch && nameMatch.length > 0) {
    return nameMatch[0].replace(/(作品|漫画|动画|小说|游戏|电影|剧)$/, '')
  }

  return null
}

/**
 * AI Search Service
 * 
 * 使用 Tavily Search API
 */

export interface SearchResult {
  title: string
  url: string
  snippet: string
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
}

export interface WorkCandidate {
  name: string
  type: string
  source: string
  url: string
}

function getTavilyApiKey(): string | undefined {
  return process.env.TAVILY_API_KEY
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
        max_results: 10,
        include_answer: false,
        include_raw_content: false,
        include_images: false
      })
    })

    if (!response.ok) {
      throw new Error(`Tavily API error: ${response.status}`)
    }

    const data = await response.json()

    if (data.results && Array.isArray(data.results)) {
      return data.results.map((item: any) => ({
        title: item.title || '',
        url: item.url || '',
        snippet: item.content || item.snippet || ''
      }))
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
    const workInfo = extractWorkInfo(result.title, result.snippet, result.url)
    if (workInfo && !seen.has(workInfo.name)) {
      seen.add(workInfo.name)
      candidates.push(workInfo)
    }
  }
  
  return candidates.slice(0, 10)
}

function extractWorkInfo(title: string, snippet: string, url: string): WorkCandidate | null {
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
  
  let source = '网络'
  if (url.includes('baike.baidu.com')) source = '百度百科'
  else if (url.includes('wikipedia.org')) source = '维基百科'
  else if (url.includes('bilibili.com')) source = 'Bilibili'
  else if (url.includes('douban.com')) source = '豆瓣'
  else if (url.includes('weibo.com')) source = '微博'
  else if (url.includes('youtube.com')) source = 'YouTube'
  
  return {
    name: workName,
    type: workType,
    source,
    url
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
    evidence: result.url
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

/**
 * AI Search Service
 * 
 * 使用免费的网页搜索服务实现搜索功能
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

/**
 * 使用 DuckDuckGo API 进行网页搜索
 */
export async function searchWeb(query: string): Promise<SearchResult[]> {
  try {
    const encodedQuery = encodeURIComponent(query)
    const response = await fetch(
      `https://api.duckduckgo.com/?q=${encodedQuery}&format=json&no_html=1&skip_disambig=1`,
      {
        headers: {
          'Accept': 'application/json'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`)
    }

    const data = await response.json()

    if (!data.RelatedTopics || data.RelatedTopics.length === 0) {
      return []
    }

    const results: SearchResult[] = []
    
    for (const topic of data.RelatedTopics) {
      if (topic.Text && topic.FirstURL) {
        results.push({
          title: topic.Text.split(' - ')[0] || topic.Text,
          url: topic.FirstURL,
          snippet: topic.Text
        })
      }
    }

    return results.slice(0, 15)
  } catch (error) {
    console.error('Web search error:', error)
    throw new Error('搜索失败，请稍后重试')
  }
}

/**
 * 图像理解 - 使用外部服务分析图片
 * 注意：免费方案有限，需要配置付费API
 */
export async function analyzeImage(
  imageUrl: string, 
  prompt: string = '这张图片是什么作品？请给出作品名称、类型。'
): Promise<ImageAnalysisResult> {
  return {
    description: `图片分析功能需要配置付费API。当前图片URL: ${imageUrl.substring(0, 50)}...`,
    workName: undefined,
    characters: [],
    confidence: 0
  }
}

/**
 * 搜索作品联动信息
 */
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

/**
 * 搜索特定作品之间的证据
 */
export async function searchEvidence(workA: string, workB: string): Promise<SearchResult[]> {
  const query = `${workA} ${workB} 联动 合作 客串 改编`
  const results = await searchWeb(query)
  
  return results.slice(0, 5)
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

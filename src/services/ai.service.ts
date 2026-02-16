/**
 * AI Service - Minimax Coding Plan API Integration
 * 
 * 提供两种能力：
 * 1. web_search: 网络搜索作品/人物信息
 * 2. understand_image: 图像理解识别作品
 */

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY
const MINIMAX_API_HOST = process.env.MINIMAX_API_HOST || 'https://api.minimaxi.com'

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
 * 调用 Minimax API 的通用方法
 */
async function callMinimaxTool(tool: 'web_search' | 'understand_image', params: Record<string, any>) {
  const apiKey = process.env.MINIMAX_API_KEY
  const apiHost = process.env.MINIMAX_API_HOST || 'https://api.minimaxi.com'
  
  if (!apiKey) {
    throw new Error('MINIMAX_API_KEY is not configured. Please set it in Vercel dashboard or .env file.')
  }

  const response = await fetch(`${apiHost}/v1/mcp/tools/call`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      tool,
      parameters: params
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Minimax API error: ${response.status} - ${error}`)
  }

  return response.json()
}

/**
 * 网络搜索 - 搜索作品或人物信息
 */
export async function searchWeb(query: string): Promise<SearchResult[]> {
  try {
    const result = await callMinimaxTool('web_search', { query })
    
    // 解析返回结果
    if (result && result.data && result.data.web_search) {
      return result.data.web_search.results.map((item: any) => ({
        title: item.title || '',
        url: item.url || '',
        snippet: item.snippet || item.content || ''
      }))
    }
    
    return []
  } catch (error) {
    console.error('Web search error:', error)
    throw error
  }
}

/**
 * 图像理解 - 识别图片中的作品或人物
 */
export async function analyzeImage(imageUrl: string, prompt: string = '这张图片是什么作品？请给出作品名称、类型（小说/漫画/动画/游戏等）、以及出场的人物。'): Promise<ImageAnalysisResult> {
  try {
    const result = await callMinimaxTool('understand_image', {
      image_url: imageUrl,
      prompt
    })
    
    // 解析返回结果
    if (result && result.data && result.data.understand_image) {
      const analysis = result.data.understand_image.analysis || result.data.understand_image.content || ''
      
      // 尝试解析结构化信息
      return {
        description: analysis,
        workName: extractWorkName(analysis),
        characters: extractCharacters(analysis),
        confidence: 0.8 // 假设置信度
      }
    }
    
    return {
      description: '无法分析图像',
      confidence: 0
    }
  } catch (error) {
    console.error('Image analysis error:', error)
    throw error
  }
}

/**
 * 搜索作品联动信息
 */
export async function searchConnections(workName: string): Promise<WorkConnection[]> {
  // 搜索与该作品相关的联动、改编、衍生作品信息
  const query = `${workName} 联动 改编 衍生 客串 crossover adaptation spin-off`
  const results = await searchWeb(query)
  
  const connections: WorkConnection[] = []
  
  for (const result of results.slice(0, 10)) {
    // 尝试从搜索结果中提取联动关系
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
  
  return results.map(r => ({
    title: r.title,
    url: r.url,
    snippet: r.snippet
  })).slice(0, 5)
}

// ============ 辅助函数 ============

function extractWorkName(analysis: string): string | undefined {
  // 尝试匹配作品名称（通常在开头或引号中）
  const match = analysis.match(/作品[：:]\s*["']?([^"'"\n]+)["']?|这是[《]([^》]+)》/)
  return match ? (match[1] || match[2]) : undefined
}

function extractCharacters(analysis: string): string[] {
  // 尝试匹配人物名称
  const patterns = [
    /人物[：:]\s*([^。\n]+)/g,
    /出场人物[：:]\s*([^。\n]+)/g,
    /角色[：:]\s*([^。\n]+)/g
  ]
  
  const characters: string[] = []
  
  for (const pattern of patterns) {
    const matches = analysis.matchAll(pattern)
    for (const match of matches) {
      const names = match[1].split(/[,，、]/).map(n => n.trim()).filter(n => n)
      characters.push(...names)
    }
  }
  
  return [...new Set(characters)].slice(0, 10)
}

function extractConnectionInfo(workName: string, result: SearchResult): WorkConnection | null {
  const text = result.title + ' ' + result.snippet
  
  // 检测关系类型
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
  
  // 尝试提取目标作品
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
  // 移除源作品名称后查找可能的联动作品
  const cleaned = text.replace(sourceWork, '').trim()
  
  // 匹配《作品名》格式
  const match = cleaned.match(/[《]([^》]+)[》]/)
  if (match) return match[1]
  
  // 匹配常见作品名模式
  const nameMatch = cleaned.match(/([A-Za-z0-9\u4e00-\u9fa5]{2,20}(?:作品|漫画|动画|小说|游戏|电影|剧))/g)
  if (nameMatch && nameMatch.length > 0) {
    return nameMatch[0].replace(/(作品|漫画|动画|小说|游戏|电影|剧)$/, '')
  }
  
  return null
}

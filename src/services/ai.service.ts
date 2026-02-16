/**
 * AI Search Service
 * 
 * 使用博查AI搜索API (国内可用)
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

function getBochaApiKey(): string | undefined {
  return process.env.BOCHA_API_KEY
}

export async function searchWeb(query: string): Promise<SearchResult[]> {
  const apiKey = getBochaApiKey()
  
  if (apiKey) {
    try {
      const response = await fetch('https://api.bochaai.com/v1/web-search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query,
          count: 10,
          summary: true
        })
      })

      if (response.ok) {
        const data = await response.json()
        
        if (data.webPages?.value) {
          return data.webPages.value.map((item: any) => ({
            title: item.name || '',
            url: item.url || '',
            snippet: item.summary || item.snippet || ''
          }))
        }
      }
    } catch (error) {
      console.error('Bocha API error:', error)
    }
  }

  try {
    const encodedQuery = encodeURIComponent(query)
    const response = await fetch(
      `https://r.jina.ai/http://ddg-api.herokuapp.com/search?q=${encodedQuery}&limit=10`,
      {
        headers: {
          'Accept': 'application/json'
        }
      }
    )

    if (response.ok) {
      const data = await response.json()
      
      if (Array.isArray(data) && data.length > 0) {
        return data.map((item: any) => ({
          title: item.title || '',
          url: item.url || '',
          snippet: item.snippet || item.body || ''
        }))
      }
    }
  } catch (error) {
    console.error('Fallback search error:', error)
  }

  throw new Error('搜索服务暂不可用。请在 Vercel 后台配置 BOCHA_API_KEY')
}

export async function analyzeImage(
  imageUrl: string, 
  prompt: string = '这张图片是什么作品？请给出作品名称、类型。'
): Promise<ImageAnalysisResult> {
  return {
    description: `图片分析需要配置付费API。当前图片: ${imageUrl.substring(0, 30)}...`,
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

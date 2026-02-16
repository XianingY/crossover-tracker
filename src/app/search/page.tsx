'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import ImageUploader from '@/components/ai/ImageUploader'

interface WorkConnection {
  fromWork: string
  toWork: string
  relationType: string
  evidence: string
  evidenceUrl: string
  fromImage?: string
  toImage?: string
  source?: 'db' | 'ai'
  sourceName?: string
  sourceLevel?: 'official' | 'trusted' | 'other'
}

interface ReportCitation {
  title: string
  url: string
  snippet: string
  sourceName: string
  sourceLevel: 'official' | 'trusted' | 'other'
}

interface ReportClaim {
  id: string
  category: string
  targetWork: string
  relationType: 'adaptation' | 'spin_off' | 'crossover' | 'reference' | 'inspired'
  summary: string
  confidence: number
  citations: ReportCitation[]
}

interface ReportSection {
  id: string
  title: string
  description: string
  claims: ReportClaim[]
}

interface WorkCrossoverReport {
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

interface Work {
  id: string
  title: string
  type: string
}

interface WorkCandidate {
  name: string
  type: string
  source: string
  url: string
  imageUrl?: string
}

interface SearchResults {
  type?: 'identify' | 'image' | 'report'
  query?: string
  workCandidates?: WorkCandidate[]
  foundInDb?: Work[]
  connections?: WorkConnection[]
  report?: WorkCrossoverReport
  imageAnalysis?: {
    description: string
    workName?: string
  }
  matchedWorks?: Work[]
  suggestions?: unknown[]
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export default function SearchPage() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<'text' | 'image'>('text')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<SearchResults | null>(null)
  const [error, setError] = useState('')
  const [selectedWork, setSelectedWork] = useState<WorkCandidate | null>(null)

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return

    setLoading(true)
    setError('')
    setResults(null)
    setSelectedWork(null)

    try {
      const res = await fetch(`/api/ai/search?q=${encodeURIComponent(query)}&mode=identify`)
      const data = await res.json() as SearchResults & { error?: string }

      if (!res.ok) {
        throw new Error(data.error || 'Search failed')
      }

      setResults(data)
    } catch (err) {
      setError(getErrorMessage(err, 'Search failed'))
    } finally {
      setLoading(false)
    }
  }, [query])

  const handleWorkSelect = useCallback(async (work: WorkCandidate) => {
    setSelectedWork(work)
    setLoading(true)

    try {
      const res = await fetch(`/api/ai/search?q=${encodeURIComponent(work.name)}&mode=connections`)
      const data = await res.json() as { connections?: WorkConnection[]; error?: string }

      if (res.ok) {
        setResults(prev => ({ ...(prev || {}), connections: data.connections || [] }))
      } else {
        throw new Error(data.error || 'Search failed')
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Search failed'))
    } finally {
      setLoading(false)
    }
  }, [])

  const handleGenerateReport = useCallback(async (workName?: string) => {
    const target = (workName || selectedWork?.name || query).trim()
    if (!target) return

    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/ai/search?q=${encodeURIComponent(target)}&mode=report`)
      const data = await res.json() as SearchResults & { error?: string }

      if (!res.ok) {
        throw new Error(data.error || '生成报告失败')
      }

      setResults(data)
      if (workName) {
        setSelectedWork({
          name: workName,
          type: selectedWork?.type || '未知',
          source: selectedWork?.source || 'AI报告',
          url: selectedWork?.url || '',
          imageUrl: selectedWork?.imageUrl,
        })
      }
    } catch (err) {
      setError(getErrorMessage(err, '生成报告失败'))
    } finally {
      setLoading(false)
    }
  }, [query, selectedWork])

  const handleImageAnalysis = useCallback(async (imageUrl: string) => {
    setLoading(true)
    setError('')
    setResults(null)
    setSelectedWork(null)

    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl })
      })
      const data = await res.json() as {
        analysis?: SearchResults['imageAnalysis']
        matchedWorks?: Work[]
        suggestions?: unknown[]
        error?: string
      }

      if (!res.ok) {
        throw new Error(data.error || 'Analysis failed')
      }

      setResults({
        type: 'image',
        imageAnalysis: data.analysis,
        matchedWorks: data.matchedWorks,
        suggestions: data.suggestions
      })
    } catch (err) {
      setError(getErrorMessage(err, 'Analysis failed'))
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSaveConnection = useCallback(async (connection: WorkConnection) => {
    try {
      const workA = await findOrCreateWork(connection.fromWork)
      const workB = await findOrCreateWork(connection.toWork)

      const res = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromWorkId: workA.id,
          toWorkId: workB.id,
          relationType: connection.relationType,
          description: `AI发现 - ${connection.evidence}`
        })
      })

      if (res.ok) {
        alert('联动关系已保存！')
      }
    } catch (err) {
      alert('保存失败: ' + getErrorMessage(err, 'Unknown error'))
    }
  }, [])

  const findOrCreateWork = async (title: string): Promise<Work> => {
    const res = await fetch(`/api/works?search=${encodeURIComponent(title)}`)
    const works: Work[] = await res.json()

    if (works.length > 0) {
      return works[0]
    }

    const createRes = await fetch('/api/works', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, type: 'OTHER' })
    })

    const createdWork = await createRes.json() as Work
    return createdWork
  }

  const saveEvidence = useCallback(async (workA: string, workB: string) => {
    try {
      const res = await fetch('/api/ai/evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workA, workB })
      })
      const data = await res.json() as { savedEvidence?: unknown[]; error?: string }

      if (res.ok) {
        alert(`已保存 ${data.savedEvidence?.length || 0} 条证据到审核队列`)
      } else {
        throw new Error(data.error || '保存证据失败')
      }
    } catch (err) {
      alert('保存证据失败: ' + getErrorMessage(err, 'Unknown error'))
    }
  }, [])

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">AI 搜索</h1>
        <p className="text-slate-600">搜索作品名称，优先使用官方发布信息，并过滤成人与低质站点</p>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setMode('text')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${mode === 'text'
            ? 'bg-blue-600 text-white'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
        >
          文本搜索
        </button>
        <button
          onClick={() => setMode('image')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${mode === 'image'
            ? 'bg-blue-600 text-white'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
        >
          图片搜索
        </button>
      </div>

      {mode === 'text' && (
        <div className="flex gap-2 mb-8">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="输入作品名，例如：海贼王、复仇者联盟..."
            className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? '搜索中...' : '搜索'}
          </button>
          <button
            onClick={() => handleGenerateReport()}
            disabled={loading}
            className="px-5 py-3 bg-slate-800 text-white font-medium rounded-lg hover:bg-slate-900 disabled:opacity-50 transition-colors"
          >
            {loading ? '分析中...' : '深度报告'}
          </button>
        </div>
      )}

      {mode === 'image' && (
        <div className="mb-8">
          <ImageUploader onAnalysisComplete={handleImageAnalysis} />
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-slate-600">AI 分析中...</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 mb-6">
          {error}
        </div>
      )}

      {results && !loading && (
        <div className="space-y-6">
          {(results.workCandidates?.length ?? 0) > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-slate-800 mb-4">
                请选择你搜索的作品：
              </h2>
              <div className="space-y-2">
                {results.workCandidates?.map((work: WorkCandidate, i: number) => (
                  <button
                    key={i}
                    onClick={() => handleWorkSelect(work)}
                    className={`w-full text-left p-4 rounded-lg border transition-all ${selectedWork?.name === work.name
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm'
                      }`}
                  >
                    <div className="flex gap-4">
                      {work.imageUrl && (
                        <img
                          src={work.imageUrl}
                          alt={work.name}
                          className="w-20 h-20 object-cover rounded-lg shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-slate-800 text-lg">{work.name}</span>
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-sm rounded">
                            {work.type}
                          </span>
                        </div>
                        <p className="text-sm text-slate-500 mt-1">来源: {work.source}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {(results.foundInDb?.length ?? 0) > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-slate-800 mb-4">数据库中已存在</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                {results.foundInDb?.map((work: Work) => (
                  <button
                    key={work.id}
                    onClick={() => router.push(`/works/${work.id}`)}
                    className="p-3 bg-green-50 border border-green-200 rounded-lg text-left hover:bg-green-100 transition-colors"
                  >
                    <span className="font-medium text-green-800">{work.title}</span>
                    <span className="block text-xs text-green-600 mt-1">{work.type}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {(results.connections?.length ?? 0) > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-slate-800 mb-4">
                {selectedWork ? `《${selectedWork.name}》的联动作品` : '发现的联动关系'}
              </h2>
              <div className="space-y-3">
                {results.connections?.map((conn: WorkConnection, i: number) => (
                  <div
                    key={i}
                    className="p-4 bg-white border border-slate-200 rounded-lg"
                  >
                    <div className="flex gap-4 items-start mb-3">
                      {conn.fromImage && (
                        <img
                          src={conn.fromImage}
                          alt={conn.fromWork}
                          className="w-16 h-16 object-cover rounded-lg shrink-0"
                        />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-slate-800">
                            {selectedWork?.name || conn.fromWork}
                          </span>
                          <span className="text-slate-400">⟷</span>
                          <span className="font-medium text-slate-800">{conn.toWork}</span>
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
                            {conn.relationType === 'adaptation' ? '改编' :
                              conn.relationType === 'spin_off' ? '衍生' :
                                conn.relationType === 'crossover' ? '联动' :
                                  conn.relationType === 'reference' ? '参考' : '灵感'}
                          </span>
                          {conn.source && (
                            <span className={`px-2 py-0.5 text-xs rounded ${conn.source === 'db'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-blue-100 text-blue-700'
                              }`}>
                              {conn.source === 'db' ? '数据库' : 'AI搜索'}
                            </span>
                          )}
                        </div>
                        {conn.evidence && (
                          <p className="text-sm text-slate-500 line-clamp-2">{conn.evidence}</p>
                        )}
                        {conn.sourceName && (
                          <p className="mt-1 text-xs text-slate-400">
                            证据来源: {conn.sourceName}
                            {conn.sourceLevel === 'official' && '（官方）'}
                            {conn.sourceLevel === 'trusted' && '（权威）'}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => handleSaveConnection(conn)}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                      >
                        保存联动
                      </button>
                      {conn.evidenceUrl && (
                        <a
                          href={conn.evidenceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1 bg-slate-100 text-slate-700 text-sm rounded hover:bg-slate-200"
                        >
                          查看证据
                        </a>
                      )}
                      <button
                        onClick={() => saveEvidence(conn.fromWork, conn.toWork)}
                        className="px-3 py-1 bg-slate-100 text-slate-700 text-sm rounded hover:bg-slate-200"
                      >
                        保存证据
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {results.type === 'report' && results.report && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="text-xl font-semibold text-slate-800">
                  《{results.report.workName}》联动深度报告
                </h2>
                <p className="mt-2 text-sm text-slate-600">{results.report.summary}</p>
                <p className="mt-2 text-xs text-slate-500">
                  联动判定标准：同一证据需同时提及源作品与目标 IP，并出现联动动作词（联动/合作/crossover 等）；每条 claim 至少满足 1 条官方来源或 2 个不同权威来源。
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded bg-indigo-100 px-2 py-1 text-indigo-700">
                    Claims {results.report.stats.claims}
                  </span>
                  <span className="rounded bg-slate-100 px-2 py-1 text-slate-700">
                    引用 {results.report.stats.citations}
                  </span>
                  <span className="rounded bg-emerald-100 px-2 py-1 text-emerald-700">
                    官方 {results.report.stats.official}
                  </span>
                  <span className="rounded bg-blue-100 px-2 py-1 text-blue-700">
                    权威 {results.report.stats.trusted}
                  </span>
                </div>
              </div>

              {results.report.sections.length === 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
                  当前关键词下没有通过联动判定门槛的结果。建议补充“英文名/日文名 + 具体联动对象（如 Fortnite / Overwatch 2）”后重试。
                </div>
              )}

              {results.report.sections.map((section, index) => (
                <div key={section.id} className="rounded-xl border border-slate-200 bg-white p-5">
                  <h3 className="text-lg font-semibold text-slate-800">
                    {index + 1}. {section.title}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">{section.description}</p>

                  <div className="mt-4 space-y-4">
                    {section.claims.map((claim, claimIndex) => (
                      <div key={claim.id} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-slate-800">
                            {index + 1}.{claimIndex + 1} {claim.targetWork}
                          </span>
                          <span className="rounded bg-purple-100 px-2 py-0.5 text-xs text-purple-700">
                            {claim.relationType === 'adaptation' && '改编'}
                            {claim.relationType === 'spin_off' && '衍生'}
                            {claim.relationType === 'crossover' && '联动'}
                            {claim.relationType === 'reference' && '参考'}
                            {claim.relationType === 'inspired' && '灵感'}
                          </span>
                          <span className="rounded bg-slate-200 px-2 py-0.5 text-xs text-slate-700">
                            置信度 {(claim.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                        <p className="text-sm text-slate-600">{claim.summary}</p>
                        <div className="mt-3 space-y-2">
                          {claim.citations.map((citation, citationIndex) => (
                            <div key={`${claim.id}-${citationIndex}`} className="text-sm">
                              <a
                                href={citation.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-indigo-600 hover:underline"
                              >
                                [{citationIndex + 1}] {citation.title || citation.sourceName}
                              </a>
                              <span className="ml-2 text-xs text-slate-500">
                                {citation.sourceName}
                                {citation.sourceLevel === 'official' && '（官方）'}
                                {citation.sourceLevel === 'trusted' && '（权威）'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {results.type === 'image' && results.imageAnalysis && (
            <div>
              <h2 className="text-xl font-semibold text-slate-800 mb-4">图像分析结果</h2>
              <div className="p-4 bg-white border border-slate-200 rounded-lg mb-4">
                <p className="text-slate-700">{results.imageAnalysis.description}</p>
                {results.imageAnalysis.workName && (
                  <p className="mt-2 text-sm text-green-600">
                    识别作品: {results.imageAnalysis.workName}
                  </p>
                )}
              </div>

              {(results.matchedWorks?.length ?? 0) > 0 && (
                <div>
                  <h3 className="font-medium text-slate-800 mb-2">数据库匹配</h3>
                  <div className="flex flex-wrap gap-2">
                    {results.matchedWorks?.map((work: Work) => (
                      <button
                        key={work.id}
                        onClick={() => router.push(`/works/${work.id}`)}
                        className="px-3 py-1 bg-green-100 text-green-700 rounded-full hover:bg-green-200"
                      >
                        {work.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

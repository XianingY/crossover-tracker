'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import ImageUploader from '@/components/ai/ImageUploader'

interface SearchResult {
  title: string
  url: string
  snippet: string
}

interface WorkConnection {
  fromWork: string
  toWork: string
  relationType: string
  evidence: string
}

interface Work {
  id: string
  title: string
  type: string
}

export default function SearchPage() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<'text' | 'image'>('text')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [error, setError] = useState('')

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return

    setLoading(true)
    setError('')
    setResults(null)

    try {
      const res = await fetch(`/api/ai/search?q=${encodeURIComponent(query)}&mode=auto`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Search failed')
      }

      setResults(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [query])

  const handleImageAnalysis = useCallback(async (imageUrl: string) => {
    setLoading(true)
    setError('')
    setResults(null)

    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl })
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Analysis failed')
      }

      setResults({
        type: 'image',
        imageAnalysis: data.analysis,
        matchedWorks: data.matchedWorks,
        suggestions: data.suggestions
      })
    } catch (err: any) {
      setError(err.message)
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
    } catch (err: any) {
      alert('保存失败: ' + err.message)
    }
  }, [])

  const findOrCreateWork = async (title: string) => {
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

    return createRes.json()
  }

  const saveEvidence = useCallback(async (workA: string, workB: string) => {
    try {
      const res = await fetch('/api/ai/evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workA, workB })
      })
      const data = await res.json()

      if (res.ok) {
        alert(`已保存 ${data.savedEvidence?.length || 0} 条证据到审核队列`)
      }
    } catch (err: any) {
      alert('保存证据失败: ' + err.message)
    }
  }, [])

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">AI 搜索</h1>
        <p className="text-slate-600">通过作品名、人物名或图片搜索联动作品</p>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setMode('text')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            mode === 'text'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          文本搜索
        </button>
        <button
          onClick={() => setMode('image')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            mode === 'image'
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
            placeholder="输入作品名或人物名..."
            className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? '搜索中...' : '搜索'}
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
          <span className="ml-3 text-slate-600">AI 搜索中...</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 mb-6">
          {error}
        </div>
      )}

      {results && !loading && (
        <div className="space-y-6">
          {results.type === 'works' && (
            <div>
              <h2 className="text-xl font-semibold text-slate-800 mb-4">搜索结果</h2>
              <div className="space-y-3">
                {results.results?.map((r: SearchResult, i: number) => (
                  <a
                    key={i}
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-4 bg-white border border-slate-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all"
                  >
                    <h3 className="font-medium text-blue-600 mb-1">{r.title}</h3>
                    <p className="text-sm text-slate-600 line-clamp-2">{r.snippet}</p>
                  </a>
                ))}
              </div>
            </div>
          )}

          {results.type === 'auto' && (
            <>
              {results.foundInDb?.length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold text-slate-800 mb-4">数据库中已存在</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                    {results.foundInDb.map((work: Work) => (
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

              {results.searchResults?.length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold text-slate-800 mb-4">网络搜索结果</h2>
                  <div className="space-y-3">
                    {results.searchResults.slice(0, 10).map((r: SearchResult, i: number) => (
                      <a
                        key={i}
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-4 bg-white border border-slate-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all"
                      >
                        <h3 className="font-medium text-blue-600 mb-1">{r.title}</h3>
                        <p className="text-sm text-slate-600 line-clamp-2">{r.snippet}</p>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {results.connections?.length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold text-slate-800 mb-4">发现的联动关系</h2>
                  <div className="space-y-3">
                    {results.connections.map((conn: WorkConnection, i: number) => (
                      <div
                        key={i}
                        className="p-4 bg-white border border-slate-200 rounded-lg"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-medium text-slate-800">{conn.fromWork}</span>
                          <span className="text-slate-400">→</span>
                          <span className="font-medium text-slate-800">{conn.toWork}</span>
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
                            {conn.relationType}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveConnection(conn)}
                            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                          >
                            保存联动
                          </button>
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
            </>
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
                {results.imageAnalysis.characters?.length > 0 && (
                  <p className="text-sm text-blue-600">
                    识别人物: {results.imageAnalysis.characters?.join(', ')}
                  </p>
                )}
              </div>

              {results.matchedWorks?.length > 0 && (
                <div>
                  <h3 className="font-medium text-slate-800 mb-2">数据库匹配</h3>
                  <div className="flex flex-wrap gap-2">
                    {results.matchedWorks.map((work: Work) => (
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

              {results.suggestions?.length > 0 && (
                <div className="mt-4">
                  <h3 className="font-medium text-slate-800 mb-2">建议搜索</h3>
                  <div className="flex flex-wrap gap-2">
                    {results.suggestions.map((s: string, i: number) => (
                      <button
                        key={i}
                        onClick={() => {
                          setQuery(s)
                          handleSearch()
                        }}
                        className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200"
                      >
                        {s}
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

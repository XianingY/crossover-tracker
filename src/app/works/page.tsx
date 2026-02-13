'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Work {
  id: string
  title: string
  type: string
  isCentral: boolean
  _count: {
    connectionsFrom: number
    connectionsTo: number
  }
}

const WORK_TYPE_LABELS: Record<string, string> = {
  NOVEL: '小说',
  MANGA: '漫画',
  ANIME: '动画',
  GAME: '游戏',
  MOVIE: '电影',
  TV_SERIES: '电视剧',
  MUSIC: '音乐',
  OTHER: '其他'
}

export default function WorksPage() {
  const [works, setWorks] = useState<Work[]>([])
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  
  useEffect(() => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (typeFilter) params.set('type', typeFilter)
    
    fetch(`/api/works?${params}`)
      .then(res => res.json())
      .then(setWorks)
      .catch(console.error)
  }, [search, typeFilter])
  
  const handleDelete = async (id: string) => {
    if (!confirm('确定删除此作品？')) return
    
    await fetch(`/api/works/${id}`, { method: 'DELETE' })
    setWorks(works.filter(w => w.id !== id))
  }
  
  const setCentral = async (id: string) => {
    await fetch(`/api/works/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isCentral: true })
    })
    setWorks(works.map(w => ({
      ...w,
      isCentral: w.id === id
    })))
  }
  
  return (
    <div className="min-h-screen p-4 max-w-4xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">作品管理</h1>
        <Link
          href="/works/new"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        >
          添加作品
        </Link>
      </header>
      
      {/* 搜索和筛选 */}
      <div className="flex gap-4 mb-6">
        <input
          type="text"
          placeholder="搜索作品..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">全类型</option>
          {Object.entries(WORK_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value.toLowerCase()}>{label}</option>
          ))}
        </select>
      </div>
      
      {/* 作品列表 */}
      <div className="space-y-4">
        {works.map(work => (
          <div
            key={work.id}
            className="flex items-center justify-between p-4 bg-white rounded-lg shadow border border-gray-200"
          >
            <div className="flex items-center gap-4">
              <div>
                <h3 className="font-semibold text-lg text-gray-800">
                  {work.title}
                  {work.isCentral && (
                    <span className="ml-2 text-xs bg-red-500 text-white px-2 py-0.5 rounded">
                      中心
                    </span>
                  )}
                </h3>
                <p className="text-sm text-gray-500">{WORK_TYPE_LABELS[work.type] || work.type}</p>
                <p className="text-xs text-gray-400">
                  联动: {work._count.connectionsFrom} 出 / {work._count.connectionsTo} 入
                </p>
              </div>
            </div>
            
            <div className="flex gap-2">
              {!work.isCentral && (
                <button
                  onClick={() => setCentral(work.id)}
                  className="px-3 py-1 text-sm bg-yellow-500 text-white rounded hover:bg-yellow-600 transition"
                >
                  设为中心
                </button>
              )}
              <Link
                href={`/works/${work.id}`}
                className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition"
              >
                详情
              </Link>
              <button
                onClick={() => handleDelete(work.id)}
                className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition"
              >
                删除
              </button>
            </div>
          </div>
        ))}
        
        {works.length === 0 && (
          <p className="text-center text-gray-500 py-8">暂无作品</p>
        )}
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

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
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium tracking-wide text-slate-500">WORKS</p>
          <h1 className="text-3xl font-semibold text-slate-900">作品管理</h1>
          <p className="mt-1 text-sm text-slate-600">按类型筛选、搜索并维护作品库。</p>
        </div>
        <Link
          href="/works/new"
          className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          添加作品
        </Link>
      </header>

      <Card className="mb-6 bg-white/90 p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <Input
            type="text"
            placeholder="搜索作品标题..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">全类型</option>
          {Object.entries(WORK_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value.toLowerCase()}>{label}</option>
          ))}
        </select>
        </div>
      </Card>

      <div className="grid gap-4">
        {works.map(work => (
          <Card
            key={work.id}
            className="bg-white/95 p-5"
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold text-slate-900">{work.title}</h3>
                  {work.isCentral && (
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
                      中心作品
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-600">{WORK_TYPE_LABELS[work.type] || work.type}</p>
                <p className="mt-1 text-xs text-slate-500">
                  联动统计: 出向 {work._count.connectionsFrom} / 入向 {work._count.connectionsTo}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {!work.isCentral && (
                  <Button
                    variant="warning"
                    size="sm"
                    onClick={() => setCentral(work.id)}
                  >
                    设为中心
                  </Button>
                )}
                <Link
                  href={`/works/${work.id}`}
                  className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                >
                  查看详情
                </Link>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(work.id)}
                >
                  删除
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {works.length === 0 && (
        <Card className="mt-4 border-dashed border-slate-300 bg-white/80 py-12 text-center">
          <h3 className="text-lg font-semibold text-slate-800">暂无作品</h3>
          <p className="mt-1 text-sm text-slate-600">先创建第一部作品，开始构建联动网络。</p>
          <div className="mt-4">
            <Link
              href="/works/new"
              className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              创建作品
            </Link>
          </div>
        </Card>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'

interface Work {
  id: string
  title: string
  type: string
  description: string | null
  coverUrl: string | null
  isCentral: boolean
  connectionsFrom: OutgoingConnection[]
  connectionsTo: IncomingConnection[]
}

interface OutgoingConnection {
  id: string
  relationType: string
  level: number
  description: string | null
  evidences: { id: string }[]
  toWork: { id: string; title: string }
}

interface IncomingConnection {
  id: string
  relationType: string
  fromWork: { id: string; title: string }
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

export default function WorkDetailPage() {
  const params = useParams()
  const [work, setWork] = useState<Work | null>(null)
  
  useEffect(() => {
    fetch(`/api/works/${params.id}`)
      .then(res => res.json())
      .then(setWork)
      .catch(console.error)
  }, [params.id])
  
  if (!work) {
    return <div className="px-4 py-10 text-center text-slate-500">加载中...</div>
  }
  
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/works" className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 rounded">返回作品列表</Link>
          <h1 className="mt-1 text-3xl font-semibold text-slate-900">{work.title}</h1>
        </div>
        {work.isCentral && (
          <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-medium text-rose-700">中心作品</span>
        )}
      </header>

      <Card className="mb-6 bg-white/95 p-6">
        <div className="flex flex-col gap-5 sm:flex-row">
          <div className="h-44 w-32 flex-shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
            {work.coverUrl ? (
              <div
                className="h-full w-full bg-cover bg-center"
                style={{ backgroundImage: `url(${work.coverUrl})` }}
                aria-label={`${work.title} 封面`}
                role="img"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-slate-500">无封面</div>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-sm text-slate-600">类型: {WORK_TYPE_LABELS[work.type] || work.type}</p>
            {work.description && (
              <p className="text-sm leading-relaxed text-slate-700">{work.description}</p>
            )}
            <div className="pt-1 text-xs text-slate-500">
              出向联动 {work.connectionsFrom.length} / 入向联动 {work.connectionsTo.length}
            </div>
          </div>
        </div>
      </Card>
      
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-slate-900">由此作品联动到</h2>
          <Link href={`/works/${work.id}/connections`} className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2">
            管理联动
          </Link>
        </div>
        
        <div className="grid gap-3">
          {work.connectionsFrom.map((conn) => (
            <Card key={conn.id} className="bg-white/95 p-4">
              <div>
                <span className="font-medium text-slate-900">{conn.toWork.title}</span>
                <span className="ml-2 text-sm text-slate-500">
                  [{conn.relationType}] 级别: {conn.level}
                </span>
                {conn.description && (
                  <p className="text-sm text-slate-500">{conn.description}</p>
                )}
                <p className="text-xs text-slate-500">
                  有效证据: {conn.evidences.length}
                </p>
              </div>
            </Card>
          ))}
          
          {work.connectionsFrom.length === 0 && (
            <Card className="border-dashed border-slate-300 bg-white/80 py-10 text-center text-slate-500">暂无联动</Card>
          )}
        </div>
      </section>
      
      <section>
        <h2 className="mb-4 text-xl font-semibold text-slate-900">联动到此作品</h2>
        
        <div className="grid gap-3">
          {work.connectionsTo.map((conn) => (
            <Card key={conn.id} className="bg-white/95 p-4">
              <div className="flex items-center justify-between gap-2">
              <div>
                <span className="font-medium text-slate-900">{conn.fromWork.title}</span>
                <span className="ml-2 text-sm text-slate-500">
                  [{conn.relationType}]
                </span>
              </div>
              <Link
                href={`/works/${conn.fromWork.id}`}
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              >
                查看
              </Link>
              </div>
            </Card>
          ))}
          
          {work.connectionsTo.length === 0 && (
            <Card className="border-dashed border-slate-300 bg-white/80 py-10 text-center text-slate-500">暂无联动</Card>
          )}
        </div>
      </section>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface Work {
  id: string
  title: string
  type: string
  description: string | null
  coverUrl: string | null
  isCentral: boolean
  connectionsFrom: any[]
  connectionsTo: any[]
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
    return <div className="min-h-screen p-4 text-center text-gray-500">加载中...</div>
  }
  
  return (
    <div className="min-h-screen p-4 max-w-4xl mx-auto">
      <header className="flex items-center gap-4 mb-6">
        <Link href="/works" className="text-gray-500 hover:text-gray-700">← 返回</Link>
        <h1 className="text-2xl font-bold text-gray-800">{work.title}</h1>
        {work.isCentral && (
          <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded">中心作品</span>
        )}
      </header>
      
      {/* 作品信息 */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6 mb-6">
        <div className="flex gap-6">
          {work.coverUrl && (
            <img
              src={work.coverUrl}
              alt={work.title}
              className="w-32 h-44 object-cover rounded"
            />
          )}
          <div>
            <p className="text-gray-500 mb-2">类型: {WORK_TYPE_LABELS[work.type] || work.type}</p>
            {work.description && (
              <p className="text-gray-700">{work.description}</p>
            )}
          </div>
        </div>
      </div>
      
      {/* outgoing connections */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800">由此作品联动到</h2>
          <Link
            href={`/works/${work.id}/connections`}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
          >
            管理联动
          </Link>
        </div>
        
        <div className="space-y-2">
          {work.connectionsFrom.map((conn: any) => (
            <div
              key={conn.id}
              className="flex items-center justify-between p-3 bg-white rounded shadow border border-gray-200"
            >
              <div>
                <span className="font-medium">{conn.toWork.title}</span>
                <span className="ml-2 text-sm text-gray-500">
                  [{conn.relationType}] 级别: {conn.level}
                </span>
                {conn.description && (
                  <p className="text-sm text-gray-400">{conn.description}</p>
                )}
                <p className="text-xs text-gray-400">
                  有效证据: {conn.evidences.length}
                </p>
              </div>
            </div>
          ))}
          
          {work.connectionsFrom.length === 0 && (
            <p className="text-gray-500 text-center py-4">暂无联动</p>
          )}
        </div>
      </section>
      
      {/* incoming connections */}
      <section>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">联动到此作品</h2>
        
        <div className="space-y-2">
          {work.connectionsTo.map((conn: any) => (
            <div
              key={conn.id}
              className="flex items-center justify-between p-3 bg-white rounded shadow border border-gray-200"
            >
              <div>
                <span className="font-medium">{conn.fromWork.title}</span>
                <span className="ml-2 text-sm text-gray-500">
                  [{conn.relationType}]
                </span>
              </div>
              <Link
                href={`/works/${conn.fromWork.id}`}
                className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition"
              >
                查看
              </Link>
            </div>
          ))}
          
          {work.connectionsTo.length === 0 && (
            <p className="text-gray-500 text-center py-4">暂无联动</p>
          )}
        </div>
      </section>
    </div>
  )
}

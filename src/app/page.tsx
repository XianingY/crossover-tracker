'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'

const GraphView = dynamic(() => import('@/components/GraphView').then((m) => m.GraphView), {
  ssr: false,
})

export default function HomePage() {
  const router = useRouter()
  const [centralWorkId, setCentralWorkId] = useState<string>('')
  
  useEffect(() => {
    // 获取中心作品
    fetch('/api/works/central')
      .then(res => {
        if (res.ok) return res.json()
        throw new Error('No central work')
      })
      .then(data => {
        setCentralWorkId(data.id)
      })
      .catch(() => {
        // 没有中心作品
      })
  }, [])
  
  const handleNodeClick = (workId: string) => {
    router.push(`/works/${workId}`)
  }
  
  return (
    <main className="min-h-screen p-4 bg-white">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">文艺作品联动图谱</h1>
        <div className="space-x-2">
          <Link
            href="/works/new"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
          >
            添加作品
          </Link>
          <Link
            href="/works"
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition"
          >
            作品列表
          </Link>
        </div>
      </header>
      
      {!centralWorkId ? (
        <div className="flex flex-col items-center justify-center h-96">
          <p className="text-gray-500 mb-4">尚未设置中心作品</p>
          <Link
            href="/works/new?central=true"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            创建中心作品
          </Link>
        </div>
      ) : (
        <GraphView
          centralWorkId={centralWorkId}
          onNodeClick={handleNodeClick}
        />
      )}
      
      {/* 图例 */}
      <div className="mt-4 flex items-center justify-center gap-4 text-sm">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-red-500"></span>
          中心作品
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-orange-500"></span>
          一级联动
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
          二级联动
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-green-500"></span>
          三级联动
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-blue-500"></span>
          四级联动
        </span>
      </div>
    </main>
  )
}

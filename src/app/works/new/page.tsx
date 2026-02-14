'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const WORK_TYPES = [
  { value: 'novel', label: '小说' },
  { value: 'manga', label: '漫画' },
  { value: 'anime', label: '动画' },
  { value: 'game', label: '游戏' },
  { value: 'movie', label: '电影' },
  { value: 'tv_series', label: '电视剧' },
  { value: 'music', label: '音乐' },
  { value: 'other', label: '其他' },
]

export default function NewWorkPage() {
  const router = useRouter()
  
  const [form, setForm] = useState({
    title: '',
    type: 'novel',
    description: '',
    coverUrl: '',
    isCentral: false
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const isCentral = params.get('central') === 'true'
    if (isCentral) {
      setForm((prev) => ({ ...prev, isCentral: true }))
    }
  }, [])
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    const res = await fetch('/api/works', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })
    
    const data = await res.json()
    
    if (res.ok) {
      router.push('/works')
    } else {
      alert(data.error || '创建失败')
    }
    
    setLoading(false)
  }
  
  return (
    <div className="min-h-screen p-4 max-w-2xl mx-auto">
      <header className="flex items-center gap-4 mb-6">
        <Link href="/works" className="text-gray-500 hover:text-gray-700">← 返回</Link>
        <h1 className="text-2xl font-bold text-gray-800">新建作品</h1>
      </header>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1 font-medium text-gray-700">作品标题</label>
          <input
            type="text"
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        
        <div>
          <label className="block mb-1 font-medium text-gray-700">作品类型</label>
          <select
            value={form.type}
            onChange={e => setForm({ ...form, type: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {WORK_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block mb-1 font-medium text-gray-700">简介</label>
          <textarea
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={4}
          />
        </div>
        
        <div>
          <label className="block mb-1 font-medium text-gray-700">封面图 URL</label>
          <input
            type="url"
            value={form.coverUrl}
            onChange={e => setForm({ ...form, coverUrl: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="https://..."
          />
        </div>
        
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isCentral"
            checked={form.isCentral}
            onChange={e => setForm({ ...form, isCentral: e.target.checked })}
            className="w-4 h-4"
          />
          <label htmlFor="isCentral" className="text-gray-700">设为中心作品</label>
        </div>
        
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {loading ? '创建中...' : '创建作品'}
        </button>
      </form>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface Work {
  id: string
  title: string
  connectionsFrom: any[]
}

interface AllWork {
  id: string
  title: string
  type: string
}

export default function ConnectionsPage() {
  const params = useParams()
  const [work, setWork] = useState<Work | null>(null)
  const [allWorks, setAllWorks] = useState<AllWork[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    toWorkId: '',
    relationType: 'crossover',
    description: ''
  })
  
  useEffect(() => {
    fetch(`/api/works/${params.id}`)
      .then(res => res.json())
      .then(setWork)
      .catch(console.error)
    
    fetch('/api/works')
      .then(res => res.json())
      .then(setAllWorks)
      .catch(console.error)
  }, [params.id])
  
  const handleCreateConnection = async (e: React.FormEvent) => {
    e.preventDefault()
    
    await fetch('/api/connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromWorkId: params.id,
        ...form
      })
    })
    
    // 刷新数据
    const res = await fetch(`/api/works/${params.id}`)
    setWork(await res.json())
    setShowForm(false)
  }
  
  const handleDeleteConnection = async (connId: string) => {
    if (!confirm('确定删除此联动？')) return
    
    await fetch(`/api/connections/${connId}`, { method: 'DELETE' })
    
    const res = await fetch(`/api/works/${params.id}`)
    setWork(await res.json())
  }
  
  if (!work) return <div className="min-h-screen p-4 text-center text-gray-500">加载中...</div>
  
  const RELATION_TYPES = [
    { value: 'crossover', label: '跨界联动' },
    { value: 'adaptation', label: '改编' },
    { value: 'spin_off', label: '衍生作品' },
    { value: 'reference', label: '致敬/彩蛋' },
    { value: 'inspired', label: '灵感来源' },
    { value: 'collaboration', label: '合作' },
  ]
  
  return (
    <div className="min-h-screen p-4 max-w-4xl mx-auto">
      <header className="flex items-center gap-4 mb-6">
        <Link href={`/works/${params.id}`} className="text-gray-500 hover:text-gray-700">← 返回</Link>
        <h1 className="text-2xl font-bold text-gray-800">联动管理: {work.title}</h1>
      </header>
      
      {/* 联动列表 */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">由此作品联动到</h2>
        
        <div className="space-y-2 mb-4">
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
              <div className="flex gap-2">
                <Link
                  href={`/evidences/new?connectionId=${conn.id}`}
                  className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600 transition"
                >
                  添加证据
                </Link>
                <button
                  onClick={() => handleDeleteConnection(conn.id)}
                  className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
        
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        >
          添加联动
        </button>
        
        {showForm && (
          <form onSubmit={handleCreateConnection} className="mt-4 p-4 bg-gray-50 rounded space-y-4">
            <div>
              <label className="block mb-1 font-medium text-gray-700">联动到</label>
              <select
                value={form.toWorkId}
                onChange={e => setForm({ ...form, toWorkId: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">选择作品</option>
                {allWorks
                  .filter(w => w.id !== params.id)
                  .map(w => (
                    <option key={w.id} value={w.id}>{w.title}</option>
                  ))}
              </select>
            </div>
            
            <div>
              <label className="block mb-1 font-medium text-gray-700">联动类型</label>
              <select
                value={form.relationType}
                onChange={e => setForm({ ...form, relationType: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {RELATION_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block mb-1 font-medium text-gray-700">描述</label>
              <textarea
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
              />
            </div>
            
            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
              >
                创建
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition"
              >
                取消
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  )
}

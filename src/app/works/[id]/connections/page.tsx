'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

interface Work {
  id: string
  title: string
  connectionsFrom: ConnectionItem[]
}

interface ConnectionItem {
  id: string
  relationType: string
  level: number
  description: string | null
  evidences: { id: string }[]
  toWork: { id: string; title: string }
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
  
  if (!work) return <div className="px-4 py-10 text-center text-slate-500">加载中...</div>
  
  const RELATION_TYPES = [
    { value: 'crossover', label: '跨界联动' },
    { value: 'adaptation', label: '改编' },
    { value: 'spin_off', label: '衍生作品' },
    { value: 'reference', label: '致敬/彩蛋' },
    { value: 'inspired', label: '灵感来源' },
    { value: 'collaboration', label: '合作' },
  ]
  
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/works/${params.id}`} className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 rounded">返回作品详情</Link>
          <h1 className="mt-1 text-3xl font-semibold text-slate-900">联动管理: {work.title}</h1>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          variant={showForm ? 'secondary' : 'primary'}
        >
          {showForm ? '收起表单' : '添加联动'}
        </Button>
      </header>
      
      <section className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-slate-900">由此作品联动到</h2>
        
        <div className="grid gap-3">
          {work.connectionsFrom.map((conn) => (
            <Card key={conn.id} className="bg-white/95 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
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
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/evidences/new?connectionId=${conn.id}`}
                  className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                >
                  添加证据
                </Link>
                <Button
                  onClick={() => handleDeleteConnection(conn.id)}
                  variant="destructive"
                  size="sm"
                >
                  删除
                </Button>
              </div>
              </div>
            </Card>
          ))}

          {work.connectionsFrom.length === 0 && (
            <Card className="border-dashed border-slate-300 bg-white/80 py-10 text-center text-slate-500">
              暂无联动，点击“添加联动”开始创建。
            </Card>
          )}
        </div>

        {showForm && (
          <Card className="mt-5 bg-white/95 p-5">
          <form onSubmit={handleCreateConnection} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">联动到</label>
              <select
                value={form.toWorkId}
                onChange={e => setForm({ ...form, toWorkId: e.target.value })}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
              <label className="mb-1 block text-sm font-medium text-slate-700">联动类型</label>
              <select
                value={form.relationType}
                onChange={e => setForm({ ...form, relationType: e.target.value })}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {RELATION_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">描述</label>
              <textarea
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                rows={2}
                placeholder="如：动画改编自漫画，角色设定共享世界观"
              />
            </div>
            
            <div className="flex gap-2">
              <Button
                type="submit"
              >
                创建
              </Button>
              <Button
                type="button"
                onClick={() => setShowForm(false)}
                variant="secondary"
              >
                取消
              </Button>
            </div>
          </form>
          </Card>
        )}
      </section>
    </div>
  )
}

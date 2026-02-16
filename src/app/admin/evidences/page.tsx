'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

interface Evidence {
  id: string
  type: string
  url: string | null
  fileUrl: string | null
  description: string | null
  status: string
  connection: {
    fromWork: { title: string }
    toWork: { title: string }
  }
}

export default function EvidencesAdminPage() {
  const [evidences, setEvidences] = useState<Evidence[]>([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    const params = new URLSearchParams()
    if (filter) params.set('status', filter)

    fetch(`/api/evidences?${params}`)
      .then(res => res.json())
      .then(setEvidences)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [filter])
  
  const handleReview = async (id: string, status: 'APPROVED' | 'REJECTED', reason?: string) => {
    await fetch(`/api/evidences/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, rejectReason: reason })
    })
    
    setEvidences(evidences.filter(e => e.id !== id))
  }
  
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      <header className="mb-6">
        <Link href="/" className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white/80 px-2.5 py-1 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2">← 返回图谱概览</Link>
        <p className="text-sm font-medium tracking-wide text-slate-500">ADMIN</p>
        <h1 className="text-3xl font-semibold text-slate-900">证据审核</h1>
        <p className="mt-1 text-sm text-slate-600">统一处理待审核证据，保证联动关系可追溯。</p>
      </header>

      <div className="mb-5 flex flex-wrap gap-2">
        <Button
          onClick={() => setFilter('')}
          variant={!filter ? 'primary' : 'secondary'}
          size="sm"
        >
          全部
        </Button>
        <Button
          onClick={() => setFilter('PENDING')}
          variant={filter === 'PENDING' ? 'warning' : 'secondary'}
          size="sm"
        >
          待审核
        </Button>
        <Button
          onClick={() => setFilter('APPROVED')}
          variant={filter === 'APPROVED' ? 'success' : 'secondary'}
          size="sm"
        >
          已通过
        </Button>
      </div>
      
      <div className="grid gap-4">
        {loading && (
          <Card className="bg-white/90 py-12 text-center text-slate-600">加载中...</Card>
        )}

        {!loading && evidences.map(evidence => (
          <Card key={evidence.id} className="bg-white/95 p-5">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <span className="font-medium text-slate-900">
                  {evidence.connection.fromWork.title} → {evidence.connection.toWork.title}
                </span>
                <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${
                  evidence.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                  evidence.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                }`}>
                  {evidence.status}
                </span>
              </div>
              
              {evidence.status === 'PENDING' && (
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleReview(evidence.id, 'APPROVED')}
                    variant="success"
                    size="sm"
                  >
                    通过
                  </Button>
                  <Button
                    onClick={() => handleReview(evidence.id, 'REJECTED', '证据不充分')}
                    variant="destructive"
                    size="sm"
                  >
                    拒绝
                  </Button>
                </div>
              )}
            </div>
            
            {evidence.description && (
              <p className="mb-2 text-sm text-slate-600">{evidence.description}</p>
            )}
            
            {evidence.type === 'link' && evidence.url && (
              <a
                href={evidence.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-indigo-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 rounded"
              >
                查看证据链接 →
              </a>
            )}
            
            {evidence.type === 'file' && evidence.fileUrl && (
              <a
                href={evidence.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-indigo-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 rounded"
              >
                查看证据文件 →
              </a>
            )}
          </Card>
        ))}
        
        {!loading && evidences.length === 0 && (
          <Card className="border-dashed border-slate-300 bg-white/80 py-12 text-center">
            <h3 className="text-lg font-semibold text-slate-800">暂无证据</h3>
            <p className="mt-1 text-sm text-slate-600">当前筛选条件下没有可审核条目。</p>
          </Card>
        )}
      </div>
    </div>
  )
}

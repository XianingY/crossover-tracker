'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

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
  
  useEffect(() => {
    const params = new URLSearchParams()
    if (filter) params.set('status', filter)
    
    fetch(`/api/evidences?${params}`)
      .then(res => res.json())
      .then(setEvidences)
      .catch(console.error)
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
    <div className="min-h-screen p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">证据审核</h1>
      
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setFilter('')}
          className={`px-3 py-1 rounded ${!filter ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
        >
          全部
        </button>
        <button
          onClick={() => setFilter('PENDING')}
          className={`px-3 py-1 rounded ${filter === 'PENDING' ? 'bg-yellow-500 text-white' : 'bg-gray-200'}`}
        >
          待审核
        </button>
        <button
          onClick={() => setFilter('APPROVED')}
          className={`px-3 py-1 rounded ${filter === 'APPROVED' ? 'bg-green-500 text-white' : 'bg-gray-200'}`}
        >
          已通过
        </button>
      </div>
      
      <div className="space-y-4">
        {evidences.map(evidence => (
          <div key={evidence.id} className="p-4 bg-white rounded shadow border border-gray-200">
            <div className="flex justify-between items-start mb-2">
              <div>
                <span className="font-medium">
                  {evidence.connection.fromWork.title} → {evidence.connection.toWork.title}
                </span>
                <span className={`ml-2 px-2 py-0.5 text-xs rounded ${
                  evidence.status === 'PENDING' ? 'bg-yellow-100' :
                  evidence.status === 'APPROVED' ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  {evidence.status}
                </span>
              </div>
              
              {evidence.status === 'PENDING' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleReview(evidence.id, 'APPROVED')}
                    className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600 transition"
                  >
                    通过
                  </button>
                  <button
                    onClick={() => handleReview(evidence.id, 'REJECTED', '证据不充分')}
                    className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition"
                  >
                    拒绝
                  </button>
                </div>
              )}
            </div>
            
            {evidence.description && (
              <p className="text-sm text-gray-600 mb-2">{evidence.description}</p>
            )}
            
            {evidence.type === 'link' && evidence.url && (
              <a
                href={evidence.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-500 hover:underline"
              >
                查看证据链接 →
              </a>
            )}
            
            {evidence.type === 'file' && evidence.fileUrl && (
              <a
                href={evidence.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-500 hover:underline"
              >
                查看证据文件 →
              </a>
            )}
          </div>
        ))}
        
        {evidences.length === 0 && (
          <p className="text-center text-gray-500 py-8">暂无证据</p>
        )}
      </div>
    </div>
  )
}

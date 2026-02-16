'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'

type EvidenceType = 'link' | 'file'

interface ConnectionDetail {
  id: string
  fromWork: { id: string; title: string }
  toWork: { id: string; title: string }
}

export default function NewEvidencePage() {
  const router = useRouter()
  const [connectionId, setConnectionId] = useState('')

  const [connection, setConnection] = useState<ConnectionDetail | null>(null)
  const [type, setType] = useState<EvidenceType>('link')
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [submittedBy, setSubmittedBy] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const id = new URLSearchParams(window.location.search).get('connectionId') || ''
    setConnectionId(id)
  }, [])

  useEffect(() => {
    if (!connectionId) return

    fetch(`/api/connections/${connectionId}`)
      .then((res) => {
        if (!res.ok) throw new Error('连接不存在')
        return res.json()
      })
      .then(setConnection)
      .catch(() => setConnection(null))
  }, [connectionId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMessage('')

    try {
      if (!connectionId) {
        throw new Error('缺少 connectionId，无法提交证据')
      }

      let fileUrl = ''
      let fileName = ''

      if (type === 'file') {
        if (!file) {
          throw new Error('请先选择文件')
        }

        const formData = new FormData()
        formData.append('file', file)

        const uploadRes = await fetch('/api/evidences/upload', {
          method: 'POST',
          body: formData,
        })

        const uploadData = await uploadRes.json()
        if (!uploadRes.ok) {
          throw new Error(uploadData.error || '文件上传失败')
        }

        fileUrl = uploadData.url
        fileName = uploadData.filename
      }

      if (type === 'link' && !url.trim()) {
        throw new Error('请填写证据链接')
      }

      const submitRes = await fetch('/api/evidences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId,
          type,
          url: type === 'link' ? url.trim() : null,
          fileUrl: type === 'file' ? fileUrl : null,
          fileName: type === 'file' ? fileName : null,
          description: description.trim() || null,
          submittedBy: submittedBy.trim() || null,
        }),
      })

      const submitData = await submitRes.json()
      if (!submitRes.ok) {
        throw new Error(submitData.error || '提交失败')
      }

      if (connection?.fromWork.id) {
        router.push(`/works/${connection.fromWork.id}/connections`)
      } else {
        router.push('/works')
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '提交失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const backHref = connection?.fromWork.id ? `/works/${connection.fromWork.id}/connections` : '/works'

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
      <header className="mb-6">
        <div>
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white/80 px-2.5 py-1 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          >
            ← 返回联动管理
          </Link>
          <p className="text-sm font-medium tracking-wide text-slate-500">NEW EVIDENCE</p>
          <h1 className="text-3xl font-semibold text-slate-900">添加证据</h1>
          {connection && (
            <p className="mt-1 text-sm text-slate-600">
              当前联动: {connection.fromWork.title} → {connection.toWork.title}
            </p>
          )}
        </div>
      </header>

      <Card className="bg-white/95">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">证据类型</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as EvidenceType)}
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="link">链接</option>
              <option value="file">文件</option>
            </select>
          </div>

          {type === 'link' ? (
            <Input
              label="证据链接"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              required
            />
          ) : (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">上传文件</label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-600 file:px-3 file:py-1.5 file:text-white hover:file:bg-indigo-700"
                required
              />
              <p className="mt-1 text-xs text-slate-500">支持 jpg/png/gif/pdf，最大 10MB。</p>
            </div>
          )}

          <Textarea
            label="说明"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="简要说明该证据如何证明联动关系"
          />

          <Input
            label="提交者（可选）"
            type="text"
            value={submittedBy}
            onChange={(e) => setSubmittedBy(e.target.value)}
            placeholder="昵称或标识"
          />

          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
            提交后需管理员审核，通过后联动图谱才会计入该证据。
          </p>

          {errorMessage && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{errorMessage}</p>}

          <Button type="submit" disabled={loading} className="w-full" size="lg">
            {loading ? '提交中...' : '提交证据'}
          </Button>
        </form>
      </Card>
    </div>
  )
}

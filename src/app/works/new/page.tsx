'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'

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
    isCentral: typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('central') === 'true'
  })
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMessage('')

    const res = await fetch('/api/works', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })

    const data = await res.json()

    if (res.ok) {
      router.push('/works')
    } else {
      setErrorMessage(data.error || '创建失败，请稍后重试')
    }

    setLoading(false)
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
      <header className="mb-6">
        <div>
          <Link href="/works" className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white/80 px-2.5 py-1 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2">← 返回列表</Link>
          <p className="text-sm font-medium tracking-wide text-slate-500">NEW WORK</p>
          <h1 className="text-3xl font-semibold text-slate-900">新建作品</h1>
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-[1fr_220px]">
        <Card className="bg-white/95">
          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="作品标题"
              type="text"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              required
              placeholder="例如：命运石之门"
            />



            <Select
              label="作品类型"
              value={form.type}
              onChange={e => setForm({ ...form, type: e.target.value })}
              options={WORK_TYPES}
            />

            <Textarea
              label="简介"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              rows={4}
              placeholder="简要介绍作品背景、内容或特色"
            />

            <Input
              label="封面图 URL"
              type="url"
              value={form.coverUrl}
              onChange={e => setForm({ ...form, coverUrl: e.target.value })}
              placeholder="https://..."
            />

            <label className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <input
                type="checkbox"
                id="isCentral"
                checked={form.isCentral}
                onChange={e => setForm({ ...form, isCentral: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              设为中心作品
            </label>

            {errorMessage && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{errorMessage}</p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading ? '创建中...' : '创建作品'}
            </Button>
          </form>
        </Card>

        <Card className="bg-white/90 p-4">
          <h2 className="text-sm font-semibold text-slate-800">封面预览</h2>
          <div className="mt-3 aspect-[3/4] overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
            {form.coverUrl ? (
              <img
                src={form.coverUrl}
                alt="封面预览"
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-slate-500">输入 URL 后显示预览</div>
            )}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            建议使用清晰的竖版封面图，比例接近 3:4，可获得更好的展示效果。
          </p>
        </Card>
      </div>
    </div>
  )
}

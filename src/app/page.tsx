'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import type { GraphNode } from '@/components/GraphView'

const GraphView = dynamic(() => import('@/components/GraphView').then((m) => m.GraphView), {
  ssr: false,
})

interface CentralWork {
  id: string
  title: string
}

export default function HomePage() {
  const [centralWorks, setCentralWorks] = useState<CentralWork[]>([])
  const [centralWorkId, setCentralWorkId] = useState<string>('')
  const [centralLoading, setCentralLoading] = useState(true)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [selectedNodeDetail, setSelectedNodeDetail] = useState<{
    id: string
    title: string
    type: string
    description: string | null
    isCentral: boolean
    coverUrl: string | null
    connectionsFrom: { id: string }[]
    connectionsTo: { id: string }[]
  } | null>(null)
  const [panelLoading, setPanelLoading] = useState(false)

  useEffect(() => {
    // 获取所有中心作品
    fetch('/api/works/central')
      .then(res => res.json())
      .then((data: CentralWork[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setCentralWorks(data)
          // 默认选中第一个
          setCentralWorkId(data[0].id)
        }
      })
      .catch(console.error)
      .finally(() => setCentralLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedNode) return

    let cancelled = false

    fetch(`/api/works/${selectedNode.id}`)
      .then((res) => {
        if (!res.ok) throw new Error('fetch failed')
        return res.json()
      })
      .then((data) => {
        if (!cancelled) setSelectedNodeDetail(data)
      })
      .catch(() => {
        if (!cancelled) setSelectedNodeDetail(null)
      })
      .finally(() => {
        if (!cancelled) setPanelLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [selectedNode])

  useEffect(() => {
    if (!selectedNode) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedNode(null)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedNode])

  const handleNodeSelect = (node: GraphNode) => {
    setSelectedNode(node)
    setSelectedNodeDetail(null)
    setPanelLoading(true)
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 md:px-8">
      <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium tracking-wide text-slate-500">CROSSOVER TRACKER</p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-900 md:text-4xl">文艺作品联动图谱</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            以中心作品为起点，查看跨小说、漫画、动画、游戏等媒介的关联路径。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/works/new" className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
            添加作品
          </Link>
          <Link href="/works" className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
            作品列表
          </Link>
          <Link href="/admin/evidences" className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
            证据审核
          </Link>
        </div>
      </header>

      {centralLoading ? (
        <Card className="border-dashed border-slate-300 bg-white/80 text-center">
          <div className="py-20">
            <h2 className="text-2xl font-semibold text-slate-800">加载中...</h2>
            <p className="mx-auto mt-2 max-w-md text-slate-600">正在加载中心作品与图谱数据。</p>
          </div>
        </Card>
      ) : centralWorks.length === 0 ? (
        <Card className="border-dashed border-slate-300 bg-white/80 text-center">
          <div className="py-20">
            <h2 className="text-2xl font-semibold text-slate-800">还没有中心作品</h2>
            <p className="mx-auto mt-2 max-w-md text-slate-600">
              先创建一个中心作品，系统将基于它自动计算联动层级并生成关系图。
            </p>
            <div className="mt-6">
              <Link href="/works/new?central=true" className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-6 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
                创建中心作品
              </Link>
            </div>
          </div>
        </Card>
      ) : (
        <section className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold text-slate-900">联动网络</h2>
              {centralWorks.length > 1 && (
                <div className="w-56">
                  <Select
                    value={centralWorkId}
                    onChange={(e) => setCentralWorkId(e.target.value)}
                    options={centralWorks.map(w => ({ value: w.id, label: w.title }))}
                  />
                </div>
              )}
            </div>
            <p className="text-xs text-slate-500">点击节点可在右侧查看详情，按 Esc 可关闭侧栏</p>
          </div>
          <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)_320px] xl:grid-cols-[240px_minmax(0,1fr)_360px]">
            <Card className="h-fit bg-white/90 p-4 lg:sticky lg:top-6">
              <h3 className="text-base font-semibold text-slate-900">层级图例</h3>
              <p className="mt-1 text-xs text-slate-500">不同颜色表示中心作品向外的联动层级。</p>
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                <div className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: 'var(--level-0)' }}></span>中心</div>
                <div className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: 'var(--level-1)' }}></span>一级</div>
                <div className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: 'var(--level-2)' }}></span>二级</div>
                <div className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: 'var(--level-3)' }}></span>三级</div>
                <div className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: 'var(--level-4)' }}></span>四级及以上</div>
              </div>
            </Card>

            <GraphView
              centralWorkId={centralWorkId}
              onNodeSelect={handleNodeSelect}
              selectedNodeId={selectedNode?.id}
            />
            <Card className="h-fit bg-white/90 p-4 lg:sticky lg:top-6">
              {!selectedNode ? (
                <div className="space-y-2 py-6 text-center">
                  <h3 className="text-base font-semibold text-slate-800">节点详情</h3>
                  <p className="text-sm text-slate-600">从图谱中选择任一节点，这里会展示作品信息与联动统计。</p>
                </div>
              ) : (
                <div className="space-y-4" aria-live="polite">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">{selectedNode.title}</h3>
                      <p className="text-xs text-slate-500">层级: {selectedNode.level} · 类型: {selectedNode.type}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedNode(null)}
                      className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                      aria-label="关闭节点详情侧栏"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                    {selectedNodeDetail?.coverUrl || selectedNode.coverUrl ? (
                      <img
                        src={selectedNodeDetail?.coverUrl || selectedNode.coverUrl || ''}
                        alt={`${selectedNode.title} 封面`}
                        className="h-44 w-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex h-44 items-center justify-center text-xs text-slate-500">无封面</div>
                    )}
                  </div>

                  {panelLoading ? (
                    <p className="text-sm text-slate-500">加载节点详情中...</p>
                  ) : (
                    <>
                      <p className="text-sm leading-relaxed text-slate-600">
                        {selectedNodeDetail?.description || '暂无作品简介。'}
                      </p>
                      <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                        <div>
                          <p className="text-slate-500">出向联动</p>
                          <p className="text-base font-semibold text-slate-800">{selectedNodeDetail?.connectionsFrom.length ?? '-'}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">入向联动</p>
                          <p className="text-base font-semibold text-slate-800">{selectedNodeDetail?.connectionsTo.length ?? '-'}</p>
                        </div>
                      </div>
                    </>
                  )}

                  <Link
                    href={`/works/${selectedNode.id}`}
                    className="inline-flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                  >
                    打开完整详情页
                  </Link>
                </div>
              )}
            </Card>
          </div>
        </section>
      )}
    </main>
  )
}

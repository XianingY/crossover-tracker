'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import ForceGraph2D, { ForceGraphMethods, NodeObject } from 'react-force-graph-2d'
import { Combobox } from './ui/Combobox'

const LEVEL_COLOR_FALLBACK = ['#c0444f', '#d4793e', '#b8932e', '#3a8f5e', '#3d6faa', '#6e5fa0']

export interface GraphNode {
  id: string
  title: string
  type: string
  isCentral: boolean
  coverUrl?: string | null
  level: number
}

interface GraphLink {
  source: string
  target: string
  relationType: string
  level: number
  isUnreviewed: boolean
}

interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}

interface GraphViewProps {
  centralWorkId: string
  onNodeSelect: (node: GraphNode) => void
  selectedNodeId?: string
}

type GraphNodeObject = NodeObject & {
  id?: string
  level?: number
  x?: number
  y?: number
}

export function GraphView({ centralWorkId, onNodeSelect, selectedNodeId }: GraphViewProps) {
  const [data, setData] = useState<GraphData>({ nodes: [], links: [] })
  const [loading, setLoading] = useState(true)
  const [dimensions, setDimensions] = useState({ width: 800, height: 640 })
  const levelColorsRef = useRef<string[] | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const fgRef = useRef<ForceGraphMethods<GraphNodeObject, GraphLink> | undefined>(undefined)

  // 加载图谱数据
  useEffect(() => {
    async function fetchGraphData() {
      setLoading(true)
      try {
        const response = await fetch(`/api/graph?centralId=${centralWorkId}`)
        const graphData = await response.json()
        setData(graphData)
      } catch (error) {
        console.error('Failed to fetch graph data:', error)
      } finally {
        setLoading(false)
      }
    }

    if (centralWorkId) {
      fetchGraphData()
    } else {
      setLoading(false)
    }
  }, [centralWorkId])

  // ResizeObserver for responsive graph
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        setDimensions({ width, height })
      }
    })

    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  // 节点颜色（按层级）
  const getLevelColors = useCallback(() => {
    if (levelColorsRef.current) return levelColorsRef.current

    if (typeof window === 'undefined') {
      levelColorsRef.current = LEVEL_COLOR_FALLBACK
      return LEVEL_COLOR_FALLBACK
    }

    const styles = getComputedStyle(document.documentElement)
    levelColorsRef.current = LEVEL_COLOR_FALLBACK.map((fallback, index) => {
      const token = styles.getPropertyValue(`--level-${index}`).trim()
      return token || fallback
    })

    return levelColorsRef.current
  }, [])

  const getNodeColor = (level: number) => {
    const colors = getLevelColors()
    return colors[Math.min(level, 5)]
  }

  const handleNodeClick = useCallback((node: GraphNodeObject) => {
    if (typeof node.id !== 'string') return
    const clickedNode = data.nodes.find((item) => item.id === node.id)
    if (clickedNode) {
      onNodeSelect(clickedNode)
    }
  }, [data.nodes, onNodeSelect])

  const handleZoomIn = () => {
    if (fgRef.current) {
      fgRef.current.zoom(fgRef.current.zoom() * 1.2, 400)
    }
  }

  const handleZoomOut = () => {
    if (fgRef.current) {
      fgRef.current.zoom(fgRef.current.zoom() / 1.2, 400)
    }
  }

  const handleZoomReset = () => {
    if (fgRef.current) {
      fgRef.current.zoomToFit(400)
    }
  }

  if (!centralWorkId) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-500 bg-gray-50 rounded-xl border border-gray-200 border-dashed">
        请先设置中心作品
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-500 bg-gray-50 rounded-xl border border-gray-200 border-dashed">
        加载中...
      </div>
    )
  }

  if (data.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-500 bg-gray-50 rounded-xl border border-gray-200 border-dashed">
        暂无联动数据
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative w-full h-[58vh] min-h-[480px] max-h-[760px] rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <ForceGraph2D
        ref={fgRef}
        graphData={data}
        width={dimensions.width}
        height={dimensions.height}
        nodeLabel="title"
        nodeColor={(node: GraphNodeObject) => getNodeColor(node.level || 0)}
        nodeRelSize={6}
        linkColor={() => '#b8c4da'}
        linkLineDash={(link: GraphLink) => (link.isUnreviewed ? [6, 4] : [])}
        linkWidth={1.5}
        linkDirectionalArrowLength={0}
        cooldownTicks={100}
        onNodeClick={handleNodeClick}
        backgroundColor="#fbfcff"
      />

      {/* Stats Overlay */}
      <div className="absolute left-4 top-4 rounded-lg border border-slate-200/80 bg-white/90 px-3 py-2 text-xs text-slate-600 backdrop-blur">
        节点 {data.nodes.length} · 连线 {data.links.length}{selectedNodeId ? ` · 已选 ${data.nodes.find((n) => n.id === selectedNodeId)?.title || '节点'}` : ''}
      </div>

      {/* Search Overlay */}
      <div className="absolute left-4 top-16 w-64">
        <Combobox
          value=""
          onChange={(val) => {
            const selectedNode = data.nodes.find((n) => n.id === val)
            if (selectedNode) {
              const graphNode = selectedNode as GraphNodeObject
              handleNodeClick(graphNode)
              // Zoom to node
              if (fgRef.current) {
                // ForceGraph adds x/y to nodes after simulation
                if (typeof graphNode.x === 'number' && typeof graphNode.y === 'number') {
                  fgRef.current.centerAt(graphNode.x, graphNode.y, 400)
                  fgRef.current.zoom(4, 400)
                }
              }
            }
          }}
          options={data.nodes.map((n) => ({ value: n.id, label: n.title }))}
          placeholder="搜索节点..."
          className="bg-white/90 backdrop-blur shadow-sm"
        />
      </div>

      {/* Legend Overlay */}
      <div className="absolute bottom-4 left-4 rounded-lg border border-slate-200/80 bg-white/90 p-3 shadow-sm backdrop-blur">
        <h4 className="mb-2 text-xs font-semibold text-slate-900">层级图例</h4>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-slate-600">
          <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--level-0)' }}></span>中心</div>
          <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--level-1)' }}></span>一级</div>
          <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--level-2)' }}></span>二级</div>
          <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--level-3)' }}></span>三级</div>
          <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--level-4)' }}></span>四级+</div>
        </div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2 rounded-lg border border-slate-200 bg-white/90 p-2 shadow-lg backdrop-blur">
        <button
          type="button"
          onClick={handleZoomIn}
          className="rounded p-2 text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          title="Zoom In"
          aria-label="放大图谱"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          className="rounded p-2 text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          title="Zoom Out"
          aria-label="缩小图谱"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
        </button>
        <button
          type="button"
          onClick={handleZoomReset}
          className="rounded p-2 text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          title="Reset View"
          aria-label="重置图谱视角"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
        </button>
      </div>
    </div>
  )
}

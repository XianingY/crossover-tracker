'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import ForceGraph2D, { ForceGraphMethods, NodeObject } from 'react-force-graph-2d'

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
}

export function GraphView({ centralWorkId, onNodeSelect, selectedNodeId }: GraphViewProps) {
  const [data, setData] = useState<GraphData>({ nodes: [], links: [] })
  const [dimensions, setDimensions] = useState({ width: 800, height: 640 })
  const containerRef = useRef<HTMLDivElement>(null)
  const fgRef = useRef<ForceGraphMethods<GraphNodeObject, GraphLink> | undefined>(undefined)

  // 加载图谱数据
  useEffect(() => {
    async function fetchGraphData() {
      try {
        const response = await fetch('/api/graph')
        const graphData = await response.json()
        setData(graphData)
      } catch (error) {
        console.error('Failed to fetch graph data:', error)
      }
    }

    if (centralWorkId) {
      fetchGraphData()
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
  const getNodeColor = (level: number) => {
    const colors = [
      'var(--level-0)',
      'var(--level-1)',
      'var(--level-2)',
      'var(--level-3)',
      'var(--level-4)',
      'var(--level-5)',
    ]
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
        linkWidth={1.5}
        linkDirectionalArrowLength={6}
        linkDirectionalArrowRelPos={1}
        cooldownTicks={100}
        onNodeClick={handleNodeClick}
        backgroundColor="#fbfcff"
      />

      <div className="absolute left-4 top-4 rounded-lg border border-slate-200/80 bg-white/90 px-3 py-2 text-xs text-slate-600 backdrop-blur">
        节点 {data.nodes.length} · 连线 {data.links.length}{selectedNodeId ? ` · 已选 ${data.nodes.find((n) => n.id === selectedNodeId)?.title || '节点'}` : ''}
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

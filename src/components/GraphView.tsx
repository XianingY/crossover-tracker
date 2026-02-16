'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import ForceGraph2D, { NodeObject } from 'react-force-graph-2d'

interface GraphNode {
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
  onNodeClick: (workId: string) => void
}

export function GraphView({ centralWorkId, onNodeClick }: GraphViewProps) {
  const [data, setData] = useState<GraphData>({ nodes: [], links: [] })
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const containerRef = useRef<HTMLDivElement>(null)
  const fgRef = useRef<any>(null)

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
      '#ef4444', // 中心 - 红色
      '#f97316', // 一级 - 橙色
      '#eab308', // 二级 - 黄色
      '#22c55e', // 三级 - 绿色
      '#3b82f6', // 四级 - 蓝色
      '#8b5cf6', // 五级+ - 紫色
    ]
    return colors[Math.min(level, 5)]
  }

  const handleNodeClick = useCallback((node: NodeObject) => {
    // ForceGraph2D modifies the node object, so we cast to any or GraphNode to access id
    onNodeClick((node as any).id)
  }, [onNodeClick])

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
    <div ref={containerRef} className="relative w-full h-[600px] bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <ForceGraph2D
        ref={fgRef}
        graphData={data}
        width={dimensions.width}
        height={dimensions.height}
        nodeLabel="title"
        nodeColor={(node: any) => getNodeColor(node.level || 0)}
        nodeRelSize={6}
        linkColor={() => '#cbd5e1'}
        linkWidth={1.5}
        linkDirectionalArrowLength={6}
        linkDirectionalArrowRelPos={1}
        cooldownTicks={100}
        onNodeClick={handleNodeClick}
        backgroundColor="#ffffff"
      />

      {/* Controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2 bg-white/90 backdrop-blur shadow-lg rounded-lg p-2 border border-gray-200">
        <button
          onClick={handleZoomIn}
          className="p-2 hover:bg-gray-100 rounded text-gray-700 transition-colors"
          title="Zoom In"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
        </button>
        <button
          onClick={handleZoomOut}
          className="p-2 hover:bg-gray-100 rounded text-gray-700 transition-colors"
          title="Zoom Out"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
        </button>
        <button
          onClick={handleZoomReset}
          className="p-2 hover:bg-gray-100 rounded text-gray-700 transition-colors"
          title="Reset View"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
        </button>
      </div>
    </div>
  )
}

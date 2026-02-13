'use client'

import { useEffect, useState, useCallback } from 'react'
import ForceGraph2D, { NodeObject } from 'react-force-graph-2d'

interface Work {
  id: string
  title: string
  type: string
  isCentral: boolean
  coverUrl?: string
  level: number
}

interface Connection {
  source: string
  target: string
  relationType: string
  level: number
}

interface GraphData {
  nodes: Work[]
  links: Connection[]
}

interface GraphViewProps {
  centralWorkId: string
  onNodeClick: (workId: string) => void
}

export function GraphView({ centralWorkId, onNodeClick }: GraphViewProps) {
  const [data, setData] = useState<GraphData>({ nodes: [], links: [] })
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  
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
    
    // 设置尺寸
    const updateDimensions = () => {
      const container = document.getElementById('graph-container')
      if (container) {
        setDimensions({
          width: container.clientWidth,
          height: container.clientHeight
        })
      }
    }
    
    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [centralWorkId])
  
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
    onNodeClick((node as any).id)
  }, [onNodeClick])
  
  if (!centralWorkId) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-500">
        请先设置中心作品
      </div>
    )
  }
  
  if (data.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-500">
        暂无联动数据
      </div>
    )
  }
  
  return (
    <div id="graph-container" className="w-full h-[600px] bg-gray-50 rounded-lg">
      <ForceGraph2D
        graphData={data}
        width={dimensions.width}
        height={dimensions.height}
        nodeLabel="title"
        nodeColor={(node: any) => getNodeColor(node.level || 0)}
        nodeRelSize={6}
        linkColor={() => '#94a3b8'}
        linkWidth={1}
        linkDirectionalArrowLength={6}
        linkDirectionalArrowRelPos={1}
        cooldownTicks={100}
        onNodeClick={handleNodeClick}
        backgroundColor="#fafafa"
      />
    </div>
  )
}

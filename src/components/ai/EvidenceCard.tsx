'use client'

interface EvidenceCardProps {
  title: string
  url: string
  snippet: string
  source?: 'USER' | 'WEB' | 'AI'
  status?: 'PENDING' | 'APPROVED' | 'REJECTED'
  onSave?: () => void
  onView?: () => void
}

export default function EvidenceCard({
  title,
  url,
  snippet,
  source = 'WEB',
  status,
  onSave,
  onView
}: EvidenceCardProps) {
  const sourceLabels = {
    USER: { text: '用户提交', color: 'bg-blue-100 text-blue-700' },
    WEB: { text: '网络抓取', color: 'bg-purple-100 text-purple-700' },
    AI: { text: 'AI 生成', color: 'bg-green-100 text-green-700' }
  }

  const statusLabels = {
    PENDING: { text: '待审核', color: 'bg-yellow-100 text-yellow-700' },
    APPROVED: { text: '已通过', color: 'bg-green-100 text-green-700' },
    REJECTED: { text: '已拒绝', color: 'bg-red-100 text-red-700' }
  }

  return (
    <div className="p-4 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-blue-600 hover:text-blue-800 truncate block"
          >
            {title}
          </a>
          <p className="text-sm text-slate-600 mt-1 line-clamp-2">{snippet}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className={`px-2 py-0.5 text-xs rounded ${sourceLabels[source].color}`}>
              {sourceLabels[source].text}
            </span>
            {status && (
              <span className={`px-2 py-0.5 text-xs rounded ${statusLabels[status].color}`}>
                {statusLabels[status].text}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          {onSave && (
            <button
              onClick={onSave}
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
            >
              保存
            </button>
          )}
          {onView && (
            <button
              onClick={onView}
              className="px-3 py-1 bg-slate-100 text-slate-700 text-sm rounded hover:bg-slate-200 transition-colors"
            >
              查看
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

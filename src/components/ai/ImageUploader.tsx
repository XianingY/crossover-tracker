'use client'

import { useState, useCallback } from 'react'

interface ImageUploaderProps {
  onAnalysisComplete: (imageUrl: string) => void
}

export default function ImageUploader({ onAnalysisComplete }: ImageUploaderProps) {
  const [imageUrl, setImageUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleUrlSubmit = useCallback(() => {
    if (imageUrl.trim()) {
      onAnalysisComplete(imageUrl.trim())
    }
  }, [imageUrl, onAnalysisComplete])

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('请上传图片文件')
      return
    }

    setUploading(true)
    setPreview(URL.createObjectURL(file))

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/evidences/upload', {
        method: 'POST',
        body: formData
      })

      if (!res.ok) {
        throw new Error('Upload failed')
      }

      const data = await res.json()
      const uploadedUrl = data.url

      onAnalysisComplete(uploadedUrl)
    } catch (err) {
      alert('上传失败，请重试')
      console.error(err)
    } finally {
      setUploading(false)
    }
  }, [onAnalysisComplete])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileUpload(file)
    }
  }, [handleFileUpload])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileUpload(file)
    }
  }, [handleFileUpload])

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragOver
            ? 'border-blue-400 bg-blue-50'
            : 'border-slate-300 hover:border-slate-400'
        }`}
      >
        <div className="mb-4">
          <svg
            className="mx-auto h-12 w-12 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
        <p className="text-slate-600 mb-4">拖拽图片到此处，或点击选择文件</p>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileInput}
          className="hidden"
          id="image-upload"
        />
        <label
          htmlFor="image-upload"
          className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors"
        >
          选择文件
        </label>
        {uploading && (
          <p className="mt-2 text-blue-600">上传中...</p>
        )}
      </div>

      <div className="relative">
        <div className="absolute inset-x-0 flex items-center">
          <div className="flex-1 border-t border-slate-200"></div>
          <span className="px-3 text-sm text-slate-500">或</span>
          <div className="flex-1 border-t border-slate-200"></div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          输入图片 URL
        </label>
        <div className="flex gap-2">
          <input
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
            placeholder="https://example.com/image.jpg"
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
          <button
            onClick={handleUrlSubmit}
            disabled={uploading || !imageUrl.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            分析
          </button>
        </div>
      </div>

      {preview && (
        <div className="mt-4">
          <p className="text-sm font-medium text-slate-700 mb-2">预览</p>
          <img
            src={preview}
            alt="Preview"
            className="max-h-64 rounded-lg border border-slate-200"
          />
        </div>
      )}
    </div>
  )
}

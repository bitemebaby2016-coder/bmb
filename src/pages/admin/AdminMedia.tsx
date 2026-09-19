// ============================================
// Admin — Media Library (D6 gap, Phase D)
// Upload/list/delete assets in Storage bucket `bmb-images` (media_assets table).
// ============================================

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { showToast } from '@/components/ui/ToastContainer'
import {
  listMediaAssets,
  uploadMediaAsset,
  deleteMediaAsset,
  MEDIA_KINDS,
  type MediaAssetRow,
} from '@/lib/bmbAdminApi_media'

const KIND_LABEL: Record<string, string> = {
  image: 'รูปภาพ',
  video: 'วิดีโอ',
  logo: 'โลโก้',
  hero: 'Hero',
  mascot: 'มาสคอต',
}

export function AdminMedia() {
  const [assets, setAssets] = useState<MediaAssetRow[]>([])
  const [uploading, setUploading] = useState(false)
  const [kind, setKind] = useState<MediaAssetRow['kind']>('image')
  const [alt, setAlt] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setAssets(await listMediaAssets())
  }

  async function handleUpload(file: File | undefined) {
    if (!file) { showToast('เลือกไฟล์ก่อนอัปโหลด', 'error'); return }
    setUploading(true)
    try {
      const row = await uploadMediaAsset(file, kind, alt.trim())
      if (row) {
        showToast('อัปโหลดสำเร็จ', 'success')
        setAlt('')
        await load()
      } else {
        showToast('อัปโหลดไม่สำเร็จ (ยังต้องมี storage policy จาก migration 011)', 'error')
      }
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(asset: MediaAssetRow) {
    const ok = await deleteMediaAsset(asset)
    showToast(ok ? 'ลบแล้ว' : 'ลบไม่สำเร็จ', ok ? 'success' : 'error')
    await load()
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Link to="/admin" className="text-sm text-brand-muted hover:underline">← กลับแดชบอร์ด</Link>
      <h1 className="text-2xl font-bold text-brand-accent mt-2 mb-4">🖼️ Media Library (D6)</h1>

      <div className="card p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-sm font-medium text-brand-muted mb-1">ประเภท</label>
            <select
              className="input border rounded px-3 py-2"
              value={kind}
              onChange={(e) => setKind(e.target.value as MediaAssetRow['kind'])}
            >
              {MEDIA_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k] || k}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-muted mb-1">คำอธิบาย (alt)</label>
            <input
              className="input border rounded px-3 py-2"
              placeholder="เช่น ภาพ hero รอบเช้า"
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-muted mb-1">ไฟล์</label>
            <input
              type="file"
              className="input border rounded px-3 py-2"
              accept="image/*,video/mp4"
              disabled={uploading}
              onChange={(e) => handleUpload(e.target.files?.[0] || undefined)}
            />
          </div>
        </div>
        <p className="text-xs text-brand-muted mt-2">
          ไฟล์จะถูกเก็บใน Storage bucket <code className="bg-gray-100 px-1 rounded">bmb-images</code> และ
          metadata ในตาราง <code className="bg-gray-100 px-1 rounded">media_assets</code>
        </p>
      </div>

      {assets.length === 0 ? (
        <p className="text-brand-muted text-center py-8">ยังไม่มี media — อัปโหลดไฟล์แรกด้านบน</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {assets.map((a) => (
            <div key={a.id} className="card overflow-hidden">
              <div className="aspect-square bg-gray-100 flex items-center justify-center">
                {a.url ? (
                  <img src={a.url} alt={a.alt || 'media'} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl">🎬</span>
                )}
              </div>
              <div className="p-3">
                <div className="text-xs font-medium">{KIND_LABEL[a.kind] || a.kind}</div>
                <div className="text-sm text-brand-muted truncate">{a.alt || a.url}</div>
                <button
                  onClick={() => handleDelete(a)}
                  className="mt-2 text-xs bg-red-50 text-red-700 border border-red-200 rounded px-2 py-1 hover:bg-red-100"
                >
                  ลบ
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
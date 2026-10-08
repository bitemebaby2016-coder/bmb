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
  uploadRegisteredAsset,
  deleteMediaAsset,
  listRegistryAssets,
  setRegistryAssetActive,
  MEDIA_KINDS,
  type MediaAssetRow,
  type RegistryAssetRow,
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
  const [registry, setRegistry] = useState<RegistryAssetRow[]>([])
  const [uploading, setUploading] = useState(false)
  const [kind, setKind] = useState<MediaAssetRow['kind']>('image')
  const [alt, setAlt] = useState('')
  const [assetKey, setAssetKey] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setAssets(await listMediaAssets())
    setRegistry(await listRegistryAssets())
  }

  async function handleToggleActive(asset: RegistryAssetRow) {
    const ok = await setRegistryAssetActive(asset.id, !asset.is_active)
    showToast(ok ? (asset.is_active ? 'ปิดใช้งานแล้ว (runtime จะ fallback)' : 'เปิดใช้งานแล้ว') : 'เปลี่ยนสถานะไม่สำเร็จ', ok ? 'success' : 'error')
    await load()
  }

  async function handleUpload(file: File | undefined) {
    if (!file) { showToast('เลือกไฟล์ก่อนอัปโหลด', 'error'); return }
    setUploading(true)
    try {
      // asset_key ที่กรอก (เช่น ai.chat_background) → ลงทะเบียนใน media_assets
      // เพื่อให้ runtime (เช่น พื้นหลังแชท Talk to Bite) ดึงไปใช้ได้
      const key = assetKey.trim()
      const row = key
        ? await uploadRegisteredAsset(file, kind, alt.trim(), { assetKey: key, category: 'system' })
        : await uploadMediaAsset(file, kind, alt.trim())
      if (row) {
        showToast('อัปโหลดสำเร็จ', 'success')
        setAlt('')
        await load()
      } else {
        showToast('อัปโหลดไม่สำเร็จ (ตรวจ storage policy / การล็อกอิน admin)', 'error')
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
            <label className="block text-sm font-medium text-brand-muted mb-1">
              asset_key <span className="text-xs font-normal">(ถ้ามี — เช่น <code>ai.chat_background</code>)</span>
            </label>
            <input
              className="input border rounded px-3 py-2"
              placeholder="เว้นว่างได้ ใส่เพื่อให้ runtime ใช้ภาพนี้"
              value={assetKey}
              onChange={(e) => setAssetKey(e.target.value)}
              data-testid="media-asset-key"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-muted mb-1">ไฟล์</label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="file"
                className="input border rounded px-3 py-2"
                accept="image/*,video/mp4"
                disabled={uploading}
                onChange={(e) => handleUpload(e.target.files?.[0] || undefined)}
                data-testid="media-file-input"
              />
              {/* Owner request: เพิ่มรูปต้องถ่ายจากกล้องได้ด้วย (มีแต่เลือกจากอัลบั้ม) */}
              <label className="btn btn-outline btn-sm cursor-pointer" title="ถ่ายภาพ/อัดวิดีโอด้วยกล้อง">
                📷 ถ่ายภาพ
                <input
                  type="file"
                  accept="image/*,video/mp4"
                  capture="environment"
                  disabled={uploading}
                  onChange={(e) => handleUpload(e.target.files?.[0] || undefined)}
                  className="hidden"
                  data-testid="media-camera-input"
                />
              </label>
            </div>
          </div>
        </div>
        <p className="text-xs text-brand-muted mt-2">
          ไฟล์จะถูกเก็บใน Storage bucket <code className="bg-gray-100 px-1 rounded">bmb-images</code> และ
          metadata ในตาราง <code className="bg-gray-100 px-1 rounded">media_assets</code>
        </p>
      </div>

      {registry.length > 0 && (
        <div className="card p-4 mb-6">
          <h2 className="text-lg font-bold text-brand-accent mb-2">🗂️ Asset Registry (migration 105)</h2>
          <p className="text-xs text-brand-muted mb-3">
            asset ที่ลงทะเบียนแล้ว — runtime อ่านจาก DB โดยตรง (active + ไม่ใช่ MOCK มีลำดับความสำคัญสูงสุด)
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-brand-muted border-b">
                  <th className="py-2 pr-3">asset_key</th>
                  <th className="py-2 pr-3">category</th>
                  <th className="py-2 pr-3">scope (tenant/brand)</th>
                  <th className="py-2 pr-3">สถานะ</th>
                  <th className="py-2 pr-3">พรีวิว</th>
                  <th className="py-2">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {registry.map((a) => (
                  <tr key={a.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-mono text-xs">{a.asset_key || '—'}</td>
                    <td className="py-2 pr-3">{a.category || a.kind}</td>
                    <td className="py-2 pr-3 text-xs text-brand-muted">
                      {a.tenant_id ? a.tenant_id.slice(0, 8) + '…' : 'global'}
                      {' / '}
                      {a.brand_id ? a.brand_id.slice(0, 8) + '…' : 'global'}
                    </td>
                    <td className="py-2 pr-3">
                      {a.is_active ? (
                        <span className="text-green-700 bg-green-50 border border-green-200 rounded px-2 py-0.5 text-xs">ACTIVE</span>
                      ) : (
                        <span className="text-gray-500 bg-gray-100 border rounded px-2 py-0.5 text-xs">INACTIVE</span>
                      )}
                      {a.is_mock && (
                        <span className="ml-1 text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-0.5 text-xs">MOCK</span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {a.url && a.kind !== 'video' ? (
                        <img src={a.url} alt={a.alt || a.asset_key || ''} className="w-10 h-10 object-cover rounded" />
                      ) : ('—')}
                    </td>
                    <td className="py-2">
                      <button
                        onClick={() => handleToggleActive(a)}
                        className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded px-2 py-1 hover:bg-blue-100"
                      >
                        {a.is_active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
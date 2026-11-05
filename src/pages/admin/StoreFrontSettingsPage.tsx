// ============================================
// Bite Me Baby — Store Front Settings (N-8 · R69 · 2026-11-05)
// ============================================
// แท็บ "หน้าร้าน" ข้างแท็บมาสคอตในการตั้งค่าร้าน: แอดมินเพิ่มรูปหน้าร้าน +
// รายละเอียดร้านเอง (รูปผ่าน Media Library bucket เดิม bmb-images —
// ย่ออัตโนมัติทุกใบ) · ค่าที่บันทึก = business_settings.store_front →
// หน้าเว็บเส้นทาง "รับที่ร้าน" (Checkout/Track) แสดงเป็นตำแหน่งร้านทันที
// ============================================

import { useEffect, useRef, useState } from 'react'
import { GlassCard } from '@/components/ui/GlassCard'
import { showToast } from '@/components/ui/ToastContainer'
import { getStoreFront, saveStoreFront, type StoreFrontInfo } from '@/lib/storeFront'
import { uploadMediaAsset, validateImageFile } from '@/lib/bmbAdminApi_media'

const MAX_PHOTOS = 6

export function StoreFrontSettingsPage() {
  const [info, setInfo] = useState<StoreFrontInfo>({ description: '', photos: [] })
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void getStoreFront().then((v) => {
      setInfo(v)
      setLoaded(true)
    })
  }, [])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    e.target.value = '' // เลือกไฟล์เดิมซ้ำได้
    if (!file) return
    const check = validateImageFile(file)
    if (!check.ok) {
      showToast(check.error || 'ไฟล์รูปไม่ถูกต้อง', 'error')
      return
    }
    if (info.photos.length >= MAX_PHOTOS) {
      showToast(`อัปโหลดได้สูงสุด ${MAX_PHOTOS} รูป`, 'warning')
      return
    }
    setUploading(true)
    const row = await uploadMediaAsset(file, 'image', 'หน้าร้าน')
    setUploading(false)
    if (!row) {
      showToast('อัปโหลดรูปไม่สำเร็จ — ลองใหม่อีกครั้ง', 'error')
      return
    }
    setInfo((p) => ({ ...p, photos: [...p.photos, row.url] }))
    showToast('อัปโหลดรูปแล้ว — กด "บันทึกข้อมูลหน้าร้าน" เพื่อให้ขึ้นหน้าเว็บ', 'success')
  }

  function removePhoto(url: string) {
    setInfo((p) => ({ ...p, photos: p.photos.filter((x) => x !== url) }))
  }

  async function handleSave() {
    if (busy) return
    setBusy(true)
    const ok = await saveStoreFront(info)
    setBusy(false)
    showToast(ok ? 'บันทึกข้อมูลหน้าร้านแล้ว' : 'บันทึกไม่สำเร็จ — ลองใหม่อีกครั้ง', ok ? 'success' : 'error')
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4" data-testid="storefront-settings">
      <div>
        <h1 className="text-2xl font-bold text-brand-accent">🏪 หน้าร้าน</h1>
        <p className="text-sm text-slate-500 mt-1">
          รูปหน้าร้าน + รายละเอียดที่ลูกค้าเห็นตอนสั่งแบบ <b>รับที่ร้าน</b> (หน้าเช็คเอาท์/ติดตามออเดอร์)
          — ตำแหน่งร้านใช้ค่าจาก <b>ห้องครัว/ตำแหน่งร้าน</b> ในการตั้งค่าร้านอัตโนมัติ
        </p>
      </div>

      <GlassCard className="p-4">
        <h3 className="font-bold text-slate-700 text-sm mb-2">📝 รายละเอียดร้าน</h3>
        <textarea
          className="input w-full h-24"
          placeholder="เช่น ร้านอยู่หน้าตลาดสด จอดรถหน้าร้านได้ · รับอาหารที่เคาน์เตอร์หน้าร้าน"
          value={info.description}
          onChange={(e) => setInfo((p) => ({ ...p, description: e.target.value }))}
          data-testid="storefront-desc"
        />
      </GlassCard>

      <GlassCard className="p-4">
        <h3 className="font-bold text-slate-700 text-sm mb-2">📸 รูปหน้าร้าน ({info.photos.length}/{MAX_PHOTOS})</h3>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <button
            type="button"
            className="btn btn-outline text-sm"
            disabled={uploading || info.photos.length >= MAX_PHOTOS}
            onClick={() => fileRef.current?.click()}
            data-testid="storefront-upload"
          >
            {uploading ? '⏳ กำลังอัปโหลด…' : '📷 เพิ่มรูปหน้าร้าน'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void handleUpload(e)} data-testid="storefront-upload-input" />
        </div>
        {info.photos.length === 0 ? (
          <p className="text-xs text-slate-500">ยังไม่มีรูป — รูปแรกจะแสดงเป็นภาพหลักบนหน้า "รับที่ร้าน"</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {info.photos.map((url) => (
              <div key={url} className="relative" data-testid="storefront-photo">
                <img src={url} alt="รูปหน้าร้าน" className="w-full h-24 object-cover rounded-lg border" />
                <button
                  type="button"
                  className="absolute top-1 right-1 text-xs bg-white/90 rounded px-1.5 py-0.5 text-red-600 border"
                  onClick={() => removePhoto(url)}
                  data-testid="storefront-photo-remove"
                >
                  ลบ
                </button>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      <button
        type="button"
        className="btn btn-primary w-full"
        disabled={busy || !loaded}
        onClick={() => void handleSave()}
        data-testid="storefront-save"
      >
        {busy ? '⏳ กำลังบันทึก…' : '💾 บันทึกข้อมูลหน้าร้าน'}
      </button>
    </div>
  )
}
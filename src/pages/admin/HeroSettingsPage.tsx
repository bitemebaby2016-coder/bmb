// ============================================
// Bite Me Baby — Hero Settings (ฮีโร่หน้าแรก)
// ============================================
// แท็บ "ฮีโร่หน้าแรก" ในตั้งค่าร้าน: แอดมินแก้ข้อความ hero (kicker/headline/
// subheadline/cta) + เลือกรูป hero ใหญ่ตัวเดียว (อัปโหลดผ่าน Media Library เดิม)
// ค่าบันทึก = business_settings.hero_config → hydrate ตอน boot → FoodTheater (/shop)
// อ่านผ่าน getHeroConfig / เขียนผ่าน saveHeroConfig — ฝั่งลูกค้า READ-ONLY
// ============================================

import { useEffect, useRef, useState } from 'react'
import { GlassCard } from '@/components/ui/GlassCard'
import { showToast } from '@/components/ui/ToastContainer'
import { getHeroConfig, saveHeroConfig, type HeroConfig } from '@/lib/heroConfig'
import { DEFAULT_HERO_CONFIG } from '@/config/platformConfig'
import { uploadMediaAsset, validateImageFile } from '@/lib/bmbAdminApi_media'

export function HeroSettingsPage() {
  const [cfg, setCfg] = useState<HeroConfig>({ ...DEFAULT_HERO_CONFIG })
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void getHeroConfig().then((v) => { setCfg(v); setLoaded(true) })
  }, [])

  function setField<K extends keyof HeroConfig>(key: K, value: HeroConfig[K]) {
    setCfg((p) => ({ ...p, [key]: value }))
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    e.target.value = '' // เลือกไฟล์เดิมซ้ำได้
    if (!file) return
    const check = validateImageFile(file)
    if (!check.ok) { showToast(check.error || 'ไฟล์รูปไม่ถูกต้อง', 'error'); return }
    setUploading(true)
    const row = await uploadMediaAsset(file, 'image', 'hero')
    setUploading(false)
    if (!row) { showToast('อัปโหลดรูปไม่สำเร็จ — ลองใหม่อีกครั้ง', 'error'); return }
    setField('heroImageUrl', row.url)
    showToast('อัปโหลดรูป hero แล้ว กด "บันทึกฮีโร่" เพื่อให้ขึ้นหน้าเว็บ', 'success')
  }

  async function handleSave() {
    if (busy) return
    setBusy(true)
    const ok = await saveHeroConfig(cfg)
    setBusy(false)
    showToast(ok ? 'บันทึกฮีโร่หน้าแรกแล้ว' : 'บันทึกไม่สำเร็จ — ลองใหม่อีกครั้ง', ok ? 'success' : 'error')
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4" data-testid="hero-settings">
      <div>
        <h1 className="text-2xl font-bold text-brand-accent">🎭 ฮีโร่หน้าแรก</h1>
        <p className="text-sm text-slate-500 mt-1">
          ข้อความและรูปส่วนหัวของหน้าแรก (/shop) — แก้ได้ที่นี่ ไม่ต้องแก้โค้ด
          ค่าเริ่มต้นใช้ค่า default เมื่อไม่มีค่าใน business_settings.hero_config
        </p>
      </div>

      <GlassCard className="p-4 space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">ป้ายหัว (Kicker)</label>
          <input className="input w-full" value={cfg.kicker} onChange={(e) => setField('kicker', e.target.value)} data-testid="hero-kicker" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">หัวเรื่องใหญ่ (Headline) *</label>
          <input className="input w-full" value={cfg.headline} onChange={(e) => setField('headline', e.target.value)} data-testid="hero-headline" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">คำอธิบายใต้หัวเรื่อง (Subheadline)</label>
          <textarea className="input w-full h-20" value={cfg.subheadline} onChange={(e) => setField('subheadline', e.target.value)} data-testid="hero-subheadline" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">ข้อความปุ่ม (CTA)</label>
          <input className="input w-full" value={cfg.ctaLabel} onChange={(e) => setField('ctaLabel', e.target.value)} data-testid="hero-cta" />
        </div>
      </GlassCard>

      <GlassCard className="p-4">
        <h3 className="font-bold text-slate-700 text-sm mb-2">รูป hero ใหญ่ (ตัวเดียว)</h3>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <button type="button" className="btn btn-outline text-sm" disabled={uploading} onClick={() => fileRef.current?.click()} data-testid="hero-upload">
            {uploading ? 'กำลังอัปโหลด…' : 'อัปโหลดรูป hero'}
          </button>
          {cfg.heroImageUrl && (
            <button type="button" className="btn btn-outline text-sm" onClick={() => setField('heroImageUrl', '')} data-testid="hero-image-remove">ลบรูป</button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void handleUpload(e)} data-testid="hero-upload-input" />
        </div>
        {cfg.heroImageUrl ? (
          <img src={cfg.heroImageUrl} alt="รูป hero ตัวอย่าง" className="w-full max-h-48 object-cover rounded-lg border" data-testid="hero-image-preview" />
        ) : (
          <p className="text-xs text-slate-500">ยังไม่มีรูป hero — ถ้าไม่ใส่จะไม่แสดงแบนเนอร์รูป (ใช้ได้เป็นข้อความล้วน)</p>
        )}
      </GlassCard>

      <button type="button" className="btn btn-primary w-full" disabled={busy || !loaded} onClick={() => void handleSave()} data-testid="hero-save">
        {busy ? 'กำลังบันทึก…' : 'บันทึกฮีโร่'}
      </button>
    </div>
  )
}
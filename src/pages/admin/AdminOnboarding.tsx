// ============================================
// Bite Me Baby — Onboarding Wizard (Master Prompt Task 2 · T2-b)
// ============================================
// เปิดร้านใหม่ในไม่กี่นาที: ชื่อร้าน → โทนสี/โลโก้ (อัปโหลดลง storage จริง) →
// Prompt AI ประจำร้าน → สร้าง tenant (RPC tenant_create_admin ตัวเดิม) + brand row
// (RLS brands_admin_manage ตัวเดิม) — ไม่มี logic สร้างร้านใหม่ซ้ำที่อื่น
// ข้อจำกัดตรงไปตรงมา:
//   * createTenant = platform admin เท่านั้น (RPC 079 กำหนด — ไม่ใช่กฎของหน้านี้)
//   * ai_prompt ต้อง apply migration 175 ก่อน (ยังไม่ apply) — ถ้ายังไม่มีคอลัมน์
//     หน้านี้จะสร้างร้าน/แบรนด์สำเร็จแล้วแจ้งว่า "prompt รอ apply 175" (ไม่เงียบ)
//   * ธีม/โดเมน resolve ต่อร้าน = BrandProvider + worker (ดู changelog รอบนี้)
// ============================================

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { createTenant } from '@/lib/adminTenantApi'
import { showToast } from '@/components/ui/ToastContainer'

/** slug จากร้าน (a-z0-9- · ไม่เกิน 40) — pure, export เพื่อให้ test เรียกตรง ๆ */
export function slugifyStore(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

const STEPS = ['ข้อมูลร้าน', 'โลโก้และโทนสี', 'AI ประจำร้าน'] as const

export function AdminOnboarding() {
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [autoSlug, setAutoSlug] = useState(true)
  const [color, setColor] = useState('#FF5E1E')
  const [logoUrl, setLogoUrl] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [aiPrompt, setAiPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ tenantId: string; promptSaved: boolean } | null>(null)

  const finalSlug = autoSlug ? slugifyStore(name) : slugifyStore(slug)
  const step1Ok = name.trim().length >= 2 && finalSlug.length >= 2
  // โทนสีต้องเป็น hex จริง · โลโก้ไม่บังคับ (มีไฟล์หรือลิงก์อย่างใดอย่างหนึ่งก็ใช้ได้ ไม่มีก็ได้)
  const step2Ok = /^#[0-9a-fA-F]{6}$/.test(color.trim())

  async function uploadLogo(): Promise<string> {
    if (!logoFile) return logoUrl.trim()
    try {
      const ext = (logoFile.name.split('.').pop() || 'png').toLowerCase()
      const path = `brands/${finalSlug || 'store'}/logo-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('bmb-images').upload(path, logoFile, { upsert: true })
      if (upErr) throw upErr
      const { data } = supabase.storage.from('bmb-images').getPublicUrl(path)
      return data?.publicUrl || logoUrl.trim()
    } catch (e) {
      showToast(
        `อัปโหลดโลโก้ไม่สำเร็จ — ใช้ลิงก์ที่กรอกไว้แทน (${String((e as Error)?.message || e).slice(0, 80)})`,
        'warning',
      )
      return logoUrl.trim()
    }
  }

  async function handleCreate() {
    if (busy || !step1Ok || !step2Ok) return
    setBusy(true)
    setError('')
    try {
      const t = await createTenant(name.trim(), finalSlug)
      if (!t.ok || !t.tenant) {
        setError(t.error || 'สร้างร้านไม่สำเร็จ — ตรวจชื่อ/slug ว่าซ้ำหรือสิทธิ์ platform admin หรือไม่')
        return
      }
      const logo = await uploadLogo()
      const baseBrand = {
        tenant_id: t.tenant.id,
        name: name.trim(),
        logo_url: logo,
        color_scheme: color.trim(),
      }
      let promptSaved = false
      const { error: bErr } = await supabase
        .from('brands')
        .insert({ ...baseBrand, ai_prompt: aiPrompt.trim() || null })
      if (bErr) {
        // m175 ยังไม่ apply = คอลัมน์ ai_prompt ยังไม่มีบน production → สร้างแบรนด์
        // โดยไม่มี prompt แล้วแจ้งตรง ๆ (ห้ามเงียบ — กติกา No evidence = not done)
        const { error: bErr2 } = await supabase.from('brands').insert(baseBrand)
        if (bErr2) throw bErr2
        showToast('เปิดร้านแล้ว — แต่ prompt AI ยังบันทึกไม่ได้ ต้อง apply migration 175 ก่อน', 'warning')
      } else {
        promptSaved = true
      }
      setResult({ tenantId: t.tenant.id, promptSaved })
      showToast('เปิดร้านใหม่สำเร็จ — เลือกสาขา/ธีมร้านต่อได้ที่หน้าองค์กรและแบรนด์', 'success')
    } catch (e) {
      setError(String((e as Error)?.message || e).slice(0, 200))
    } finally {
      setBusy(false)
    }
  }

  if (result) {
    return (
      <div className="max-w-xl mx-auto p-4 space-y-4" data-testid="onboarding-done">
        <div className="card bg-green-50 border border-green-300">
          <h2 className="text-xl font-bold text-green-800 mb-2">✅ เปิดร้าน "{name}" แล้ว</h2>
          <p className="text-sm text-green-900">
            Tenant: <code data-testid="onboarding-tenant-id">{result.tenantId}</code> (slug: {finalSlug})
          </p>
          <p className="text-sm text-green-900 mt-1">
            {result.promptSaved
              ? 'บันทึก prompt AI ของร้านเรียบร้อย'
              : 'prompt AI: ยังบันทึกไม่ได้ — apply migration 175 แล้วกรอกใหม่ที่หน้านี้/หน้าแบรนด์'}
          </p>
          <p className="text-sm text-brand-muted mt-2">
            ขั้นถัดไป: เปิดรับออร์เดอร์ = เพิ่มสาขา → ตั้งรอบส่ง → ผูกโดเมน/ธีม (white-label)
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/tenants" className="btn btn-primary" data-testid="onboarding-to-tenants">🏫 ไปหน้าองค์กรและแบรนด์</Link>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => { setResult(null); setStep(1); setName(''); setSlug(''); setAiPrompt(''); setLogoFile(null); setLogoUrl('') }}
          >
            เปิดร้านเพิ่ม
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      <div className="card">
        <h1 className="text-xl font-bold text-brand-accent mb-1">✨ เปิดร้านใหม่ (Onboarding Wizard)</h1>
        <p className="text-xs text-brand-muted mb-3">กรอก 3 ขั้นตอน → ระบบสร้างร้าน + แบรนด์ให้เอง (platform admin เท่านั้น)</p>

        <ol className="flex gap-2 mb-4 text-xs" data-testid="onboarding-steps">
          {STEPS.map((label, i) => (
            <li
              key={label}
              className={`flex-1 rounded-lg px-2 py-1.5 text-center border ${
                step === i + 1 ? 'bg-brand-primary text-white border-brand-primary' : 'border-brand-border text-brand-muted'
              }`}
            >
              {i + 1}. {label}
            </li>
          ))}
        </ol>

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-2 text-xs font-medium text-red-700 mb-3" role="alert" data-testid="onboarding-error">
            ⚠️ {error}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3" data-testid="onboarding-step-1">
            <label className="block text-sm">
              <span className="font-medium">ชื่อร้าน *</span>
              <input
                className="input mt-1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="เช่น Sweet Bakery Chanthaburi"
                data-testid="onboarding-name"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={autoSlug} onChange={(e) => setAutoSlug(e.target.checked)} data-testid="onboarding-autoslug" />
              สร้าง slug อัตโนมัติจากชื่อร้าน
            </label>
            {!autoSlug && (
              <label className="block text-sm">
                <span className="font-medium">slug (a-z0-9-)</span>
                <input className="input mt-1" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="sweet-bakery" data-testid="onboarding-slug" />
              </label>
            )}
            <p className="text-xs text-brand-muted">slug ปัจจุบัน: <code data-testid="onboarding-preview-slug">{finalSlug || '—'}</code></p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3" data-testid="onboarding-step-2">
            <label className="block text-sm">
              <span className="font-medium">โทนสีหลัก (hex) *</span>
              <div className="flex items-center gap-2 mt-1">
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="เลือกโทนสี" data-testid="onboarding-color-picker" />
                <input className="input flex-1" value={color} onChange={(e) => setColor(e.target.value)} data-testid="onboarding-color" />
              </div>
            </label>
            <label className="block text-sm">
              <span className="font-medium">โลโก้ (อัปโหลดไฟล์ หรือ วางลิงก์จากคลังรูปภาพ)</span>
              <input
                type="file"
                accept="image/*"
                className="mt-1 block w-full text-xs"
                onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                data-testid="onboarding-logo-file"
              />
              <input className="input mt-2" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://.../logo.png" data-testid="onboarding-logo-url" />
            </label>
            <p className="text-xs text-brand-muted">ตัวอย่าง: <span style={{ color }}>สีนี้</span> · ไฟล์อัปโหลดเข้า bucket <code>bmb-images</code> ทันทีที่กดสร้างร้าน</p>
          </div>
        )}
      {/* __PART2__ */}
        {step === 3 && (
          <div className="space-y-3" data-testid="onboarding-step-3">
            <label className="block text-sm">
              <span className="font-medium">Prompt ของ AI ประจำร้าน</span>
              <textarea
                className="input mt-1 min-h-28"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="เช่น ร้านเบเกอรี่เน้นครัวซองต์อบสดทุกเช้า ตอบสุภาพ แนะนำสินค้าใหม่ก่อน"
                data-testid="onboarding-ai-prompt"
              />
            </label>
            <p className="text-xs text-brand-muted">
              เก็บลงแบรนด์ของร้านนั้น ๆ (คอลัมน์ ai_prompt · ต้อง apply migration 175) — ฝั่ง ai-proxy อ่านไปใช้ในรอบถัดไป
            </p>
          </div>
        )}

        <div className="flex justify-between mt-4">
          <button type="button" className="btn btn-outline" disabled={step === 1 || busy} onClick={() => setStep((s) => Math.max(1, s - 1))} data-testid="onboarding-back">
            ← ย้อนกลับ
          </button>
          {step < 3 ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={(step === 1 && !step1Ok) || (step === 2 && !step2Ok)}
              onClick={() => setStep((s) => Math.min(3, s + 1))}
              data-testid="onboarding-next"
            >
              ถัดไป →
            </button>
          ) : (
            <button type="button" className="btn btn-primary" disabled={busy || !step1Ok || !step2Ok} onClick={() => void handleCreate()} data-testid="onboarding-create">
              {busy ? '⏳ กำลังสร้างร้าน...' : '🚀 สร้างร้านเลย'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
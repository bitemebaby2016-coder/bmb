// ============================================
// Bite Me Baby — AdminMarketing (Part C · 2026-10-22) — Control Center ของทีมการตลาด
// ============================================
// 7 แท็บ อ่าน/เขียนผ่านของจริงทั้งหมด (ไม่มีข้อมูลจำลอง/ของปลอม):
//   Overview — ตัวเลขจริงจาก marketing_posts · Planner — สินค้าขายดีจริง (order_items)
//   AI Studio — สร้างภาพจริง (image-gen EF, E5/E6) · Approval — คนอนุมัติเท่านั้น
//   Calendar — marketing_schedule_post (server บังคับ approval) · Rules — marketing_rules
//   Analytics — ผลเผยแพร่จริง (provider post id, error, attempts)
// อนุมัติ != ตั้งเวลา != เผยแพร่ — แยกกันชัดเจนทุกชั้น
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { showToast } from '@/components/ui/ToastContainer'
import { AdminAiStudio } from '@/pages/admin/AdminAiStudio'
import {
  listMarketingPosts, createMarketingPost, scheduleMarketingPost,
  getMarketingRules, saveMarketingRules, bestSellerProducts,
  type MarketingPostRow, type MarketingRules,
} from '@/lib/adminMarketing'
import { listContentApprovals, reviewContent, type ContentApprovalRow } from '@/lib/contentApproval'
import { autoScheduleApprovedPosts } from '@/lib/marketingAutoSchedule'
import { getBusinessSettings, setBusinessSetting } from '@/lib/bmbAdminApi_settings'

type Tab = 'overview' | 'planner' | 'studio' | 'approval' | 'calendar' | 'rules' | 'analytics' | 'ai'
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: '📊 ภาพรวม' },
  { id: 'planner', label: '🗓️ Planner' },
  { id: 'studio', label: '🎨 AI Studio' },
  { id: 'ai', label: '✍️ แคปชัน AI' },
  { id: 'approval', label: '✅ กล่องอนุมัติ' },
  { id: 'calendar', label: '📅 ปฏิทิน' },
  { id: 'rules', label: '⚙️ กติกา' },
  { id: 'analytics', label: '📈 รายงาน' },
]

const STATUS_CLS: Record<string, string> = {
  draft: 'badge', pending_approval: 'badge badge-warning', approved: 'badge badge-info',
  scheduled: 'badge badge-primary', published: 'badge badge-success', failed: 'badge badge-danger',
}

export function AdminMarketing() {
  const [tab, setTab] = useState<Tab>(() => {
    // C5/Q3: deep-link ?tab= จาก redirect ของหน้าเดิม (bookmark ไม่ตาย)
    const t = new URLSearchParams(window.location.search).get('tab')
    return TABS.some((x) => x.id === t) ? (t as Tab) : 'overview'
  })
  const [posts, setPosts] = useState<MarketingPostRow[]>([])
  const [approvals, setApprovals] = useState<ContentApprovalRow[]>([])
  const [rules, setRules] = useState<MarketingRules | null>(null)
  const [sellers, setSellers] = useState<Array<{ product_id: string; product_name: string; units: number }>>([])
  // R32 (Owner): Picker เมนู "ทั้งหมด" ใน Planner — แอดมินจิ้มเลือกได้ทั้งพรีออเดอร์และเซมเดย์
  const [catalog, setCatalog] = useState<Array<{ id: string; name: string; price: number | null; is_preorder?: boolean; available_preorder?: boolean; available_same_day?: boolean; image_url?: string | null }>>([])
  const [loading, setLoading] = useState(true)

  const [title, setTitle] = useState('')
  const [bodyText, setBodyText] = useState('')
  const [contentType, setContentType] = useState<'post' | 'promotion' | 'banner' | 'announcement'>('post')
  const [images, setImages] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const [genKind, setGenKind] = useState<'menu' | 'promo' | 'festival'>('promo')
  const [genStyle, setGenStyle] = useState<'realistic' | 'illustration' | 'poster'>('realistic')
  const [genSubject, setGenSubject] = useState('')
  const [genNote, setGenNote] = useState('')
  const [genBusy, setGenBusy] = useState(false)

  const [ruleFreq, setRuleFreq] = useState(3)
  const [ruleStart, setRuleStart] = useState('10:00')
  const [ruleEnd, setRuleEnd] = useState('19:00')
  const [ruleCooldown, setRuleCooldown] = useState(6)
  const [whenByPost, setWhenByPost] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    const [p, a, r, s, cat] = await Promise.all([
      listMarketingPosts(), listContentApprovals(), getMarketingRules(), bestSellerProducts(),
      // R32: เมนูทั้งหมดของร้าน (สินค้าที่แอดมินตั้งจริง — พรีออเดอร์ + เซมเดย์) ใช้ใน picker
      supabase.from('products').select('id,name,price,is_preorder,available_preorder,available_same_day,is_available,image_url').eq('is_available', true).order('sort_order'),
    ])
    setPosts(p); setApprovals(a); setSellers(s)
    setCatalog((cat.data ?? []) as Array<{ id: string; name: string; price: number | null; is_preorder?: boolean; available_preorder?: boolean; available_same_day?: boolean; image_url?: string | null }>)
    if (r) {
      setRules(r)
      setRuleFreq(r.frequency_per_week)
      setRuleStart(r.publishing_window?.start ?? '10:00')
      setRuleEnd(r.publishing_window?.end ?? '19:00')
      setRuleCooldown(r.cooldown_hours)
    }
    setLoading(false)
  }, [])
  useEffect(() => { void load() }, [load])

  async function handleCreatePost() {
    if (!title.trim()) { showToast('ใส่หัวข้อโพสต์ก่อน', 'error'); return }
    setSaving(true)
    const r = await createMarketingPost({ title: title.trim(), body: bodyText, content_type: contentType, image_urls: images })
    setSaving(false)
    if (r.ok) {
      showToast('สร้างโพสต์แล้ว — ส่งเข้ากล่องอนุมัติ (คนอนุมัติเท่านั้น)', 'success')
      setTitle(''); setBodyText(''); setImages([])
      await load()
    } else {
      showToast('สร้างโพสต์ไม่สำเร็จ: ' + (r.error || 'ERR_SUBMIT_FAILED'), 'error')
    }
  }

  async function handleApprove(id: string) {
    const ok = await reviewContent(id, 'approved')
    if (ok) {
      await supabase.from('marketing_posts').update({ status: 'approved' }).eq('approval_id', id)
      showToast('อนุมัติแล้ว — พร้อมตั้งเวลาเผยแพร่', 'success')
      await load()
    } else showToast('อนุมัติไม่สำเร็จ', 'error')
  }

  async function handleReject(id: string) {
    const note = window.prompt('เหตุผลที่ปฏิเสธ (บันทึกลง audit):', '') ?? ''
    const ok = await reviewContent(id, 'rejected', note)
    if (ok) {
      await supabase.from('marketing_posts').update({ status: 'draft' }).eq('approval_id', id)
      showToast('ปฏิเสธแล้ว — โพสต์กลับเป็นฉบับร่าง', 'success')
      await load()
    } else showToast('บันทึกการตัดสินใจไม่สำเร็จ', 'error')
  }

  async function handleSchedule(id: string) {
    const when = whenByPost[id]
    if (!when) { showToast('เลือกเวลาเผยแพร่ก่อน', 'error'); return }
    const r = await scheduleMarketingPost(id, new Date(when).toISOString())
    if (r.ok) {
      showToast('ตั้งเวลาเผยแพร่แล้ว (ระบบจะโพสต์อัตโนมัติเมื่อถึงเวลา)', 'success')
      await load()
    } else {
      showToast('ตั้งเวลาไม่สำเร็จ: ' + (r.error || 'ERR_SCHEDULE_FAILED'), 'error')
    }
  }

  // CAP-22 (Owner 2026-10-26): "ให้ AI เลือกเวลา/โพสอัตโนมัติเต็มรูปแบบ"
  //  เลือกเวลาจาก marketing_rules จริง (หน้าต่างเผยแพร่/cooldown/เพดานต่อสัปดาห์)
  //  → เรียก RPC marketing_schedule_post ตัวเดิม (server บังคับ approval='approved' ซ้ำ)
  //  → การโพสต์จริงยังเป็น marketing_publish worker รายชั่วโมงตัวเดิม (ไม่มีทาง publish ที่สอง)
  //  หมายเหตุ: การ "อนุมัติ" ยังเป็นหน้าที่คนเสมอ — ปุ่มนี้ตั้งเวลาได้เฉพาะโพสต์ที่อนุมัติแล้ว
  const [autoBusy, setAutoBusy] = useState(false)
  async function handleAutoSchedule() {
    setAutoBusy(true)
    try {
      const res = await autoScheduleApprovedPosts()
      if (res.scheduled > 0) {
        const preview = res.plan.slice(0, 3)
          .map((p) => `${p.title}: ${new Date(p.iso).toLocaleString('th-TH')}`)
          .join(' · ')
        showToast(
          `AI เลือกเวลาให้ ${res.scheduled} โพสต์ (ข้าม ${res.skipped})${res.failed ? ` · ล้มเหลว ${res.failed}` : ''} — ${preview}`,
          'success',
        )
        await load()
      } else {
        showToast(`ยังไม่มีโพสต์ที่ตั้งเวลาให้ได้ (ข้าม ${res.skipped}) — ต้องมีโพสต์ที่อนุมัติแล้วและยังไม่มีเวลา`, 'info')
      }
      if (res.failed > 0) {
        showToast('ตั้งเวลาไม่สำเร็จบางรายการ: ' + res.errors.map((e) => e.error).join(', '), 'error')
      }
    } finally {
      setAutoBusy(false)
    }
  }

  async function handleGenerateImage() {
    if (!genSubject.trim()) { showToast('ใส่ชื่อสินค้า/หัวข้อก่อนสร้างภาพ', 'error'); return }
    // R34 (Owner): รูปอาหารห้ามเจน — ใช้ภาพจริงจากแคตตาลอก (Picker แนบ image_url ให้แล้ว)
    if (genKind === 'menu') {
      showToast('รูปเมนูใช้ภาพจริงจากแคตตาลอก — จิ้มเมนูใน Planner เพื่อแนบรูปจริง (สร้างภาพ AI ได้เฉพาะป้ายโปรโมต/เทศกาล)', 'warning')
      return
    }
    setGenBusy(true)
    try {
      const { data, error } = await supabase.functions.invoke('image-gen', {
        body: { kind: genKind, style: genStyle, subject: genSubject.trim(), note: genNote },
      })
      if (error || !data?.ok) {
        // R32: ดึงรายละเอียดจริงจาก body ของ EF (400/502 detail) — เดิมเห็นแค่ "non-2xx" มองไม่เห็นสาเหตุ
        let detail = data?.error || error?.message || 'ERR_IMAGE_GEN_FAILED'
        const ctx = (error as unknown as { context?: Response } | null)?.context
        if (ctx && typeof ctx.json === 'function') {
          try {
            const body = await ctx.json() as { error?: string; detail?: string }
            if (body?.error || body?.detail) detail = `${body.error ?? ''} ${body.detail ?? ''}`.trim()
          } catch { /* คง message เดิม */ }
        }
        showToast('สร้างภาพไม่สำเร็จ: ' + detail, 'error')
      } else {
        setImages((prev) => [...prev, data.url])
        showToast('สร้างภาพสำเร็จ — แนบกับโพสต์แล้ว (เลือก/ใช้เลย/สร้างใหม่ได้)', 'success')
      }
    } catch (e) {
      showToast('สร้างภาพไม่สำเร็จ: ' + String(e).slice(0, 120), 'error')
    } finally {
      setGenBusy(false)
    }
  }

  async function handleSaveRules() {
    const r = await saveMarketingRules({
      frequency_per_week: ruleFreq,
      publishing_window: { start: ruleStart, end: ruleEnd },
      cooldown_hours: ruleCooldown,
    })
    if (r.ok) { showToast('บันทึกกติกาแล้ว (คุมด้วยตารางจริง ไม่ใช่ค่าฝังโค้ด)', 'success'); await load() }
    else showToast('บันทึกกติกาไม่สำเร็จ: ' + (r.error || 'ERR_SAVE_FAILED'), 'error')
  }

  const stats = {
    pending: posts.filter((p) => p.status === 'pending_approval').length,
    scheduled: posts.filter((p) => p.status === 'scheduled').length,
    published: posts.filter((p) => p.status === 'published').length,
    failed: posts.filter((p) => p.status === 'failed').length,
  }

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold text-brand-accent">📣 AdminMarketing — Control Center</h1>
      {/* C5/Q3: กล่องอนุมัติ = marketing แท็บ approval (หน้า /admin/content-approvals redirect มาที่นี่) */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`btn text-sm ${tab === t.id ? 'btn-primary' : 'btn-outline'}`} data-testid={`mk-tab-${t.id}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-brand-muted text-sm">กำลังโหลดข้อมูลจริง…</p>}

      {tab === 'overview' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="card text-center"><p className="text-2xl font-bold">{stats.pending}</p><p className="text-sm text-brand-muted">รอคนอนุมัติ</p></div>
          <div className="card text-center"><p className="text-2xl font-bold">{stats.scheduled}</p><p className="text-sm text-brand-muted">ตั้งเวลาแล้ว</p></div>
          <div className="card text-center"><p className="text-2xl font-bold">{stats.published}</p><p className="text-sm text-brand-muted">เผยแพร่แล้ว</p></div>
          <div className="card text-center"><p className="text-2xl font-bold text-red-500">{stats.failed}</p><p className="text-sm text-brand-muted">ล้มเหลว (รอ retry)</p></div>
          <div className="card md:col-span-4 text-sm text-brand-muted">
            กติกาปัจจุบัน: {rules ? `${rules.frequency_per_week} โพสต์/สัปดาห์ · หน้าต่างเวลา ${rules.publishing_window?.start}-${rules.publishing_window?.end} · เว้น ${rules.cooldown_hours} ชม.` : 'ยังไม่มีการตั้งค่า'}
            {' · '}โพสต์ทั้งหมด {posts.length} รายการ (ข้อมูลจริงจาก marketing_posts)
          </div>
        </div>
      )}

      {tab === 'ai' && <AdminAiStudio />}

      {tab === 'planner' && (
        <div className="space-y-3">
          <div className="card">
            <h2 className="font-bold text-brand-accent mb-2">🏆 สินค้าขายดีจริง (จาก order_items)</h2>
            {sellers.length === 0 ? (
              <p className="text-sm text-brand-muted">ยังไม่มีข้อมูลการขาย — รายการจะโผล่เมื่อมีออเดอร์จริง</p>
            ) : (
              <ul className="space-y-1">
                {sellers.map((s) => (
                  <li key={s.product_id} className="flex items-center justify-between text-sm">
                    <span>{s.product_name}</span>
                    <span className="flex items-center gap-2">
                      <span className="badge badge-info">{s.units} ชิ้น</span>
                      <button
                        className="btn btn-outline text-xs"
                        onClick={() => { setTitle('แนะนำ ' + s.product_name); setBodyText('วันนี้ขอแนะนำ ' + s.product_name + ' เมนูขายดีของเรา'); setGenSubject(s.product_name); setTab('studio') }}
                      >
                        ใช้ทำโพสต์
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {/* R32 (Owner): จิ้มเลือกจากเมนูทั้งหมด (พรีออเดอร์ + เซมเดย์) — ไม่ใช่แค่สินค้าขายดี */}
          <div className="card" data-testid="mk-product-picker">
            <h2 className="font-bold text-brand-accent mb-2">🍽️ เลือกจากเมนูทั้งหมด (พรีออเดอร์ + เซมเดย์)</h2>
            {catalog.length === 0 ? (
              <p className="text-sm text-brand-muted">ยังไม่มีสินค้าที่เปิดขาย — เพิ่มในหน้าสินค้าก่อน</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {catalog.map((p) => {
                  const preorder = p.is_preorder && !(p.available_same_day ?? false)
                  return (
                    <button
                      key={p.id}
                      className="btn btn-outline text-xs"
                      data-testid={`mk-pick-${p.id}`}
                      onClick={() => {
                        setTitle(`แนะนำ ${p.name}`)
                        setBodyText(`วันนี้ขอแนะนำ ${p.name}${p.price != null ? ` ฿${Number(p.price).toFixed(0)}` : ''}`)
                        setGenSubject(p.name)
                        // R34 (Owner): รูปอาหารไม่ต้องเจน — ใช้ภาพจริงจากเมนู (image_url ของสินค้า)
                        setImages(p.image_url ? [p.image_url] : [])
                        if (p.image_url) showToast('แนบรูปเมนูจริงจากแคตตาลอกให้แล้ว (ไม่ต้องเจนรูปอาหาร)', 'success')
                        setTab('studio')
                      }}
                    >
                      {preorder ? '⏳ ' : '⚡ '}{p.name}{p.price != null ? ` ฿${Number(p.price).toFixed(0)}` : ''} <span className="text-brand-muted">{preorder ? '(พรีออเดอร์)' : '(เซมเดย์)'}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          <PostForm title={title} setTitle={setTitle} bodyText={bodyText} setBodyText={setBodyText} contentType={contentType} setContentType={setContentType} images={images} setImages={setImages} saving={saving} onSubmit={() => void handleCreatePost()} />
        </div>
      )}

      {tab === 'studio' && (
        <div className="space-y-3">
          <div className="card">
            <h2 className="font-bold text-brand-accent mb-2">🎨 สร้างภาพโปรโมต (AI — E5/E6)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-sm">ประเภทภาพ (E5)
                <select className="input w-full" value={genKind} onChange={(e) => setGenKind(e.target.value as typeof genKind)}>
                  <option value="promo">ป้ายโปรโมต</option>
                  <option value="festival">ภาพเทศกาล</option>
                </select>
              </label>
              <label className="text-sm">สไตล์ (E6 — 3 แนวจากโจทย์เดียวกัน)
                <select className="input w-full" value={genStyle} onChange={(e) => setGenStyle(e.target.value as typeof genStyle)}>
                  <option value="realistic">ถ่ายสมจริง</option>
                  <option value="illustration">ภาพประกอบ</option>
                  <option value="poster">กราฟิกป้าย</option>
                </select>
              </label>
              <label className="text-sm">ชื่อสินค้า/หัวข้อ
                <input className="input w-full" value={genSubject} onChange={(e) => setGenSubject(e.target.value)} placeholder="เช่น บิงซูมะม่วง" />
              </label>
              <label className="text-sm">เพิ่มเติม (ไม่บังคับ)
                <input className="input w-full" value={genNote} onChange={(e) => setGenNote(e.target.value)} placeholder="เช่น โทนเหลืองทอง" />
              </label>
            </div>
            <button className="btn btn-primary mt-3" disabled={genBusy} onClick={() => void handleGenerateImage()} data-testid="mk-generate-image">
              {genBusy ? '⏳ กำลังสร้าง…' : '✨ สร้างภาพ'}
            </button>
            <p className="text-xs text-brand-muted mt-2">รูปเมนู = ภาพจริงจากแคตตาลอก (จิ้มเมนูใน Planner → แนบภาพจริงให้อัตโนมัติ) · สร้างภาพ AI เฉพาะป้ายโปรโมต/เทศกาลเท่านั้น</p>
            {images.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {images.map((u) => <img key={u} src={u} alt="generated" className="w-24 h-24 object-cover rounded-lg border border-brand-border" />)}
              </div>
            )}
          </div>
          <PostForm title={title} setTitle={setTitle} bodyText={bodyText} setBodyText={setBodyText} contentType={contentType} setContentType={setContentType} images={images} setImages={setImages} saving={saving} onSubmit={() => void handleCreatePost()} />
        </div>
      )}

      {tab === 'approval' && (
        <div className="space-y-3">
          {approvals.length === 0 && <p className="text-sm text-brand-muted">ยังไม่มีเนื้อหาในคิว — สร้างโพสต์จาก Planner/Studio</p>}
          {approvals.map((a) => {
            const linked = posts.find((p) => p.approval_id === a.id)
            return (
              <div key={a.id} className="card">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="font-bold">{a.title}</p>
                    <p className="text-sm text-brand-muted">{a.body}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={STATUS_CLS[a.status] || 'badge'}>{a.status}</span>
                    {a.status === 'pending' && (
                      <>
                        <button className="btn btn-primary text-xs" onClick={() => void handleApprove(a.id)} data-testid={`mk-approve-${a.id}`}>✅ อนุมัติ</button>
                        <button className="btn btn-outline text-xs" onClick={() => void handleReject(a.id)}>✖ ปฏิเสธ</button>
                      </>
                    )}
                    {linked && <span className="badge">{linked.status}</span>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'calendar' && (
        <div className="space-y-3">
          {/* CAP-22 (Owner 2026-10-26): ให้ AI เลือกเวลาอัตโนมัติ — เฉพาะโพสต์ที่คนอนุมัติแล้ว
              และยังไม่มีเวลา · กติกาจาก marketing_rules จริง · ยิง RPC เดิม · ไม่มี publish path ใหม่ */}
          <div className="card flex items-center justify-between flex-wrap gap-2" data-testid="mk-auto-schedule-bar">
            <div className="text-sm text-brand-muted">
              🤖 AI เลือกเวลาจาก <b>กติกาจริงในแท็บ "⚙️ กติกา"</b> (หน้าต่างเผยแพร่ · cooldown · เพดาน/สัปดาห์)
              — เฉพาะโพสต์ที่อนุมัติแล้ว · การโพสต์จริงเป็นระบบอัตโนมัติรายชั่วโมงตัวเดิม
            </div>
            <button
              type="button"
              className="btn btn-primary text-sm"
              onClick={() => void handleAutoSchedule()}
              disabled={autoBusy}
              data-testid="mk-auto-schedule"
            >
              {autoBusy ? '⏳ กำลังเลือกเวลา…' : '🤖 ให้ AI เลือกเวลาทั้งหมด'}
            </button>
          </div>
          {posts.filter((p) => p.status !== 'published').length === 0 && <p className="text-sm text-brand-muted">ยังไม่มีโพสต์รอตั้งเวลา</p>}
          {posts.filter((p) => p.status !== 'published').map((p) => (
            <div key={p.id} className="card flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="font-bold">{p.title}</p>
                <p className="text-xs text-brand-muted">
                  สถานะ: <span className={STATUS_CLS[p.status] || 'badge'}>{p.status}</span>
                  {p.scheduled_for ? ` · ตั้งไว้ ${new Date(p.scheduled_for).toLocaleString('th-TH')}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="datetime-local" className="input text-sm"
                  value={whenByPost[p.id] || ''}
                  onChange={(e) => setWhenByPost((m) => ({ ...m, [p.id]: e.target.value }))}
                  data-testid={`mk-when-${p.id}`}
                />
                <button className="btn btn-primary text-xs" onClick={() => void handleSchedule(p.id)} data-testid={`mk-schedule-${p.id}`}>⏰ ตั้งเวลา</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'rules' && (
        <div className="space-y-4 max-w-xl">
          <PromotionBudgetPanel />
          <ReferralSettingsPanel />
          <LoyaltySettingsPanel />
          {/* [G&R 156 · Rollout ④⑤⑦] Engagement & Play — ยืนบนศูนย์กลางเดิมตาม §3 */}
          <SpinSettingsPanel />
          <AffiliateSettingsPanel />
          <RewardsCatalogPanel />
          <div className="card space-y-3">
            <p className="text-sm text-brand-muted">กติกาเหล่านี้เก็บในตาราง marketing_rules (แก้ได้จริง ไม่มีค่าฝังโค้ด)</p>
            <label className="text-sm">จำนวนโพสต์ต่อสัปดาห์
              <input type="number" min={1} max={21} className="input w-full" value={ruleFreq} onChange={(e) => setRuleFreq(Number(e.target.value))} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">หน้าต่างเวลาเริ่ม
                <input type="time" className="input w-full" value={ruleStart} onChange={(e) => setRuleStart(e.target.value)} />
              </label>
              <label className="text-sm">หน้าต่างเวลาสิ้นสุด
                <input type="time" className="input w-full" value={ruleEnd} onChange={(e) => setRuleEnd(e.target.value)} />
              </label>
            </div>
            <label className="text-sm">เว้นขั้นต่ำระหว่างโพสต์ (ชม.)
              <input type="number" min={0} max={168} className="input w-full" value={ruleCooldown} onChange={(e) => setRuleCooldown(Number(e.target.value))} />
            </label>
            <button className="btn btn-primary" onClick={() => void handleSaveRules()} data-testid="mk-save-rules">💾 บันทึกกติกา</button>
            {rules && <p className="text-xs text-brand-muted">ค่าปัจจุบันในระบบ: mix {JSON.stringify(rules.content_mix)} · menu rules {JSON.stringify(rules.menu_rules)}</p>}
          </div>
        </div>
      )}

      {tab === 'analytics' && (
        <div className="space-y-2">
          {posts.length === 0 && <p className="text-sm text-brand-muted">ยังไม่มีข้อมูลเผยแพร่</p>}
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-brand-muted">
                <th className="p-2">โพสต์</th><th className="p-2">สถานะ</th><th className="p-2">เผยแพร่เมื่อ</th><th className="p-2">Provider ID</th><th className="p-2">ครั้งที่ยิง</th><th className="p-2">ข้อผิดพลาด</th>
              </tr></thead>
              <tbody>
                {posts.map((p) => (
                  <tr key={p.id} className="border-t border-brand-border">
                    <td className="p-2">{p.title}</td>
                    <td className="p-2"><span className={STATUS_CLS[p.status] || 'badge'}>{p.status}</span></td>
                    <td className="p-2">{p.published_at ? new Date(p.published_at).toLocaleString('th-TH') : '—'}</td>
                    <td className="p-2 font-mono text-xs">{p.provider_post_id || '—'}</td>
                    <td className="p-2">{p.publish_attempts}</td>
                    <td className="p-2 text-red-500 text-xs">{p.error || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

/** ฟอร์มโพสต์ร่วม (Planner/Studio) — สร้างโพสต์จริง + ส่งเข้ากล่องอนุมัติ */
function PostForm(props: {
  title: string; setTitle: (v: string) => void
  bodyText: string; setBodyText: (v: string) => void
  contentType: 'post' | 'promotion' | 'banner' | 'announcement'; setContentType: (v: 'post' | 'promotion' | 'banner' | 'announcement') => void
  images: string[]; setImages: (v: string[]) => void
  saving: boolean; onSubmit: () => void
}) {
  return (
    <div className="card space-y-3">
      <h2 className="font-bold text-brand-accent">✍️ สร้างโพสต์ (ส่งเข้ากล่องอนุมัติ)</h2>
      <label className="text-sm">หัวข้อ
        <input className="input w-full" value={props.title} onChange={(e) => props.setTitle(e.target.value)} />
      </label>
      <label className="text-sm">เนื้อหา
        <textarea className="input w-full" rows={4} value={props.bodyText} onChange={(e) => props.setBodyText(e.target.value)} />
      </label>
      <label className="text-sm">ประเภท
        <select className="input w-full" value={props.contentType} onChange={(e) => props.setContentType(e.target.value as typeof props.contentType)}>
          <option value="post">โพสต์ทั่วไป</option>
          <option value="promotion">โปรโมชัน</option>
          <option value="banner">แบนเนอร์</option>
          <option value="announcement">ประกาศ</option>
        </select>
      </label>
      {props.images.length > 0 && <p className="text-xs text-brand-muted">แนบรูปแล้ว {props.images.length} รูป</p>}
      <button className="btn btn-primary" disabled={props.saving} onClick={props.onSubmit} data-testid="mk-create-post">
        {props.saving ? '⏳…' : '📨 สร้างโพสต์ (รอคนอนุมัติ)'}
      </button>
    </div>
  )
}

/**
 * [G&R 153 · Rollout ①] แผงงบประมาณ & Kill Switch ของโปรโมชั่น
 * เก็บใน business_settings.promotion_policy (Owner ⑥: เริ่ม 15% ของยอดขาย · แอดมินปรับได้เอง)
 *  · kill switch = promotions_enabled (false → ทุกโค้ดถูกหัก 0 ทันทีที่เซิร์ฟเวอร์)
 *  · budget_percent = เพดานส่วนลด/เดือน (0–100 · null = ไม่จำกัด)
 *  · ตัวเลขจริงอ่านจาก RPC promotion_budget_status (gate is_admin — แอดมินเท่านั้น)
 *  เป็นส่วนหนึ่งของ AI Marketing Center (§3 GAP: หน้าจอบริหาร Growth ยืนบนศูนย์กลางเดิม)
 */
function PromotionBudgetPanel() {
  const [enabled, setEnabled] = useState(true)
  const [percent, setPercent] = useState<number | ''>(15)
  const [unlimited, setUnlimited] = useState(false)
  const [status, setStatus] = useState<Record<string, unknown> | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { void loadPolicy() }, [])

  async function loadPolicy() {
    const settings = await getBusinessSettings()
    const policy = settings['promotion_policy']
    if (policy && typeof policy === 'object') {
      if (typeof policy.promotions_enabled === 'boolean') setEnabled(policy.promotions_enabled)
      if (policy.budget_percent === null) {
        setUnlimited(true)
        setPercent('')
      } else if (policy.budget_percent !== undefined && Number.isFinite(Number(policy.budget_percent))) {
        setUnlimited(false)
        setPercent(Number(policy.budget_percent))
      }
    }
    const { data, error } = await supabase.rpc('promotion_budget_status')
    if (!error && data && typeof data === 'object') setStatus(data as Record<string, unknown>)
    else setStatus(null)
  }

  async function handleSave() {
    if (!unlimited) {
      const n = percent === '' ? NaN : Number(percent)
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        showToast('เพดานงบส่วนลดต้องเป็นตัวเลข 0–100 (หรือติ๊ก "ไม่จำกัด")', 'warning')
        return
      }
    }
    setBusy(true)
    const ok = await setBusinessSetting('promotion_policy', {
      promotions_enabled: enabled,
      budget_percent: unlimited ? null : Number(percent),
    })
    setBusy(false)
    showToast(
      ok ? 'บันทึกงบ/kill switch โปรโมชั่นแล้ว (มีผลกับทุกโค้ดทันที)' : 'บันทึกไม่สำเร็จ — ลองใหม่อีกครั้ง',
      ok ? 'success' : 'error',
    )
    if (ok) void loadPolicy()
  }

  const money = (v: unknown) => Number(v ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div className="card space-y-3" data-testid="gr-budget-panel">
      <h3 className="font-bold text-brand-accent">💰 งบประมาณ & Kill Switch โปรโมชั่น</h3>
      <p className="text-sm text-brand-muted">
        เพดานส่วนลดต่อเดือน = เปอร์เซ็นต์ของยอดขายเดือนนั้น — ระบบตัดสินใจให้เองทุกโค้ด (server) ·
        เกินเพดาน/ปิดสวิตช์ = ส่วนลดเป็น 0 โดยไม่หักเงินลูกค้าลับ ๆ
      </p>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          data-testid="gr-kill-switch"
        />
        ✅ เปิดระบบโปรโมชั่น (ติ๊กออก = ปิดทุกโค้ดทันที — kill switch)
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={unlimited}
          onChange={(e) => { setUnlimited(e.target.checked); if (e.target.checked) setPercent('') }}
          data-testid="gr-budget-unlimited"
        />
        ไม่จำกัดงบ (ปิดเพดานชั่วคราว)
      </label>
      {!unlimited && (
        <label className="text-sm block">
          เพดานงบส่วนลด (% ของยอดขายเดือนนี้ · 0 = ไม่ให้ส่วนลดเลย)
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            className="input w-full"
            value={percent}
            onChange={(e) => setPercent(e.target.value === '' ? '' : Number(e.target.value))}
            data-testid="gr-budget-percent"
          />
        </label>
      )}
      {status && (
        <div className="rounded-xl bg-brand-bg p-3 text-xs text-brand-muted space-y-1" data-testid="gr-budget-status">
          <div>เดือนนี้: ยอดขายรวม <b>{money(status.sales)}</b> บาท · ใช้ส่วนลดไป <b>{money(status.spent)}</b> บาท</div>
          <div>
            {status.percent === null
              ? 'เพดานงบ: ไม่จำกัด'
              : `เพดานงบ: ${money(status.budget)} บาท (เหลือ ${money(status.remaining)} บาท) จาก ${Number(status.percent)}% ของยอดขาย`}
          </div>
        </div>
      )}
      <button className="btn btn-primary" onClick={() => void handleSave()} disabled={busy} data-testid="gr-budget-save">
        {busy ? '⏳…' : '💾 บันทึกงบ/kill switch'}
      </button>
    </div>
  )
}

/**
 * [G&R 154 · Rollout ②] แผงควบคุม "แนะนำเพื่อน" — ตั้งใน business_settings.referral_policy
 *  (Owner: ทำสูตรไว้ แอดมินปรับเองได้ · kill switch · เพดาน/เดือน · หน้าต่าง claim)
 *  + สถิติ/รายการ attribution จริง + ปุ่มอนุมัติ/ปฏิเสธ รายการที่ถูก "พักรางวัล" (risk=review)
 *  ยืนบน AI Marketing Center (แท็บ Rules) ตาม §3 — ไม่สร้างศูนย์กลางใหม่
 */
function ReferralSettingsPanel() {
  const [enabled, setEnabled] = useState(true)
  const [referrerBaht, setReferrerBaht] = useState<number | ''>(30)
  const [friendBaht, setFriendBaht] = useState<number | ''>(30)
  const [qualifyStatus, setQualifyStatus] = useState('delivered')
  const [validityDays, setValidityDays] = useState<number | ''>(30)
  const [monthlyCap, setMonthlyCap] = useState<number | ''>(20)
  const [minOrder, setMinOrder] = useState<number | ''>(0)
  const [claimWindow, setClaimWindow] = useState<number | ''>(72)
  const [shareBase, setShareBase] = useState('')
  const [stats, setStats] = useState<Record<string, any> | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    const settings = await getBusinessSettings()
    const policy = settings['referral_policy']
    if (policy && typeof policy === 'object') {
      if (typeof policy.enabled === 'boolean') setEnabled(policy.enabled)
      if (Number.isFinite(Number(policy.referrer_reward_baht))) setReferrerBaht(Number(policy.referrer_reward_baht))
      if (Number.isFinite(Number(policy.friend_reward_baht))) setFriendBaht(Number(policy.friend_reward_baht))
      if (typeof policy.qualify_status === 'string') setQualifyStatus(policy.qualify_status)
      if (Number.isFinite(Number(policy.coupon_validity_days))) setValidityDays(Number(policy.coupon_validity_days))
      if (policy.referrer_monthly_cap === null) setMonthlyCap('')
      else if (Number.isFinite(Number(policy.referrer_monthly_cap))) setMonthlyCap(Number(policy.referrer_monthly_cap))
      if (Number.isFinite(Number(policy.min_order_amount))) setMinOrder(Number(policy.min_order_amount))
      if (Number.isFinite(Number(policy.claim_window_hours))) setClaimWindow(Number(policy.claim_window_hours))
      if (typeof policy.share_base_url === 'string') setShareBase(policy.share_base_url)
    }
    const { data, error } = await supabase.rpc('referral_admin_stats')
    setStats(!error && data && typeof data === 'object' ? (data as Record<string, any>) : null)
  }

  async function handleSave() {
    const num = (v: number | '', min: number, label: string): number | null | false => {
      if (v === '') return null
      const n = Number(v)
      if (!Number.isFinite(n) || n < min) {
        showToast(`${label} ต้องเป็นตัวเลขไม่น้อยกว่า ${min}`, 'warning')
        return false
      }
      return n
    }
    const refN = num(referrerBaht, 0, 'รางวัลผู้แนะนำ')
    const frN = num(friendBaht, 0, 'รางวัลเพื่อนใหม่')
    const valN = num(validityDays, 1, 'อายุคูปอง')
    const capN = monthlyCap === '' ? null : num(monthlyCap, 0, 'เพดานต่อเดือน')
    const minN = num(minOrder, 0, 'ยอดขั้นต่ำ')
    const winN = num(claimWindow, 1, 'หน้าต่างเวลา claim')
    if (refN === false || frN === false || valN === false || capN === false || minN === false || winN === false) return

    setBusy(true)
    const ok = await setBusinessSetting('referral_policy', {
      enabled,
      referrer_reward_baht: refN ?? 0,
      friend_reward_baht: frN ?? 0,
      qualify_status: qualifyStatus,
      coupon_validity_days: valN ?? 30,
      referrer_monthly_cap: capN,
      min_order_amount: minN ?? 0,
      claim_window_hours: winN ?? 72,
      share_base_url: shareBase.trim(),
    })
    setBusy(false)
    showToast(
      ok ? 'บันทึกกติกาแนะนำเพื่อนแล้ว (มีผลกับการ claim ครั้งถัดไปทันที)' : 'บันทึกไม่สำเร็จ — ลองใหม่อีกครั้ง',
      ok ? 'success' : 'error',
    )
    if (ok) void load()
  }

  async function handleResolve(orderNumber: string, decision: 'approve' | 'reject') {
    const { data, error } = await supabase.rpc('referral_resolve_attribution', {
      p_order_number: orderNumber,
      p_decision: decision,
    })
    if (error || !data) {
      showToast('ดำเนินการไม่สำเร็จ — ลองใหม่อีกครั้ง', 'error')
      return
    }
    showToast(decision === 'approve' ? 'อนุมัติปลดล็อกรางวัลแล้ว' : 'ปฏิเสธรายการแนะนำแล้ว', 'success')
    void load()
  }

  const totals = (stats?.totals ?? null) as Record<string, unknown> | null
  const recent = Array.isArray(stats?.recent) ? (stats.recent as Array<Record<string, unknown>>) : []
  const money = (v: unknown) => Number(v ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div className="card space-y-3" data-testid="gr-referral-panel">
      <h3 className="font-bold text-brand-accent">🤝 แนะนำเพื่อน (Referral &amp; Affiliate)</h3>
      <p className="text-sm text-brand-muted">
        รางวัล = คูปอง (ไม่ใช่เงินสด) · ออกเมื่อออเดอร์แรกของเพื่อนใหม่ผ่านสถานะที่กำหนด ·
        ระบบป้องกันแนะนำตัวเอง 3 ระดับ + พักรางวัลเมื่อผิดปกติให้ท่านตรวจที่นี่
      </p>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          data-testid="gr-ref-enabled"
        />
        ✅ เปิดระบบแนะนำเพื่อน (ติ๊กออก = ไม่รับโค้ดใหม่ทันที — kill switch · รางวัลที่ออกแล้วยังคงอยู่)
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">รางวัลผู้แนะนำ (฿)
          <input type="number" min={0} step={1} className="input w-full" value={referrerBaht}
            onChange={(e) => setReferrerBaht(e.target.value === '' ? '' : Number(e.target.value))} data-testid="gr-ref-referrer-baht" />
        </label>
        <label className="text-sm">รางวัลเพื่อนใหม่ (฿)
          <input type="number" min={0} step={1} className="input w-full" value={friendBaht}
            onChange={(e) => setFriendBaht(e.target.value === '' ? '' : Number(e.target.value))} data-testid="gr-ref-friend-baht" />
        </label>
      </div>

      <label className="text-sm block">ออเดอร์ผ่านสถานะไหนจึงได้รางวัล
        <select className="input w-full" value={qualifyStatus} onChange={(e) => setQualifyStatus(e.target.value)} data-testid="gr-ref-qualify">
          <option value="confirmed">confirmed — ยืนยันออเดอร์</option>
          <option value="preparing">preparing — กำลังเตรียม</option>
          <option value="ready_for_dispatch">ready_for_dispatch — พร้อมส่ง</option>
          <option value="dispatched">dispatched — ออกส่ง</option>
          <option value="in_transit">in_transit — ระหว่างส่ง</option>
          <option value="arrived">arrived — ถึงที่</option>
          <option value="delivered">delivered — ส่งสำเร็จ (ค่าเริ่มต้น)</option>
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">อายุคูปอง (วัน)
          <input type="number" min={1} className="input w-full" value={validityDays}
            onChange={(e) => setValidityDays(e.target.value === '' ? '' : Number(e.target.value))} data-testid="gr-ref-validity" />
        </label>
        <label className="text-sm">เพดานผู้แนะนำ/เดือน (ครั้ง · ว่าง = ไม่จำกัด)
          <input type="number" min={0} className="input w-full" value={monthlyCap}
            onChange={(e) => setMonthlyCap(e.target.value === '' ? '' : Number(e.target.value))} data-testid="gr-ref-cap" />
        </label>
        <label className="text-sm">ยอดขั้นต่ำของคูปอง (฿)
          <input type="number" min={0} className="input w-full" value={minOrder}
            onChange={(e) => setMinOrder(e.target.value === '' ? '' : Number(e.target.value))} data-testid="gr-ref-min-order" />
        </label>
        <label className="text-sm">หน้าต่างอายุสิทธิ์ (ชม. หลังสั่งซื้อ)
          <input type="number" min={1} className="input w-full" value={claimWindow}
            onChange={(e) => setClaimWindow(e.target.value === '' ? '' : Number(e.target.value))} data-testid="gr-ref-window" />
        </label>
      </div>

      <label className="text-sm block">ลิงก์แชร์พื้นฐาน (ว่าง = ใช้โดเมนปัจจุบันของเว็บ)
        <input type="text" className="input w-full" placeholder="https://biteme-baby.com"
          value={shareBase} onChange={(e) => setShareBase(e.target.value)} data-testid="gr-ref-share-base" />
      </label>

      <button className="btn btn-primary" onClick={() => void handleSave()} disabled={busy} data-testid="gr-ref-save">
        {busy ? '⏳…' : '💾 บันทึกกติกาแนะนำเพื่อน'}
      </button>

      {totals && (
        <div className="rounded-xl bg-brand-bg p-3 text-xs text-brand-muted space-y-1" data-testid="gr-ref-totals">
          <div>
            รอตรวจพัก: <b>{Number(totals.review_pending ?? 0)}</b> · ค้างรางวัล:{' '}
            <b>{Math.max(0, Number(totals.held ?? 0) - Number(totals.review_pending ?? 0))}</b> ·
            สำเร็จ: <b>{Number(totals.qualified ?? 0)}</b> · ถูกกัน: <b>{Number(totals.blocked ?? 0)}</b> ·
            ปรับกลับ: <b>{Number(totals.reversed ?? 0)}</b>
          </div>
          <div>รางวัลที่ยังใช้ได้รวม {money(totals.rewards_issued)} บาท</div>
        </div>
      )}

      {recent.length > 0 && (
        <div className="space-y-2" data-testid="gr-ref-recent">
          <p className="text-sm font-bold">รายการแนะนำล่าสุด</p>
          {recent.slice(0, 12).map((r) => (
            <div
              key={String(r.order_number)}
              className="flex items-center justify-between gap-2 rounded-lg border border-brand-border p-2 text-xs"
            >
              <div className="min-w-0 text-left">
                <span className="font-mono font-bold">{String(r.order_number)}</span>
                <span className="text-brand-muted">
                  {' '}· {String(r.status)}{r.risk === 'review' ? ' · ⏸ พักรางวัล' : ''}
                </span>
                {r.reason ? <div className="text-brand-muted">{String(r.reason)}</div> : null}
              </div>
              {r.status === 'held' && (
                <div className="flex gap-1 shrink-0">
                  <button
                    className="btn btn-primary text-xs px-2 py-1"
                    data-testid={`gr-ref-approve-${String(r.order_number)}`}
                    onClick={() => void handleResolve(String(r.order_number), 'approve')}
                  >
                    อนุมัติ
                  </button>
                  <button
                    className="btn btn-outline text-xs px-2 py-1"
                    data-testid={`gr-ref-reject-${String(r.order_number)}`}
                    onClick={() => void handleResolve(String(r.order_number), 'reject')}
                  >
                    ปฏิเสธ
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * [G&R 155 · Rollout ③] แผงควบคุม "ระดับสมาชิก + แต้มสะสม" — เก็บใน business_settings.loyalty_policy
 *  (Owner §5.2: 4 ระดับ 1,500/4,000/8,000 rolling 12 เดือน · เกณฑ์ = ยอดสุทธิไม่รวมค่าส่ง)
 *  + อัตราแต้ม = แอดมินตั้งเอง (ค่าเริ่มต้น = ยังไม่เปิด — requirements ห้ามฝังอัตรา)
 *  ยืนบน AI Marketing Center (แท็บ Rules) ตาม §3 — ไม่สร้างศูนย์กลางใหม่
 */
function LoyaltySettingsPanel() {
  const [tiersEnabled, setTiersEnabled] = useState(true)
  const [windowMonths, setWindowMonths] = useState<number | ''>(12)
  const [silverMin, setSilverMin] = useState<number | ''>(1500)
  const [goldMin, setGoldMin] = useState<number | ''>(4000)
  const [platinumMin, setPlatinumMin] = useState<number | ''>(8000)
  const [pointsEnabled, setPointsEnabled] = useState(false)
  const [pointsPerBaht, setPointsPerBaht] = useState<number | ''>(0)
  const [stats, setStats] = useState<Record<string, any> | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    const settings = await getBusinessSettings()
    const policy = settings['loyalty_policy']
    if (policy && typeof policy === 'object') {
      if (typeof policy.tiers_enabled === 'boolean') setTiersEnabled(policy.tiers_enabled)
      if (Number.isFinite(Number(policy.window_months))) setWindowMonths(Number(policy.window_months))
      if (Number.isFinite(Number(policy.tier_silver_min))) setSilverMin(Number(policy.tier_silver_min))
      if (Number.isFinite(Number(policy.tier_gold_min))) setGoldMin(Number(policy.tier_gold_min))
      if (Number.isFinite(Number(policy.tier_platinum_min))) setPlatinumMin(Number(policy.tier_platinum_min))
      if (typeof policy.points_enabled === 'boolean') setPointsEnabled(policy.points_enabled)
      if (Number.isFinite(Number(policy.points_per_baht))) setPointsPerBaht(Number(policy.points_per_baht))
    }
    const { data, error } = await supabase.rpc('loyalty_admin_stats')
    setStats(!error && data && typeof data === 'object' ? (data as Record<string, any>) : null)
  }

  async function handleSave() {
    const num = (v: number | '', min: number, label: string): number | null | false => {
      if (v === '') return null
      const n = Number(v)
      if (!Number.isFinite(n) || n < min) {
        showToast(`${label} ต้องเป็นตัวเลขไม่น้อยกว่า ${min}`, 'warning')
        return false
      }
      return n
    }
    const winN = num(windowMonths, 1, 'หน้าต่างเดือน')
    const silN = num(silverMin, 1, 'เกณฑ์ Silver')
    const golN = num(goldMin, 1, 'เกณฑ์ Gold')
    const plaN = num(platinumMin, 1, 'เกณฑ์ Platinum')
    const rateN = num(pointsPerBaht, 0, 'อัตราแต้ม')
    if (winN === false || silN === false || golN === false || plaN === false || rateN === false) return
    if (winN !== null && silN !== null && golN !== null && plaN !== null && !(silN < golN && golN < plaN)) {
      showToast('เกณฑ์ต้องเรียงตรง: Silver < Gold < Platinum', 'warning')
      return
    }
    if (pointsEnabled && (rateN === null || rateN <= 0)) {
      showToast('เปิดอัตราแต้มต้องตั้งอัตรา (฿) ให้มากกว่า 0 ก่อน', 'warning')
      return
    }

    setBusy(true)
    const ok = await setBusinessSetting('loyalty_policy', {
      tiers_enabled: tiersEnabled,
      window_months: winN ?? 12,
      tier_silver_min: silN ?? 1500,
      tier_gold_min: golN ?? 4000,
      tier_platinum_min: plaN ?? 8000,
      points_enabled: pointsEnabled,
      points_per_baht: rateN ?? 0,
      earn_qualify_status: 'delivered',
    })
    setBusy(false)
    showToast(
      ok ? 'บันทึกกติกา loyalty แล้ว (มีผลกับการตรวจครั้งถัดไปทันที)' : 'บันทึกไม่สำเร็จ — ลองใหม่อีกครั้ง',
      ok ? 'success' : 'error',
    )
    if (ok) void load()
  }

  const tiers = (stats?.tiers ?? null) as Record<string, unknown> | null
  const points = (stats?.points ?? null) as Record<string, unknown> | null

  return (
    <div className="card space-y-3" data-testid="gr-loyalty-panel">
      <h3 className="font-bold text-brand-accent">💎 ระดับสมาชิก &amp; แต้มสะสม (Loyalty)</h3>
      <p className="text-sm text-brand-muted">
        เกณฑ์ = ยอดสินค้าสุทธิ (หักส่วนลด/คืนเงิน · ไม่รวมค่าส่ง) แบบ rolling
        {typeof windowMonths === 'number' ? ` ${windowMonths}` : ''} เดือน · แคนเซิล/คืนเงินปรับกลับอัตโนมัติ ·
        แต้มออกเมื่อออเดอร์ผ่านสถานะที่กำหนด
      </p>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={tiersEnabled}
          onChange={(e) => setTiersEnabled(e.target.checked)} data-testid="gr-loy-tiers-enabled" />
        ✅ เปิดแสดงระดับสมาชิก 4 ระดับ (ปิด = ทุกบัญชีเป็น Member ชั่วคราว)
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">หน้าต่าง rolling (เดือน)
          <input type="number" min={1} max={36} className="input w-full" value={windowMonths}
            onChange={(e) => setWindowMonths(e.target.value === '' ? '' : Number(e.target.value))} data-testid="gr-loy-window" />
        </label>
        <label className="text-sm">Silver ≥ (฿)
          <input type="number" min={1} className="input w-full" value={silverMin}
            onChange={(e) => setSilverMin(e.target.value === '' ? '' : Number(e.target.value))} data-testid="gr-loy-silver" />
        </label>
        <label className="text-sm">Gold ≥ (฿)
          <input type="number" min={1} className="input w-full" value={goldMin}
            onChange={(e) => setGoldMin(e.target.value === '' ? '' : Number(e.target.value))} data-testid="gr-loy-gold" />
        </label>
        <label className="text-sm">Platinum ≥ (฿)
          <input type="number" min={1} className="input w-full" value={platinumMin}
            onChange={(e) => setPlatinumMin(e.target.value === '' ? '' : Number(e.target.value))} data-testid="gr-loy-platinum" />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={pointsEnabled}
          onChange={(e) => setPointsEnabled(e.target.checked)} data-testid="gr-loy-points-enabled" />
        🪙 เปิดสะสมแต้มจากการสั่งซื้อ (ปิด = ยังไม่มีการให้แต้ม — ค่าเริ่มต้น)
      </label>
      <label className="text-sm">อัตราแต้ม ต่อ ฿1 ของยอดสินค้า (ภาระการเงิน — ตั้งเองเมื่อ unit economics พร้อม)
        <input type="number" min={0} step={0.1} className="input w-full" value={pointsPerBaht}
          onChange={(e) => setPointsPerBaht(e.target.value === '' ? '' : Number(e.target.value))} data-testid="gr-loy-rate" />
      </label>

      <button className="btn btn-primary" onClick={() => void handleSave()} disabled={busy} data-testid="gr-loy-save">
        {busy ? '⏳…' : '💾 บันทึกกติกา Loyalty'}
      </button>

      {tiers && (
        <div className="rounded-xl bg-brand-bg p-3 text-xs text-brand-muted space-y-1" data-testid="gr-loy-tiers">
          <div>
            Member: <b>{Number(tiers.member ?? 0)}</b> · Silver: <b>{Number(tiers.silver ?? 0)}</b> ·
            {' '}Gold: <b>{Number(tiers.gold ?? 0)}</b> · Platinum: <b>{Number(tiers.platinum ?? 0)}</b>
          </div>
          {points && (
            <div>
              แต้มแจกสะสมรวม {Number(points.earned ?? 0)} · ปรับกลับ {Number(points.reversed ?? 0)} ·
              {' '}คงเหลือ {Number(points.balance ?? 0)} จาก {Number(points.entries ?? 0)} รายการในสมุดบันทึก
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * [G&R 156 · Rollout ④] แผงควบคุม Spin & Win — เก็บใน business_settings.spin_policy
 *  (Owner §2 ข้อ 4: "ต้องการรางวัล/แต้ม: ใช่") — อัตรา/เพดาน = แอดมินตั้งเอง (ค่าเริ่มต้น ปิด/0
 *  + จำกัด 1 ครั้ง/วัน · requirements §3.1 ห้ามฝังอัตรา) · ยืนบนแท็บ Rules ตาม §3
 */
function SpinSettingsPanel() {
  const [enabled, setEnabled] = useState(false)
  const [dailyLimit, setDailyLimit] = useState<number | ''>(1)
  const [pointsPerSpin, setPointsPerSpin] = useState<number | ''>(0)
  const [stats, setStats] = useState<Record<string, any> | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { void load() }, [])

  async function load() {
    const settings = await getBusinessSettings()
    const policy = settings['spin_policy']
    if (policy && typeof policy === 'object') {
      if (typeof policy.enabled === 'boolean') setEnabled(policy.enabled)
      if (Number.isFinite(Number(policy.daily_limit))) setDailyLimit(Number(policy.daily_limit))
      if (Number.isFinite(Number(policy.points_per_spin))) setPointsPerSpin(Number(policy.points_per_spin))
    }
    const { data, error } = await supabase.rpc('spin_admin_stats')
    setStats(!error && data && typeof data === 'object' ? (data as Record<string, any>) : null)
  }

  async function handleSave() {
    const limitN = dailyLimit === '' ? NaN : Number(dailyLimit)
    const rateN = pointsPerSpin === '' ? NaN : Number(pointsPerSpin)
    if (!Number.isFinite(limitN) || limitN < 1) { showToast('เพดานต่อวันต้องอย่างน้อย 1 ครั้ง', 'warning'); return }
    if (!Number.isFinite(rateN) || rateN < 0) { showToast('จำนวนแต้มต้องเป็นตัวเลขไม่น้อยกว่า 0', 'warning'); return }
    if (enabled && rateN <= 0) { showToast('เปิดรางวัลต้องตั้งจำนวนแต้มต่อหมุนให้มากกว่า 0 ก่อน', 'warning'); return }

    setBusy(true)
    const ok = await setBusinessSetting('spin_policy', {
      enabled,
      daily_limit: Math.floor(limitN),
      points_per_spin: Math.floor(rateN),
    })
    setBusy(false)
    showToast(ok ? 'บันทึกกติกาล้อสุ่มแล้ว' : 'บันทึกไม่สำเร็จ — ลองใหม่อีกครั้ง', ok ? 'success' : 'error')
    if (ok) void load()
  }

  return (
    <div className="card space-y-3" data-testid="gr-spin-panel">
      <h3 className="font-bold text-brand-accent">🎰 Spin &amp; Win (รางวัลล้อสุ่ม)</h3>
      <p className="text-sm text-brand-muted">
        ล้อสุ่มหน้า "คิดไม่ออก?" และ "กิจกรรม" จะได้แต้มจริงจากเซิร์ฟเวอร์เมื่อเปิดใช้งาน ·
        มีเพดานรายวันต่อลูกค้า · ปิด = หน้าล้อบอกตรง ๆ ว่ายังไม่เปิด (ไม่สัญญาแต้ม)
      </p>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)} data-testid="gr-spin-enabled" />
        ✅ เปิดรางวัลล้อสุ่ม (ค่าเริ่มต้น = ปิด — requirements ห้ามกำหนดอัตราล่วงหน้า)
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">จำนวนแต้มต่อการหมุน
          <input type="number" min={0} className="input w-full" value={pointsPerSpin}
            onChange={(e) => setPointsPerSpin(e.target.value === '' ? '' : Number(e.target.value))} data-testid="gr-spin-rate" />
        </label>
        <label className="text-sm">เพดาน (ครั้ง/วัน/ลูกค้า)
          <input type="number" min={1} className="input w-full" value={dailyLimit}
            onChange={(e) => setDailyLimit(e.target.value === '' ? '' : Number(e.target.value))} data-testid="gr-spin-limit" />
        </label>
      </div>

      <button className="btn btn-primary" onClick={() => void handleSave()} disabled={busy} data-testid="gr-spin-save">
        {busy ? '⏳…' : '💾 บันทึกกติกาล้อสุ่ม'}
      </button>

      {stats && (
        <div className="rounded-xl bg-brand-bg p-3 text-xs text-brand-muted space-y-1" data-testid="gr-spin-stats">
          <div>ปั่นวันนี้ {Number(stats.spins_today ?? 0)} ครั้ง · คนปั่น {Number(stats.spinners_today ?? 0)} คน</div>
          <div>แต้มออกเดือนนี้ {Number(stats.points_this_month ?? 0)} แต้ม</div>
        </div>
      )}
    </div>
  )
}

/**
 * [G&R 156 · Rollout ⑤] แผงควบคุม Creator Affiliate — business_settings.affiliate_policy
 *  (Owner §2 ข้อ 5: "ไม่มีเงินสด → แต้ม/คูปอง อย่างเดียว") — จ่ายเป็นแต้มเท่านั้น ·
 *  cap รายเดือน fail-closed (ไม่ตั้ง cap = ยังไม่จ่าย) · ยืนบนแท็บ Rules ตาม §3
 */
function AffiliateSettingsPanel() {
  const [enabled, setEnabled] = useState(false)
  const [pointsPerOrder, setPointsPerOrder] = useState<number | ''>(0)
  const [monthlyCap, setMonthlyCap] = useState<number | ''>(0)
  const [stats, setStats] = useState<Record<string, any> | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { void load() }, [])

  async function load() {
    const settings = await getBusinessSettings()
    const policy = settings['affiliate_policy']
    if (policy && typeof policy === 'object') {
      if (typeof policy.enabled === 'boolean') setEnabled(policy.enabled)
      if (Number.isFinite(Number(policy.points_per_qualified_order))) setPointsPerOrder(Number(policy.points_per_qualified_order))
      if (Number.isFinite(Number(policy.monthly_cap))) setMonthlyCap(Number(policy.monthly_cap))
    }
    const { data, error } = await supabase.rpc('affiliate_admin_stats')
    setStats(!error && data && typeof data === 'object' ? (data as Record<string, any>) : null)
  }

  async function handleSave() {
    const ptsN = pointsPerOrder === '' ? NaN : Number(pointsPerOrder)
    const capN = monthlyCap === '' ? NaN : Number(monthlyCap)
    if (!Number.isFinite(ptsN) || ptsN < 0) { showToast('แต้มต่อออเดอร์ต้องเป็นตัวเลขไม่น้อยกว่า 0', 'warning'); return }
    if (!Number.isFinite(capN) || capN < 0) { showToast('เพดานต่อเดือนต้องเป็นตัวเลขไม่น้อยกว่า 0', 'warning'); return }
    if (enabled && ptsN <= 0) { showToast('เปิดรางวัลต้องตั้งแต้มต่อออเดอร์ให้มากกว่า 0 ก่อน', 'warning'); return }
    if (enabled && capN <= 0) { showToast('เปิดรางวัลต้องตั้งเพดานแต้มต่อเดือนก่อน (ไม่ตั้งเพดาน = ระบบไม่จ่าย — กันจ่ายเพลิน)', 'warning'); return }

    setBusy(true)
    const ok = await setBusinessSetting('affiliate_policy', {
      enabled,
      points_per_qualified_order: Math.floor(ptsN),
      monthly_cap: Math.floor(capN),
      qualify_status: 'delivered',
    })
    setBusy(false)
    showToast(ok ? 'บันทึกกติกาครีเอเตอร์แล้ว' : 'บันทึกไม่สำเร็จ — ลองใหม่อีกครั้ง', ok ? 'success' : 'error')
    if (ok) void load()
  }

  const att = (stats?.attributions ?? null) as Record<string, unknown> | null

  return (
    <div className="card space-y-3" data-testid="gr-affiliate-panel">
      <h3 className="font-bold text-brand-accent">🤝 Creator Affiliate (ลิงก์ครีเอเตอร์)</h3>
      <p className="text-sm text-brand-muted">
        ครีเอเตอร์แชร์ลิงก์ <code>?aff=โค้ด</code> → ได้ <b>แต้มล้วน ไม่มีเงินสด</b> (§4.1 ข้อ 5) เมื่อออเดอร์ของผู้ซื้อ
        ผ่านสถานะที่กำหนด · ห้าม self-affiliate · เพดานแต้มต่อเดือนต่อครีเอเตอร์ (ไม่ตั้งเพดาน = ยังไม่จ่าย)
      </p>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)} data-testid="gr-aff-enabled" />
        ✅ เปิดรางวัลครีเอเตอร์ (ค่าเริ่มต้น = ปิด)
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">แต้มต่อออเดอร์ที่ผ่านเงื่อนไข
          <input type="number" min={0} className="input w-full" value={pointsPerOrder}
            onChange={(e) => setPointsPerOrder(e.target.value === '' ? '' : Number(e.target.value))} data-testid="gr-aff-rate" />
        </label>
        <label className="text-sm">เพดาน (แต้ม/ครีเอเตอร์/เดือน)
          <input type="number" min={0} className="input w-full" value={monthlyCap}
            onChange={(e) => setMonthlyCap(e.target.value === '' ? '' : Number(e.target.value))} data-testid="gr-aff-cap" />
        </label>
      </div>

      <button className="btn btn-primary" onClick={() => void handleSave()} disabled={busy} data-testid="gr-aff-save">
        {busy ? '⏳…' : '💾 บันทึกกติกาครีเอเตอร์'}
      </button>

      {stats && (
        <div className="rounded-xl bg-brand-bg p-3 text-xs text-brand-muted space-y-1" data-testid="gr-aff-stats">
          <div>โค้ดที่ใช้งาน {Number(stats.codes_active ?? 0)} รหัส</div>
          {att && (
            <div>
              attribution: รอตรวจสอบ {Number(att.pending ?? 0)} · ผ่านเงื่อนไข {Number(att.qualified ?? 0)} ·
              {' '}ปรับกลับ {Number(att.reversed ?? 0)}
            </div>
          )}
          <div>แต้มออกทั้งหมด {Number(stats.points_total ?? 0)} · เดือนนี้ {Number(stats.points_this_month ?? 0)}</div>
        </div>
      )}
    </div>
  )
}

interface CatalogAdminRow {
  id: string
  name: string
  description: string
  points_cost: number
  is_active: boolean
  sort_order: number
}

/**
 * [G&R 156 · Rollout ⑦] แคตตาล็อก Rewards — ย้าย hardcode ใน RewardsPage → ตาราง admin
 *  (Owner §2 ข้อ 7: "ย้าย hardcode → ตาราง admin ตั้งเอง") — CRUD ผ่าน RPC (gate is_admin + audit)
 */
function RewardsCatalogPanel() {
  const [items, setItems] = useState<CatalogAdminRow[] | null>(null)
  const [editId, setEditId] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [pointsCost, setPointsCost] = useState<number | ''>(100)
  const [isActive, setIsActive] = useState(true)
  const [sortOrder, setSortOrder] = useState<number | ''>(0)
  const [busy, setBusy] = useState(false)

  useEffect(() => { void load() }, [])

  async function load() {
    const { data, error } = await supabase.rpc('rewards_admin_list')
    setItems(!error && Array.isArray(data) ? (data as CatalogAdminRow[]) : null)
  }

  function resetForm() {
    setEditId(''); setName(''); setDescription(''); setPointsCost(100); setIsActive(true); setSortOrder(0)
  }

  function editRow(row: CatalogAdminRow) {
    setEditId(row.id); setName(row.name); setDescription(row.description)
    setPointsCost(row.points_cost); setIsActive(row.is_active); setSortOrder(row.sort_order)
  }

  async function handleSave() {
    const trimmed = name.trim()
    if (!trimmed) { showToast('ต้องมีชื่อรางวัล', 'warning'); return }
    const costN = pointsCost === '' ? NaN : Number(pointsCost)
    if (!Number.isFinite(costN) || costN <= 0) { showToast('แต้มต้องมากกว่า 0', 'warning'); return }
    const sortN = sortOrder === '' ? 0 : Number(sortOrder)
    if (!Number.isFinite(sortN)) { showToast('ลำดับต้องเป็นตัวเลข', 'warning'); return }

    setBusy(true)
    const { error } = await supabase.rpc('rewards_admin_save', {
      p_id: editId,
      p_name: trimmed,
      p_description: description,
      p_points_cost: Math.floor(costN),
      p_is_active: isActive,
      p_sort_order: Math.floor(sortN),
    })
    setBusy(false)
    if (error) {
      showToast(error.message?.includes('ERR_INVALID') ? 'ข้อมูลไม่ถูกต้อง — ตรวจชื่อ/จำนวนแต้ม' : 'บันทึกไม่สำเร็จ — ลองใหม่อีกครั้ง', 'error')
      return
    }
    showToast(editId ? 'อัปเดตรายการรางวัลแล้ว' : 'เพิ่มรายการรางวัลแล้ว', 'success')
    resetForm()
    void load()
  }

  async function handleRemove(rowId: string) {
    if (!window.confirm('ลบรายการรางวัลนี้ออกจากรายการแลกหรือไม่? (บันทึก audit ทุกครั้ง)')) return
    setBusy(true)
    const { error } = await supabase.rpc('rewards_admin_remove', { p_id: rowId })
    setBusy(false)
    if (error) { showToast('ลบไม่สำเร็จ — ลองใหม่อีกครั้ง', 'error'); return }
    showToast('ลบรายการรางวัลแล้ว', 'success')
    if (editId === rowId) resetForm()
    void load()
  }

  return (
    <div className="card space-y-3" data-testid="gr-catalog-panel">
      <h3 className="font-bold text-brand-accent">🎁 แคตตาล็อก Rewards (รายการแลกแต้ม)</h3>
      <p className="text-sm text-brand-muted">
        รายการนี้แทนที่ hardcode เดิมในหน้า "รางวัลและแต้ม" — แก้/เพิ่ม/ลบได้ที่นี่
        (ทุกครั้งบันทึก audit log · ปิดการใช้งาน = ซ่อนจากหน้าลูกค้า)
      </p>

      {items === null ? (
        <p className="text-sm text-brand-muted">โหลดรายการไม่สำเร็จ — ลองใหม่อีกครั้ง</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-brand-muted">ยังไม่มีรายการ — เพิ่มรายการแรกด้านล่างเลย</p>
      ) : (
        <ul className="space-y-2" data-testid="gr-catalog-list">
          {items.map((row) => (
            <li key={row.id} className="flex items-center gap-2 rounded-lg border border-brand-border px-3 py-2 text-sm">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">
                  {row.name} <span className="text-brand-muted">· {row.points_cost} แต้ม</span>
                  {!row.is_active && <span className="ml-1 text-xs text-red-500">(ปิดอยู่)</span>}
                </div>
                <div className="text-xs text-brand-muted truncate">{row.description}</div>
              </div>
              <button className="btn btn-secondary text-xs" onClick={() => editRow(row)} data-testid={`gr-catalog-edit-${row.id}`}>แก้ไข</button>
              <button
                className={`btn text-xs ${row.is_active ? 'btn-secondary' : 'btn-primary'}`}
                onClick={() => { editRow({ ...row, is_active: !row.is_active }) }}
              >
                {row.is_active ? 'ปิด' : 'เปิด'}
              </button>
              <button className="btn btn-secondary text-xs text-red-600" onClick={() => void handleRemove(row.id)}>ลบ</button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-2 gap-3 border-t border-brand-border pt-3">
        <label className="text-sm col-span-2">ชื่อรางวัล
          <input type="text" className="input w-full" value={name} placeholder="เช่น คูปองลด 10%"
            onChange={(e) => setName(e.target.value)} data-testid="gr-catalog-name" />
        </label>
        <label className="text-sm col-span-2">คำอธิบาย
          <input type="text" className="input w-full" value={description}
            onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label className="text-sm">จำนวนแต้ม
          <input type="number" min={1} className="input w-full" value={pointsCost}
            onChange={(e) => setPointsCost(e.target.value === '' ? '' : Number(e.target.value))} data-testid="gr-catalog-points" />
        </label>
        <label className="text-sm">ลำดับแสดง
          <input type="number" min={0} className="input w-full" value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value === '' ? '' : Number(e.target.value))} />
        </label>
        <label className="flex items-center gap-2 text-sm col-span-2">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          เปิดใช้งาน (ปิด = ซ่อนจากหน้าลูกค้า)
        </label>
      </div>

      <div className="flex gap-2">
        <button className="btn btn-primary" onClick={() => void handleSave()} disabled={busy} data-testid="gr-catalog-save">
          {busy ? '⏳…' : editId ? '💾 อัปเดตรายการ' : '➕ เพิ่มรายการ'}
        </button>
        {editId && (
          <button className="btn btn-secondary" onClick={resetForm} disabled={busy}>ยกเลิก</button>
        )}
      </div>
    </div>
  )
}
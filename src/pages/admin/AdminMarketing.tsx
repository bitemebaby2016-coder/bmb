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
import {
  listMarketingPosts, createMarketingPost, scheduleMarketingPost,
  getMarketingRules, saveMarketingRules, bestSellerProducts,
  type MarketingPostRow, type MarketingRules,
} from '@/lib/adminMarketing'
import { listContentApprovals, reviewContent, type ContentApprovalRow } from '@/lib/contentApproval'

type Tab = 'overview' | 'planner' | 'studio' | 'approval' | 'calendar' | 'rules' | 'analytics'
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: '📊 ภาพรวม' },
  { id: 'planner', label: '🗓️ Planner' },
  { id: 'studio', label: '🎨 AI Studio' },
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
  const [tab, setTab] = useState<Tab>('overview')
  const [posts, setPosts] = useState<MarketingPostRow[]>([])
  const [approvals, setApprovals] = useState<ContentApprovalRow[]>([])
  const [rules, setRules] = useState<MarketingRules | null>(null)
  const [sellers, setSellers] = useState<Array<{ product_id: string; product_name: string; units: number }>>([])
  const [loading, setLoading] = useState(true)

  const [title, setTitle] = useState('')
  const [bodyText, setBodyText] = useState('')
  const [contentType, setContentType] = useState<'post' | 'promotion' | 'banner' | 'announcement'>('post')
  const [images, setImages] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const [genKind, setGenKind] = useState<'menu' | 'promo' | 'festival'>('menu')
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
    const [p, a, r, s] = await Promise.all([
      listMarketingPosts(), listContentApprovals(), getMarketingRules(), bestSellerProducts(),
    ])
    setPosts(p); setApprovals(a); setSellers(s)
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

  async function handleGenerateImage() {
    if (!genSubject.trim()) { showToast('ใส่ชื่อสินค้า/หัวข้อก่อนสร้างภาพ', 'error'); return }
    setGenBusy(true)
    try {
      const { data, error } = await supabase.functions.invoke('image-gen', {
        body: { kind: genKind, style: genStyle, subject: genSubject.trim(), note: genNote },
      })
      if (error || !data?.ok) {
        showToast('สร้างภาพไม่สำเร็จ: ' + (data?.error || error?.message || 'ERR_IMAGE_GEN_FAILED'), 'error')
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
                  <option value="menu">ภาพเมนูอาหาร</option>
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
        <div className="card space-y-3 max-w-xl">
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
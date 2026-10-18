// ============================================
// Admin — เนื้อหาก่อนเผยแพร่ (ตรวจ/อนุมัติ)
// ============================================
// ทุกเนื้อหา (โปรโมชั่น/แบนเนอร์/โพสต์/ประกาศ) ต้องผ่านการตรวจก่อนแสดงผล —
// แอดมินส่งเนื้อหาพร้อมรายละเอียด รูปประกอบ และเลือกมาสคอตได้เอง

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { showToast } from '@/components/ui/ToastContainer'
import { submitContentForApproval, reviewContent, listContentApprovals, type ContentApprovalRow, type ContentApprovalStatus } from '@/lib/contentApproval'
import { uploadMediaAsset } from '@/lib/bmbAdminApi_media'
import { MASCOT_ROLES } from '@/lib/mascotService'

const TYPE_LABEL: Record<string, string> = {
  promotion: 'โปรโมชั่น',
  banner: 'แบนเนอร์',
  post: 'โพสต์',
  announcement: 'ประกาศ',
}

const STATUS_LABEL: Record<ContentApprovalStatus, string> = {
  pending: 'รออนุมัติ',
  approved: 'อนุมัติแล้ว',
  rejected: 'ไม่อนุมัติ',
}

const MASCOT_LABEL: Record<string, string> = {
  greeting: 'ทักทาย', heart: 'ส่งใจ', thumbsup: 'ยกนิ้วให้', running: 'วิ่งส่ง',
  pointing: 'ชี้แนะนำ', peeking: 'โผล่มาทัก', thinking: 'กำลังคิด', empty: 'ของหมด (เศร้า)',
  bye: 'ลาก่อน', award: 'มอบรางวัล', cooking: 'กำลังทำอาหาร', eating: 'กำลังกิน',
  feedback: 'รับฟังความเห็น', menu: 'แนะนำเมนู', ready: 'พร้อมเสิร์ฟ', recommend: 'แนะนำเมนูเด็ด',
  reviewing: 'กำลังตรวจ', shopping: 'ช้อปปิ้ง', success: 'สำเร็จ', vote: 'ชวนโหวต',
  waiting: 'รอสักครู่', sad: 'เศร้า', closed: 'ร้านปิด',
}

function mascotLabelOf(key: string): string {
  return MASCOT_LABEL[key] || key
}

export function AdminContentApprovals() {
  const [rows, setRows] = useState<ContentApprovalRow[]>([])
  const [contentType, setContentType] = useState<ContentApprovalRow['content_type']>('promotion')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [mascot, setMascot] = useState('')
  const [uploading, setUploading] = useState(false)
  const [reviewNote, setReviewNote] = useState<Record<string, string>>({})

  useEffect(() => { load() }, [])

  async function load() {
    setRows(await listContentApprovals())
  }

  function resetForm() {
    setTitle('')
    setBody('')
    setImageUrl('')
    setMascot('')
    setContentType('promotion')
  }

  async function handleUpload(file: File) {
    setUploading(true)
    try {
      const asset = await uploadMediaAsset(file, 'image', title || 'content')
      if (asset?.url) {
        setImageUrl(asset.url)
        showToast('อัปโหลดรูปสำเร็จ', 'success')
      } else {
        showToast('อัปโหลดรูปไม่สำเร็จ — ลองอีกครั้ง หรือวางลิงก์รูปในช่องด้านบนแทน', 'error')
      }
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit() {
    if (!title.trim()) { showToast('กรุณากรอกหัวข้อเนื้อหาก่อน', 'warning'); return }
    const id = await submitContentForApproval(contentType, title.trim(), body.trim(), imageUrl.trim() || undefined, mascot || undefined)
    if (!id) { showToast('ส่งเข้าคิวตรวจไม่สำเร็จ — ลองอีกครั้ง', 'error'); return }
    showToast('ส่งเข้าคิวตรวจแล้ว — เนื้อหาจะยังไม่แสดงผลจนกว่าจะอนุมัติ', 'success')
    resetForm()
    load()
  }

  async function handleReview(row: ContentApprovalRow, decision: 'approved' | 'rejected') {
    const note = (reviewNote[row.id] ?? '').trim()
    const ok = await reviewContent(row.id, decision, note)
    if (!ok) { showToast('บันทึกผลตรวจไม่สำเร็จ — รายการนี้อาจถูกตรวจไปแล้ว', 'error'); return }
    showToast(decision === 'approved' ? 'อนุมัติแล้ว — เนื้อหานี้แสดงผลได้' : 'ไม่อนุมัติ — เนื้อหานี้จะไม่ถูกแสดงผล', decision === 'approved' ? 'success' : 'warning')
    load()
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <Link to="/admin" className="text-sm text-brand-muted hover:underline">← กลับหน้าภาพรวม</Link>
      <h1 className="text-2xl font-bold text-brand-accent mt-2 mb-1">🛡️ ตรวจเนื้อหาก่อนเผยแพร่</h1>
      <p className="text-sm text-brand-muted mb-6">
        เนื้อหาทุกชิ้นต้องผ่านการตรวจก่อนแสดงผล — ส่งเนื้อหาได้ด้านล่าง พร้อมรายละเอียด รูปประกอบ และเลือกมาสคอตได้ตามต้องการ
      </p>

      {/* ส่งเนื้อหาใหม่ */}
      <div className="card p-4 mb-6">
        <h3 className="font-bold text-brand-accent mb-3">➕ ส่งเนื้อหาใหม่</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <select className="input" value={contentType} onChange={(e) => setContentType(e.target.value as ContentApprovalRow['content_type'])} aria-label="ประเภทเนื้อหา">
            {Object.keys(TYPE_LABEL).map((k) => <option key={k} value={k}>{TYPE_LABEL[k]}</option>)}
          </select>
          <input className="input" placeholder="หัวข้อ *" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="หัวข้อเนื้อหา" />
          <textarea
            className="input md:col-span-2"
            rows={3}
            placeholder="รายละเอียดเนื้อหา (ข้อความที่ต้องการสื่อสาร)"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            aria-label="รายละเอียดเนื้อหา"
          />
          <div>
            <label className="text-xs text-brand-muted">รูปประกอบ</label>
            <input
              className="input"
              placeholder="ลิงก์รูปภาพ"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              aria-label="ลิงก์รูปภาพ"
            />
            <div className="flex items-center gap-2 mt-2">
              <input
                type="file"
                accept="image/*"
                className="input"
                aria-label="เลือกรูปจากเครื่อง"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void handleUpload(f)
                }}
              />
              {uploading && <span className="text-sm text-brand-muted">กำลังอัปโหลด…</span>}
            </div>
            {imageUrl && (
              <img src={imageUrl} alt="ตัวอย่างรูปประกอบ" className="mt-2 h-24 rounded-lg object-cover border border-brand-border" />
            )}
          </div>
          <div>
            <label className="text-xs text-brand-muted">มาสคอต</label>
            <select className="input" value={mascot} onChange={(e) => setMascot(e.target.value)} aria-label="เลือกมาสคอต">
              <option value="">ไม่ใช้มาสคอต</option>
              {MASCOT_ROLES.map((r) => (
                <option key={r} value={r}>{mascotLabelOf(r)}</option>
              ))}
            </select>
            {mascot && <p className="text-xs text-brand-muted mt-2">ท่ามาสคอตที่เลือก: {mascotLabelOf(mascot)}</p>}
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={handleSubmit} className="btn btn-primary">ส่งเข้าคิวตรวจ</button>
          <button onClick={resetForm} className="btn btn-outline">ล้างฟอร์ม</button>
        </div>
      </div>

      {/* คิวตรวจ + ประวัติ */}
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="card">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`badge ${row.status === 'approved' ? 'badge-success' : row.status === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>
                  {TYPE_LABEL[row.content_type] || row.content_type} · {STATUS_LABEL[row.status] || row.status}
                </span>
                <span className="text-sm font-medium text-brand-accent">{row.title}</span>
                {row.mascot && <span className="text-xs text-brand-muted">🎭 {mascotLabelOf(row.mascot)}</span>}
              </div>
              <span className="text-xs text-brand-muted">{row.created_at.slice(0, 16).replace('T', ' ')}</span>
            </div>
            {row.body && <p className="text-sm text-brand-muted whitespace-pre-wrap">{row.body}</p>}
            {row.image_url && (
              <img src={row.image_url} alt={`รูปประกอบ ${row.title}`} className="mt-2 h-28 rounded-lg object-cover border border-brand-border" />
            )}
            <div className="text-xs text-brand-muted mt-1">
              {row.status === 'approved' ? '✅ อนุมัติแล้ว — แสดงผลได้' : row.status === 'rejected' ? '⛔ ไม่อนุมัติ — จะไม่ถูกแสดงผล' : '⏳ รอการอนุมัติ — ยังไม่แสดงผล'}
            </div>
            {row.status === 'pending' && (
              <div className="flex gap-2 mt-2">
                <input
                  className="input flex-1"
                  placeholder="บันทึกผลตรวจ (ไม่บังคับ)"
                  value={reviewNote[row.id] ?? ''}
                  onChange={(e) => setReviewNote({ ...reviewNote, [row.id]: e.target.value })}
                  aria-label="บันทึกผลตรวจ"
                />
                <button onClick={() => handleReview(row, 'approved')} className="btn btn-success text-sm">✅ อนุมัติ</button>
                <button onClick={() => handleReview(row, 'rejected')} className="btn btn-outline text-sm text-red-500">✖ ไม่อนุมัติ</button>
              </div>
            )}
          </div>
        ))}
        {rows.length === 0 && (
          <p className="text-brand-muted text-center py-8">ยังไม่มีเนื้อหาในคิว — ส่งเนื้อหาใหม่ได้จากฟอร์มด้านบนค่ะ</p>
        )}
      </div>
    </div>
  )
}
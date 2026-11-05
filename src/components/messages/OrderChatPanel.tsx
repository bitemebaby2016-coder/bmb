// ============================================
// Bite Me Baby — R51: OrderChatPanel (แชต ลูกค้า ↔ ไรเดอร์ ↔ แอดมิน รายออเดอร์)
// ============================================
// ใช้ร่วมกัน 3 ฝั่ง (component เดียว — ไม่มี logic ซ้ำ):
//   OrdersPage (ลูกค้า) · RiderPwaPage (ไรเดอร์) · AdminOrders (แอดมิน)
// poll ทุก 10 วิ (CHAT_POLL_MS) — realtime = stub ตาม W4C · เขียนผ่าน RPC m182 เท่านั้น
// ============================================
import { useEffect, useRef, useState } from 'react'
import {
  listOrderMessages, sendOrderMessage, chatComposeGuard,
  CHAT_ROLE_LABELS, CHAT_POLL_MS, type ChatRole, type OrderMessageRow,
} from '@/lib/orderMessages'
// R70 (Owner 2026-11-05 "ไม่มีแจ้งเตือนข้อความ"): เสียงสั้นเมื่อมีข้อความใหม่จากอีกฝั่ง
import { playNotifBeep } from '@/lib/notifBeep'

interface Props {
  orderNumber: string
  role: ChatRole
}

/** แจ้งเตือนเบราว์เซอร์เมื่อหน้าไม่ได้โฟกัส (granted เท่านั้น — ไม่เด้งขอสิทธิ์เอง) */
function notifyBrowser(title: string, body: string): void {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission !== 'granted') return
    if (typeof document !== 'undefined' && !document.hidden) return
    new Notification(title, { body, icon: '/favicon.svg', tag: 'bmb-chat' })
  } catch {
    /* private mode / policy — เงียบไว้ */
  }
}

export function OrderChatPanel({ orderNumber, role }: Props) {
  const [rows, setRows] = useState<OrderMessageRow[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [newCount, setNewCount] = useState(0)
  const listRef = useRef<HTMLDivElement | null>(null)
  // id ที่เห็นแล้ว (โหลดรอบแรก = ไม่นับเป็น "ข้อความใหม่")
  const seenRef = useRef<Set<string> | null>(null)

  async function load(silent = false) {
    const r = await listOrderMessages(orderNumber)
    if (!r.ok) {
      if (!silent) setErr(r.error || 'โหลดข้อความไม่สำเร็จ')
      return
    }
    const incoming = r.rows ?? []
    // R70: จับข้อความใหม่จาก "อีกฝั่ง" ที่เข้ามาระหว่าง poll — เสียง + badge + browser notification
    if (seenRef.current) {
      const fresh = incoming.filter((m) => !seenRef.current!.has(m.id) && m.sender_role !== role)
      if (fresh.length > 0) {
        setNewCount((n) => n + fresh.length)
        playNotifBeep()
        const last = fresh[fresh.length - 1]
        notifyBrowser(
          `💬 ข้อความใหม่จาก${CHAT_ROLE_LABELS[last.sender_role]}`,
          `${orderNumber}: ${last.body.slice(0, 120)}`,
        )
      }
    }
    seenRef.current = new Set(incoming.map((m) => m.id))
    setRows(incoming)
    setErr('')
  }

  useEffect(() => {
    let alive = true
    // เปลี่ยนออเดอร์ = รีเซ็ตสถานะแจ้งเตือนของ thread เดิม
    seenRef.current = null
    setNewCount(0)
    void (async () => { if (alive) await load() })()
    const t = window.setInterval(() => { void load(true) }, CHAT_POLL_MS)
    return () => { alive = false; window.clearInterval(t) }
  }, [orderNumber])

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [rows.length])

  function jumpToLatest() {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
    setNewCount(0)
  }

  async function handleSend() {
    if (busy) return
    const guard = chatComposeGuard(draft)
    if (guard) { setErr(guard); return }
    setBusy(true)
    const r = await sendOrderMessage(orderNumber, draft, role)
    setBusy(false)
    if (!r.ok) { setErr(r.error || 'ส่งข้อความไม่สำเร็จ'); return }
    setDraft('')
    setErr('')
    setNewCount(0)
    await load(true)
  }

  return (
    <div className="mt-2 rounded-lg border border-brand-border bg-white p-2" data-testid="order-chat-panel">
      <div
        ref={listRef}
        className="max-h-48 overflow-y-auto space-y-1.5 py-1"
        data-testid="order-chat-list"
      >
        {rows.length === 0 && (
          <p className="text-xs text-brand-muted text-center py-2">ยังไม่มีข้อความ — พิมพ์ทักข้อความแรกได้เลย</p>
        )}
        {rows.map((m) => {
          const mine = m.sender_role === role
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-lg px-2.5 py-1.5 text-sm ${mine ? 'bg-orange-100 text-slate-900' : 'bg-slate-100 text-slate-800'}`}
                data-testid="order-chat-bubble"
              >
                {!mine && (
                  <span className="block text-[10px] font-bold text-brand-accent mb-0.5">
                    {CHAT_ROLE_LABELS[m.sender_role]}
                  </span>
                )}
                <span className="whitespace-pre-wrap break-words">{m.body}</span>
                <span className="block text-[10px] text-slate-400 mt-0.5 text-right">
                  {new Date(m.created_at).toLocaleString('th-TH', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                </span>
              </div>
            </div>
          )
        })}
      </div>
      {newCount > 0 && (
        <button
          type="button"
          onClick={jumpToLatest}
          className="w-full mt-1 text-xs rounded-full border border-brand-primary text-brand-primary bg-brand-primary/10 py-1"
          data-testid="order-chat-new-pill"
        >
          💬 มีข้อความใหม่ {newCount} ข้อความ — แตะเพื่อเลื่อนลงไปดู
        </button>
      )}
      {err && <p className="text-xs text-red-500 mt-1" data-testid="order-chat-error">{err}</p>}
      <div className="flex gap-2 mt-2">
        <input
          className="input flex-1 text-sm"
          placeholder={`พิมพ์ข้อความเป็น${CHAT_ROLE_LABELS[role]}…`}
          value={draft}
          maxLength={2000}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleSend() } }}
          data-testid="order-chat-input"
        />
        <button
          type="button"
          className="btn btn-primary btn-sm disabled:opacity-50"
          disabled={busy}
          onClick={() => void handleSend()}
          data-testid="order-chat-send"
        >
          {busy ? '⏳…' : 'ส่ง'}
        </button>
      </div>
    </div>
  )
}

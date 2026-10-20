// ============================================
// Bite Me Baby — Rider PWA (DEL-02: real drivers — migration 020/041/132)
// Driver logs in (Supabase Auth JWT) → sees real assignments via my_deliveries
// → accepts/declines → advances (picked_up → in_transit) → Delivered gated by
// geolocation + POD photo (uploaded + recorded server-side, A3).
//
// A1 (2026-10-20): polling งานใหม่ทุก ~25 วิ + ปุ่มรีเฟรชเอง + last-updated
//   + error/retry + เตือนงานใหม่ (badge + เสียง เปิด/ปิดได้) — ไม่ใช้ Realtime
//   (ทั้งแอปตั้งใจไม่ subscribe realtime — ดู src/lib/supabase.ts)
// A2: ปุ่มเปิดการแจ้งเตือน Push ฝั่งไรเดอร์ (audience='driver') + สถานะ permission
// A3: รูป POD upload ขึ้น bucket ส่วนตัว pod-photos + driver_attach_pod ก่อน
//   ยืนยันส่ง — ไม่มีทางปิดงานโดยไม่มีหลักฐานรูป (ERR_POD_REQUIRED ฝั่งเซิร์ฟเวอร์)
// A4: ปุ่มปฏิเสธงาน (assigned เท่านั้น) — งานคืนแอดมินมอบหมายใหม่
// A5: ทุก action คืนผลแบบมีเหตุผล (network/permission/state) + retry + กันกดซ้ำ
// PHASE 2: RiderMiniMap — จุดปักปลายทาง/ตำแหน่ง GPS/ครัว แยกชนิดชัดเจน
// ============================================

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { GlassCard } from '@/components/ui/GlassCard'
import { RiderPWA } from '@/components/dashboard/RiderPWA'
import { RiderMiniMap } from '@/components/rider/RiderMiniMap'
import {
  driverLogin,
  myDeliveriesResult,
  driverAcceptAssignment,
  driverUpdateDeliveryStatus,
  driverDeclineAssignment,
  driverAttachPod,
  uploadPodPhoto,
  type DriverRecord,
  type MyDeliveryAssignment,
  type DriverActionKind,
} from '@/lib/driverService'
import {
  enablePush,
  disablePush,
  getPushStatus,
  type PushPermissionState,
} from '@/lib/pushService'

const POLL_MS = 25_000 // A1: 20–30 วิ ตามที่กำหนด

const STATUS_LABEL: Record<string, string> = {
  assigned: '📩 รอรับงาน',
  accepted: '✅ รับงานแล้ว',
  picked_up: '🛵 รับอาหารแล้ว',
  in_transit: '🚗 กำลังเดินทาง',
  delivered: '🏠 ส่งสำเร็จ',
  declined: '🚫 ปฏิเสธแล้ว',
  cancelled: '⛔ ยกเลิกแล้ว',
}

const KIND_HINT: Record<DriverActionKind, string> = {
  network: ' (เครือข่าย — กดลองใหม่ได้)',
  permission: ' (สิทธิ์/เซสชัน — เข้าสู่ระบบใหม่)',
  state: ' (สถานะงานเปลี่ยนแล้ว — รีเฟรชรายการ)',
  unknown: ' (ติดต่อแอดมินหากเกิดซ้ำ)',
}

/** เสียงเตือนงานใหม่ — สร้างจาก WebAudio (ไม่ต้องโหลดไฟล์) */
function playBeep(enabled: boolean) {
  if (!enabled) return
  try {
    const Ctx = (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext
      ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 880
    gain.gain.value = 0.12
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.35)
    osc.onended = () => void ctx.close()
  } catch { /* เสียงเป็นของแถม — เงียบได้ไม่พัง */ }
}

export function RiderPwaPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [driver, setDriver] = useState<DriverRecord | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  // ADDENDUM #5: login แล้วแต่แอดมินยังไม่ link → ข้อความชัดเจน ไม่ใช่หน้าว่าง
  const [notLinked, setNotLinked] = useState(false)

  const [assignments, setAssignments] = useState<MyDeliveryAssignment[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [newJobPulse, setNewJobPulse] = useState<string | null>(null)
  const [soundOn, setSoundOn] = useState(() => {
    try { return localStorage.getItem('rider_sound_on') !== '0' } catch { return true }
  })

  const [busyOn, setBusyOn] = useState<string | null>(null)
  const [actionError, setActionError] = useState<{ order: string; error: string; kind: DriverActionKind } | null>(null)
  const [activeOrder, setActiveOrder] = useState<MyDeliveryAssignment | null>(null)
  const [deliverBusy, setDeliverBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const [pushState, setPushState] = useState<{
    supported: boolean
    permission: PushPermissionState
    subscribed: boolean
  } | null>(null)

  const inflightRef = useRef(false)
  const knownOrdersRef = useRef<Set<string>>(new Set())
  const firstPollDoneRef = useRef(false)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mountedRef = useRef(true)

  // ---------- A1: load + refresh (error state + new-job detection) ----------
  const refresh = useCallback(async (opts: { silent?: boolean } = {}) => {
    if (inflightRef.current) return // กัน polling ซ้อน
    inflightRef.current = true
    if (!opts.silent) setLoading(true)
    try {
      const r = await myDeliveriesResult()
      if (!mountedRef.current) return
      if (r.ok) {
        setAssignments(r.assignments)
        setLoadError(null)
        setLastUpdated(new Date())
        const firstLoad = !firstPollDoneRef.current
        firstPollDoneRef.current = true
        const fresh = r.assignments.filter(
          (a) => a.assignment_status === 'assigned' && !knownOrdersRef.current.has(a.order_number),
        )
        knownOrdersRef.current = new Set(r.assignments.map((a) => a.order_number))
        if (fresh.length > 0 && !firstLoad) {
          const first = fresh[0].order_number
          setNewJobPulse(fresh.length === 1 ? first : `${first} และอีก ${fresh.length - 1} งาน`)
          playBeep(soundOn)
          window.setTimeout(() => mountedRef.current && setNewJobPulse(null), 15_000)
        }
      } else {
        setLoadError(r.kind === 'permission' ? `${r.error} — เข้าสู่ระบบใหม่` : r.error)
      }
    } finally {
      inflightRef.current = false
      if (mountedRef.current && !opts.silent) setLoading(false)
    }
  }, [soundOn])

  // ---------- A1: polling — เฉพาะตอน login แล้ว, หยุดทันทีที่ logout/unmount ----------
  useEffect(() => {
    if (!driver) return
    void refresh({ silent: true })
    pollTimerRef.current = setInterval(() => void refresh({ silent: true }), POLL_MS)
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [driver, refresh])

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  // ---------- session restore (F-06): JWT → drivers.user_id เท่านั้น ----------
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (cancelled) return
      if (session) {
        const d = await driverLogin()
        if (cancelled) return
        if (d) setDriver(d)
        else setNotLinked(true) // ADDENDUM #5: login แล้วแต่ยังไม่ถูกผูก
      }
      setAuthChecked(true)
    })()
    return () => { cancelled = true }
  }, [])

  // ---------- A2: push status (เฉพาะอุปกรณ์/บัญชีนี้) ----------
  useEffect(() => {
    if (!driver) return
    void getPushStatus().then((s) => mountedRef.current && setPushState(s))
  }, [driver])

  async function doLogin(em = email, pw = password) {
    if (!em.trim() || !pw) return
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: em.trim(), password: pw })
      if (error) {
        setLoadError('เข้าสู่ระบบไม่สำเร็จ: ' + error.message)
        return
      }
      const d = await driverLogin()
      if (!d) {
        setNotLinked(true) // ข้อความแสดงในหน้า (ไม่ใช่ alert)
        return
      }
      setNotLinked(false)
      setDriver(d)
      setLoadError(null)
    } finally {
      setLoading(false)
    }
  }

  async function logout() {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    pollTimerRef.current = null
    await supabase.auth.signOut()
    setDriver(null)
    setAssignments([])
    setActiveOrder(null)
    setNotLinked(false)
    setActionError(null)
    knownOrdersRef.current = new Set()
    firstPollDoneRef.current = false
  }

  function toggleSound() {
    const next = !soundOn
    setSoundOn(next)
    try { localStorage.setItem('rider_sound_on', next ? '1' : '0') } catch { /* storage เต็ม — ข้าม */ }
  }

  // ---------- A5: helper กลางแสดง error ตาม kind + กันกดซ้ำด้วย busyOn ----------
  function showActionError(order: string, result: { ok: false; error: string; kind: DriverActionKind }) {
    setActionError({ order, error: result.error + KIND_HINT[result.kind], kind: result.kind })
  }

  async function accept(orderNumber: string) {
    if (!driver || busyOn) return
    setBusyOn(orderNumber)
    setActionError(null)
    try {
      const r = await driverAcceptAssignment(orderNumber)
      if (!r.ok) { showActionError(orderNumber, r); return }
      setNotice(`✅ รับงาน ${orderNumber} แล้ว`)
      void refresh({ silent: true })
    } finally {
      setBusyOn(null)
    }
  }

  async function decline(orderNumber: string) {
    if (!driver || busyOn) return
    const reason = window.prompt('เหตุผลที่ปฏิเสธงาน (เว้นว่างได้):', '') ?? ''
    setBusyOn(orderNumber)
    setActionError(null)
    try {
      const r = await driverDeclineAssignment(orderNumber, reason)
      if (!r.ok) { showActionError(orderNumber, r); return }
      setNotice(`🚫 ปฏิเสธงาน ${orderNumber} แล้ว — งานคืนสู่แอดมินเพื่อมอบหมายใหม่`)
      void refresh({ silent: true })
    } finally {
      setBusyOn(null)
    }
  }

  async function advance(orderNumber: string, status: 'picked_up' | 'in_transit') {
    if (!driver || busyOn) return
    setBusyOn(orderNumber)
    setActionError(null)
    try {
      const r = await driverUpdateDeliveryStatus(orderNumber, status)
      if (!r.ok) { showActionError(orderNumber, r); return }
      void refresh({ silent: true })
    } finally {
      setBusyOn(null)
    }
  }

  // ---------- A3: POD upload → attach → delivered (ทุกขั้นต้องผ่านก่อนปิดงาน) ----------
  const lastPhotoRef = useRef<{ order: string; file: File; coords: { latitude: number; longitude: number } } | null>(null)

  async function completeDelivery(orderNumber: string, photo: File, coords: { latitude: number; longitude: number }) {
    if (!driver || deliverBusy) return
    setDeliverBusy(true)
    setActionError(null)
    lastPhotoRef.current = { order: orderNumber, file: photo, coords }
    try {
      const up = await uploadPodPhoto(photo, driver.id, orderNumber)
      if (!up.ok) { showActionError(orderNumber, up); return }
      const att = await driverAttachPod(orderNumber, up.path, coords)
      if (!att.ok) { showActionError(orderNumber, att); return }
      const del = await driverUpdateDeliveryStatus(orderNumber, 'delivered', coords)
      if (!del.ok) { showActionError(orderNumber, del); return }
      setNotice(`🏠 ส่งมอบ ${orderNumber} สำเร็จ (บันทึกรูป POD แล้ว)`)
      setActiveOrder(null)
      lastPhotoRef.current = null
      void refresh({ silent: true })
    } finally {
      setDeliverBusy(false)
    }
  }

  function retryDeliver() {
    const last = lastPhotoRef.current
    if (!last) return
    void completeDelivery(last.order, last.file, last.coords) // พิกัดจริงจากรอบก่อน ไม่ใช่ค่าปลอม
  }

  // ---------- PHASE 2: GPS ของไรเดอร์สำหรับปักหมุดแผนที่ (มาจาก onCoordsChange จริง) ----------
  const [riderGps, setRiderGps] = useState<{ latitude: number; longitude: number } | null>(null)

  // ---------- A2: เปิด/ปิด push ฝั่งไรเดอร์ (audience='driver') ----------
  async function togglePush() {
    if (!pushState) return
    if (pushState.subscribed) {
      const r = await disablePush()
      setNotice(r.ok ? '🔕 ปิดการแจ้งเตือนบนอุปกรณ์นี้แล้ว' : 'ปิดการแจ้งเตือนไม่สำเร็จ: ' + r.error)
    } else {
      const r = await enablePush('driver')
      setNotice(r.ok ? '🔔 เปิดการแจ้งเตือนงานใหม่บนอุปกรณ์นี้แล้ว' : 'เปิดการแจ้งเตือนไม่สำเร็จ: ' + r.error)
    }
    const s = await getPushStatus()
    if (mountedRef.current) setPushState(s)
  }

  /** ADDENDUM #5: session ยังอยู่ — แค่ลอง link กับ driver record ใหม่ */
  async function retryLink() {
    const d = await driverLogin()
    if (d) {
      setNotLinked(false)
      setDriver(d)
      setLoadError(null)
    } else {
      setNotLinked(true)
    }
  }

  // A5: retry สำหรับ network failure — เก็บ action ล่าสุดไว้กดซ้ำได้
  const lastActionRef = useRef<(() => void) | null>(null)

  if (!authChecked) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center text-slate-500" data-testid="rider-auth-checking">
        ⏳ กำลังตรวจสอบสิทธิ์…
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-bold text-slate-800">🛵 งานจัดส่งของฉัน (Rider)</h1>

      {/* ADDENDUM #5 — login แล้วแต่แอดมินยังไม่ได้ผูกบัญชี: ข้อความชัดเจน ไม่ใช่หน้าว่าง */}
      {notLinked && (
        <GlassCard className="p-5 border-2 border-amber-400" data-testid="rider-not-linked">
          <p className="font-semibold text-amber-700 mb-1">⚠️ บัญชีนี้ยังไม่ถูกผูกกับโปรไฟล์ไรเดอร์</p>
          <p className="text-sm text-slate-600">
            เข้าสู่ระบบสำเร็จแล้ว แต่แอดมินยังไม่ได้เพิ่มคุณเป็นไรเดอร์ในระบบ —
            ติดต่อแอดมินให้ provision + ผูกบัญชี แล้วกด “ลองอีกครั้ง”
          </p>
          <div className="flex gap-2 mt-3">
            <button className="btn btn-outline text-sm" onClick={() => void retryLink()}>🔄 ลองอีกครั้ง</button>
            <button className="btn btn-outline text-sm" onClick={() => void logout()}>ออกจากระบบ</button>
          </div>
        </GlassCard>
      )}

      {/* ฟอร์มเข้าสู่ระบบ — บัญชีไรเดอร์ได้รับการผูกโดยแอดมินเท่านั้น (F-06) */}
      {!driver && !notLinked && (
        <GlassCard className="p-5">
          <p className="text-sm text-slate-600 mb-3">
            เข้าสู่ระบบด้วยอีเมล/รหัสผ่านของบัญชีที่แอดมินผูกกับโปรไฟล์ไรเดอร์แล้ว
          </p>
          <input
            className="input w-full mb-2" type="email" placeholder="อีเมล"
            value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username"
            data-testid="rider-email"
          />
          <input
            className="input w-full mb-3" type="password" placeholder="รหัสผ่าน"
            value={password} onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void doLogin()}
            autoComplete="current-password"
            data-testid="rider-password"
          />
          <button className="btn btn-primary w-full" disabled={loading} onClick={() => void doLogin()} data-testid="rider-login">
            {loading ? '⏳ กำลังเข้าสู่ระบบ…' : '🔓 เข้าสู่ระบบไรเดอร์'}
          </button>
          {loadError && (
            <p className="text-xs text-red-600 mt-2" data-testid="rider-login-error">{loadError}</p>
          )}
        </GlassCard>
      )}

      {/* ============ กระดานงาน (เฉพาะบัญชีที่ผูกไรเดอร์แล้ว) ============ */}
      {driver && (
        <>
          <GlassCard className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="font-semibold text-slate-800">👤 {driver.name}</p>
                <p className="text-xs text-slate-500">
                  สถานะ: {driver.status === 'available' ? '🟢 พร้อมรับงาน' : driver.status === 'busy' ? '🟠 มีงานอยู่' : '⚪ ออฟไลน์'}
                  {lastUpdated && ` · อัปเดตล่าสุด ${lastUpdated.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} น.`}
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button className="btn btn-outline text-xs" disabled={loading} onClick={() => void refresh()} data-testid="rider-refresh">
                  {loading ? '⏳ กำลังโหลด…' : '🔄 รีเฟรชงานของฉัน'}
                </button>
                <button className="btn btn-outline text-xs" onClick={toggleSound} data-testid="rider-sound-toggle">
                  {soundOn ? '🔔 เสียงเตือน: เปิด' : '🔕 เสียงเตือน: ปิด'}
                </button>
                <button className="btn btn-outline text-xs" onClick={() => void logout()}>ออกจากระบบ</button>
              </div>
            </div>

            {/* A2: push ฝั่งไรเดอร์ + สถานะ permission ตรงจริง */}
            {pushState && (
              <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between flex-wrap gap-2">
                <p className="text-xs text-slate-600">
                  📲 การแจ้งเตือนงานใหม่ (Push):
                  {pushState.permission === 'denied' && ' ถูกปฏิเสธในเบราว์เซอร์นี้ — ต้องเปิดสิทธิ์ในการตั้งค่าเบราว์เซอร์'}
                  {pushState.permission === 'unsupported' && ' เบราว์เซอร์นี้ไม่รองรับ — ใช้การโหลดงานอัตโนมัติแทน'}
                  {pushState.permission !== 'denied' && pushState.permission !== 'unsupported' && (pushState.subscribed ? ' เปิดอยู่บนอุปกรณ์นี้' : ' ยังไม่ได้เปิด')}
                </p>
                {pushState.supported && pushState.permission !== 'denied' && (
                  <button className="btn btn-outline text-xs" onClick={() => void togglePush()} data-testid="rider-push-toggle">
                    {pushState.subscribed ? '🔕 ปิดการแจ้งเตือน' : '🔔 เปิดการแจ้งเตือน'}
                  </button>
                )}
              </div>
            )}
          </GlassCard>

          {/* A1: เตือนงานใหม่ */}
          {newJobPulse && (
            <div className="p-3 rounded-xl border-2 border-green-400 bg-green-50 text-sm text-green-800" data-testid="rider-new-job">
              🆕 งานใหม่เข้า: 📦 {newJobPulse} — เลื่อนลงไปรับงานได้เลย
            </div>
          )}

          {/* ข้อความสำเร็จ */}
          {notice && (
            <div className="p-3 rounded-xl border-2 border-slate-300 bg-slate-50 text-sm text-slate-700 flex items-center justify-between gap-2">
              <span>{notice}</span>
              <button className="text-xs text-slate-500 underline" onClick={() => setNotice(null)}>ปิด</button>
            </div>
          )}

          {/* A1/A5: โหลดงานไม่สำเร็จ + retry */}
          {loadError && (
            <div className="p-3 rounded-xl border-2 border-red-300 bg-red-50 text-sm text-red-700" data-testid="rider-load-error">
              ⚠️ โหลดงานไม่สำเร็จ: {loadError}
              <button className="btn btn-outline text-xs ml-2" onClick={() => void refresh()}>🔄 ลองใหม่</button>
            </div>
          )}

          {/* ===== งานที่กำลังส่ง: แผนที่จุดปัก + ยืนยันส่ง (geo + POD) ===== */}
          {activeOrder ? (
            <GlassCard className="p-5">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-bold text-slate-800">📦 {activeOrder.order_number}</h3>
                <button className="btn btn-outline text-xs" onClick={() => setActiveOrder(null)}>← กลับไปที่รายการ</button>
              </div>
              <p className="text-sm text-slate-600 mb-2">
                สถานะ: {STATUS_LABEL[activeOrder.assignment_status] ?? activeOrder.assignment_status}
                {' · '}ชำระ: {activeOrder.payment_status === 'paid' ? '✅ แล้ว' : `⏳ ${activeOrder.payment_status}`}
              </p>
              <ul className="text-sm text-slate-700 mb-2">
                {activeOrder.items.map((it) => (
                  <li key={it.product_name}>• {it.product_name} × {it.quantity}</li>
                ))}
              </ul>
              <p className="text-xs text-slate-500 mb-1">📍 {activeOrder.dropoff_detail || 'ไม่มีรายละเอียดที่อยู่'}</p>

              {/* PHASE 2: แผนที่จุดปัก — ปลายทาง/คุณ(GPS)/ครัว แยกชนิดชัดเจน */}
              {activeOrder.dropoff_latitude != null && activeOrder.dropoff_longitude != null ? (
                <>
                  <RiderMiniMap
                    dropOff={{ latitude: Number(activeOrder.dropoff_latitude), longitude: Number(activeOrder.dropoff_longitude) }}
                    rider={riderGps}
                  />
                  <RiderPWA
                    dropOff={{ latitude: Number(activeOrder.dropoff_latitude), longitude: Number(activeOrder.dropoff_longitude) }}
                    busy={deliverBusy}
                    onCoordsChange={setRiderGps}
                    onDelivered={(photo, coords) => void completeDelivery(activeOrder.order_number, photo, coords)}
                  />
                </>
              ) : (
                <p className="text-xs text-amber-600">ออเดอร์นี้ไม่มีพิกัดปลายทาง — ยืนยันส่งไม่ได้ (แจ้งแอดมิน)</p>
              )}

              {actionError?.order === activeOrder.order_number && (
                <div className="mt-3 p-3 rounded-xl border-2 border-red-300 bg-red-50 text-xs text-red-700">
                  ⚠️ {actionError.error}
                  {actionError.kind === 'network' && lastPhotoRef.current && (
                    <button className="btn btn-outline text-xs ml-2" onClick={() => retryDeliver()} data-testid="rider-retry-deliver">
                      🔄 ลองยืนยันส่งอีกครั้ง
                    </button>
                  )}
                </div>
              )}
            </GlassCard>
          ) : (
            <div className="space-y-3">
              {assignments.length === 0 && (
                <GlassCard className="p-5 text-center text-slate-500" data-testid="rider-empty">
                  ยังไม่มีงานที่ได้รับมอบหมาย — งานใหม่จะโหลดอัตโนมัติทุก ~25 วินาที
                </GlassCard>
              )}
              {assignments.map((a) => (
                <GlassCard key={a.order_number} className="p-4" data-testid={`rider-job-${a.order_number}`}>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-bold text-slate-800">📦 {a.order_number}</h3>
                    <span className="text-xs text-slate-500">{STATUS_LABEL[a.assignment_status] ?? a.assignment_status}</span>
                  </div>
                  <ul className="text-sm text-slate-700 mb-2">
                    {a.items.map((it) => (
                      <li key={it.product_name}>• {it.product_name} × {it.quantity}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-slate-500 mb-3">📍 {a.dropoff_detail || '—'}</p>
                  {actionError?.order === a.order_number && (
                    <div className="mb-2 p-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                      ⚠️ {actionError.error}
                    </div>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    {a.assignment_status === 'assigned' && (
                      <>
                        <button
                          className="btn btn-primary text-xs"
                          disabled={busyOn === a.order_number}
                          onClick={() => { lastActionRef.current = () => void accept(a.order_number); void accept(a.order_number) }}
                          data-testid="rider-accept"
                        >
                          {busyOn === a.order_number ? '⏳…' : '✅ รับงาน'}
                        </button>
                        <button
                          className="btn btn-outline text-xs"
                          disabled={busyOn === a.order_number}
                          onClick={() => { lastActionRef.current = () => void decline(a.order_number); void decline(a.order_number) }}
                          data-testid="rider-decline"
                        >
                          🚫 ปฏิเสธงาน
                        </button>
                      </>
                    )}
                    {a.assignment_status === 'accepted' && (
                      <button
                        className="btn btn-outline text-xs"
                        disabled={busyOn === a.order_number}
                        onClick={() => { lastActionRef.current = () => void advance(a.order_number, 'picked_up'); void advance(a.order_number, 'picked_up') }}
                      >
                        🛵 รับอาหารแล้ว
                      </button>
                    )}
                    {a.assignment_status === 'picked_up' && (
                      <button
                        className="btn btn-outline text-xs"
                        disabled={busyOn === a.order_number}
                        onClick={() => { lastActionRef.current = () => void advance(a.order_number, 'in_transit'); void advance(a.order_number, 'in_transit') }}
                      >
                        🚗 กำลังเดินทาง
                      </button>
                    )}
                    {['assigned', 'accepted', 'picked_up', 'in_transit'].includes(a.assignment_status) && (
                      <button className="btn btn-outline text-xs" onClick={() => setActiveOrder(a)}>
                        📸 ยืนยันส่ง (geo + POD)
                      </button>
                    )}
                  </div>
                </GlassCard>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
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
import { haversineDistanceKm } from '@/lib/deliveryRouter'
import { RiderMiniMap } from '@/components/rider/RiderMiniMap'
import {
  driverLogin,
  myDeliveriesResult,
  driverAcceptAssignment,
  driverUpdateDeliveryStatus,
  driverDeclineAssignment,
  claimDispatchOffer,
  driverDeclineOffer,
  driverUpdateLocation,
  driverAttachPod,
  driverCheckinArrival,
  uploadPodPhoto,
  classifyDriverError,
  type DriverRecord,
  type MyDeliveryAssignment,
  type DriverActionKind,
} from '@/lib/driverService'
import { fetchAddressPhotoPath, getAddressPhotoUrl } from '@/lib/addressPhoto'
import { planMultiStopRoute, googleMapsDirUrl, toPlanStops } from '@/lib/deliveryPlan'
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
  arrived: '🏁 ถึงปลายทาง', // R13: assignment เป็น arrived แล้ว — ห้ามโชว์ค้าง "กำลังเดินทาง"
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
  // E1 (2026-10-22): งานประกาศที่ยังไม่มีใครจอง (dispatch_offers ผ่าน my_deliveries)
  // — "คนแรกรับ = จอง" ต้องเห็นทันทีทุกเครื่องที่ผูกบัญชี
  const [offers, setOffers] = useState<MyDeliveryAssignment[]>([])
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
        setOffers(r.offers ?? [])
        setLoadError(null)
        setLastUpdated(new Date())
        const firstLoad = !firstPollDoneRef.current
        firstPollDoneRef.current = true
        // E1: งานประกาศใหม่ = งานใหม่สำหรับไรเดอร์คนนี้ด้วย (เดิมนับเฉพาะ assigned)
        const fresh = [
          ...r.assignments.filter(
            (a) => a.assignment_status === 'assigned' && !knownOrdersRef.current.has(a.order_number),
          ),
          ...(r.offers ?? []).filter((o) => !knownOrdersRef.current.has(o.order_number)),
        ]
        knownOrdersRef.current = new Set([...r.assignments, ...(r.offers ?? [])].map((a) => a.order_number))
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
    // R3 (D-07): refresh ทันทีที่กลับเข้าหน้า (โปรเจกต์ไม่ใช้ realtime — polling/focus เท่านั้น)
    const onFocus = () => { if (!document.hidden) void refresh({ silent: true }) }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
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

  // E1: รับงานประกาศ = จองคนเดียว (atomic — คนแรกได้ คนที่เหลือเจอ "งานถูกจองแล้ว")
  async function claimOffer(orderNumber: string) {
    if (!driver || busyOn) return
    setBusyOn(orderNumber)
    setActionError(null)
    try {
      const r = await claimDispatchOffer(orderNumber)
      if (!r.ok) { showActionError(orderNumber, r); return }
      setNotice(`✅ จองงาน ${orderNumber} สำเร็จ — เริ่มส่งได้เลย`)
      void refresh({ silent: true })
    } finally {
      setBusyOn(null)
    }
  }

  // E1: ไม่รับงานประกาศ (ต่อคน — คนอื่นยังเห็น/รับได้จนกว่าจะมีคนจอง)
  async function declineOffer(orderNumber: string) {
    if (!driver || busyOn) return
    setBusyOn(orderNumber)
    setActionError(null)
    try {
      const r = await driverDeclineOffer(orderNumber)
      if (!r.ok) { showActionError(orderNumber, r); return }
      setNotice(`🚫 ไม่รับงานประกาศ ${orderNumber} — งานยังเปิดให้เพื่อนรับได้`)
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
  // R3 (D-02/D-07): progress รายขั้นตอน — ผู้ใช้ต้องเห็นว่าค้างที่ upload/attach/ปิดงาน
  const [deliverStep, setDeliverStep] = useState<'upload' | 'attach' | 'finalize' | null>(null)

  async function completeDelivery(orderNumber: string, photo: File, coords: { latitude: number; longitude: number }) {
    if (!driver || deliverBusy) return
    setDeliverBusy(true)
    setActionError(null)
    lastPhotoRef.current = { order: orderNumber, file: photo, coords }
    try {
      setDeliverStep('upload')
      const up = await uploadPodPhoto(photo, driver.id, orderNumber)
      if (!up.ok) { showActionError(orderNumber, up); return }
      setDeliverStep('attach')
      const att = await driverAttachPod(orderNumber, up.path, coords)
      if (!att.ok) { showActionError(orderNumber, att); return }
      setDeliverStep('finalize')
      const del = await driverUpdateDeliveryStatus(orderNumber, 'delivered', coords)
      if (!del.ok) { showActionError(orderNumber, del); return }
      setNotice(`🏠 ส่งมอบ ${orderNumber} สำเร็จ (บันทึกรูป POD แล้ว) — จบงานแล้ว กลับหน้าหลัก`)
      setActiveOrder(null)
      lastPhotoRef.current = null
      // R13 (Owner 2026-10-28): จบลูป = ออกไปหน้าจอหลักอัตโนมัติ (เลื่อนกลับบนสุด)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      void refresh({ silent: true })
    } catch (e) {
      // R10 (Owner 2026-10-27): เดิมไม่มี catch — error ระหว่าง upload/attach/ปิดงาน
      // หายเงียบ (unhandled rejection) = อาการ "กดยืนยันแล้วไม่มีอะไรเกิดขึ้น สถานะค้าง"
      showActionError(orderNumber, { ok: false, ...classifyDriverError(e) })
    } finally {
      setDeliverBusy(false)
      setDeliverStep(null)
    }
  }

  function retryDeliver() {
    const last = lastPhotoRef.current
    if (!last) return
    void completeDelivery(last.order, last.file, last.coords) // พิกัดจริงจากรอบก่อน ไม่ใช่ค่าปลอม
  }

  async function checkinArrival(orderNumber: string, coords: { latitude: number; longitude: number }) {
    if (!driver) return
    const r = await driverCheckinArrival(orderNumber, coords)
    if (!r.ok) { showActionError(orderNumber, r); return }
    setNotice(`🏁 เช็คตำแหน่งในพื้นที่สำเร็จ — สถานะเป็น "ถึงปลายทาง" แล้ว`)
    void refresh({ silent: true })
  }

  // ---------- PHASE 2: GPS ของไรเดอร์สำหรับปักหมุดแผนที่ (มาจาก onCoordsChange จริง) ----------
  const [riderGps, setRiderGps] = useState<{ latitude: number; longitude: number } | null>(null)

  // ---------- R10 (Owner 2026-10-27): รูปที่อยู่ที่ลูกค้าแนบไว้ — โชว์บนหน้างาน ----------
  const [addrPhotoUrl, setAddrPhotoUrl] = useState<string | null>(null)
  const addrPhotoOrder = activeOrder?.order_number ?? null
  useEffect(() => {
    if (!addrPhotoOrder) { setAddrPhotoUrl(null); return }
    let cancelled = false
    void (async () => {
      const p = await fetchAddressPhotoPath(addrPhotoOrder)
      if (cancelled) return
      setAddrPhotoUrl(p ? await getAddressPhotoUrl(p) : null)
    })()
    return () => { cancelled = true }
  }, [addrPhotoOrder])

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

  // E3 (2026-10-22): GPS heartbeat — ส่งตำแหน่งจริงทุก 30 วิ (10 วิระหว่างมีงาน
  // กำลังส่ง) → drivers.current_* + driver_location_history (136) → แอดมินเห็น
  // วิ่งจริงบนแผนที่ Dispatch และดูเส้นทางย้อนหลังตอนจบงาน
  useEffect(() => {
    if (!driver) return
    let stopped = false
    const send = () => {
      if (stopped || typeof navigator === 'undefined' || !('geolocation' in navigator)) return
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (stopped) return
          void driverUpdateLocation(
            { latitude: pos.coords.latitude, longitude: pos.coords.longitude },
            activeOrder?.order_number,
          )
        },
        () => { /* heartbeat เงียบได้ — ไม่เด้ง error ทุกไม้ */ },
        { enableHighAccuracy: true, timeout: 10000 },
      )
    }
    send()
    const t = window.setInterval(send, activeOrder ? 10_000 : 30_000)
    return () => { stopped = true; window.clearInterval(t) }
  }, [driver, activeOrder?.order_number])

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

          {/* R16 (Owner 2026-10-28): งานหลายใบ — เส้นทาง+จุดส่งคำนวณให้ (nearest-neighbour) + แผนที่รวมจุดส่ง */}
          {(() => {
            const activeJobs = assignments.filter((a) => ['assigned', 'accepted', 'picked_up', 'in_transit', 'arrived'].includes(String(a.assignment_status)))
            const stops = toPlanStops(activeJobs)
            if (stops.length === 0) return null
            const origin = riderGps
              ?? (driver?.current_latitude != null && driver?.current_longitude != null
                ? { latitude: Number(driver.current_latitude), longitude: Number(driver.current_longitude) }
                : null)
            const plan = planMultiStopRoute(origin, stops)
            const dirUrl = googleMapsDirUrl(origin, plan.stops)
            return (
              <GlassCard className="p-4" data-testid="rider-route-plan">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                  <h3 className="font-bold text-slate-800">
                    🗺️ เส้นทางส่งของวันนี้ ({plan.stops.length} จุด{activeJobs.length > stops.length ? ` + ${activeJobs.length - stops.length} งานไม่มีพิกัด` : ''})
                  </h3>
                  {dirUrl ? (
                    <a className="btn btn-primary text-xs" href={dirUrl} target="_blank" rel="noreferrer" data-testid="rider-open-gmaps">
                      🧭 เปิดนำทาง Google Maps
                    </a>
                  ) : null}
                </div>
                <ol className="text-sm text-slate-700 mb-2 space-y-1">
                  {plan.stops.map((s, i) => (
                    <li key={s.order_number} data-testid={`rider-route-stop-${s.order_number}`}>
                      <b>จุด {i + 1}</b> · #{s.order_number}
                      {s.detail ? ` — ${s.detail}` : ''}
                      <span className="text-xs text-brand-muted"> · {plan.legKm[i]?.toFixed(2)} กม.</span>
                    </li>
                  ))}
                </ol>
                <p className="text-xs text-slate-500 mb-1">
                  รวม ≈ <b>{plan.totalKm.toFixed(2)} กม.</b>
                  {plan.noOrigin ? ' · ยังไม่มีตำแหน่งคุณ — คงลำดับเดิม (ไม่เดา)' : ' · เรียงจากจุดใกล้ที่สุด (คำนวณในเครื่อง)'}
                </p>
                <RiderMiniMap
                  dropOff={{ latitude: plan.stops[0].latitude, longitude: plan.stops[0].longitude }}
                  rider={riderGps}
                  stops={plan.stops}
                />
              </GlassCard>
            )
          })()}

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
                  {/* R10: รูปหน้าบ้าน/ที่อยู่ที่ลูกค้าแนบไว้ — ช่วยไรเดอร์หาจุดส่ง */}
                  {addrPhotoUrl && (
                    <div className="mb-3" data-testid="rider-address-photo">
                      <p className="text-xs font-semibold text-slate-600 mb-1">📸 รูปที่อยู่จากลูกค้า</p>
                      <img src={addrPhotoUrl} alt="รูปที่อยู่ลูกค้า" className="rounded-xl border max-h-48 object-cover" />
                    </div>
                  )}
                  <PodDeliveryPanel
                    dropOff={{ latitude: Number(activeOrder.dropoff_latitude), longitude: Number(activeOrder.dropoff_longitude) }}
                    busy={deliverBusy}
                    busyLabel={deliverStep === 'upload' ? '📤 กำลังอัปโหลดรูป POD…' : deliverStep === 'attach' ? '🔗 กำลังบันทึกหลักฐาน…' : deliverStep === 'finalize' ? '✅ กำลังปิดงาน…' : '⏳ กำลังบันทึก…'}
                    onCoordsChange={setRiderGps}
                    onArrived={(coords) => void checkinArrival(activeOrder.order_number, coords)}
                    onDelivered={(photo, coords) => void completeDelivery(activeOrder.order_number, photo, coords)}
                  />
                </>
              ) : (
                <p className="text-xs text-amber-600">ออเดอร์นี้ไม่มีพิกัดปลายทาง — ยืนยันส่งไม่ได้ (แจ้งแอดมิน)</p>
              )}

              {actionError?.order === activeOrder.order_number && (
                <div className="mt-3 p-3 rounded-xl border-2 border-red-300 bg-red-50 text-xs text-red-700">
                  ⚠️ {actionError.error}
                  {/* R3 (D-02): retry สำหรับทุกความล้มเหลวที่ลองซ้ำได้ (ยกเว้น state =
                      ไฟล์/ข้อมูลไม่ถูกต้อง ต้องเลือกใหม่) */}
                  {actionError.kind !== 'state' && lastPhotoRef.current && (
                    <button className="btn btn-outline text-xs ml-2" onClick={() => retryDeliver()} data-testid="rider-retry-deliver">
                      🔄 ลองยืนยันส่งอีกครั้ง
                    </button>
                  )}
                </div>
              )}
            </GlassCard>
          ) : (
            <div className="space-y-3">
          {/* ===== E1: งานประกาศใหม่ (dispatch_offers) — คนแรกรับ = จองคนเดียว ===== */}
          {!activeOrder && offers.length > 0 && (
            <div className="space-y-3" data-testid="rider-offers">
              <h2 className="text-sm font-semibold text-slate-700">📣 งานประกาศใหม่ ({offers.length}) — ใครรับก่อนได้ก่อน</h2>
              {offers.map((o) => (
                <GlassCard key={`offer-${o.order_number}`} className="p-4 border-2 border-amber-300" data-testid={`rider-offer-${o.order_number}`}>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-bold text-slate-800">📦 {o.order_number}</h3>
                    <span className="text-xs text-amber-600 font-semibold">📣 งานประกาศ — ยังไม่มีใครจอง</span>
                  </div>
                  <ul className="text-sm text-slate-700 mb-2">
                    {o.items.map((it) => (
                      <li key={it.product_name}>• {it.product_name} × {it.quantity}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-slate-500 mb-3">📍 {o.dropoff_detail || '—'}</p>
                  {actionError?.order === o.order_number && (
                    <div className="mb-2 p-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                      ⚠️ {actionError.error}
                    </div>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    <button
                      className="btn btn-primary text-xs"
                      disabled={busyOn === o.order_number}
                      onClick={() => { lastActionRef.current = () => void claimOffer(o.order_number); void claimOffer(o.order_number) }}
                      data-testid="rider-claim-offer"
                    >
                      {busyOn === o.order_number ? '⏳…' : '🙋 รับงานนี้'}
                    </button>
                    <button
                      className="btn btn-outline text-xs"
                      disabled={busyOn === o.order_number}
                      onClick={() => { lastActionRef.current = () => void declineOffer(o.order_number); void declineOffer(o.order_number) }}
                      data-testid="rider-decline-offer"
                    >
                      🚫 ไม่รับ
                    </button>
                  </div>
                </GlassCard>
              ))}
            </div>
          )}

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

// ============================================
// PodDeliveryPanel (M3 · 2026-10-22) — ดูดมาจาก Rider PWA component เดิม (ลบไฟล์ซ้ำแล้ว)
// ============================================
// แผ่นยืนยันส่งมอบ: ตรวจพิกัด (ต้องอยู่ในรัศมีปลายทาง) + ถ่ายรูป POD (บังคับ)
// ก่อนกด "ยืนยันส่งสำเร็จ" — gates ฝั่งเครื่องช่วยให้ถ่ายทัน แต่ตัวจริงที่บังคับคือ
// server (driver_update_delivery_status + ERR_POD_REQUIRED, 132) — ไม่มีสถานะ
// จำลองใน component นี้ (สถานะจริงอยู่ที่ assignment_status ที่แสดงด้านบน)
// (ใช้ import React/hooks จากหัวไฟล์เดียวกัน — ไม่มี import ซ้ำ)

export function PodDeliveryPanel({ dropOff, radiusMeters = 300, onDelivered, onArrived, busy = false, busyLabel, onCoordsChange }: {
  dropOff: { latitude: number; longitude: number }
  radiusMeters?: number
  onDelivered?: (photo: File, coords: { latitude: number; longitude: number }) => void | Promise<void>
  /** R11: เช็คพิกัดในรัศมี → แจ้ง parent ยิง driver_checkin_arrival (สถานะ 'ถึงปลายทาง') */
  onArrived?: (coords: { latitude: number; longitude: number }) => void | Promise<void>
  busy?: boolean
  /** R3 (D-02): ป้าย progress รายขั้นตอน (upload → attach → ปิดงาน) */
  busyLabel?: string
  onCoordsChange?: (coords: { latitude: number; longitude: number }) => void
}) {
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [podUrl, setPodUrl] = useState<string | null>(null)
  const [podFile, setPodFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  function checkIn() {
    if (!('geolocation' in navigator)) {
      setGeoError('เบราว์เซอร์ไม่รองรับ Geolocation API')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { latitude: pos.coords.latitude, longitude: pos.coords.longitude }
        setCoords(c)
        setGeoError(null)
        onCoordsChange?.(c)
        // R11: อยู่ในรัศมี = เช็คอินสำเร็จ → แจ้ง parent ให้เดินสถานะถึง 'ถึงปลายทาง'
        // (server ตรวจ geofence ซ้ำอีกชั้น — ฝั่งเครื่องเป็นแค่ gate ช่วยถ่ายทัน)
        const dKm = haversineDistanceKm(c.latitude, c.longitude, dropOff.latitude, dropOff.longitude)
        if (dKm * 1000 <= radiusMeters) void onArrived?.(c)
      },
      (err) => setGeoError(`อ่านพิกัดไม่สำเร็จ: ${err.message}`),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/') || file.size > 15 * 1024 * 1024) {
      setGeoError('ไฟล์ต้องเป็นรูปภาพไม่เกิน 15MB')
      return
    }
    setPodFile(file)
    const reader = new FileReader()
    reader.onload = () => setPodUrl(reader.result as string) // preview เท่านั้น — ของจริง upload ตอนยืนยัน
    reader.readAsDataURL(file)
  }

  // Distance to the drop-off (m). Coords absent ⇒ cannot verify ⇒ gate blocked.
  const distanceM = coords ? haversineDistanceKm(coords.latitude, coords.longitude, dropOff.latitude, dropOff.longitude) * 1000 : null
  const geoOk = coords !== null && distanceM !== null && distanceM <= radiusMeters

  function handleDeliver() {
    if (!geoOk || !podFile || !coords || busy) return
    void onDelivered?.(podFile, coords)
  }

  return (
    <GlassCard className="p-5">
      <h4 className="text-sm font-semibold text-slate-700 mb-2">1. เช็คอินตำแหน่งปลายทาง</h4>
      <button onClick={checkIn} className="btn btn-outline text-sm mb-2" data-testid="rider-checkin">
        📍 ตรวจพิกัดปัจจุบัน
      </button>
      {coords && (
        <p className="text-xs text-slate-600 mb-1">
          พิกัด: {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}{' '}
          · ห่างปลายทาง {distanceM !== null ? Math.round(distanceM) : '-'} ม.
        </p>
      )}
      {geoError && <p className="text-xs text-red-600 mb-1">{geoError}</p>}
      {coords && !geoOk && (
        <p className="text-xs text-amber-600 mb-2">⚠️ ยังอยู่นอกระยะ {radiusMeters} ม. — ยืนยันส่งไม่ได้</p>
      )}
      {geoOk && <p className="text-xs text-green-600 mb-2">✅ อยู่ในระยะที่กำหนด ตรวจพิกัดผ่านแล้ว</p>}

      <h4 className="text-sm font-semibold text-slate-700 mb-2 mt-3">2. ถ่าย/เลือกรูป proof of delivery (POD)</h4>
      {/* R3 (D-02 ข): แยกปุ่ม "ถ่ายรูป" (กล้อง) กับ "เลือกรูปจากเครื่อง" (แกลเลอรี่) —
          เดิมมีแค่ capture="environment" = บังคับกล้องอย่างเดียว */}
      <div className="flex flex-wrap gap-2 mb-2">
        <button type="button" onClick={() => fileRef.current?.click()} className="btn btn-outline text-xs" data-testid="rider-pod-camera">
          📷 ถ่ายรูป
        </button>
        <button type="button" onClick={() => galleryRef.current?.click()} className="btn btn-outline text-xs" data-testid="rider-pod-gallery">
          🖼️ เลือกรูปจากเครื่อง
        </button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onPickPhoto} className="hidden" data-testid="rider-pod-input" />
      <input ref={galleryRef} type="file" accept="image/*" onChange={onPickPhoto} className="hidden" data-testid="rider-pod-gallery-input" />
      {podUrl && <img src={podUrl} alt="Proof of delivery" className="w-32 h-32 object-cover rounded-xl mb-2" />}

      <button
        onClick={handleDeliver}
        disabled={!geoOk || !podFile || busy}
        className="btn btn-primary w-full mt-3 disabled:opacity-50 disabled:cursor-not-allowed"
        data-testid="rider-deliver"
      >
        {busy ? (busyLabel || '⏳ กำลังบันทึก…') : !geoOk ? '⛔ ตรวจพิกัดก่อนส่ง' : !podFile ? '📸 ถ่าย/เลือกรูป POD ก่อนส่ง' : '✅ ยืนยันส่งสำเร็จ (POD)'}
      </button>
    </GlassCard>
  )
}
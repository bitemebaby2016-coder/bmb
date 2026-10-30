import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore, fetchProfileRole, describeLoginError, restoreProfileAddress } from '@/store/authStore'
import { useLocationStore, KITCHEN_LAT, KITCHEN_LNG } from '@/store/locationStore'
import { getGpsLocation, uploadDeliveryPhoto, saveDeliveryProfile, sendQuickLoginOtp } from '@/lib/locationLogin'
import { showToast } from '@/components/ui/ToastContainer'
import { sendPasswordReset } from '@/lib/authRecovery'
// P3 — Facebook Login
import { signInWithFacebook, signInWithSocial, consumeSocialCallbackError, describeSocialError, readSocialNext } from '@/lib/socialLogin'
// P4 — Passkey / WebAuthn
import { signInWithPasskey, describePasskeyError, isPasskeySupported } from '@/lib/passkeyLogin'
import { writeAuditLog } from '@/lib/auditLog'

// จำข้อมูล Quick login ครั้งเดียวใช้ตลอด (localStorage — รอบหน้ากรอกให้อัตโนมัติ)
const QUICK_PROFILE_KEY = 'bmb_quick_profile'
interface QuickProfile { name: string; phone: string; address: string; photoUrl: string }
function loadQuickProfile(): QuickProfile {
  try {
    const raw = localStorage.getItem(QUICK_PROFILE_KEY)
    if (!raw) return { name: '', phone: '', address: '', photoUrl: '' }
    const p = JSON.parse(raw)
    return {
      name: String(p.name || ''),
      phone: String(p.phone || ''),
      address: String(p.address || ''),
      photoUrl: String(p.photoUrl || ''),
    }
  } catch {
    return { name: '', phone: '', address: '', photoUrl: '' }
  }
}
function saveQuickProfile(p: QuickProfile) {
  try { localStorage.setItem(QUICK_PROFILE_KEY, JSON.stringify(p)) } catch { /* ignore */ }
}

export function LoginPage() {
  const navigate = useNavigate()
  const routerLocation = useLocation()
  // Launch-closure (case B/D): กลับไปหน้าที่ผู้ใช้ตั้งใจ (ProtectedRoute/Checkout ส่งมา)
  const returnTo =
    (routerLocation.state as { from?: string } | null)?.from ||
    readSocialNext() || null
  const login = useAuthStore((s) => s.login)
  const loginByLocation = useAuthStore((s) => s.loginByLocation)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isInitializing = useAuthStore((s) => s.isInitializing)
  const [mode, setMode] = useState<'email' | 'quick'>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [qName, setQName] = useState('')
  const [qPhone, setQPhone] = useState('')
  const [qAddress, setQAddress] = useState('')
  const [locationBadge, setLocationBadge] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isLocating, setIsLocating] = useState(false)
  const [error, setError] = useState('')

  // P1 / SF-04 — ลืมรหัสผ่าน (ไม่มีในระบบมาก่อน 2026-10-12)
  const [isForgot, setIsForgot] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [isSendingReset, setIsSendingReset] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  // P0 (Owner OD-1) — OTP ยืนยันการควบคุมเบอร์ก่อนเข้าสู่ระบบด่วน
  const [otpCode, setOtpCode] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [isSendingOtp, setIsSendingOtp] = useState(false)
  const [otpMasked, setOtpMasked] = useState('')
  // รูปสถานที่จัดส่ง (Owner feature 2026-10-08)
  const [qPhotoFile, setQPhotoFile] = useState<File | null>(null)
  const [qPhotoPreview, setQPhotoPreview] = useState<string>('') // objectURL หรือ URL เดิม
  const [qPhotoUrl, setQPhotoUrl] = useState<string>('') // URL ที่บันทึกไว้ในระบบแล้ว
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const qPhotoInputRef = useRef<HTMLInputElement>(null)

  // โหลดข้อมูลที่เคยกรอกไว้ (ให้ข้อมูลครั้งเดียวแล้วระบบจำตลอด)
  useEffect(() => {
    const saved = loadQuickProfile()
    if (saved.name) setQName(saved.name)
    if (saved.phone) setQPhone(saved.phone)
    if (saved.address) setQAddress(saved.address)
    if (saved.photoUrl) { setQPhotoUrl(saved.photoUrl); setQPhotoPreview(saved.photoUrl) }
  }, [])

  // Launch-closure (case A): มี session อยู่แล้ว → ไม่ต้องเห็นฟอร์ม login ซ้ำ
  // (รอ isInitializing เสร็จก่อนกัน redirect ผิดจังหวะตอน restore session)
  useEffect(() => {
    if (!isInitializing && isAuthenticated) {
      // R25 (Owner): เคยล็อกอินแล้ว → เข้า /shop เลย (เดิมไป '/' = หน้า TalkToBite)
      navigate(returnTo || '/shop', { replace: true })
    }
  }, [isInitializing, isAuthenticated, returnTo, navigate])

  // P3 — จับ error จาก OAuth callback (Facebook) แล้วแปลเป็นภาษาไทย
  // (เกิดขึ้นตอน user กด "ยกเลิก" หรือ Facebook ปฏิเสธสิทธิ์)
  useEffect(() => {
    const code = consumeSocialCallbackError()
    if (code) setError(describeSocialError(code))
  }, [])

  // Redirect after login based on DB role + กลับหน้าที่ผู้ใช้ตั้งใจ (case B/D)
  async function finishLogin(userLabel: string) {
    const role = await fetchProfileRole()
    // case D: คืนข้อความที่อยู่ที่บันทึกไว้ในโปรไฟล์ (best-effort, ไม่บล็อก login)
    void restoreProfileAddress()
    writeAuditLog({
      action: 'user_login',
      entity_type: 'user',
      entity_id: userLabel,
      description: userLabel + ' - login success',
    })
    showToast('เข้าสู่ระบบสำเร็จ!', 'success')
    // A3 (R21): returnTo (case B/D — deep-link ที่ถูกเด้งมา login) มาก่อนเสมอ
    // เดิมบังคับ admin ไป /admin เสมอจน deep-link ของแอดมินเช่น /admin/orders?tab=x หาย
    navigate(returnTo || (role === 'admin' ? '/admin' : '/shop'), { replace: true })
  }

  // P1 / SF-04 — ส่งลิงก์ตั้งรหัสผ่านใหม่ (กัน enumeration: ตอบสำเร็จเสมอถ้าอีเมลไม่มีในระบบ)
  async function handleSendReset(e: React.FormEvent) {
    e.preventDefault()
    if (isSendingReset) return
    setIsSendingReset(true)
    setError('')
    const res = await sendPasswordReset(forgotEmail)
    setIsSendingReset(false)
    if (!res.ok) {
      setError('ส่งลิงก์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
      return
    }
    setResetSent(true)
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      // P0-2: login through Supabase Auth (not localStorage users)
      const ok = await login(email, password)
      if (!ok) {
        // Show the REAL reason (email not confirmed / wrong password / rate limit)
        // instead of a blanket "Invalid email or password".
        setError(describeLoginError(useAuthStore.getState().lastLoginError))
        setIsLoading(false)
        return
      }
      await finishLogin(email)
    } catch (err) {
      console.error('Login error:', err)
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    } finally {
      setIsLoading(false)
    }
  }

  // เลือก/ถ่ายรูปสถานที่จัดส่ง (หน้าบ้าน เลขที่บ้าน ฯลฯ)
  function handlePhotoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { showToast('กรุณาเลือกไฟล์รูปภาพ', 'error'); return }
    if (file.size > 8 * 1024 * 1024) { showToast('รูปภาพต้องมีขนาดไม่เกิน 8 MB', 'error'); return }
    setQPhotoFile(file)
    setQPhotoPreview((prev) => {
      if (prev.startsWith('blob:')) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
  }

  // เข้าสู่ระบบด่วน — ชื่อ + เบอร์โทร + ตำแหน่ง (Edge Function phone-auto-login)
  // P0 (Owner OD-1) — ขอยรหัส OTP (ไม่ออก session ใด ๆ — ยืนยันแค่การควบคุมเบอร์)
  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault()
    if (isSendingOtp) return
    setError('')
    setIsSendingOtp(true)
    const res = await sendQuickLoginOtp(qPhone)
    setIsSendingOtp(false)
    if (!res.ok) {
      setError(
        res.error === 'ERR_RATE_LIMITED'
          ? 'ขอรหัสยืนยันบ่อยเกินไป — กรุณารอสักครู่แล้วลองใหม่'
          : res.error === 'ERR_TIMEOUT'
          ? 'ระบบช้าเกินไป — ตรวจสอบเน็ตเวิร์กแล้วลองใหม่อีกครั้ง'
          : res.error === 'ERR_SMS_SEND_FAILED'
          ? 'ส่ง SMS ไม่สำเร็จ — กรุณาลองใหม่อีกครั้ง'
          : 'ขอรหัสยืนยันไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
      )
      return
    }
    setOtpSent(true)
    setOtpMasked(res.maskedPhone || '')
    showToast('ส่งรหัสยืนยันทาง SMS แล้ว', 'success')
  }

  async function handleQuickLogin(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const st = useLocationStore.getState()
      st.setLocation({
        latitude: st.location.latitude,
        longitude: st.location.longitude,
        addressDetail: qAddress,
        source: st.location.source || 'manual',
      })
      const res = await loginByLocation({
        name: qName,
        phone: qPhone,
        addressDetail: qAddress,
        // P0 (Owner OD-1) — ส่งรหัส OTP ไปให้ EF ตรวจก่อนออก session
        otpCode,
      })
      if (!res.ok) {
        setError(
          res.error === 'ERR_ACCOUNT_CREATE_FAILED' || res.error === 'ERR_ACCOUNT_UPDATE_FAILED' || res.error === 'ERR_SESSION_MINT_FAILED'
            ? 'ระบบยืนยันตัวตนขัดข้อง — ลองใหม่อีกครั้ง หรือใช้แท็บอีเมล/รหัสผ่าน'
            : res.error === 'ERR_TIMEOUT'
            ? 'ระบบช้าเกินไป — ตรวจสอบเน็ตเวิร์กแล้วลองใหม่อีกครั้ง'
            : res.error === 'ERR_RATE_LIMITED'
            ? 'พยายามมากเกินไป — กรุณารอสักครู่แล้วลองใหม่ หรือใช้แท็บอีเมล/รหัสผ่าน'
            : res.error === 'ERR_OTP_REQUIRED' || res.error === 'ERR_OTP_INVALID'
            ? 'รหัสยืนยันไม่ถูกต้อง — กรุณากรอกรหัส 6 หลักที่ได้รับทาง SMS'
            : res.error === 'ERR_OTP_EXPIRED'
            ? 'รหัสยืนยันหมดอายุแล้ว — กรุณากดขอรหัสใหม่'
            : res.error === 'ERR_OTP_ALREADY_USED'
            ? 'รหัสนี้ถูกใช้ไปแล้ว — กรุณากดขอรหัสใหม่'
            : res.error === 'ERR_OTP_TOO_MANY_TRIES'
            ? 'กรอกรหัสผิดบ่อยเกินไป — กรุณารอสักครู่แล้วขอยรหัสใหม่'
            : (res.error || 'เข้าสู่ระบบด่วนไม่สำเร็จ'),
        )
        setIsLoading(false)
        return
      }
      // "ให้ข้อมูลครั้งเดียวแล้วระบบจำตลอด" — บันทึกลง localStorage (รอบหน้ากรอกให้อัตโนมัติ)
      // + ถ้ามีรูปสถานที่ → อัปโหลดขึ้นระบบ (ต้อง login แล้ว) แล้วบันทึกลงโปรไฟล์ลูกค้า
      let photoUrl = qPhotoUrl
      if (qPhotoFile) {
        setIsUploadingPhoto(true)
        const up = await uploadDeliveryPhoto(qPhotoFile)
        setIsUploadingPhoto(false)
        if (up.ok && up.url) photoUrl = up.url
        else showToast(up.error || 'อัปโหลดรูปสถานที่ไม่สำเร็จ', 'error')
      }
      if (photoUrl || qAddress) {
        // CR-2 P0: persist customer default coordinates ONLY from trusted sources
        // (real GPS or a manual pin) — IP-geo / kitchen fallback never get stored.
        const locState = useLocationStore.getState().location
        const trusted = locState.source === 'gps' || locState.source === 'manual'
        await saveDeliveryProfile({
          name: qName,
          phone: qPhone,
          addressDetail: qAddress,
          ...(trusted ? { latitude: locState.latitude, longitude: locState.longitude, source: locState.source } : {}),
          deliveryPhotoUrl: photoUrl,
        })
      }
      saveQuickProfile({ name: qName, phone: qPhone, address: qAddress, photoUrl })
      await finishLogin('quick:' + qPhone)
    } catch (err) {
      console.error('Quick login error:', err)
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    } finally {
      setIsLoading(false)
    }
  }

  // ค้นตำแหน่ง GPS และจำไว้สำหรับเข้าสู่ระบบด่วน
  async function handleLocate() {
    setIsLocating(true)
    setLocationBadge('กำลังระบุตำแหน่งของคุณ…')
    try {
      const loc = await getGpsLocation()
      useLocationStore.getState().setLocation({
        latitude: loc.latitude,
        longitude: loc.longitude,
        addressDetail: qAddress,
        name: qName,
        phone: qPhone,
        source: loc.source,
      })
      const label =
        loc.source === 'gps' ? 'ตำแหน่งจาก GPS' :
        loc.source === 'ip' ? 'ตำแหน่งโดยประมาณ (IP)' :
        loc.source === 'saved' ? 'ตำแหน่งที่เคยบันทึกไว้' : 'ตำแหน่งครัว (ค่าเริ่มต้น)'
      setLocationBadge('ตำแหน่งของฉัน: ' + label + ' · ' + loc.latitude.toFixed(4) + ', ' + loc.longitude.toFixed(4))
    } catch {
      setLocationBadge('ไม่พบตำแหน่ง — ใช้ค่าเริ่มต้น: ' + KITCHEN_LAT + ', ' + KITCHEN_LNG)
    } finally {
      setIsLocating(false)
    }
  }
return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🧡</div>
          <h1 className="text-4xl font-bold text-brand-accent font-display">Bite Me Baby</h1>
          <p className="text-brand-muted mt-2">More than just delicious food</p>
        </div>

        {/* Mode switch: email login OR quick login (name + phone + location) */}
        <div className="card bg-brand-surface">
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-brand-surface mb-4">
            <button
              type="button"
              onClick={() => { setMode('email'); setError('') }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg ${mode === 'email' ? 'bg-brand-primary text-white' : 'bg-white/60 text-brand-accent'}`}
            >
              📧 อีเมล / รหัสผ่าน
            </button>
            <button
              type="button"
              onClick={() => { setMode('quick'); setError('') }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg ${mode === 'quick' ? 'bg-brand-primary text-white' : 'bg-white/60 text-brand-accent'}`}
            >
              ⚡ เข้าสู่ระบบด่วน
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          {mode === 'email' && isForgot ? (
            <form onSubmit={handleSendReset} className="space-y-4">
              <div className="text-sm font-semibold text-brand-accent">ลืมรหัสผ่าน</div>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}
              {resetSent ? (
                <>
                  <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm">
                    ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมลของคุณแล้ว (ถ้าอีเมลมีบัญชีอยู่ในระบบ)
                    กรุณาตรวจสอบกล่องจดหมาย — ลิงก์มีอายุจำกัด
                  </div>
                  <button
                    type="button"
                    onClick={() => { setIsForgot(false); setResetSent(false); setError('') }}
                    className="btn btn-outline w-full"
                  >
                    กลับไปเข้าสู่ระบบ
                  </button>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-brand-accent mb-2">อีเมล</label>
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="input"
                      placeholder="your@email.com"
                      required
                      autoFocus
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSendingReset}
                    className={`btn btn-primary w-full ${isSendingReset ? 'btn-disabled' : ''}`}
                  >
                    {isSendingReset ? 'กำลังส่ง…' : 'ส่งลิงก์ตั้งรหัสผ่านใหม่'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsForgot(false); setError('') }}
                    className="btn btn-outline w-full"
                  >
                    กลับไปเข้าสู่ระบบ
                  </button>
                </>
              )}
            </form>
          ) : mode === 'email' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-brand-accent mb-2">อีเมล</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input"
                  placeholder="your@email.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-brand-accent mb-2">รหัสผ่าน</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input"
                  placeholder="••••••••"
                  required
                />
                <div className="text-right mt-2">
                  <button
                    type="button"
                    onClick={() => { setIsForgot(true); setError('') }}
                    className="text-sm text-brand-primary hover:underline"
                  >
                    ลืมรหัสผ่าน?
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className={`btn btn-primary w-full ${isLoading ? 'btn-disabled' : ''}`}
              >
                {isLoading ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleQuickLogin} className="space-y-4">
              <div className="rounded-lg bg-brand-bg border border-brand-border p-3 text-xs text-brand-muted">
                เข้าสู่ระบบด่วน: เพียงชื่อ + เบอร์โทร + ตำแหน่งที่อยู่ (GPS) — ระบบใช้ตำแหน่งจริงของคุณเพื่อคำนวณระยะทาง/เส้นทาง/ค่าจัดส่ง
                และจะจำข้อมูลนี้ไว้ให้ ครั้งต่อไปไม่ต้องกรอกใหม่
              </div>

              <div>
                <label className="block text-sm font-medium text-brand-accent mb-2">ชื่อ-นามสกุล</label>
                <input
                  value={qName}
                  onChange={(e) => setQName(e.target.value)}
                  className="input"
                  placeholder="ชื่อของคุณ"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-brand-accent mb-2">เบอร์โทรศัพท์</label>
                <input
                  type="tel"
                  value={qPhone}
                  onChange={(e) => setQPhone(e.target.value)}
                  className="input"
                  placeholder="เช่น 0812345678"
                  required
                />
              </div>

              {/* P0 (Owner OD-1) — ยืนยันการควบคุมเบอร์ก่อนเข้าสู่ระบบด่วน
                  หมายเหตุ: รหัสนี้ "ไม่ใช่" หลักฐานยืนยันการชำระเงิน และ
                  ไม่ให้สิทธิ์เข้าบัญชีอื่นนอกจากบัญชีของเบอร์นี้ */}
              <div className="rounded-lg bg-brand-bg border border-brand-border p-3 space-y-2">
                <div className="text-sm font-medium text-brand-accent">ยืนยันเบอร์โทรศัพท์</div>
                <p className="text-xs text-brand-muted">
                  กดปุ่มด้านล่างเพื่อรับรหัส 6 หลักทาง SMS เพื่อยืนยันว่าคุณเป็นเจ้าของเบอร์นี้
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={(e) => void handleSendOtp(e)}
                    disabled={isSendingOtp || qPhone.trim().length < 9}
                    className={`btn btn-outline btn-sm ${isSendingOtp ? 'btn-disabled' : ''}`}
                  >
                    {isSendingOtp ? 'กำลังส่ง…' : otpSent ? 'ส่งรหัสใหม่' : 'ส่งรหัสยืนยัน'}
                  </button>
                  {otpSent && (
                    <span className="text-xs text-brand-muted self-center">
                      ส่งไปที่ {otpMasked || 'เบอร์ของคุณ'}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  className="input tracking-[0.4em]"
                  placeholder="รหัส 6 หลัก"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-brand-accent mb-2">ที่อยู่จัดส่ง (เช่น เลขที่บ้าน)</label>
                <textarea
                  value={qAddress}
                  onChange={(e) => setQAddress(e.target.value)}
                  className="input"
                  rows={2}
                  placeholder="เลขที่บ้าน / ถนน / หมู่ที่"
                />
              </div>

              {/* GPS + รูปสถานที่จัดส่ง — อยู่คู่กัน */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleLocate}
                  disabled={isLocating}
                  className="btn btn-outline text-sm"
                >
                  {isLocating ? 'กำลังระบุตำแหน่ง…' : '📍 ตำแหน่งของฉัน (GPS)'}
                </button>
                <button
                  type="button"
                  onClick={() => qPhotoInputRef.current?.click()}
                  disabled={isUploadingPhoto}
                  className="btn btn-outline text-sm"
                  data-testid="quick-photo-button"
                >
                  {isUploadingPhoto ? 'กำลังอัปโหลดรูป…' : '📷 เพิ่มรูปสถานที่จัดส่ง'}
                </button>
                <input
                  ref={qPhotoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  data-testid="quick-photo-input"
                  onChange={handlePhotoPick}
                />
                {locationBadge && <span className="text-xs text-brand-muted">{locationBadge}</span>}
              </div>
              {qPhotoPreview && (
                <div className="flex items-center gap-3">
                  <img
                    src={qPhotoPreview}
                    alt="รูปสถานที่จัดส่ง"
                    className="w-16 h-16 object-cover rounded-lg border-2 border-brand-border"
                    data-testid="quick-photo-preview"
                  />
                  <span className="text-xs text-brand-muted flex-1">
                    รูปสถานที่จัดส่ง — ช่วยให้ไรเดอร์หาบ้านคุณเจอได้ง่ายขึ้น
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (qPhotoPreview.startsWith('blob:')) URL.revokeObjectURL(qPhotoPreview)
                      setQPhotoFile(null)
                      setQPhotoPreview(qPhotoUrl)
                    }}
                    className="text-xs text-red-500 hover:underline"
                  >
                    ลบรูป
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || isUploadingPhoto}
                className={`btn btn-primary w-full ${isLoading ? 'btn-disabled' : ''}`}
              >
                {isLoading ? 'กำลังเข้าสู่ระบบ…' : '⚡ เข้าสู่ระบบด่วน'}
              </button>
            </form>
          )}

          <div className="mt-6 text-center">
            <p className="text-brand-muted text-sm">
              ยังไม่มีบัญชี?{' '}
              {/* Login context restoration (PRE-OPENING): ส่งต่อ returnTo ไปหน้าสมัครด้วย —
                  ไม่งั้น register → login จะลืมหน้าที่ผู้ใช้ตั้งใจ (ตก Landing ไม่จำเป็น) */}
              <Link
                to="/register"
                state={returnTo ? { from: returnTo } : undefined}
                className="text-brand-primary font-medium hover:underline"
              >
                สมัครสมาชิก
              </Link>
            </p>
          </div>

          {/* P3 — Facebook Login
              ข้อจำกัดด้านความปลอดภัย (Owner): การยืนยันผ่าน Facebook "ไม่มีทาง" เข้าถึง
              บัญชี Quick Login/Guest Checkout ได้ เพราะบัญชีเหล่านั้นใช้ synthetic email
              `<phone>@phone.bmb.local` ซึ่ง Facebook ไม่มีทางคืนมา
              และระบบ "ไม่รวมบัญชีอัตโนมัติ" ระหว่าง Facebook กับบัญชีอีเมล/รหัสผ่านเดิม */}
          <div className="mt-5 pt-5 border-t border-brand-border">
            {/* R25 (Owner): Google — built-in Supabase (ต้องใส่ Client ID/Secret ใน Dashboard ก่อนใช้จริง) */}
            <button
              type="button"
              onClick={() => { setError(''); void signInWithSocial('google', returnTo || readSocialNext()).then((r) => { if (!r.ok) setError(describeSocialError(r.code, 'Google')) }) }}
              className="w-full flex items-center justify-center gap-2 border border-brand-border rounded-lg bg-white text-[#4285F4] font-medium py-2.5 hover:bg-gray-50 transition-colors mb-2"
            >
              <span className="w-5 h-5 rounded-full bg-white text-[13px] font-bold flex items-center justify-center" style={{ color: '#4285F4' }} aria-hidden="true">G</span>
              เข้าสู่ระบบด้วย Google
            </button>
            {/* R25 (Owner): LINE — Supabase ยังไม่มี built-in → ต้องลงทะเบียน Custom OIDC (LINE) ใน Dashboard
                ถ้ายังไม่ได้ตั้งค่า ปุ่มจะแจ้งสถานะกลับมาเป็นข้อความไทย (ไม่เงียบ/ไม่พัง) */}
            <button
              type="button"
              onClick={() => { setError(''); void signInWithSocial('line', returnTo || readSocialNext()).then((r) => { if (!r.ok) setError(describeSocialError(r.code, 'LINE')) }) }}
              className="w-full flex items-center justify-center gap-2 border border-brand-border rounded-lg bg-[#06C755] text-white font-medium py-2.5 hover:opacity-90 transition-colors mb-2"
            >
              <span className="w-5 h-5 rounded-full bg-white text-[#06C755] text-[11px] font-bold flex items-center justify-center" aria-hidden="true">L</span>
              เข้าสู่ระบบด้วย LINE
            </button>
            <button
              type="button"
              onClick={() => void signInWithFacebook(returnTo || readSocialNext())}
              className="w-full flex items-center justify-center gap-2 border border-brand-border rounded-lg bg-white text-[#1877F2] font-medium py-2.5 hover:bg-gray-50 transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true">
                <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.414c0-3.025 1.792-4.697 4.533-4.697 1.313 0 2.686.236 2.686.236v2.97h-1.513c-1.49 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
              </svg>
              เข้าสู่ระบบด้วย Facebook
            </button>
            <p className="text-[11px] text-brand-muted text-center mt-2">
              การยืนยันผ่าน Facebook เป็นการยืนยันตัวตนเท่านั้น ไม่เกี่ยวข้องกับการชำระเงิน
            </p>
          </div>

          {/* P4 — Passkey / WebAuthn
              แสดงเฉพาะเมื่อเบราว์เซอร์รองรับจริง และ "ยังไม่มี session"
              (ถ้ามี session อยู่แล้ว effect ด้านบนจะพาไปหน้าแรกทันที) */}
          {isPasskeySupported() && !isAuthenticated && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => {
                  setError('')
                  setIsLoading(true)
                  void signInWithPasskey().then((r) => {
                    setIsLoading(false)
                    if (!r.ok) setError(describePasskeyError(r.code))
                  })
                }}
                disabled={isLoading}
                className={`w-full flex items-center justify-center gap-2 border border-brand-border rounded-lg bg-brand-bg text-brand-accent font-medium py-2.5 hover:bg-brand-surface transition-colors ${isLoading ? 'btn-disabled' : ''}`}
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M12 2a5 5 0 0 1 5 5v3a5 5 0 0 1-10 0V7a5 5 0 0 1 5-5z" />
                  <path d="M3 21v-2a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v2" />
                </svg>
                {isLoading ? 'กำลังยืนยันตัวตน…' : 'เข้าสู่ระบบด้วย Passkey'}
              </button>
              <p className="text-[11px] text-brand-muted text-center mt-2">
                ใช้ Face / Touch ID / ล็อกหน้าจอของเครื่องคุณ — ไม่ต้องจำรหัสผ่าน
              </p>
            </div>
          )}
        </div>

        <div className="text-center mt-6">
          <Link to="/" className="text-brand-primary hover:underline">
            ← กลับหน้าแรก
          </Link>
        </div>
      </div>
    </div>
  )
}
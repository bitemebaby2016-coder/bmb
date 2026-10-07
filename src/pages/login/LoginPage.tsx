import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore, fetchProfileRole, describeLoginError } from '@/store/authStore'
import { useLocationStore, KITCHEN_LAT, KITCHEN_LNG } from '@/store/locationStore'
import { getGpsLocation, uploadDeliveryPhoto, saveDeliveryProfile } from '@/lib/locationLogin'
import { showToast } from '@/components/ui/ToastContainer'
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
  const login = useAuthStore((s) => s.login)
  const loginByLocation = useAuthStore((s) => s.loginByLocation)
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

  // Redirect after login based on DB role
  async function finishLogin(userLabel: string) {
    const role = await fetchProfileRole()
    writeAuditLog({
      action: 'user_login',
      entity_type: 'user',
      entity_id: userLabel,
      description: userLabel + ' - login success',
    })
    showToast('เข้าสู่ระบบสำเร็จ!', 'success')
    navigate(role === 'admin' ? '/admin' : '/')
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
      })
      if (!res.ok) {
        setError(
          res.error === 'ERR_ACCOUNT_CREATE_FAILED' || res.error === 'ERR_ACCOUNT_UPDATE_FAILED' || res.error === 'ERR_SESSION_MINT_FAILED'
            ? 'ระบบยืนยันตัวตนขัดข้อง — ลองใหม่อีกครั้ง หรือใช้แท็บอีเมล/รหัสผ่าน'
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
        await saveDeliveryProfile({
          name: qName,
          phone: qPhone,
          addressDetail: qAddress,
          latitude: useLocationStore.getState().location.latitude,
          longitude: useLocationStore.getState().location.longitude,
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

          {mode === 'email' ? (
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
              <Link to="/register" className="text-brand-primary font-medium hover:underline">
                สมัครสมาชิก
              </Link>
            </p>
          </div>
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
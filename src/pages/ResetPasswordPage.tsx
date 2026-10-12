// ============================================
// Bite Me Baby — Reset Password page (P1 / SF-04)
// ผู้ใช้กดลิงก์จากอีเมล -> Supabase สร้าง session ชั่วคราวให้ (detectSessionInUrl)
// หน้านี้รอจนมี session แล้วจึงให้ตั้งรหัสผ่านใหม่
// หมายเหตุ: updateUser ทำงานกับ session ปัจจุบันเท่านั้น — หน้านี้
// "ไม่รับ" uid/orderNumber/email จาก URL เลย จึงใช้เป็นเครื่องมือ
// เปลี่ยนรหัสผ่านของผู้อื่นไม่ได้ (IDOR ปิดไว้โดย design)
// ============================================

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  updatePassword,
  canUpdatePassword,
  MIN_PASSWORD_LENGTH,
} from '@/lib/authRecovery'
import { showToast } from '@/components/ui/ToastContainer'

type Phase = 'checking' | 'ready' | 'done' | 'no-session'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // detectSessionInUrl=true (src/lib/supabase.ts) จะแปลง hash ของลิงก์อีเมล
  // เป็น session ให้เอง — หน้านี้แค่รอจน session พร้อม
  useEffect(() => {
    let alive = true
    void (async () => {
      for (let i = 0; i < 20; i++) {
        if (await canUpdatePassword()) {
          if (alive) setPhase('ready')
          return
        }
        await new Promise((r) => setTimeout(r, 500))
      }
      if (alive) setPhase('no-session')
    })()
    return () => { alive = false }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isSaving) return
    setError('')
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`รหัสผ่านต้องมีอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`)
      return
    }
    if (password !== confirm) {
      setError('รหัสผ่านทั้งสองช่องไม่ตรงกัน')
      return
    }
    setIsSaving(true)
    const res = await updatePassword(password)
    setIsSaving(false)
    if (!res.ok) {
      setError(res.error === 'ERR_PASSWORD_TOO_SHORT'
        ? `รหัสผ่านต้องมีอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`
        : 'ตั้งรหัสผ่านใหม่ไม่สำเร็จ กรุณาลองลิงก์จากอีเมลอีกครั้ง (ลิงก์มีอายุจำกัด)')
      return
    }
    setPhase('done')
    showToast('เปลี่ยนรหัสผ่านสำเร็จ', 'success')
    setTimeout(() => navigate('/login', { replace: true }), 1500)
  }

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🧡</div>
          <h1 className="text-4xl font-bold text-brand-accent font-display">Bite Me Baby</h1>
          <p className="text-brand-muted mt-2">ตั้งรหัสผ่านใหม่</p>
        </div>

        <div className="card bg-brand-surface">
          {phase === 'checking' && (
            <p className="text-sm text-brand-muted text-center py-6">กำลังตรวจสอบลิงก์…</p>
          )}

          {phase === 'no-session' && (
            <div className="space-y-4">
              <p className="text-sm text-brand-text">
                ลิงก์นี้หมดอายุหรือถูกใช้ไปแล้ว กรุณาขอร้องขอใหม่จากหน้าเข้าสู่ระบบ
              </p>
              <button
                type="button"
                onClick={() => navigate('/login', { replace: true })}
                className="btn btn-primary w-full"
              >
                ไปหน้าเข้าสู่ระบบ
              </button>
            </div>
          )}

          {phase === 'done' && (
            <p className="text-sm text-brand-text text-center py-6">
              เปลี่ยนรหัสผ่านสำเร็จ — กำลังพาไปหน้าเข้าสู่ระบบ…
            </p>
          )}

          {phase === 'ready' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-brand-accent mb-2">
                  รหัสผ่านใหม่
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input"
                  placeholder="อย่างน้อย 8 ตัวอักษร"
                  minLength={MIN_PASSWORD_LENGTH}
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-accent mb-2">
                  ยืนยันรหัสผ่านใหม่
                </label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="input"
                  placeholder="พิมพ์ซ้ำอีกครั้ง"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isSaving}
                className={`btn btn-primary w-full ${isSaving ? 'btn-disabled' : ''}`}
              >
                {isSaving ? 'กำลังบันทึก…' : 'บันทึกรหัสผ่านใหม่'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

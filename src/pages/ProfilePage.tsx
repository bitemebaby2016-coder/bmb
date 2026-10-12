import { Link } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useRewardsStore } from '@/store/rewardsStore'
// P4 — Passkey / WebAuthn (สมัคร/ลบ ต้องมี session อยู่แล้ว — หน้านี้เป็น ProtectedRoute)
import { useState, useEffect } from 'react'
import { showToast } from '@/components/ui/ToastContainer'
import {
  registerPasskey,
  listPasskeys,
  removePasskey,
  describePasskeyError,
  isPasskeySupported,
  type PasskeyInfo,
} from '@/lib/passkeyLogin'

export function ProfilePage() {
  const customer = useAuthStore((s) => s.customer)
  const loyaltyPoints = useRewardsStore((s) => s.loyaltyPoints)

  // P4 — รายการ passkey ที่ผูกกับบัญชีนี้ (โหลดครั้งเดียวตอนเปิดหน้า)
  const [passkeys, setPasskeys] = useState<PasskeyInfo[]>([])
  useEffect(() => {
    if (!customer || !isPasskeySupported()) return
    let active = true
    void listPasskeys().then((r) => {
      if (active && r.ok) setPasskeys(r.items)
    })
    return () => { active = false }
  }, [customer])

  if (!customer) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <div className="text-6xl mb-4">👤</div>
        <h2 className="text-2xl font-bold text-brand-accent mb-2">เข้าสู่ระบบเพื่อใช้งาน</h2>
        <p className="text-brand-muted mb-6">รับแต้มสะสม โปรโมชั่น และติดตามออเดอร์</p>
        <button className="btn btn-primary">เข้าสู่ระบบ</button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="card mb-6 bg-gradient-to-r from-brand-primary to-brand-secondary text-white">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-3xl font-bold text-brand-primary">
            {customer.name?.charAt(0) || 'U'}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{customer.name}</h1>
            <p className="opacity-90">{customer.phone}</p>
          </div>
        </div>
      </div>

      <div className="card mb-6 bg-yellow-50 border-2 border-yellow-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-brand-accent text-lg">💎 แต้มสะสม</h3>
            <div className="text-4xl font-bold text-brand-primary">{loyaltyPoints}</div>
          </div>
          <Link to="/rewards" className="btn btn-secondary">แลกรางวัล →</Link>
        </div>
      </div>

      <div className="space-y-3">
        <Link to="/orders" className="card block hover:scale-[1.02] transition-transform">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📋</span>
            <div>
              <div className="font-bold text-brand-accent">ออเดอร์ของฉัน</div>
              <div className="text-sm text-brand-muted">{customer.total_orders} รายการ</div>
            </div>
            <span className="ml-auto text-brand-muted">→</span>
          </div>
        </Link>
        <Link to="/promotions" className="card block hover:scale-[1.02] transition-transform">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎟️</span>
            <div>
              <div className="font-bold text-brand-accent">โปรโมชั่น</div>
              <div className="text-sm text-brand-muted">ดูและใช้คูปอง</div>
            </div>
            <span className="ml-auto text-brand-muted">→</span>
          </div>
        </Link>
        <Link to="/rewards" className="card block hover:scale-[1.02] transition-transform">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎁</span>
            <div>
              <div className="font-bold text-brand-accent">รางวัลและแต้ม</div>
              <div className="text-sm text-brand-muted">แลกรางวัลจากแต้ม</div>
            </div>
            <span className="ml-auto text-brand-muted">→</span>
          </div>
        </Link>
        <Link to="/viral" className="card block hover:scale-[1.02] transition-transform">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏅</span>
            <div>
              <div className="font-bold text-brand-accent">กิจกรรมและ badges</div>
              <div className="text-sm text-brand-muted">ทำกิจกรรมรับแต้ม</div>
            </div>
            <span className="ml-auto text-brand-muted">→</span>
          </div>
        </Link>
      </div>

      {/* P4 — Passkey / WebAuthn
          วิธีเข้าสู่ระบบวิธีที่ 3 — ไม่แตะ business rules / RPC / Payment Authority
          การสมัครต้องทำตอน "มี session อยู่แล้ว" จึงกันไม่ให้ใครผูก passkey เข้าบัญชีคนอื่น */}
      {isPasskeySupported() && (
        <div className="card mt-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">🔑</span>
            <h3 className="font-bold text-brand-accent">Passkey</h3>
          </div>
          <p className="text-sm text-brand-muted mb-4">
            เข้าสู่ระบบครั้งต่อไปด้วย Face / Touch ID / ล็อกหน้าจอของเครื่องคุณ — ไม่ต้องจำรหัสผ่าน
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                void (async () => {
                  const r = await registerPasskey(customer.full_name || 'Passkey ของฉัน')
                  if (!r.ok) {
                    showToast(describePasskeyError(r.code), 'error')
                    return
                  }
                  showToast('สร้าง Passkey สำเร็จ', 'success')
                  const l = await listPasskeys()
                  if (l.ok) setPasskeys(l.items)
                })()
              }}
              className="btn btn-primary btn-sm"
            >
              + สร้าง Passkey
            </button>
          </div>

          {passkeys.length > 0 && (
            <ul className="mt-4 space-y-2">
              {passkeys.map((p) => (
                <li key={p.id} className="flex items-center justify-between rounded-lg border border-brand-border px-3 py-2">
                  <div>
                    <div className="text-sm font-medium text-brand-accent">{p.label}</div>
                    <div className="text-xs text-brand-muted">
                      {p.createdAt ? new Date(p.createdAt).toLocaleDateString('th-TH') : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void (async () => {
                        const r = await removePasskey(p.id)
                        if (!r.ok) {
                          showToast(describePasskeyError(r.code), 'error')
                          return
                        }
                        showToast('ลบ Passkey แล้ว', 'success')
                        setPasskeys((prev) => prev.filter((x) => x.id !== p.id))
                      })()
                    }}
                    className="text-xs text-red-500 hover:underline"
                  >
                    ลบ
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
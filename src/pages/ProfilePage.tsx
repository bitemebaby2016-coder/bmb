import { Link } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useRewardsStore } from '@/store/rewardsStore'

export function ProfilePage() {
  const customer = useAuthStore((s) => s.customer)
  const loyaltyPoints = useRewardsStore((s) => s.loyaltyPoints)

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
    </div>
  )
}
import { useEffect, useState } from 'react'
import { useRewardsStore } from '@/store/rewardsStore'
import { useAuthStore } from '@/store/authStore'
import { showToast } from '@/components/ui/ToastContainer'
import {
  fetchLoyaltyStatus,
  fetchLoyaltyHistory,
  loyaltyTierCatalog,
  describeLoyaltyTier,
  describeLoyaltyIssue,
  describeLoyaltyEntryType,
  type LoyaltyStatus,
  type LoyaltyHistory,
} from '@/lib/loyaltyClient'

const rewards = [
  { id: '1', name: 'คูปองลด 10%', points: 100, description: 'ใช้กับออเดอร์ถัดไป' },
  { id: '2', name: 'ส่งฟรี 1 ครั้ง', points: 150, description: 'ส่งฟรีภายใน 5 กม.' },
  { id: '3', name: 'เมนูฟรี 1 จาน', points: 200, description: 'เลือกเมนูจากเมนูหลัก' },
  { id: '4', name: 'คูปองลด 20%', points: 300, description: 'ใช้กับออเดอร์ ≥฿200' },
]

export function RewardsPage() {
  const loyaltyPoints = useRewardsStore((s) => s.loyaltyPoints)
  const redeemPoints = useRewardsStore((s) => s.redeemPoints)
  const customer = useAuthStore((s) => s.customer)

  // [G&R 155] ระดับสมาชิก + แต้ม + ประวัติ = ข้อมูลจริงจากเซิร์ฟเวอร์ (ZERO-FAKE)
  const [status, setStatus] = useState<LoyaltyStatus | null>(null)
  const [history, setHistory] = useState<LoyaltyHistory | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let active = true
    void Promise.all([fetchLoyaltyStatus(), fetchLoyaltyHistory(20)]).then(([s, h]) => {
      if (!active) return
      setStatus(s)
      setHistory(h)
      setLoaded(true)
    })
    return () => { active = false }
  }, [customer])

  function handleRedeem(rewardId: string) {
    const reward = rewards.find(r => r.id === rewardId)
    if (!reward) return
    if (loyaltyPoints < reward.points) { showToast('แต้มไม่พอ', 'warning'); return }
    // ZERO-FAKE: แคตตาล็อกนี้ยังเป็นพรีวิว — ห้ามแสร้งว่า "แลกสำเร็จ"
    // (ระบบแลกแต้มจริง + แคตตาล็อกแอดมิน = STAGE 4)
    if (redeemPoints(reward.points, reward.name, reward.description)) {
      showToast(`บันทึกรายการขอแลก ${reward.name} แล้ว (พรีวิว) — ยังไม่มีการออกคูปองจริงค่ะ`, 'info')
    }
  }

  const tiers = loyaltyTierCatalog(status?.thresholds)
  const fmt = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2 })

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-3xl font-bold text-brand-accent mb-6">🎁 รางวัลและแต้ม</h1>
      {/* [G&R 155] ระดับสมาชิก — ยอดสุทธิ rolling 12 เดือนจากเซิร์ฟเวอร์ */}
      <div className="card mb-4 border-2 border-indigo-300 bg-indigo-50" data-testid="loyalty-tier-card">
        {!loaded ? (
          <p className="text-sm text-indigo-800">⏳ กำลังโหลดระดับสมาชิก…</p>
        ) : !customer || !status ? (
          <p className="text-sm text-indigo-800">{describeLoyaltyIssue(customer ? 'load_failed' : 'signed_out')}</p>
        ) : !status.tiers_enabled ? (
          <p className="text-sm text-indigo-800">{describeLoyaltyIssue('disabled_tiers')}</p>
        ) : (
          <>
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-sm text-indigo-700">ระดับสมาชิกปัจจุบัน</div>
                <div className="text-2xl font-bold text-indigo-900" data-testid="loyalty-tier-label">
                  {tiers.find(t => t.key === status.tier)?.emoji} {status.tier_label}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-indigo-700">ยอดสุทธิ {status.window_months} เดือนย้อนหลัง</div>
                <div className="text-xl font-bold text-indigo-900">฿{fmt(status.net_sales)}</div>
              </div>
            </div>
            <div className="h-3 w-full rounded-full bg-indigo-200">
              <div className="h-3 rounded-full bg-indigo-600 transition-all"
                   style={{ width: `${Math.round(status.progress * 100)}%` }} />
            </div>
            <p className="text-xs text-indigo-700 mt-2">
              {status.next_tier
                ? `อีก ฿${fmt(status.remaining)} ขึ้นระดับ ${status.next_tier === 'gold' ? 'Gold' : status.next_tier === 'platinum' ? 'Platinum' : 'Silver'}`
                : 'สูงสุดแล้ว — ขอบคุณที่อยู่กับเรามาโดยตลอด 💎'}
              {' '}· {describeLoyaltyTier(status.tier)}
            </p>
          </>
        )}
      </div>

      {/* [G&R 155] แต้มสะสมจริงจาก ledger */}
      <div className="card mb-4 bg-gradient-to-r from-yellow-400 to-orange-400 text-white" data-testid="loyalty-points-card">
        <div className="text-center">
          <div className="text-sm mb-1">แต้มสะสมของคุณ</div>
          <div className="text-5xl font-bold mb-2">{status ? status.points_balance : '—'}</div>
          {loaded && status && !status.points_enabled && (
            <p className="text-xs bg-white/20 rounded-lg px-3 py-1 inline-block">
              อัตราแต้มยังไม่เปิดใช้ — จะเริ่มสะสมจากการสั่งซื้อเมื่อเปิดใช้งานค่ะ
            </p>
          )}
          {loaded && status && status.points_enabled && (
            <p className="text-xs bg-white/20 rounded-lg px-3 py-1 inline-block">
              สะสม {status.points_per_baht} แต้ม ต่อ ฿1 ของยอดสินค้า (ออเดอร์ผ่านสถานะที่กำหนด)
            </p>
          )}
        </div>
      </div>
      {/* [G&R 155] ประวัติแต้มจริงจาก ledger (append-only) */}
      {history && history.entries.length > 0 && (
        <div className="card mb-4" data-testid="loyalty-history">
          <h3 className="font-bold text-brand-accent mb-3">📒 ประวัติแต้ม</h3>
          <ul className="space-y-2">
            {history.entries.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 rounded-lg border border-brand-border px-3 py-2 text-sm">
                <div className="min-w-0">
                  <div className="font-medium">{describeLoyaltyEntryType(e.entry_type)}</div>
                  <div className="text-xs text-brand-muted truncate">
                    {e.order_number ? `ออเดอร์ ${e.order_number} · ` : ''}
                    {new Date(e.created_at).toLocaleDateString('th-TH')}
                  </div>
                </div>
                <span className={`font-bold shrink-0 ${e.points >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {e.points >= 0 ? '+' : ''}{e.points}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* [G&R 155] บันได 4 ระดับ (เกณฑ์ §5.2 — ปรับโดยแอดมินในศูนย์กลางการตลาด) */}
      <div className="card mb-6 bg-green-50 border-2 border-green-200" data-testid="loyalty-tier-ladder">
        <h3 className="font-bold text-green-800 mb-3">💎 ระดับสมาชิก 4 ระดับ</h3>
        <div className="space-y-1 text-sm">
          {tiers.map((t) => (
            <div key={t.key} className={`rounded-lg px-2 py-1 ${t.key === status?.tier ? 'bg-green-200 font-bold' : ''}`}>
              {t.emoji} <b>{t.label}</b> — {t.description}
            </div>
          ))}
        </div>
        <p className="text-xs text-green-700 mt-3">
          เกณฑ์ = ยอดสินค้าสุทธิหลังหักส่วนลดและคืนเงิน ไม่รวมค่าส่ง · นับแบบย้อนหลัง
          {status?.window_months ?? 12} เดือน · ไม่นับออเดอร์ที่ยกเลิก — แต้มสะสมได้จากการสั่งซื้อ
          เมื่อแอดมินเปิดอัตราแต้มแล้วเท่านั้น
        </p>
      </div>
      <h3 className="font-bold text-brand-accent mb-4">🎁 แลกรางวัล</h3>
      <div className="space-y-3">
        {rewards.map((reward) => {
          const canAfford = loyaltyPoints >= reward.points
          return (
            <div key={reward.id} className="card flex items-center gap-4">
              <div className="w-16 h-16 bg-brand-bg rounded-xl flex items-center justify-center text-2xl"></div>
              <div className="flex-1">
                <h4 className="font-bold text-brand-accent">{reward.name}</h4>
                <p className="text-sm text-brand-muted">{reward.description}</p>
              </div>
              <div className="text-right">
                <div className="font-bold text-brand-primary">{reward.points} แต้ม</div>
                <button onClick={() => handleRedeem(reward.id)} disabled={!canAfford} className={`btn text-sm mt-2 ${canAfford ? 'btn-primary' : 'btn-disabled'}`}>แลกเลย</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
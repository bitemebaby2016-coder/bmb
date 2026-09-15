import { useRewardsStore } from '@/store/rewardsStore'
import { showToast } from '@/components/ui/ToastContainer'

const rewards = [
  { id: '1', name: 'คูปองลด 10%', points: 100, description: 'ใช้กับออเดอร์ถัดไป' },
  { id: '2', name: 'ส่งฟรี 1 ครั้ง', points: 150, description: 'ส่งฟรีภายใน 5 กม.' },
  { id: '3', name: 'เมนูฟรี 1 จาน', points: 200, description: 'เลือกเมนูจากเมนูหลัก' },
  { id: '4', name: 'คูปองลด 20%', points: 300, description: 'ใช้กับออเดอร์ ≥฿200' },
]

export function RewardsPage() {
  const loyaltyPoints = useRewardsStore((s) => s.loyaltyPoints)
  const redeemPoints = useRewardsStore((s) => s.redeemPoints)

  function handleRedeem(rewardId: string) {
    const reward = rewards.find(r => r.id === rewardId)
    if (!reward) return
    if (loyaltyPoints < reward.points) { showToast('แต้มไม่พอ', 'warning'); return }
    if (redeemPoints(reward.points, reward.name, reward.description)) { showToast(`แลก ${reward.name} สำเร็จ!`, 'success') }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-3xl font-bold text-brand-accent mb-6">🎁 รางวัลและแต้ม</h1>
      <div className="card mb-6 bg-gradient-to-r from-yellow-400 to-orange-400 text-white">
        <div className="text-center">
          <div className="text-sm mb-1">แต้มสะสมของคุณ</div>
          <div className="text-5xl font-bold mb-2">{loyaltyPoints}</div>
        </div>
      </div>
      <div className="card mb-6 bg-green-50 border-2 border-green-200">
        <h3 className="font-bold text-green-800 mb-3">💰 วิธีได้แต้ม</h3>
        <div className="space-y-2 text-sm">
          <div>🛒 สั่งอาหาร +5 แต้ม/ออรเดอร์</div>
          <div>⭐ รีวิว +10 แต้ม/รีวิว</div>
          <div>🗳️ โหวตเมนู +5 แต้ม/ครั้ง</div>
          <div> สุ่มเมนู +3 แต้ม/ครั้ง</div>
          <div>👥 เชิญเพื่อน +50 แต้ม/คน</div>
          <div>📅 Daily login +2 แต้ม/วัน</div>
        </div>
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
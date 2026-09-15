import { useState } from 'react'
import { useRewardsStore } from '@/store/rewardsStore'
import { showToast } from '@/components/ui/ToastContainer'

const activities = [
  { id: '1', name: 'Daily Login', description: 'เข้าแอปทุกวัน', points: 2, icon: '📅', progress: 3, target: 7 },
  { id: '2', name: 'Write Review', description: 'รีวิว 5 รายการ', points: 50, icon: '⭐', progress: 2, target: 5 },
  { id: '3', name: 'Invite Friends', description: 'เชิญ 3 เพื่อน', points: 150, icon: '👥', progress: 1, target: 3 },
  { id: '4', name: 'Vote Menu', description: 'โหวต 10 ครั้ง', points: 50, icon: '🗳️', progress: 7, target: 10 },
]

const badges = [
  { id: '1', name: 'First Order', icon: '🎉', description: 'สั่งครั้งแรก', earned: true },
  { id: '2', name: 'Review Master', icon: '⭐', description: 'รีวิว 10 รายการ', earned: false },
  { id: '3', name: 'Social Butterfly', icon: '🦋', description: 'เชิญ 5 เพื่อน', earned: false },
  { id: '4', name: 'Loyal Customer', icon: '💎', description: 'สั่ง 20 ครั้ง', earned: true },
]

export function ViralPage() {
  const addPoints = useRewardsStore((s) => s.addPoints)
  const [spinning, setSpinning] = useState(false)

  function handleSpinWheel() {
    setSpinning(true)
    setTimeout(() => {
      const rewards = [5, 10, 15, 20, 50, 100]
      const randomReward = rewards[Math.floor(Math.random() * rewards.length)]
      addPoints(randomReward, 'spin_wheel')
      showToast(`ได้ ${randomReward} แต้ม!`, 'success')
      setSpinning(false)
    }, 2000)
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-3xl font-bold text-brand-accent mb-6">🏅 กิจกรรมและ badges</h1>

      <div className="card mb-6">
        <h3 className="font-bold text-brand-accent mb-4">กิจกรรมประจำวัน</h3>
        <div className="space-y-3">
          {activities.map((activity) => {
            const progressPercent = (activity.progress / activity.target) * 100
            return (
              <div key={activity.id} className="flex items-center gap-4 p-3 bg-brand-bg rounded-xl">
                <div className="text-3xl">{activity.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-bold text-brand-accent">{activity.name}</h4>
                    <span className="text-sm text-brand-primary font-bold">+{activity.points} แต้ม</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-brand-border rounded-full overflow-hidden">
                      <div className="h-full bg-brand-primary rounded-full" style={{ width: `${progressPercent}%` }}></div>
                    </div>
                    <span className="text-xs text-brand-muted">{activity.progress}/{activity.target}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="card mb-6 bg-gradient-to-r from-purple-50 to-pink-50 text-center">
        <h3 className="font-bold text-brand-accent mb-4">ล้อสุ่มแต้ม</h3>
        <div className="py-8">
          {spinning ? <div className="text-6xl animate-spin mb-4"></div> : <div className="text-6xl mb-4">🎡</div>}
          <p className="text-brand-muted mb-4">หมุนรับแต้มฟรี! 5 ครั้ง/วัน</p>
          <button onClick={handleSpinWheel} disabled={spinning} className="btn btn-primary text-lg disabled:opacity-50">
            {spinning ? '⏳ กำลังงหมุน...' : '🎰 หมุนเลย!'}
          </button>
        </div>
      </div>

      <div className="card">
        <h3 className="font-bold text-brand-accent mb-4">badges ที่ได้รับ</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {badges.map((badge) => (
            <div key={badge.id} className={`text-center p-4 rounded-xl ${badge.earned ? 'bg-yellow-50 border-2 border-yellow-200' : 'bg-gray-50 border-2 border-gray-200 opacity-50'}`}>
              <div className="text-4xl mb-2">{badge.icon}</div>
              <div className="font-bold text-sm text-brand-accent">{badge.name}</div>
              <div className="text-xs text-brand-muted">{badge.description}</div>
              {badge.earned && <div className="text-xs text-green-600 mt-1">✅ ได้รับแล้ว</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
import { useState } from 'react'
import { useRewardsStore } from '@/store/rewardsStore'
import { showToast } from '@/components/ui/ToastContainer'

const pollOptions = [
  { id: '1', name: 'ผัดไทยกุ้งสดใหม่', image: 'https://images.unsplash.com/photo-1559314809-0d155014e29e?w=300', votes: 45 },
  { id: '2', name: 'ข้าวผัดกระเทียมสตรใหม่', image: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=300', votes: 32 },
  { id: '3', name: 'แกงเขียวหวานสตรใหม่', image: 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=300', votes: 28 },
  { id: '4', name: 'กาแฟเย็นสตรใหม่', image: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=300', votes: 19 },
]

export function VotePage() {
  const [selectedVote, setSelectedVote] = useState<string | null>(null)
  const addPoints = useRewardsStore((s) => s.addPoints)

  function handleVote(optionId: string) {
    if (selectedVote) {
      showToast('คุณโหวตแล้ว กรุารอสักครู่', 'warning')
      return
    }

    setSelectedVote(optionId)
    addPoints(5, 'vote_menu')
    showToast('หวตสำเรจ! ได้ +5 แต้ม', 'success')
  }

  const totalVotes = pollOptions.reduce((sum, opt) => sum + opt.votes, 0)

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-brand-accent mb-2">🗳️ โหวตเมนูใหม่</h1>
        <p className="text-brand-muted">ช่วยเราเลือกเมนูที่จะเพิ่มใหม่! โหวตครั้งละ 5 แต้ม</p>
      </div>

      {/* Poll Card */}
      <div className="card mb-6 bg-gradient-to-r from-blue-50 to-indigo-50">
        <h3 className="font-bold text-brand-accent mb-4 text-xl">🎯 เมนไหนที่อย่ากลอง?</h3>
        <p className="text-sm text-brand-muted mb-4">หวตได้ครั้งละ 1 เมน</p>
        
        <div className="space-y-3">
          {pollOptions.map((option) => {
            const percentage = totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0
            const isSelected = selectedVote === option.id

            return (
              <button
                key={option.id}
                onClick={() => handleVote(option.id)}
                disabled={!!selectedVote}
                className={`w-full p-4 rounded-xl text-left transition-all ${
                  isSelected
                    ? 'bg-brand-primary text-white border-2 border-brand-primary'
                    : 'bg-brand-surface border-2 border-brand-border hover:border-brand-primary'
                }`}
              >
                <div className="flex items-center gap-4">
                  <img src={option.image} alt={option.name} className="w-16 h-16 rounded-lg object-cover" />
                  <div className="flex-1">
                    <div className="font-bold mb-1">{option.name}</div>
                    <div className={`text-sm ${isSelected ? 'text-white opacity-80' : 'text-brand-muted'}`}>
                      {option.votes} โหวต ({percentage.toFixed(0)}%)
                    </div>
                    <div className="mt-2 h-2 bg-white/20 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${isSelected ? 'bg-white' : 'bg-brand-primary'}`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                  {isSelected && <span className="text-2xl">✅</span>}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Results Summary */}
      <div className="card">
        <h3 className="font-bold text-brand-accent mb-4">📊 สรุปผลโหวต</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-4 bg-brand-bg rounded-xl">
            <div className="text-3xl font-bold text-brand-primary">{totalVotes}</div>
            <div className="text-sm text-brand-muted">โหวตทั้งหมด</div>
          </div>
          <div className="text-center p-4 bg-brand-bg rounded-xl">
            <div className="text-3xl font-bold text-brand-primary">{pollOptions.length}</div>
            <div className="text-sm text-brand-muted">ตัวเลือก</div>
          </div>
        </div>
      </div>

      {/* Tips */}
      <div className="card mt-6 bg-green-50 border-2 border-green-200">
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div>
            <h4 className="font-bold text-green-800 mb-1">เคล็ดลับ</h4>
            <p className="text-sm text-green-700">
              โหวตทุกสัปดาห์ รับแต้มสะสม 5 แต้ม/ครั้ง สะสม 50 แต้ม แลกคูปองลด 10%!
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
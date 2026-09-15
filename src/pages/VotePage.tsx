import { useState, useEffect } from 'react'
import { useRewardsStore } from '@/store/rewardsStore'
import { showToast } from '@/components/ui/ToastContainer'
import { getProducts, createProduct, getActiveDeliveryRounds } from '@/lib/bmbAdminApi_products'
import type { Product, DeliveryRound } from '@/types'

export function VotePage() {
  const [selectedVote, setSelectedVote] = useState<string | null>(null)
  const [pollOptions, setPollOptions] = useState<Product[]>([])
  const [deliveryRounds, setDeliveryRounds] = useState<DeliveryRound[]>([])
  const addPoints = useRewardsStore((s) => s.addPoints)

  useEffect(() => {
    const products = getProducts().filter(p => p.is_preorder)
    setPollOptions(products)
    setDeliveryRounds(getActiveDeliveryRounds())
  }, [])

  function handleVote(optionId: string) {
    if (selectedVote) {
      showToast('คุณโหวตแล้ว กรุารอสักครู่', 'warning')
      return
    }

    setSelectedVote(optionId)
    addPoints(5, 'vote_menu')

    const option = pollOptions.find(p => p.id === optionId)
    if (option) {
      const round = deliveryRounds[0]
      createProduct({
        name: option.name,
        description: `โหวตเมนูนี้เพื่อจองล่วงหน้า — ส่งรอบ ${round?.display_name || ''}`,
        price: option.price,
        category_id: option.category_id,
        image_url: option.image_url,
        is_available: true,
        is_featured: true,
        is_preorder: true,
        prep_minutes: option.prep_minutes,
        delivery_round_id: round?.id || '',
        scheduled_date: round ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : ''
      })
      showToast(`โหวตสำเร็จ! "${option.name}" จะส่งในรอบถัดไป — ได้ +5 แต้ม`, 'success')
    }
  }

  const totalVotes = pollOptions.length * 10

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
            const percentage = totalVotes > 0 ? ((option.prep_minutes || 10) / (pollOptions.length * 10)) * 100 : 0
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
                  <img src={option.image_url || '/placeholder.webp'} alt={option.name} className="w-16 h-16 rounded-lg object-cover" />
                  <div className="flex-1">
                    <div className="font-bold mb-1">{option.name}</div>
                    <div className={`text-sm ${isSelected ? 'text-white opacity-80' : 'text-brand-muted'}`}>
                      {Math.floor(percentage / 10)} โหวต ({percentage.toFixed(0)}%)
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
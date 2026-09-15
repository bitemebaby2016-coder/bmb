import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useRewardsStore } from '@/store/rewardsStore'
import { showToast } from '@/components/ui/ToastContainer'

const promotions = [
  { id: '1', name: 'WELCOME10', type: 'ลูกค้าใหม่', discount: 'ลด 10%', code: 'WELCOME10', expires: '30 วัน' },
  { id: '2', name: 'FREESHIP', type: 'ส่งฟรี', discount: 'ส่งฟรี ≥฿200', code: 'FREESHIP200', expires: 'ตลอดไป' },
  { id: '3', name: 'LUNCH50', type: 'Flash Sale', discount: 'ลด ฿50 ≥฿300', code: 'LUNCH50', expires: 'วันนี้' },
  { id: '4', name: 'MORNING15', type: 'รอบเช้า', discount: 'ลด 15% รอบเช้า', code: 'MORNING15', expires: 'ทุกเช้า' },
]

export function PromotionsPage() {
  const [appliedCode, setAppliedCode] = useState('')
  const addPoints = useRewardsStore((s) => s.addPoints)

  function handleApplyCode() {
    if (!appliedCode) { showToast('กรุณาใส่โค้ดคูปอง', 'warning'); return }
    const promo = promotions.find(p => p.code === appliedCode.toUpperCase())
    if (promo) { addPoints(10, 'use_coupon'); showToast(`ใช้ ${promo.name} สำเร็จ! ลด ${promo.discount}`, 'success') }
    else { showToast('โค้ดไม่ถูกต้อง', 'error') }
    setAppliedCode('')
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-3xl font-bold text-brand-accent mb-6">🎟️ โปรโมชั่น</h1>

      <div className="card mb-6 bg-gradient-to-r from-purple-50 to-pink-50">
        <h3 className="font-bold text-brand-accent mb-3">🎫 ใช้โค้ดคูปอง</h3>
        <div className="flex gap-2">
          <input type="text" value={appliedCode} onChange={(e) => setAppliedCode(e.target.value)} placeholder="ใส่โค้ดคูปอง" className="input flex-1" />
          <button onClick={handleApplyCode} className="btn btn-primary">ใช้โค้ด</button>
        </div>
      </div>

      <div className="space-y-4 mb-6">
        {promotions.map((promo) => (
          <div key={promo.id} className="card flex items-center gap-4">
            <div className="w-16 h-16 bg-brand-bg rounded-xl flex items-center justify-center text-2xl">
              {promo.type === 'ลูกค้าใหม่' ? '🎉' : promo.type === 'ส่งฟรี' ? '🚚' : promo.type === 'Flash Sale' ? '🔥' : '🌅'}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-brand-accent">{promo.name}</h3>
                <span className="badge badge-primary">{promo.type}</span>
              </div>
              <p className="text-brand-primary font-bold text-lg">{promo.discount}</p>
              <p className="text-xs text-brand-muted">หมดอายุ: {promo.expires}</p>
            </div>
            <div className="text-right">
              <div className="font-mono text-sm text-brand-accent bg-brand-bg px-3 py-1 rounded-lg">{promo.code}</div>
              <button onClick={() => { setAppliedCode(promo.code); handleApplyCode() }} className="btn btn-outline text-xs mt-2">ใช้เลย</button>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3 className="font-bold text-brand-accent mb-4">ชุดคอมโบ</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-brand-bg p-4 rounded-xl text-center">
            <div className="text-3xl mb-2">🍛</div>
            <h4 className="font-bold text-brand-accent">ชุดกลางวัน</h4>
            <p className="text-sm text-brand-muted">ข้าว + แกง + เครื่องดื่ม</p>
            <p className="text-brand-primary font-bold text-xl mt-2">฿99</p>
          </div>
          <div className="bg-brand-bg p-4 rounded-xl text-center">
            <div className="text-3xl mb-2">🌙</div>
            <h4 className="font-bold text-brand-accent">ชุดครอบครัว</h4>
            <p className="text-sm text-brand-muted">4 จาน + 4 เครื่องดื่ม</p>
            <p className="text-brand-primary font-bold text-xl mt-2">฿299</p>
          </div>
        </div>
      </div>
    </div>
  )
}
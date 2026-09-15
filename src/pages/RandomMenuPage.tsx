import { useState } from 'react'
import { useRewardsStore } from '@/store/rewardsStore'
import { useNavigate } from 'react-router-dom'
import { showToast } from '@/components/ui/ToastContainer'

const menuItems = [
  { id: '1', name: 'ผัดไทยกุ้งสด', price: 65, image: 'https://images.unsplash.com/photo-1559314809-0d155014e29e?w=300' },
  { id: '2', name: 'ข้าวหมทอดกระเทียม', price: 70, image: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=300' },
  { id: '3', name: 'แกงเขียวหวานไก่', price: 75, image: 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=300' },
  { id: '4', name: 'กาแฟเย็น', price: 35, image: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=300' },
  { id: '5', name: 'ไข่ดาวน้ำมัน', price: 25, image: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=300' },
  { id: '6', name: 'ขนมปังกรอบ', price: 30, image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300' },
]

export function RandomMenuPage() {
  const [selectedItem, setSelectedItem] = useState<typeof menuItems[0] | null>(null)
  const [isSpinning, setIsSpinning] = useState(false)
  const addPoints = useRewardsStore((s) => s.addPoints)
  const navigate = useNavigate()

  function spinWheel() {
    if (isSpinning) return

    setIsSpinning(true)
    addPoints(3, 'random_menu_draw')
    showToast('กำลังสุ่มเมนู... +3 แต้ม', 'info')

    setTimeout(() => {
      const randomIndex = Math.floor(Math.random() * menuItems.length)
      setSelectedItem(menuItems[randomIndex])
      setIsSpinning(false)
      showToast(`ได้คูปองลด 15% สำหรับ ${selectedItem?.name || 'เมนู'}!`, 'success')
    }, 2000)
  }

  function useDiscount() {
    if (!selectedItem) return
    
    const discountCode = `RANDOM-${Date.now().toString(36).toUpperCase()}`
    showToast(`คูปอง: ${discountCode} ลด 15%`, 'success')
    navigate('/menu')
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 text-center">
      <h1 className="text-3xl font-bold text-brand-accent mb-2">🎲 คิดไม่ออก?</h1>
      <p className="text-brand-muted mb-8">สุ่มเมนูให้เลย! ได้คูปองลด 15% ด้วย</p>

      {/* Spin Wheel */}
      <div className="card mb-6">
        {!isSpinning && !selectedItem && (
          <div className="py-12">
            <div className="text-6xl mb-4 animate-bounce">🎰</div>
            <p className="text-brand-muted mb-6">กดปุ่มเพื่อสุ่มเมน</p>
          </div>
        )}

        {isSpinning && (
          <div className="py-12">
            <div className="text-6xl mb-4 animate-spin">🎰</div>
            <p className="text-brand-primary font-bold">กำลังสุ่ม...</p>
          </div>
        )}

        {selectedItem && !isSpinning && (
          <div className="py-8">
            <img src={selectedItem.image} alt={selectedItem.name} className="w-48 h-48 rounded-2xl object-cover mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-brand-accent mb-2">{selectedItem.name}</h3>
            <p className="text-brand-primary text-xl font-bold mb-4">{selectedItem.price} บาท</p>
            <div className="bg-green-50 p-4 rounded-xl mb-4">
              <p className="text-green-800 font-medium">🎉 คุณได้รับคูปองลด 15%!</p>
              <p className="text-sm text-green-600 mt-1">ใช้กับเมนนี้ได้เลย</p>
            </div>
          </div>
        )}

        <button 
          onClick={spinWheel} 
          disabled={isSpinning}
          className="btn btn-primary text-lg py-4 px-8 disabled:opacity-50"
        >
          {isSpinning ? '⏳ กำลังสุ่ม...' : '🎲 สุ่มเมนู!'}
        </button>
      </div>

      {/* Use Discount Button */}
      {selectedItem && (
        <button onClick={useDiscount} className="btn btn-secondary w-full text-lg py-4 mb-6">
          🛒 ใช้คูปองและไปสั่งเลย
        </button>
      )}

      {/* How it works */}
      <div className="card bg-brand-bg">
        <h3 className="font-bold text-brand-accent mb-4">💡 วิธีใช้งาน</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-3xl mb-2">1️⃣</div>
            <div className="text-sm text-brand-muted">กดสุ่มเมน</div>
          </div>
          <div>
            <div className="text-3xl mb-2">2️⃣</div>
            <div className="text-sm text-brand-muted">รับคูปองลด 15%</div>
          </div>
          <div>
            <div className="text-3xl mb-2">3️⃣</div>
            <div className="text-sm text-brand-muted">ไปสั่งเลย!</div>
          </div>
        </div>
      </div>
    </div>
  )
}
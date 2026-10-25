import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { showToast } from '@/components/ui/ToastContainer'
// [G&R 156] Spin & Win — รางวัลจริงจากเซิร์ฟเวอร์ (เพดานรายวัน · ZERO-FAKE:
// ห้ามสัญญาแต้ม/คูปองฝั่งเครื่อง — policy ปิด = บอกตรง ๆ ว่ายังไม่เปิด)
import {
  fetchSpinStatus,
  trySpinReward,
  describeSpinIssue,
  type SpinStatus,
} from '@/lib/engagementClient'

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
  const [lastAward, setLastAward] = useState<string | null>(null)
  const [spinStatus, setSpinStatus] = useState<SpinStatus | null>(null)
  const [spinLoaded, setSpinLoaded] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    let active = true
    void fetchSpinStatus().then((s) => {
      if (!active) return
      setSpinStatus(s)
      setSpinLoaded(true)
    })
    return () => { active = false }
  }, [])

  async function spinWheel() {
    if (isSpinning) return
    setIsSpinning(true)
    setLastAward(null)

    // รางวัล = เซิร์ฟเวอร์ตัดสินใจเท่านั้น (เพดาน/อัตราจาก policy แอดมิน)
    let award: string | null = null
    if (spinStatus?.enabled && spinStatus.remaining_today > 0) {
      const attempt = await trySpinReward()
      if (attempt.ok) {
        award = `+${attempt.result.points} แต้ม`
        setSpinStatus((prev) => (prev ? { ...prev, ...attempt.result } : prev))
      } else {
        showToast(describeSpinIssue(attempt.reason), 'warning')
      }
    }

    await new Promise((r) => setTimeout(r, 1500))
    const picked = menuItems[Math.floor(Math.random() * menuItems.length)]
    setSelectedItem(picked)
    setLastAward(award)
    setIsSpinning(false)
    showToast(
      award ? `สุ่มได้ ${picked.name} และได้รับ ${award} จากล้อสุ่ม!` : `สุ่มได้ ${picked.name} ค่ะ`,
      'success',
    )
  }

  function goOrder() {
    if (!selectedItem) return
    navigate('/menu')
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 text-center">
      <h1 className="text-3xl font-bold text-brand-accent mb-2">🎲 คิดไม่ออก?</h1>
      <p className="text-brand-muted mb-4">สุ่มเมนูให้เลย!</p>

      {/* [G&R 156] สถานะรางวัลล้อสุ่ม — แสดงตามจริงจากเซิร์ฟเวอร์ (ZERO-FAKE) */}
      <div className="card mb-4 border-2 border-amber-300 bg-amber-50" data-testid="spin-reward-banner">
        {!spinLoaded ? (
          <p className="text-sm text-amber-800">⏳ กำลังโหลดสถานะรางวัล…</p>
        ) : spinStatus === null ? (
          <p className="text-sm text-amber-800">โหลดสถานะรางวัลไม่สำเร็จ — ยังไม่สัญญาแต้มค่ะ</p>
        ) : !spinStatus.enabled ? (
          <p className="text-sm text-amber-800">ยังไม่เปิดรางวัลล้อสุ่ม — สุ่มเมนูได้ตามปกติค่ะ</p>
        ) : (
          <div className="text-sm text-amber-800 space-y-1">
            <div>
              🎰 รางวัล: <b>{spinStatus.points_per_spin} แต้ม</b>ต่อการหมุน · เหลือ{' '}
              <b>{spinStatus.remaining_today}</b> ครั้งวันนี้
            </div>
            <div className="text-xs">แต้มสะสมของคุณ: {spinStatus.balance} แต้ม</div>
          </div>
        )}
      </div>

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
            {lastAward && (
              <div className="bg-green-50 p-4 rounded-xl mb-4" data-testid="spin-award-real">
                <p className="text-green-800 font-medium">🎉 ได้รับ {lastAward} จริงจากล้อสุ่ม!</p>
                <p className="text-sm text-green-600 mt-1">ดูประวัติแต้มได้ที่หน้า "รางวัลและแต้ม"</p>
              </div>
            )}
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

      {/* Go to menu — ไม่มีคูปองปลอม: ไปสั่งจริง ๆ เท่านั้น */}
      {selectedItem && (
        <button onClick={goOrder} className="btn btn-secondary w-full text-lg py-4 mb-6">
          🛒 ไปดูเมนูและสั่งเลย
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
            <div className="text-sm text-brand-muted">
              {spinStatus?.enabled ? `ลุ้น ${spinStatus.points_per_spin} แต้ม/วัน` : 'ดูเมนูที่สุ่มได้'}
            </div>
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
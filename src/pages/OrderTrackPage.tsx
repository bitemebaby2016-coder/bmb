import { useParams, Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { showToast } from '@/components/ui/ToastContainer'

const statusSteps = [
  { key: 'pending', label: 'รอการยืนยัน', icon: '⏳' },
  { key: 'confirmed', label: 'ยืนยันแล้ว', icon: '✅' },
  { key: 'preparing', label: 'กำลังงทำ', icon: '👨‍🍳' },
  { key: 'ready_for_dispatch', label: 'พร้อมส่ง', icon: '' },
  { key: 'dispatched', label: 'กำลังงส่ง', icon: '🛵' },
  { key: 'delivered', label: 'ส่งสำเรจ', icon: '' },
]

export function OrderTrackPage() {
  const { orderNumber } = useParams()
  const [orderStatus, setOrderStatus] = useState('preparing')
  const [eta, setEta] = useState('15 นาที')

  useEffect(() => {
    // Mock real-time updates
    const interval = setInterval(() => {
      const currentIndex = statusSteps.findIndex(s => s.key === orderStatus)
      if (currentIndex < statusSteps.length - 1) {
        setOrderStatus(statusSteps[currentIndex + 1].key)
        showToast(`สถานะ: ${statusSteps[currentIndex + 1].label}`, 'info')
      }
    }, 30000) // Update every 30 seconds

    return () => clearInterval(interval)
  }, [orderStatus])

  const currentStepIndex = statusSteps.findIndex(s => s.key === orderStatus)

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <Link to="/" className="text-brand-primary mb-4 inline-block hover:underline">
        ← กลับหน้าแรก
      </Link>

      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-brand-accent">📍 ติดตามออเดอร์</h1>
          <span className="badge badge-primary">#{orderNumber}</span>
        </div>

        {/* Progress Steps */}
        <div className="mb-6">
          <div className="flex items-center justify-between relative">
            <div className="absolute top-6 left-0 right-0 h-1 bg-brand-border z-0"></div>
            <div 
              className="absolute top-6 left-0 h-1 bg-brand-primary z-0 transition-all duration-500"
              style={{ width: `${(currentStepIndex / (statusSteps.length - 1)) * 100}%` }}
            ></div>
            
            {statusSteps.map((step, index) => (
              <div key={step.key} className="relative z-10 flex flex-col items-center">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl ${
                  index <= currentStepIndex ? 'bg-brand-primary text-white' : 'bg-brand-border text-brand-muted'
                }`}>
                  {step.icon}
                </div>
                <span className={`text-xs mt-2 text-center ${
                  index <= currentStepIndex ? 'text-brand-primary font-bold' : 'text-brand-muted'
                }`}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Current Status */}
        <div className="bg-brand-bg p-4 rounded-xl mb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{statusSteps[currentStepIndex].icon}</span>
            <div>
              <h3 className="font-bold text-brand-accent">{statusSteps[currentStepIndex].label}</h3>
              <p className="text-sm text-brand-muted">
                {orderStatus === 'preparing' && 'กำลังจัดเตรียมอาหารของคุณ'}
                {orderStatus === 'ready_for_dispatch' && 'อาหารพร้อมส่ง รอคนส่งรับ'}
                {orderStatus === 'dispatched' && 'คนส่งกำลังเดินทางมา'}
                {orderStatus === 'delivered' && 'ส่งสำเร็จ! ขอบคุณที่ใช้บริการ'}
              </p>
            </div>
          </div>
        </div>

        {/* ETA */}
        {orderStatus !== 'delivered' && orderStatus !== 'pending' && (
          <div className="flex items-center justify-between bg-green-50 p-4 rounded-xl">
            <div>
              <div className="text-sm text-green-800">⏱️ คาดว่าจะถึง</div>
              <div className="text-xl font-bold text-green-700">{eta}</div>
            </div>
            <button className="btn btn-outline text-sm">
              📞 ติดต่อเรา
            </button>
          </div>
        )}
      </div>

      {/* Order Details */}
      <div className="card">
        <h3 className="font-bold text-brand-accent mb-4"> รายละเอียดออเดอร์</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-brand-muted">วันที่สั่งซื้อ</span>
            <span>{new Date().toLocaleDateString('th-TH')}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-brand-muted">รอบจัดส่ง</span>
            <span>รอบเช้า</span>
          </div>
          <div className="flex justify-between">
            <span className="text-brand-muted">รายการ</span>
            <span>ผัดไทย x2, ข้าวแกง x1</span>
          </div>
          <div className="flex justify-between font-bold">
            <span>รวม</span>
            <span className="text-brand-primary">230 บาท</span>
          </div>
        </div>
      </div>

      {/* Rating Prompt */}
      {orderStatus === 'delivered' && (
        <div className="card mt-6 bg-gradient-to-r from-yellow-50 to-orange-50">
          <div className="text-center">
            <div className="text-4xl mb-2">⭐</div>
            <h3 className="font-bold text-brand-accent mb-2">รีวิวประสบการณ์ของคุณ</h3>
            <p className="text-sm text-brand-muted mb-4">ช่วยเราพัฒนาบริการให้ดียิ่งขึ้น</p>
            <div className="flex justify-center gap-2 mb-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} className="text-3xl hover:scale-125 transition-transform">
                  ⭐
                </button>
              ))}
            </div>
            <button className="btn btn-primary">
              ส่งรีวิว
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
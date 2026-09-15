import { useState } from 'react'
import { useRewardsStore } from '@/store/rewardsStore'
import { showToast } from '@/components/ui/ToastContainer'

export function SharePage() {
  const [referralCode] = useState('BMB-' + Math.random().toString(36).substr(2, 6).toUpperCase())
  const addPoints = useRewardsStore((s) => s.addPoints)

  function handleShare(platform: string) {
    const shareUrl = `https://biteme.co.th/ref/${referralCode}`
    let shareUrlFinal = shareUrl
    
    if (platform === 'line') shareUrlFinal = `https://line.me/R/msg/text/?text=${encodeURIComponent('มาสั่งอาหารกับ Bite Me Baby! ใช้โค้ด ' + referralCode + ' ลด 30 บาท!')}`
    else if (platform === 'facebook') shareUrlFinal = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`
    else if (platform === 'twitter') shareUrlFinal = `https://twitter.com/intent/tweet?text=${encodeURIComponent('มาสั่งอาหารกับ Bite Me Baby! ' + shareUrl)}`
    else if (platform === 'whatsapp') shareUrlFinal = `https://wa.me/?text=${encodeURIComponent('มาสั่งอาหารกับ Bite Me Baby! ใช้โค้ด ' + referralCode + ' ลด 30 บาท! ' + shareUrl)}`
    else if (platform === 'copy') {
      navigator.clipboard.writeText(shareUrl)
      showToast('คัดลอกลิงก์แล้ว!', 'success')
      addPoints(5, 'share_page')
      return
    }

    window.open(shareUrlFinal, '_blank')
    addPoints(10, `share_${platform}`)
    showToast(`แชร์ ${platform} สำเร็จ! +10 แต้ม`, 'success')
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 text-center">
      <h1 className="text-3xl font-bold text-brand-accent mb-2">📢 แชร์เพื่อน รับแต้ม!</h1>
      <p className="text-brand-muted mb-8">เชิญเพื่อนสั่งอาหาร คุณและเพื่อนได้คูปองคนละ ฿30</p>

      <div className="card mb-6 bg-brand-bg">
        <h3 className="font-bold text-brand-accent mb-3">โค้ดเชิญของคุณ</h3>
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="font-mono text-2xl font-bold text-brand-primary bg-white px-6 py-3 rounded-xl border-2 border-brand-primary">{referralCode}</div>
          <button onClick={() => handleShare('copy')} className="btn btn-primary">📋 คัดลอก</button>
        </div>
      </div>

      <h3 className="font-bold text-brand-accent mb-4">แชร์ผ่าน</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <button onClick={() => handleShare('line')} className="card hover:scale-105 transition-transform">
          <div className="text-4xl mb-2">💬</div>
          <div className="font-bold text-brand-accent">LINE</div>
          <div className="text-xs text-brand-muted">+10 แต้ม</div>
        </button>
        <button onClick={() => handleShare('facebook')} className="card hover:scale-105 transition-transform">
          <div className="text-4xl mb-2">👥</div>
          <div className="font-bold text-brand-accent">Facebook</div>
          <div className="text-xs text-brand-muted">+10 แต้ม</div>
        </button>
        <button onClick={() => handleShare('twitter')} className="card hover:scale-105 transition-transform">
          <div className="text-4xl mb-2">🐦</div>
          <div className="font-bold text-brand-accent">Twitter</div>
          <div className="text-xs text-brand-muted">+10 แต้ม</div>
        </button>
        <button onClick={() => handleShare('whatsapp')} className="card hover:scale-105 transition-transform">
          <div className="text-4xl mb-2">📱</div>
          <div className="font-bold text-brand-accent">WhatsApp</div>
          <div className="text-xs text-brand-muted">+10 แต้ม</div>
        </button>
        <button onClick={() => handleShare('copy')} className="card hover:scale-105 transition-transform">
          <div className="text-4xl mb-2">🔗</div>
          <div className="font-bold text-brand-accent">คัดลอกลิงก์</div>
          <div className="text-xs text-brand-muted">+5 แต้ม</div>
        </button>
      </div>
    </div>
  )
}
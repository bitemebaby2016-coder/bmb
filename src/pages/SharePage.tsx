import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { showToast } from '@/components/ui/ToastContainer'
import {
  fetchMyReferralStatus,
  referralShareUrl,
  type MyReferralStatus,
} from '@/lib/referralClient'

/**
 * G&R STAGE 2 (154) — หน้าแชร์ "ของจริง":
 *   * โค้ด = จากเซิร์ฟเวอร์ (referral_my_status) — เดิมเป็น random ในเครื่อง (ของปลอม)
 *   * ลิงก์ = base ที่แอดมินตั้ง (share_base_url) หรือ origin ปัจจุบัน + /?ref=CODE
 *   * รางวัล = ledger จริง (คูปองที่ออก/ถูกปรับกลับ) + จำนวนเงินจากนโยบาย
 *   * ไม่มี "แกล้งให้แต้ม" ตอนกดแชร์อีกต่อไป (ZERO-FAKE — แต้มจริง = Stage 3)
 */
export function SharePage() {
  const [status, setStatus] = useState<MyReferralStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void fetchMyReferralStatus().then((st) => {
      if (cancelled) return
      setStatus(st)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const code = status?.code ?? ''
  const shareUrl = referralShareUrl(status?.share_base_url, code)
  const refReward = status?.referrer_reward_baht ?? 0
  const friendReward = status?.friend_reward_baht ?? 0

  function handleShare(platform: string) {
    if (!code) {
      showToast('เข้าสู่ระบบเพื่อรับโค้ดแนะนำของคุณก่อน', 'warning')
      return
    }
    const pitch = `มาสั่งอาหารกับ Bite Me Baby! ใช้โค้ด ${code} สั่งแรก คุณและเพื่อนได้คูปองคนละ ฿${friendReward}`
    let shareUrlFinal = shareUrl

    if (platform === 'line') {
      shareUrlFinal = `https://line.me/R/msg/text/?text=${encodeURIComponent(pitch + ' ' + shareUrl)}`
    } else if (platform === 'facebook') {
      shareUrlFinal = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`
    } else if (platform === 'twitter') {
      shareUrlFinal = `https://twitter.com/intent/tweet?text=${encodeURIComponent(pitch + ' ' + shareUrl)}`
    } else if (platform === 'whatsapp') {
      shareUrlFinal = `https://wa.me/?text=${encodeURIComponent(pitch + ' ' + shareUrl)}`
    } else if (platform === 'copy') {
      void navigator.clipboard.writeText(shareUrl).then(
        () => showToast('คัดลอกลิงก์แนะนำของคุณแล้ว!', 'success'),
        () => showToast('คัดลอกไม่สำเร็จ — กดคัดลอกจากช่องลิงก์ด้านล่างแทน', 'warning'),
      )
      return
    }

    window.open(shareUrlFinal, '_blank')
    showToast('แชร์แล้ว — เพื่อนสั่งซื้อสำเร็จ คุณทั้งคู่ได้คูปอง!', 'success')
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 text-center">
      <h1 className="text-3xl font-bold text-brand-accent mb-2">📢 ชวนเพื่อน รับคูปอง!</h1>
      <p className="text-brand-muted mb-8">
        เชิญเพื่อนสั่งอาหาร — คุณและเพื่อนได้คูปองคนละ ฿{friendReward}{' '}
        เมื่อออเดอร์แรกของเพื่อนใหม่ผ่านสถานะที่กำหนด
      </p>

      {loading ? (
        <div className="card mb-6 bg-brand-bg">กำลังโหลดโค้ดแนะนำของคุณ…</div>
      ) : !status ? (
        <div className="card mb-6 bg-brand-bg space-y-3">
          <p className="text-brand-muted">
            เข้าสู่ระบบเพื่อรับโค้ดแนะนำเฉพาะตัวของคุณ — แชร์ลิงก์ให้เพื่อน
            ระบบบันทึกสิทธิ์อัตโนมัติตอนเพื่อนสั่งซื้อสำเร็จ
          </p>
          <Link to="/login" className="btn btn-primary inline-block">เข้าสู่ระบบ</Link>
        </div>
      ) : (
        <>
          {!status.enabled && (
            <div className="rounded-xl bg-amber-50 border border-amber-300 text-amber-800 p-3 mb-6 text-sm">
              ระบบแนะนำเพื่อนปิดรับชั่วคราว — แชร์ได้ แต่ยังไม่บันทึกสิทธิ์จนกว่าแอดมินจะเปิด
            </div>
          )}

          <div className="card mb-6 bg-brand-bg">
            <h3 className="font-bold text-brand-accent mb-3">โค้ดเชิญของคุณ</h3>
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="font-mono text-2xl font-bold text-brand-primary bg-white px-6 py-3 rounded-xl border-2 border-brand-primary">
                {code}
              </div>
              <button onClick={() => handleShare('copy')} className="btn btn-primary">📋 คัดลอก</button>
            </div>
            <div className="text-xs text-brand-muted break-all font-mono bg-white rounded-lg p-2" data-testid="share-url">
              {shareUrl}
            </div>
            <p className="text-xs text-brand-muted mt-2">
              เพื่อนเปิดลิงก์นี้ → โค้ดเข้าตะกร้าอัตโนมัติ → รางวัลออกเมื่อออเดอร์แรกของเพื่อนผ่านสถานะที่กำหนด
              (คุณ ฿{refReward} · เพื่อน ฿{friendReward})
            </p>
          </div>

          <h3 className="font-bold text-brand-accent mb-4">แชร์ผ่าน</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <button onClick={() => handleShare('line')} className="card hover:scale-105 transition-transform">
              <div className="text-4xl mb-2">💬</div>
              <div className="font-bold text-brand-accent">LINE</div>
            </button>
            <button onClick={() => handleShare('facebook')} className="card hover:scale-105 transition-transform">
              <div className="text-4xl mb-2">👥</div>
              <div className="font-bold text-brand-accent">Facebook</div>
            </button>
            <button onClick={() => handleShare('twitter')} className="card hover:scale-105 transition-transform">
              <div className="text-4xl mb-2">🐦</div>
              <div className="font-bold text-brand-accent">Twitter</div>
            </button>
            <button onClick={() => handleShare('whatsapp')} className="card hover:scale-105 transition-transform">
              <div className="text-4xl mb-2">📱</div>
              <div className="font-bold text-brand-accent">WhatsApp</div>
            </button>
            <button onClick={() => handleShare('copy')} className="card hover:scale-105 transition-transform">
              <div className="text-4xl mb-2">🔗</div>
              <div className="font-bold text-brand-accent">คัดลอกลิงก์</div>
            </button>
          </div>

          <div className="card text-left" data-testid="share-rewards">
            <h3 className="font-bold text-brand-accent mb-3">🎁 รางวัลของคุณ (บันทึกจริงในระบบ)</h3>
            {status.rewards.length === 0 ? (
              <p className="text-sm text-brand-muted">
                ยังไม่มีรางวัล — เมื่อเพื่อนที่คุณแนะนำสั่งซื้อสำเร็จ คูปองจะเข้าที่นี่
                พร้อมแจ้งเตือนในโปรไฟล์ของคุณ
              </p>
            ) : (
              <ul className="space-y-2">
                {status.rewards.map((r) => (
                  <li
                    key={`${r.coupon_code}-${r.role}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-brand-border p-3 text-sm"
                  >
                    <div className="min-w-0 text-left">
                      <span className="font-mono font-bold">{r.coupon_code}</span>
                      <span className="text-brand-muted">
                        {' '}· {r.role === 'referrer' ? 'รางวัลผู้แนะนำ' : 'รางวัลเพื่อนใหม่'}
                      </span>
                      <div className="text-xs text-brand-muted">
                        {r.state === 'issued'
                          ? `มูลค่า ฿${Number(r.amount)} — ใช้ได้ตามวันหมดอายุของคูปอง`
                          : `ถูกปรับกลับตาม ledger${r.reversal_reason ? ` (${r.reversal_reason})` : ''}`}
                      </div>
                    </div>
                    <span
                      className={`badge shrink-0 ${r.state === 'issued' ? 'bg-green-100 text-green-800' : 'bg-brand-bg text-brand-muted'}`}
                    >
                      {r.state === 'issued' ? 'ใช้ได้' : 'ปรับกลับแล้ว'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}
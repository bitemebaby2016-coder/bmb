import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { showToast } from '@/components/ui/ToastContainer'
// R21d backlog: โหลดเมนูโหวตไม่สำเร็จต้องฟ้อง + ลองใหม่ (เดิม catch เฉย ๆ = หน้าเปล่าเงียบ)
import { LoadErrorBanner } from '@/components/ui/LoadErrorBanner'
import { getProducts } from '@/lib/bmbAdminApi_products'
// R53 (Owner 2026-11-18): โหวตจริงจากตาราง preorder_votes ผ่าน server RPC (m208) —
// เดิม: โหวต 1 ครั้ง = createProduct() สร้างสินค้าซ้ำใน DB + % โหวตคำนวณจาก prep_minutes (ปลอม)
//       + addPoints แต้มปลอมฝั่งเครื่อง (สัญญา "5 แต้ม/แลกคูปอง" ที่ระบบไม่มี)
// ใหม่: ตัวเลขทุกตัว = ข้อมูลจริงจาก server · โหวตซ้ำ/เกินเพดาน = server ตัดสิน (ZERO-FAKE)
import { fetchVoteStatus, castPreorderVote, describeVoteIssue, type VoteStatus } from '@/lib/voteClient'
// R53: ซิงกระบบโปรโมชันจริงจากแอดมิน — แถบโปรที่กำลังรัน (แสดงเมื่อมีจริงเท่านั้น)
import { getPromotionsWithStatus, type PromotionRow } from '@/lib/bmbAdminApi_promotions'
import { isPromoLiveNow, promoDiscountLabel } from '@/pages/PromotionsPage'
import type { Product } from '@/types'

export function VotePage() {
  const [pollOptions, setPollOptions] = useState<Product[]>([])
  const [voteStatus, setVoteStatus] = useState<VoteStatus | null>(null)
  const [statusLoaded, setStatusLoaded] = useState(false)
  const [castingId, setCastingId] = useState<string | null>(null)
  const [livePromos, setLivePromos] = useState<PromotionRow[]>([])
  // R21d: โหลดล้มเหลว ≠ ไม่มีเมนูโหวต + key สำหรับกดลองใหม่
  const [loadError, setLoadError] = useState('')
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let active = true
    async function loadData() {
      setLoadError('')
      try {
        // L-5 (N-4 #5 · Owner 2026-10-26): หน้าโหวตต้องแสดง "ครบทุกเมนูจริง"
        // (เดิมกรองเฉพาะ available_preorder → เมนูส่งวันนี้หายเกือบทั้งหมด)
        // archived = ถูกเก็บออกจากแคตตาล็อกแล้ว = ไม่ใช่เมนู → ตัดออก ส่วนที่เหลือโชว์ครบ
        const products = await getProducts()
        if (!active) return
        setPollOptions(products.filter((p: Product) => !p.archived))
      } catch (err) {
        console.error('[VotePage] Load error:', err)
        if (active) setLoadError('โหลดเมนูโหวตไม่สำเร็จ — ตรวจสอบการเชื่อมต่อแล้วกด "ลองใหม่"')
      }
    }
    loadData()

    // R53: ผลโหวตจริง + สถานะของฉัน (server เป็นคนตัดสิน · โหลดไม่ได้ = ไม่โชว์ตัวเลข)
    void fetchVoteStatus().then((s) => {
      if (!active) return
      setVoteStatus(s)
      setStatusLoaded(true)
    })

    // R53: โปรโมชันจริงจากแอดมิน (เฉพาะที่กำลังรันตามหน้าต่างเวลาจริง)
    void (async () => {
      try {
        const { rows, ok } = await getPromotionsWithStatus()
        if (!active || !ok) return
        setLivePromos(rows.filter((p) => isPromoLiveNow(p)).slice(0, 3))
      } catch {
        /* โปรโหลดไม่ได้ = แถบโปรไม่แสดง (ไม่แสร้งว่ามีโปร) */
      }
    })()

    return () => { active = false }
  }, [retryKey])

  const myVotes = voteStatus?.myVotes ?? []
  const tallies = voteStatus?.tallies ?? {}
  const policyEnabled = voteStatus?.policy.enabled ?? false
  const remainingToday = voteStatus?.remaining_today ?? 0
  // โหวตได้ = policy เปิด + ยังไม่เกินเพดานวันนี้ (server ตัดสินอีกครั้งตอนกด — หน้าแค่ precheck)
  const canVoteNow = policyEnabled && remainingToday > 0
  const totalVotes = Object.values(tallies).reduce((a, b) => a + b, 0)

  async function handleVote(optionId: string) {
    if (castingId) {
      showToast('กำลังบันทึกโหวตอยู่ กรุณารอสักครู่', 'warning')
      return
    }
    if (!canVoteNow) {
      showToast(
        !policyEnabled ? 'ยังไม่เปิดการโหวตในขณะนี้ค่ะ' : 'โหวตครบจำนวนของวันนี้แล้ว — กลับมาโหวตใหม่พรุ่งนี้นะคะ',
        'warning',
      )
      return
    }
    setCastingId(optionId)
    const attempt = await castPreorderVote(optionId)
    if (attempt.ok) {
      // ผลล่าสุดจาก server เสมอ (ไม่เดาตัวเลขฝั่งเครื่อง)
      const fresh = await fetchVoteStatus()
      setVoteStatus(fresh)
      const option = pollOptions.find((p) => p.id === optionId)
      showToast(`โหวต "${option?.name ?? 'เมนู'}" สำเร็จ — ขอบคุณที่ช่วยเลือกเมนูค่ะ`, 'success')
    } else {
      showToast(describeVoteIssue(attempt.reason), attempt.reason === 'signed_out' ? 'info' : 'warning')
    }
    setCastingId(null)
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-brand-accent mb-2">🗳️ โหวตเมนูใหม่</h1>
        <p className="text-brand-muted">ช่วยเราเลือกเมนูที่จะเพิ่มใหม่! โหวตครั้งละ 1 เมนูต่อวัน</p>
      </div>

      {/* R53: โปรโมชันจริงจากแอดมินที่กำลังรัน (ซิงกระบบโปรโมชัน — แสดงเมื่อมีจริงเท่านั้น) */}
      {livePromos.length > 0 && (
        <div className="card mb-6 bg-gradient-to-r from-purple-50 to-pink-50">
          <h3 className="font-bold text-brand-accent mb-3">🎟️ โปรโมชั่นที่กำลังรัน</h3>
          <div className="space-y-2">
            {livePromos.map((promo) => (
              <div key={promo.id} className="flex items-center gap-3 text-sm">
                <span className="font-bold text-brand-accent line-clamp-1 flex-1">{promo.name}</span>
                <span className="text-brand-primary font-bold whitespace-nowrap">{promoDiscountLabel(promo)}</span>
              </div>
            ))}
          </div>
          <Link to="/promotions" className="btn btn-outline text-xs mt-3 inline-block">ดูโปรโมชั่นทั้งหมด →</Link>
        </div>
      )}

      {/* Poll Card */}
      <div className="card mb-6 bg-gradient-to-r from-blue-50 to-indigo-50">
        <h3 className="font-bold text-brand-accent mb-4 text-xl">🎯 เมนูไหนที่น่าลอง?</h3>
        {statusLoaded && voteStatus !== null && (
          <p className="text-sm text-brand-muted mb-4" data-testid="vote-status-line">
            {policyEnabled
              ? remainingToday > 0
                ? `วันนี้โหวตได้อีก ${remainingToday} เมนู`
                : 'โหวตครบจำนวนของวันนี้แล้ว — กลับมาใหม่พรุ่งนี้นะคะ'
              : 'ยังไม่เปิดการโหวตในขณะนี้ — ดูผลโหวตได้ตามปกติค่ะ'}
          </p>
        )}
        {!statusLoaded && (
          <p className="text-sm text-brand-muted mb-4">⏳ กำลังโหลดสถานะการโหวต…</p>
        )}

        <div className="space-y-3">
          {pollOptions.map((option) => {
            const votes = tallies[option.id] ?? 0
            const percentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 0
            const isSelected = myVotes.includes(option.id)
            const disabled = !!castingId || !canVoteNow || isSelected

            return (
              <button
                key={option.id}
                onClick={() => handleVote(option.id)}
                disabled={disabled}
                className={`w-full p-4 rounded-xl text-left transition-all ${
                  isSelected
                    ? 'bg-brand-primary text-white border-2 border-brand-primary'
                    : 'bg-brand-surface border-2 border-brand-border hover:border-brand-primary disabled:opacity-60'
                }`}
              >
                <div className="flex items-center gap-4">
                  <img src={option.image_url || '/placeholder.svg'} alt={option.name} className="w-16 h-16 rounded-lg object-cover" />
                  <div className="flex-1">
                    <div className="font-bold mb-1">{option.name}</div>
                    <div className={`text-sm ${isSelected ? 'text-white opacity-80' : 'text-brand-muted'}`}>
                      {votes.toLocaleString('th-TH')} โหวต ({percentage.toFixed(0)}%)
                    </div>
                    <div className="mt-2 h-2 bg-white/20 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${isSelected ? 'bg-white' : 'bg-brand-primary'}`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                  {isSelected && <span className="text-2xl">✅</span>}
                  {!isSelected && !canVoteNow && policyEnabled && <span className="text-xs text-brand-muted">โหวตพรุ่งนี้</span>}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* R53: โหวตครบเพดานวันนี้แล้ว → ข้อความตรงตามจริง */}
      {statusLoaded && voteStatus !== null && !canVoteNow && pollOptions.length > 0 && (
        <div className="card mb-6 text-center" data-testid="vote-all-voted">
          <p className="text-brand-muted text-sm">
          {policyEnabled ? 'คุณโหวตครบของวันนี้แล้ว — ขอบคุณที่ร่วมเลือกเมนูค่ะ 🙏' : 'ยังไม่เปิดการโหวตในขณะนี้ — ติดตามหน้านี้เพื่อร่วมโหวตค่ะ'}
        </p>
        </div>
      )}

      {/* R21d: โหลดเมนูล้มเหลวต้องฟ้อง (หน้าเปล่า = ผู้ใช้เข้าใจผิดว่าไม่มีเมนูให้โหวต) */}
      {loadError && (
        <div className="mb-4">
          <LoadErrorBanner message={loadError} onRetry={() => setRetryKey((n) => n + 1)} testId="vote-load-error" />
        </div>
      )}

      {/* Results Summary — ตัวเลขจริงจาก server เท่านั้น */}
      <div className="card">
        <h3 className="font-bold text-brand-accent mb-4">📊 สรุปผลโหวต</h3>
        {!statusLoaded && <p className="text-sm text-brand-muted">⏳ กำลังโหลดผลโหวต…</p>}
        {statusLoaded && voteStatus === null && (
          <p className="text-sm text-brand-muted">โหลดผลโหวตไม่สำเร็จ — กด "ลองใหม่" ด้านบนเพื่อลองอีกครั้งค่ะ</p>
        )}
        {statusLoaded && voteStatus !== null && (
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-brand-bg rounded-xl">
              <div className="text-3xl font-bold text-brand-primary">{totalVotes.toLocaleString('th-TH')}</div>
              <div className="text-sm text-brand-muted">โหวตทั้งหมด</div>
            </div>
            <div className="text-center p-4 bg-brand-bg rounded-xl">
              <div className="text-3xl font-bold text-brand-primary">{pollOptions.length}</div>
              <div className="text-sm text-brand-muted">ตัวเลือก</div>
            </div>
          </div>
        )}
      </div>

      {/* R53: เอาการ์ด "เคล็ดลับ" เดิมออก — เดิมมีสัญญาแต้มและสิทธิ์ที่ระบบไม่มี (ZERO-FAKE) */}
      <div className="card mt-6 bg-green-50 border-2 border-green-200">
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div>
            <h4 className="font-bold text-green-800 mb-1">เมนูยอดนิยมไปไหน?</h4>
            <p className="text-sm text-green-700">
              เมนูที่ได้โหวตมากที่สุดจะถูกนำไปพิจารณาเปิดขายในรอบถัดไป — ผลโหวตแสดงสดจากระบบจริงทุกครั้งที่มีคนโหวต
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

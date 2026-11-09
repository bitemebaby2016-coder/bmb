// ============================================
// Bite Me Baby — Settings Tab (Marketing Rules + G&R Panels)
// ============================================
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { showToast } from '@/components/ui/ToastContainer'
import { getMarketingRules, saveMarketingRules, type MarketingRules } from '@/lib/adminMarketing'
import { getBusinessSettings, setBusinessSetting } from '@/lib/bmbAdminApi_settings'

export function SettingsTab() {
  const [rules, setRules] = useState<MarketingRules | null>(null)
  const [ruleFreq, setRuleFreq] = useState(3)
  const [ruleStart, setRuleStart] = useState('10:00')
  const [ruleEnd, setRuleEnd] = useState('19:00')
  const [ruleCooldown, setRuleCooldown] = useState(6)
  const [loading, setLoading] = useState(true)

  // G&R panels state
  const [promoEnabled, setPromoEnabled] = useState(true)
  const [promoPercent, setPromoPercent] = useState<number | ''>(15)
  const [promoUnlimited, setPromoUnlimited] = useState(false)

  const [refEnabled, setRefEnabled] = useState(true)
  const [refReferrerBaht, setRefReferrerBaht] = useState<number | ''>(30)
  const [refFriendBaht, setRefFriendBaht] = useState<number | ''>(30)
  const [refQualifyStatus, setRefQualifyStatus] = useState('delivered')
  const [refValidityDays, setRefValidityDays] = useState<number | ''>(30)
  const [refMonthlyCap, setRefMonthlyCap] = useState<number | ''>(20)
  const [refMinOrder, setRefMinOrder] = useState<number | ''>(0)
  const [refClaimWindow, setRefClaimWindow] = useState<number | ''>(72)
  const [refShareBase, setRefShareBase] = useState('')

  const [loyaltyTiersEnabled, setLoyaltyTiersEnabled] = useState(true)
  const [loyaltyWindowMonths, setLoyaltyWindowMonths] = useState<number | ''>(12)
  const [loyaltySilverMin, setLoyaltySilverMin] = useState<number | ''>(1500)
  const [loyaltyGoldMin, setLoyaltyGoldMin] = useState<number | ''>(4000)
  const [loyaltyPlatinumMin, setLoyaltyPlatinumMin] = useState<number | ''>(8000)
  const [loyaltyPointsEnabled, setLoyaltyPointsEnabled] = useState(false)
  const [loyaltyPointsPerBaht, setLoyaltyPointsPerBaht] = useState<number | ''>(0)

  const [spinEnabled, setSpinEnabled] = useState(false)
  const [spinDailyLimit, setSpinDailyLimit] = useState<number | ''>(1)
  const [spinPointsPerSpin, setSpinPointsPerSpin] = useState<number | ''>(0)

  const [affEnabled, setAffEnabled] = useState(false)
  const [affTier1, setAffTier1] = useState<number | ''>(5)
  const [affTier2, setAffTier2] = useState<number | ''>(10)
  const [affTier3, setAffTier3] = useState<number | ''>(15)
  const [affCookieDays, setAffCookieDays] = useState<number | ''>(30)
  const [affMinOrder, setAffMinOrder] = useState<number | ''>(0)
  const [affPayoutThreshold, setAffPayoutThreshold] = useState<number | ''>(500)

  const [rewardsCatalog, setRewardsCatalog] = useState<Array<{ id: string; name: string; cost_points: number; stock: number; is_active: boolean }>>([])
  const [rewardForm, setRewardForm] = useState({ name: '', cost_points: 0, stock: 0 })

  useEffect(() => {
    void loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    const [r, settings] = await Promise.all([getMarketingRules(), getBusinessSettings()])
    if (r) {
      setRules(r)
      setRuleFreq(r.frequency_per_week)
      setRuleStart(r.publishing_window?.start ?? '10:00')
      setRuleEnd(r.publishing_window?.end ?? '19:00')
      setRuleCooldown(r.cooldown_hours)
    }
    // Load G&R policies from business_settings
    const promoPolicy = settings['promotion_policy']
    if (promoPolicy && typeof promoPolicy === 'object') {
      if (typeof promoPolicy.promotions_enabled === 'boolean') setPromoEnabled(promoPolicy.promotions_enabled)
      if (promoPolicy.budget_percent === null) { setPromoUnlimited(true); setPromoPercent('') }
      else if (Number.isFinite(Number(promoPolicy.budget_percent))) { setPromoUnlimited(false); setPromoPercent(Number(promoPolicy.budget_percent)) }
    }
    const refPolicy = settings['referral_policy']
    if (refPolicy && typeof refPolicy === 'object') {
      if (typeof refPolicy.enabled === 'boolean') setRefEnabled(refPolicy.enabled)
      if (Number.isFinite(Number(refPolicy.referrer_reward_baht))) setRefReferrerBaht(Number(refPolicy.referrer_reward_baht))
      if (Number.isFinite(Number(refPolicy.friend_reward_baht))) setRefFriendBaht(Number(refPolicy.friend_reward_baht))
      if (typeof refPolicy.qualify_status === 'string') setRefQualifyStatus(refPolicy.qualify_status)
      if (Number.isFinite(Number(refPolicy.coupon_validity_days))) setRefValidityDays(Number(refPolicy.coupon_validity_days))
      if (refPolicy.referrer_monthly_cap === null) setRefMonthlyCap('')
      else if (Number.isFinite(Number(refPolicy.referrer_monthly_cap))) setRefMonthlyCap(Number(refPolicy.referrer_monthly_cap))
      if (Number.isFinite(Number(refPolicy.min_order_amount))) setRefMinOrder(Number(refPolicy.min_order_amount))
      if (Number.isFinite(Number(refPolicy.claim_window_hours))) setRefClaimWindow(Number(refPolicy.claim_window_hours))
      if (typeof refPolicy.share_base_url === 'string') setRefShareBase(refPolicy.share_base_url)
    }
    const loyaltyPolicy = settings['loyalty_policy']
    if (loyaltyPolicy && typeof loyaltyPolicy === 'object') {
      if (typeof loyaltyPolicy.tiers_enabled === 'boolean') setLoyaltyTiersEnabled(loyaltyPolicy.tiers_enabled)
      if (Number.isFinite(Number(loyaltyPolicy.window_months))) setLoyaltyWindowMonths(Number(loyaltyPolicy.window_months))
      if (Number.isFinite(Number(loyaltyPolicy.tier_silver_min))) setLoyaltySilverMin(Number(loyaltyPolicy.tier_silver_min))
      if (Number.isFinite(Number(loyaltyPolicy.tier_gold_min))) setLoyaltyGoldMin(Number(loyaltyPolicy.tier_gold_min))
      if (Number.isFinite(Number(loyaltyPolicy.tier_platinum_min))) setLoyaltyPlatinumMin(Number(loyaltyPolicy.tier_platinum_min))
      if (typeof loyaltyPolicy.points_enabled === 'boolean') setLoyaltyPointsEnabled(loyaltyPolicy.points_enabled)
      if (Number.isFinite(Number(loyaltyPolicy.points_per_baht))) setLoyaltyPointsPerBaht(Number(loyaltyPolicy.points_per_baht))
    }
    const spinPolicy = settings['spin_policy']
    if (spinPolicy && typeof spinPolicy === 'object') {
      if (typeof spinPolicy.enabled === 'boolean') setSpinEnabled(spinPolicy.enabled)
      if (Number.isFinite(Number(spinPolicy.daily_limit))) setSpinDailyLimit(Number(spinPolicy.daily_limit))
      if (Number.isFinite(Number(spinPolicy.points_per_spin))) setSpinPointsPerSpin(Number(spinPolicy.points_per_spin))
    }
    const affPolicy = settings['affiliate_policy']
    if (affPolicy && typeof affPolicy === 'object') {
      if (typeof affPolicy.enabled === 'boolean') setAffEnabled(affPolicy.enabled)
      if (Number.isFinite(Number(affPolicy.tier1_percent))) setAffTier1(Number(affPolicy.tier1_percent))
      if (Number.isFinite(Number(affPolicy.tier2_percent))) setAffTier2(Number(affPolicy.tier2_percent))
      if (Number.isFinite(Number(affPolicy.tier3_percent))) setAffTier3(Number(affPolicy.tier3_percent))
      if (Number.isFinite(Number(affPolicy.cookie_days))) setAffCookieDays(Number(affPolicy.cookie_days))
      if (Number.isFinite(Number(affPolicy.min_order_amount))) setAffMinOrder(Number(affPolicy.min_order_amount))
      if (Number.isFinite(Number(affPolicy.payout_threshold_baht))) setAffPayoutThreshold(Number(affPolicy.payout_threshold_baht))
    }
    // Load rewards catalog
    const { data: catalog } = await supabase.from('rewards_catalog').select('*').order('cost_points')
    if (catalog) setRewardsCatalog(catalog as any)
    setLoading(false)
  }

  // Save functions
  async function handleSaveRules() {
    const r = await saveMarketingRules({
      frequency_per_week: ruleFreq,
      publishing_window: { start: ruleStart, end: ruleEnd },
      cooldown_hours: ruleCooldown,
    })
    if (r.ok) { showToast('บันทึกกติกาเผยแพร่แล้ว', 'success'); await loadAll() }
    else showToast('บันทึกกติกาไม่สำเร็จ: ' + (r.error || 'ERR_SAVE_FAILED'), 'error')
  }

  async function handleSavePromoBudget() {
    if (!promoUnlimited) {
      const n = promoPercent === '' ? NaN : Number(promoPercent)
      if (!Number.isFinite(n) || n < 0 || n > 100) { showToast('เพดานงบส่วนลดต้องเป็นตัวเลข 0–100', 'warning'); return }
    }
    const ok = await setBusinessSetting('promotion_policy', { promotions_enabled: promoEnabled, budget_percent: promoUnlimited ? null : Number(promoPercent) })
    showToast(ok ? 'บันทึกงบ/kill switch โปรโมชั่นแล้ว' : 'บันทึกไม่สำเร็จ', ok ? 'success' : 'error')
    if (ok) await loadAll()
  }

  async function handleSaveReferral() {
    const num = (v: number | '', min: number, label: string): number | null | false => { if (v === '') return null; const n = Number(v); if (!Number.isFinite(n) || n < min) { showToast(`${label} ต้องเป็นตัวเลขไม่น้อยกว่า ${min}`, 'warning'); return false }; return n }
    const refN = num(refReferrerBaht, 0, 'รางวัลผู้แนะนำ'); const frN = num(refFriendBaht, 0, 'รางวัลเพื่อนใหม่'); const valN = num(refValidityDays, 1, 'อายุคูปอง'); const capN = refMonthlyCap === '' ? null : num(refMonthlyCap, 0, 'เพดานต่อเดือน'); const minN = num(refMinOrder, 0, 'ยอดขั้นต่ำ'); const winN = num(refClaimWindow, 1, 'หน้าต่างเวลา claim')
    if (refN === false || frN === false || valN === false || capN === false || minN === false || winN === false) return
    const ok = await setBusinessSetting('referral_policy', { enabled: refEnabled, referrer_reward_baht: refN ?? 0, friend_reward_baht: frN ?? 0, qualify_status: refQualifyStatus, coupon_validity_days: valN ?? 30, referrer_monthly_cap: capN, min_order_amount: minN ?? 0, claim_window_hours: winN ?? 72, share_base_url: refShareBase.trim() })
    showToast(ok ? 'บันทึกกติกาแนะนำเพื่อนแล้ว' : 'บันทึกไม่สำเร็จ', ok ? 'success' : 'error')
    if (ok) await loadAll()
  }

  async function handleSaveLoyalty() {
    const num = (v: number | '', min: number, label: string): number | null | false => { if (v === '') return null; const n = Number(v); if (!Number.isFinite(n) || n < min) { showToast(`${label} ต้องเป็นตัวเลขไม่น้อยกว่า ${min}`, 'warning'); return false }; return n }
    const winN = num(loyaltyWindowMonths, 1, 'หน้าต่างเดือน'); const silN = num(loyaltySilverMin, 1, 'เกณฑ์ Silver'); const golN = num(loyaltyGoldMin, 1, 'เกณฑ์ Gold'); const plaN = num(loyaltyPlatinumMin, 1, 'เกณฑ์ Platinum'); const rateN = num(loyaltyPointsPerBaht, 0, 'อัตราแต้ม')
    if (winN === false || silN === false || golN === false || plaN === false || rateN === false) return
    if (winN !== null && silN !== null && golN !== null && plaN !== null && !(silN < golN && golN < plaN)) { showToast('เกณฑ์ต้องเรียงตรง: Silver < Gold < Platinum', 'warning'); return }
    if (loyaltyPointsEnabled && (rateN === null || rateN <= 0)) { showToast('เปิดอัตราแต้มต้องตั้งอัตรา > 0 ก่อน', 'warning'); return }
    const ok = await setBusinessSetting('loyalty_policy', { tiers_enabled: loyaltyTiersEnabled, window_months: winN ?? 12, tier_silver_min: silN ?? 1500, tier_gold_min: golN ?? 4000, tier_platinum_min: plaN ?? 8000, points_enabled: loyaltyPointsEnabled, points_per_baht: rateN ?? 0, earn_qualify_status: 'delivered' })
    showToast(ok ? 'บันทึกกติกา Loyalty แล้ว' : 'บันทึกไม่สำเร็จ', ok ? 'success' : 'error')
    if (ok) await loadAll()
  }

  async function handleSaveSpin() {
    const ok = await setBusinessSetting('spin_policy', { enabled: spinEnabled, daily_limit: spinDailyLimit === '' ? 1 : Number(spinDailyLimit), points_per_spin: spinPointsPerSpin === '' ? 0 : Number(spinPointsPerSpin) })
    showToast(ok ? 'บันทึกกติกา Spin & Win แล้ว' : 'บันทึกไม่สำเร็จ', ok ? 'success' : 'error')
    if (ok) await loadAll()
  }

  async function handleSaveAffiliate() {
    const num = (v: number | '', min: number, label: string): number | null | false => { if (v === '') return null; const n = Number(v); if (!Number.isFinite(n) || n < min) { showToast(`${label} ต้องเป็นตัวเลขไม่น้อยกว่า ${min}`, 'warning'); return false }; return n }
    const t1 = num(affTier1, 0, 'Tier 1'); const t2 = num(affTier2, 0, 'Tier 2'); const t3 = num(affTier3, 0, 'Tier 3'); const cookie = num(affCookieDays, 1, 'Cookie days'); const minO = num(affMinOrder, 0, 'Min order'); const payout = num(affPayoutThreshold, 0, 'Payout threshold')
    if (t1 === false || t2 === false || t3 === false || cookie === false || minO === false || payout === false) return
    const ok = await setBusinessSetting('affiliate_policy', { enabled: affEnabled, tier1_percent: t1 ?? 5, tier2_percent: t2 ?? 10, tier3_percent: t3 ?? 15, cookie_days: cookie ?? 30, min_order_amount: minO ?? 0, payout_threshold_baht: payout ?? 500 })
    showToast(ok ? 'บันทึกกติกา Affiliate แล้ว' : 'บันทึกไม่สำเร็จ', ok ? 'success' : 'error')
    if (ok) await loadAll()
  }

  async function handleSaveReward() {
    if (!rewardForm.name || rewardForm.cost_points <= 0) { showToast('กรอกชื่อและแต้มแลก (มากกว่า 0)', 'warning'); return }
    const { error } = await supabase.from('rewards_catalog').insert({ name: rewardForm.name, cost_points: rewardForm.cost_points, stock: rewardForm.stock, is_active: true })
    if (error) { showToast('บันทึกรางวัลไม่สำเร็จ: ' + error.message, 'error'); return }
    showToast('เพิ่มรางวัลแล้ว', 'success')
    setRewardForm({ name: '', cost_points: 0, stock: 0 })
    const { data } = await supabase.from('rewards_catalog').select('*').order('cost_points')
    if (data) setRewardsCatalog(data as any)
  }

  async function handleDeleteReward(id: string) {
    if (!window.confirm('ลบรางวัลนี้?')) return
    const { error } = await supabase.from('rewards_catalog').delete().eq('id', id)
    if (error) { showToast('ลบไม่สำเร็จ: ' + error.message, 'error'); return }
    showToast('ลบรางวัลแล้ว', 'success')
    setRewardsCatalog(rewardsCatalog.filter((r) => r.id !== id))
  }

  if (loading) return <p className="text-brand-muted text-sm">กำลังโหลดตั้งค่า…</p>

  const money = (v: unknown) => Number(v ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Marketing Rules */}
      <div className="card space-y-3">
        <h3 className="font-bold text-brand-accent">📋 กติกาเผยแพร่ (Marketing Rules)</h3>
        <p className="text-sm text-brand-muted">เก็บในตาราง marketing_rules (แก้ได้จริง ไม่มีค่าฝังโค้ด) · คุม auto-schedule ในแท็บ Social</p>
        <label className="text-sm block">จำนวนโพสต์ต่อสัปดาห์
          <input type="number" min={1} max={21} className="input w-full" value={ruleFreq} onChange={(e) => setRuleFreq(Number(e.target.value))} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">หน้าต่างเวลาเริ่ม
            <input type="time" className="input w-full" value={ruleStart} onChange={(e) => setRuleStart(e.target.value)} />
          </label>
          <label className="text-sm">หน้าต่างเวลาสิ้นสุด
            <input type="time" className="input w-full" value={ruleEnd} onChange={(e) => setRuleEnd(e.target.value)} />
          </label>
        </div>
        <label className="text-sm block">เว้นขั้นต่ำระหว่างโพสต์ (ชม.)
          <input type="number" min={0} max={168} className="input w-full" value={ruleCooldown} onChange={(e) => setRuleCooldown(Number(e.target.value))} />
        </label>
        <button className="btn btn-primary" onClick={() => void handleSaveRules()} data-testid="mk-save-rules">💾 บันทึกกติกา</button>
      </div>

      {/* Promotion Budget & Kill Switch */}
      <div className="card space-y-3" data-testid="gr-budget-panel">
        <h3 className="font-bold text-brand-accent">💰 งบประมาณ & Kill Switch โปรโมชั่น</h3>
        <p className="text-sm text-brand-muted">เพดานส่วนลดต่อเดือน = เปอร์เซ็นต์ของยอดขายเดือนนั้น — ระบบตัดสินใจให้เองทุกโค้ด (server) · เกินเพดาน/ปิดสวิตช์ = ส่วนลดเป็น 0</p>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={promoEnabled} onChange={(e) => setPromoEnabled(e.target.checked)} data-testid="gr-kill-switch" /> ✅ เปิดระบบโปรโมชั่น (ติ๊กออก = ปิดทุกโค้ดทันที — kill switch)</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={promoUnlimited} onChange={(e) => { setPromoUnlimited(e.target.checked); if (e.target.checked) setPromoPercent('') }} data-testid="gr-budget-unlimited" /> ไม่จำกัดงบ (ปิดเพดานชั่วคราว)</label>
        {!promoUnlimited && <label className="text-sm block">เพดานงบส่วนลด (% ของยอดขายเดือนนี้ · 0 = ไม่ให้ส่วนลดเลย)<input type="number" min={0} max={100} step={1} className="input w-full" value={promoPercent} onChange={(e) => setPromoPercent(e.target.value === '' ? '' : Number(e.target.value))} data-testid="gr-budget-percent" /></label>}
        <button className="btn btn-primary" onClick={() => void handleSavePromoBudget()} data-testid="gr-budget-save">💾 บันทึกงบ/kill switch</button>
      </div>

      {/* Referral Settings */}
      <div className="card space-y-3" data-testid="gr-referral-panel">
        <h3 className="font-bold text-brand-accent">🤝 แนะนำเพื่อน (Referral & Affiliate)</h3>
        <p className="text-sm text-brand-muted">รางวัล = คูปอง · ออกเมื่อออเดอร์แรกของเพื่อนใหม่ผ่านสถานะที่กำหนด · ระบบป้องกันแนะนำตัวเอง + พักรางวัลเมื่อผิดปกติ</p>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={refEnabled} onChange={(e) => setRefEnabled(e.target.checked)} data-testid="gr-ref-enabled" /> ✅ เปิดระบบแนะนำเพื่อน (ติ๊กออก = ไม่รับโค้ดใหม่ทันที — kill switch)</label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">รางวัลผู้แนะนำ (฿)<input type="number" min={0} step={1} className="input w-full" value={refReferrerBaht} onChange={(e) => setRefReferrerBaht(e.target.value === '' ? '' : Number(e.target.value))} data-testid="gr-ref-referrer-baht" /></label>
          <label className="text-sm">รางวัลเพื่อนใหม่ (฿)<input type="number" min={0} step={1} className="input w-full" value={refFriendBaht} onChange={(e) => setRefFriendBaht(e.target.value === '' ? '' : Number(e.target.value))} data-testid="gr-ref-friend-baht" /></label>
        </div>
        <label className="text-sm block">ออเดอร์ผ่านสถานะไหนจึงได้รางวัล
          <select className="input w-full" value={refQualifyStatus} onChange={(e) => setRefQualifyStatus(e.target.value)} data-testid="gr-ref-qualify">
            <option value="confirmed">confirmed — ยืนยันออเดอร์</option><option value="preparing">preparing — กำลังเตรียม</option>
            <option value="ready_for_dispatch">ready_for_dispatch — พร้อมส่ง</option><option value="dispatched">dispatched — ออกส่ง</option>
            <option value="in_transit">in_transit — ระหว่างส่ง</option><option value="arrived">arrived — ถึงที่</option>
            <option value="delivered">delivered — ส่งสำเร็จ (ค่าเริ่มต้น)</option>
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">อายุคูปอง (วัน)<input type="number" min={1} className="input w-full" value={refValidityDays} onChange={(e) => setRefValidityDays(e.target.value === '' ? '' : Number(e.target.value))} data-testid="gr-ref-validity" /></label>
          <label className="text-sm">เพดานผู้แนะนำ/เดือน (ครั้ง · ว่าง = ไม่จำกัด)<input type="number" min={0} className="input w-full" value={refMonthlyCap} onChange={(e) => setRefMonthlyCap(e.target.value === '' ? '' : Number(e.target.value))} data-testid="gr-ref-cap" /></label>
          <label className="text-sm">ยอดขั้นต่ำของคูปอง (฿)<input type="number" min={0} className="input w-full" value={refMinOrder} onChange={(e) => setRefMinOrder(e.target.value === '' ? '' : Number(e.target.value))} data-testid="gr-ref-min-order" /></label>
          <label className="text-sm">หน้าต่างอายุสิทธิ์ (ชม. หลังสั่งซื้อ)<input type="number" min={1} className="input w-full" value={refClaimWindow} onChange={(e) => setRefClaimWindow(e.target.value === '' ? '' : Number(e.target.value))} data-testid="gr-ref-window" /></label>
        </div>
        <label className="text-sm block">ลิงก์แชร์พื้นฐาน (ว่าง = ใช้โดเมนปัจจุบัน)<input type="text" className="input w-full" placeholder="https://biteme-baby.com" value={refShareBase} onChange={(e) => setRefShareBase(e.target.value)} data-testid="gr-ref-share-base" /></label>
        <button className="btn btn-primary" onClick={() => void handleSaveReferral()} data-testid="gr-ref-save">💾 บันทึกกติกาแนะนำเพื่อน</button>
      </div>

      {/* Loyalty Settings */}
      <div className="card space-y-3" data-testid="gr-loyalty-panel">
        <h3 className="font-bold text-brand-accent">💎 ระดับสมาชิก & แต้มสะสม (Loyalty)</h3>
        <p className="text-sm text-brand-muted">เกณฑ์ = ยอดสินค้าสุทธิ (หักส่วนลด/คืนเงิน · ไม่รวมค่าส่ง) แบบ rolling · แต้มออกเมื่อออเดอร์ผ่านสถานะที่กำหนด</p>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={loyaltyTiersEnabled} onChange={(e) => setLoyaltyTiersEnabled(e.target.checked)} data-testid="gr-loy-tiers-enabled" /> ✅ เปิดแสดงระดับสมาชิก 4 ระดับ (ปิด = ทุกบัญชีเป็น Member ชั่วคราว)</label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">หน้าต่าง rolling (เดือน)<input type="number" min={1} max={36} className="input w-full" value={loyaltyWindowMonths} onChange={(e) => setLoyaltyWindowMonths(e.target.value === '' ? '' : Number(e.target.value))} data-testid="gr-loy-window" /></label>
          <label className="text-sm">Silver ≥ (฿)<input type="number" min={1} className="input w-full" value={loyaltySilverMin} onChange={(e) => setLoyaltySilverMin(e.target.value === '' ? '' : Number(e.target.value))} data-testid="gr-loy-silver" /></label>
          <label className="text-sm">Gold ≥ (฿)<input type="number" min={1} className="input w-full" value={loyaltyGoldMin} onChange={(e) => setLoyaltyGoldMin(e.target.value === '' ? '' : Number(e.target.value))} data-testid="gr-loy-gold" /></label>
          <label className="text-sm">Platinum ≥ (฿)<input type="number" min={1} className="input w-full" value={loyaltyPlatinumMin} onChange={(e) => setLoyaltyPlatinumMin(e.target.value === '' ? '' : Number(e.target.value))} data-testid="gr-loy-platinum" /></label>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={loyaltyPointsEnabled} onChange={(e) => setLoyaltyPointsEnabled(e.target.checked)} data-testid="gr-loy-points-enabled" /> 🪙 เปิดสะสมแต้มจากการสั่งซื้อ (ปิด = ยังไม่มีการให้แต้ม)</label>
        <label className="text-sm block">อัตราแต้ม ต่อ ฿1 ของยอดสินค้า<input type="number" min={0} step={0.1} className="input w-full" value={loyaltyPointsPerBaht} onChange={(e) => setLoyaltyPointsPerBaht(e.target.value === '' ? '' : Number(e.target.value))} data-testid="gr-loy-rate" /></label>
        <button className="btn btn-primary" onClick={() => void handleSaveLoyalty()} data-testid="gr-loy-save">💾 บันทึกกติกา Loyalty</button>
      </div>

      {/* Spin & Win */}
      <div className="card space-y-3" data-testid="gr-spin-panel">
        <h3 className="font-bold text-brand-accent">🎡 Spin & Win</h3>
        <p className="text-sm text-brand-muted">รางวัล/แต้ม: ตั้งเอง · จำกัด 1 ครั้ง/วัน · ค่าเริ่มต้น ปิด/0</p>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={spinEnabled} onChange={(e) => setSpinEnabled(e.target.checked)} data-testid="gr-spin-enabled" /> ✅ เปิด Spin & Win</label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">จำกัดครั้งต่อวัน<input type="number" min={1} className="input w-full" value={spinDailyLimit} onChange={(e) => setSpinDailyLimit(e.target.value === '' ? '' : Number(e.target.value))} data-testid="gr-spin-daily" /></label>
          <label className="text-sm">แต้มต่อครั้งที่หมุน<input type="number" min={0} step={0.1} className="input w-full" value={spinPointsPerSpin} onChange={(e) => setSpinPointsPerSpin(e.target.value === '' ? '' : Number(e.target.value))} data-testid="gr-spin-points" /></label>
        </div>
        <button className="btn btn-primary" onClick={() => void handleSaveSpin()} data-testid="gr-spin-save">💾 บันทึกกติกา Spin & Win</button>
      </div>

      {/* Affiliate Settings */}
      <div className="card space-y-3" data-testid="gr-affiliate-panel">
        <h3 className="font-bold text-brand-accent">🤝 Affiliate / พันธมิตร</h3>
        <p className="text-sm text-brand-muted">คอมมิชชั่นแบบ tier · Cookie tracking · เกณฑ์ขั้นต่ำ</p>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={affEnabled} onChange={(e) => setAffEnabled(e.target.checked)} data-testid="gr-aff-enabled" /> ✅ เปิดระบบ Affiliate</label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">Tier 1 (% ของยอด)<input type="number" min={0} step={0.1} className="input w-full" value={affTier1} onChange={(e) => setAffTier1(e.target.value === '' ? '' : Number(e.target.value))} data-testid="gr-aff-t1" /></label>
          <label className="text-sm">Tier 2 (% ของยอด)<input type="number" min={0} step={0.1} className="input w-full" value={affTier2} onChange={(e) => setAffTier2(e.target.value === '' ? '' : Number(e.target.value))} data-testid="gr-aff-t2" /></label>
          <label className="text-sm">Tier 3 (% ของยอด)<input type="number" min={0} step={0.1} className="input w-full" value={affTier3} onChange={(e) => setAffTier3(e.target.value === '' ? '' : Number(e.target.value))} data-testid="gr-aff-t3" /></label>
          <label className="text-sm">Cookie days<input type="number" min={1} className="input w-full" value={affCookieDays} onChange={(e) => setAffCookieDays(e.target.value === '' ? '' : Number(e.target.value))} data-testid="gr-aff-cookie" /></label>
          <label className="text-sm">ยอดขั้นต่ำ (฿)<input type="number" min={0} className="input w-full" value={affMinOrder} onChange={(e) => setAffMinOrder(e.target.value === '' ? '' : Number(e.target.value))} data-testid="gr-aff-min" /></label>
          <label className="text-sm">เกณฑ์จ่ายเงิน (฿)<input type="number" min={0} className="input w-full" value={affPayoutThreshold} onChange={(e) => setAffPayoutThreshold(e.target.value === '' ? '' : Number(e.target.value))} data-testid="gr-aff-payout" /></label>
        </div>
        <button className="btn btn-primary" onClick={() => void handleSaveAffiliate()} data-testid="gr-aff-save">💾 บันทึกกติกา Affiliate</button>
      </div>

      {/* Rewards Catalog */}
      <div className="card space-y-3" data-testid="gr-rewards-panel">
        <h3 className="font-bold text-brand-accent">🎁 รางวัลแลกแต้ม (Rewards Catalog)</h3>
        <div className="grid grid-cols-3 gap-3">
          <input className="input" placeholder="ชื่อรางวัล" value={rewardForm.name} onChange={(e) => setRewardForm({ ...rewardForm, name: e.target.value })} />
          <input type="number" min={1} className="input" placeholder="แต้มที่ต้องใช้" value={rewardForm.cost_points} onChange={(e) => setRewardForm({ ...rewardForm, cost_points: Number(e.target.value) })} />
          <input type="number" min={0} className="input" placeholder="สต็อก (0 = ไม่จำกัด)" value={rewardForm.stock} onChange={(e) => setRewardForm({ ...rewardForm, stock: Number(e.target.value) })} />
        </div>
        <button className="btn btn-primary" onClick={() => void handleSaveReward()} data-testid="gr-reward-save">➕ เพิ่มรางวัล</button>
        {rewardsCatalog.length > 0 && (
          <div className="space-y-2 mt-3">
            {rewardsCatalog.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 border border-brand-border rounded-lg p-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{r.name}</p>
                  <p className="text-xs text-brand-muted">แต้ม: {r.cost_points} · สต็อก: {r.stock === 0 ? 'ไม่จำกัด' : r.stock} · {r.is_active ? 'ใช้งานแล้ว' : 'ปิด'}</p>
                </div>
                <button className="btn btn-danger text-xs" onClick={() => void handleDeleteReward(r.id)}>🗑 ลบ</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
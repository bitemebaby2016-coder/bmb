// ============================================
// Bite Me Baby — Admin Marketing & Promotions (Merged)
// ============================================
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { showToast } from '@/components/ui/ToastContainer'
import { getPromotionsAdmin, upsertPromotion, deletePromotion, togglePromotion, attachPromotionScope, type PromotionRow } from '@/lib/bmbAdminApi_promotions'
import { listMarketingPosts, type MarketingPostRow } from '@/lib/adminMarketing'
import { getBusinessSettings, setBusinessSetting } from '@/lib/bmbAdminApi_settings'
import { PromotionsTab as PromotionsTabComponent } from '@/components/admin/PromotionsTab'
import { MarketingOverviewTab } from '@/components/admin/MarketingOverviewTab'
import { PlannerTab } from '@/components/admin/PlannerTab'
import { SocialTab } from '@/components/admin/SocialTab'
import { BannersTab as BannersTabComponent } from '@/components/admin/BannersTab'
import { SettingsTab } from '@/components/admin/SettingsTab'
import { ApprovalHistoryTab } from '@/components/admin/ApprovalHistoryTab'
import { ContentTab } from '@/components/admin/ContentTab'

type Tab = 'overview' | 'promotions' | 'banners' | 'planner' | 'social' | 'settings' | 'approvals' | 'content'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: '📈 ภาพรวม' },
  { id: 'content', label: '📝 สร้างเนื้อหา' },
  { id: 'promotions', label: '🎁 โปรโมชั่น/ส่วนลด' },
  { id: 'banners', label: '🏠 แบนเนอร์/โปรโมท' },
  { id: 'planner', label: '🗓️ Planner' },
  { id: 'social', label: '📱 โซเชียล/ตารางโพสต์' },
  { id: 'approvals', label: '🛡️ อนุมัติ/ประวัติ' },
  { id: 'settings', label: '⚙️ กติกา/ตั้งค่า' },
]

export function AdminMarketingPromotions() {
  const [tab, setTab] = useState<Tab>(() => {
    const t = new URLSearchParams(window.location.search).get('tab')
    return TABS.some((x) => x.id === t) ? (t as Tab) : 'overview'
  })
  const [promotions, setPromotions] = useState<PromotionRow[]>([])
  const [posts, setPosts] = useState<MarketingPostRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [promos, marketingPosts] = await Promise.all([
        attachPromotionScope(await getPromotionsAdmin()),
        listMarketingPosts(),
      ])
      setPromotions(promos)
      setPosts(marketingPosts)
    } catch (e) {
      showToast('โหลดข้อมูลไม่สำเร็จ: ' + String((e as Error)?.message || e).slice(0, 120), 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  // Deep-link focus handling
  const [searchParams] = useState(() => new URLSearchParams(window.location.search))
  useEffect(() => {
    const focus = searchParams.get('focus')
    if (focus) {
      setTab('promotions')
      setTimeout(() => {
        const el = document.querySelector(`[data-promo-id="${focus}"]`)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 200)
    }
  }, [searchParams])

  if (loading) return <p className="text-brand-muted text-sm p-4">กำลังโหลดข้อมูลจริง…</p>

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold text-brand-accent">📈 การตลาดและโปรโมชั่น</h1>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="หมวดการตลาดและโปรโมชั่น">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            data-testid={`mkpromo-tab-${t.id}`}
            className={`btn text-sm ${tab === t.id ? 'btn-primary' : 'btn-outline'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <MarketingOverviewTab onTabChange={(t: string) => setTab(t as Tab)} />}

      {tab === 'promotions' && (
        <PromotionsTabComponent
          promotions={promotions}
          setPromotions={setPromotions}
        />
      )}

      {tab === 'banners' && (
        <BannersTabComponent
          promotions={promotions}
        />
      )}

      {tab === 'planner' && (
        <PlannerTab
          onTabChange={(t: string) => setTab(t as Tab)}
        />
      )}

      {tab === 'social' && (
        <SocialTab
          posts={posts}
          setPosts={setPosts}
          load={load}
        />
      )}

      {tab === 'settings' && <SettingsTab />}

      {tab === 'approvals' && <ApprovalHistoryTab load={load} />}

      {tab === 'content' && <ContentTab load={load} />}
    </div>
  )
}
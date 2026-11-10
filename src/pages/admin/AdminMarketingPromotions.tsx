// ============================================
// Bite Me Baby — Admin Marketing & Promotions (Merged)
// ============================================
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { showToast } from '@/components/ui/ToastContainer'
import { getPromotionsAdmin, upsertPromotion, deletePromotion, togglePromotion, attachPromotionScope, type PromotionRow } from '@/lib/bmbAdminApi_promotions'
import { listMarketingPosts, type MarketingPostRow } from '@/lib/adminMarketing'
import { listContentApprovals, type ContentApprovalRow } from '@/lib/contentApproval'
import { getBusinessSettings, setBusinessSetting } from '@/lib/bmbAdminApi_settings'
import { PromotionsTab as PromotionsTabComponent } from '@/components/admin/PromotionsTab'
import { MarketingOverviewTab } from '@/components/admin/MarketingOverviewTab'
import { PlannerTab } from '@/components/admin/PlannerTab'
import { AiStudioTab } from '@/components/admin/AiStudioTab'
import { SocialTab } from '@/components/admin/SocialTab'
import { BannersTab as BannersTabComponent } from '@/components/admin/BannersTab'
import { SettingsTab } from '@/components/admin/SettingsTab'
import { PostFormImperativeHandle } from '@/components/admin/PostForm'

type Tab = 'overview' | 'promotions' | 'banners' | 'planner' | 'studio' | 'social' | 'settings'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: '📈 ภาพรวม' },
  { id: 'promotions', label: '🎁 โปรโมชั่น/ส่วนลด' },
  { id: 'banners', label: '🏠 แบนเนอร์/โปรโมท' },
  { id: 'planner', label: '🗓️ Planner' },
  { id: 'studio', label: '🎨 AI Studio' },
  { id: 'social', label: '📱 โซเชียล/ตารางโพสต์' },
  { id: 'settings', label: '⚙️ กติกา/ตั้งค่า' },
]

export function AdminMarketingPromotions() {
  const [tab, setTab] = useState<Tab>(() => {
    const t = new URLSearchParams(window.location.search).get('tab')
    return TABS.some((x) => x.id === t) ? (t as Tab) : 'overview'
  })
  const [promotions, setPromotions] = useState<PromotionRow[]>([])
  const [posts, setPosts] = useState<MarketingPostRow[]>([])
  const [approvals, setApprovals] = useState<ContentApprovalRow[]>([])
  const [loading, setLoading] = useState(true)

  // Shared form state for posts (Planner/Studio/Social)
  const [postTitle, setPostTitle] = useState('')
  const [postBodyText, setPostBodyText] = useState('')
  const [postContentType, setPostContentType] = useState<'post' | 'promotion' | 'banner' | 'announcement'>('post')
  const [postImages, setPostImages] = useState<string[]>([])
  const [postSaving, setPostSaving] = useState(false)

  const postFormRef = useRef<PostFormImperativeHandle>({
  setTitle: () => {},
  setBodyText: () => {},
  setContentType: () => {},
  setImages: () => {},
  setGenSubject: () => {},
})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [promos, marketingPosts, contentApprovals] = await Promise.all([
        attachPromotionScope(await getPromotionsAdmin()),
        listMarketingPosts(),
        listContentApprovals(),
      ])
      setPromotions(promos)
      setPosts(marketingPosts)
      setApprovals(contentApprovals)
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

  async function handleCreatePost() {
    if (!postTitle.trim()) { showToast('ใส่หัวข้อโพสต์ก่อน', 'error'); return }
    setPostSaving(true)
    const genOnes = postImages.filter((u) => u.includes('/ai-generated/'))
    const postImagesFinal = genOnes.length > 0 ? [genOnes[genOnes.length - 1]] : postImages
    const { createMarketingPost } = await import('@/lib/adminMarketing')
    const r = await createMarketingPost({ title: postTitle.trim(), body: postBodyText, content_type: postContentType, image_urls: postImagesFinal })
    setPostSaving(false)
    if (r.ok) {
      showToast('สร้างโพสต์แล้ว — ส่งเข้ากล่องอนุมัติ (คนอนุมัติเท่านั้น)', 'success')
      setPostTitle(''); setPostBodyText(''); setPostImages([])
      await load()
      setTab('social')
    } else {
      showToast('สร้างโพสต์ไม่สำเร็จ: ' + (r.error || 'ERR_SUBMIT_FAILED'), 'error')
    }
  }

  function handleBannerChange(_bannerImage: string, _bannerMascot: string) {
    // Reload promotions to keep UI in sync (floating ad image / banner image / mascot changes)
    void load()
  }

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
          onBannerChange={handleBannerChange}
        />
      )}

      {tab === 'banners' && (
        <BannersTabComponent
          promotions={promotions}
          onBannerChange={handleBannerChange}
        />
      )}

      {tab === 'planner' && (
        <PlannerTab
          onTabChange={(t: string) => setTab(t as Tab)}
          postFormRef={postFormRef}
          postTitle={postTitle}
          postBodyText={postBodyText}
          postContentType={postContentType}
          postImages={postImages}
          setPostTitle={setPostTitle}
          setPostBodyText={setPostBodyText}
          setPostContentType={setPostContentType}
          setPostImages={setPostImages}
          postSaving={postSaving}
          onCreatePost={handleCreatePost}
        />
      )}

      {tab === 'studio' && (
        <AiStudioTab
          postFormRef={postFormRef}
          postTitle={postTitle}
          postBodyText={postBodyText}
          postContentType={postContentType}
          postImages={postImages}
          setPostTitle={setPostTitle}
          setPostBodyText={setPostBodyText}
          setPostContentType={setPostContentType}
          setPostImages={setPostImages}
          postSaving={postSaving}
          onCreatePost={handleCreatePost}
        />
      )}

      {tab === 'social' && (
        <SocialTab
          posts={posts}
          approvals={approvals}
          setPosts={setPosts}
          setApprovals={setApprovals}
          load={load}
        />
      )}

      {tab === 'settings' && <SettingsTab />}
    </div>
  )
}
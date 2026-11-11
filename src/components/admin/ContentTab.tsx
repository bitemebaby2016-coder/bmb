// ============================================
// Bite Me Baby — Content Tab (Unified Content Creation)
// เจนภาพ AI + คลังภาพ + สร้าง Post/Promotion/Banner + ตั้ง Floating Ad ทั้งในที่เดียว
// ============================================
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { showToast } from '@/components/ui/ToastContainer'
import { submitContentForApproval, reviewContent, listContentApprovals, type ContentType, type ContentApprovalRow, type ContentApprovalStatus } from '@/lib/contentApproval'
import { uploadMediaAsset, listAiAlbumFiles, type AiAlbumFile, compressToWebLimits, PRODUCT_IMAGE_MAX_SIDE } from '@/lib/bmbAdminApi_media'
import { getBusinessSettings, setBusinessSetting } from '@/lib/bmbAdminApi_settings'
import { getPromotionsAdmin, upsertPromotion, type PromotionRow } from '@/lib/bmbAdminApi_promotions'
import { createMarketingPost, listMarketingPosts, scheduleMarketingPost, type MarketingPostRow } from '@/lib/adminMarketing'
import { autoScheduleApprovedPosts } from '@/lib/marketingAutoSchedule'
import { getProducts } from '@/lib/bmbAdminApi_products'
import { type Product } from '@/types'
import { flashTo } from '@/lib/uiFlash'
import { PostForm, PostFormImperativeHandle } from './PostForm'
import { ToggleSwitch } from './ToggleSwitch'

// R44: URL ภาพที่ AI สร้าง (bmb-images/ai-generated/) — กติกา "มีภาพเจน = ใช้ภาพเจนรูปเดียว"
const isGenImage = (u: string) => u.includes('/ai-generated/')

// R47: เลือกมาสคอตลายน้ำอัตโนมัติตามประเภทภาพที่เจน
export type GenQa = { ok: boolean; warn?: string; w: number; h: number }
export const KIND_PRESETS_KEYS = ['menu', 'promo', 'festival'] as const
export const MENU_ASPECTS = [1, 4 / 3, 3 / 4]

export async function checkGenQuality(url: string, kind: string): Promise<GenQa> {
  try {
    const res = await fetch(url)
    if (!res.ok) return { ok: true, w: 0, h: 0 }
    const bmp = await createImageBitmap(await res.blob())
    const w = bmp.width; const h = bmp.height; bmp.close?.()
    if (Math.min(w, h) < 512) return { ok: false, w, h, warn: `ความละเอียด ${w}×${h} ต่ำเกินไป` }
    if (kind === 'menu') {
      const ar = w / h
      const fits = MENU_ASPECTS.some((t) => Math.abs(ar - t) / t <= 0.12)
      if (!fits) return { ok: false, w, h, warn: `สัดส่วน ${w}×${h} ไม่ตรงกรอบเมนู (1:1 หรือ 4:3) — เบี้ยว/ขนาดไม่ตรง` }
    }
    return { ok: true, w, h }
  } catch { return { ok: true, w: 0, h: 0 } }
}

export function autoMascotForKind(kind: string): string {
  if (kind === 'menu') return 'bite_menu'
  if (kind === 'festival') return 'bite_award'
  return 'bite_recommend'
}

const MASCOT_ROTATION = [
  '/assets/mascot/bite_recommend.webp',
  '/assets/mascot/bite_menu.webp',
  '/assets/mascot/bite_eating.webp',
  '/assets/mascot/bite_cooking.webp',
  '/assets/mascot/bite_award.webp',
] as const

export interface ContentTabProps {
  load: () => Promise<void>
}

export function ContentTab({ load }: ContentTabProps) {
  const [genKind, setGenKind] = useState<'menu' | 'promo' | 'festival'>('promo')
  const [genStyle, setGenStyle] = useState<'realistic' | 'illustration' | 'poster'>('realistic')
  const [genSubject, setGenSubject] = useState('')
  const [genNote, setGenNote] = useState('')
  const [wmMascot, setWmMascot] = useState<string>(() => {
    try { return localStorage.getItem('bmb:wm-mascot') || 'auto' } catch { return 'auto' }
  })
  const [genBusy, setGenBusy] = useState(false)
  const [genStatus, setGenStatus] = useState<{ phase: 'idle' | 'running' | 'ok' | 'fail'; detail?: string; url?: string; model?: string; qa?: GenQa }>({ phase: 'idle' })

  const AI_ALBUM_KINDS = ['menu', 'promo', 'festival'] as const
  type AiAlbumItem = { name: string; url: string; path: string; kind: string; disabled: boolean }
  const [aiAlbum, setAiAlbum] = useState<AiAlbumItem[]>([])
  const [aiAlbumTab, setAiAlbumTab] = useState<'all' | 'menu' | 'promo' | 'festival' | 'disabled' | 'legacy'>('all')
  const [albumLoading, setAlbumLoading] = useState(false)

  const [floatingAdImage, setFloatingAdImage] = useState('')
  const [floatingAdEnabled, setFloatingAdEnabled] = useState(true)
  const [floatingAdSources, setFloatingAdSources] = useState<('promotions' | 'announcements' | 'approved_banners')[]>(['promotions', 'announcements', 'approved_banners'])

  const [contentType, setContentType] = useState<'post' | 'promotion' | 'banner' | 'announcement'>('post')
  const [postTitle, setPostTitle] = useState('')
  const [postBody, setPostBody] = useState('')
  const [postImages, setPostImages] = useState<string[]>([])
  const [postSaving, setPostSaving] = useState(false)

  // Promotion form fields
  const [promoForm, setPromoForm] = useState({
    name: '',
    description: '',
    code: '',
    discount_type: 'percentage' as 'percentage' | 'fixed_amount',
    discount_value: 10,
    min_order_amount: 0,
    start_date: '',
    end_date: '',
    is_active: true,
    is_banner: false,
    banner_image: '',
    banner_mascot: '',
    stackable: false,
    applies_to: 'all_products' as 'all_products' | 'specific_products',
    max_discount_amount: null as number | null,
    usage_limit: null as number | null,
    scope_product_ids: [] as string[],
  })

  const [promoSaving, setPromoSaving] = useState(false)

  // Banner form fields
  const [bannerForm, setBannerForm] = useState({
    title: '',
    body: '',
    banner_image: '',
    banner_mascot: '',
    set_as_floating_ad: false,
  })
  const [bannerSaving, setBannerSaving] = useState(false)

  // Common
  const [uploading, setUploading] = useState(false)
  const [browseBusy, setBrowseBusy] = useState(false)
  const browseRef = useRef<HTMLInputElement | null>(null)

  // Catalog picker state
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalogSearch, setCatalogSearch] = useState('')
  const [catalogModalOpen, setCatalogModalOpen] = useState(false)
  const [catalogHoveredProduct, setCatalogHoveredProduct] = useState<Product | null>(null)

  // Approval Queue & Schedule Panel state
  const [approvalItems, setApprovalItems] = useState<ContentApprovalRow[]>([])
  const [approvalLoading, setApprovalLoading] = useState(false)
  const [approvalTab, setApprovalTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending')
  const [scheduledPosts, setScheduledPosts] = useState<MarketingPostRow[]>([])
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [scheduleBusyId, setScheduleBusyId] = useState<string | null>(null)
  const [whenByPost, setWhenByPost] = useState<Record<string, string>>({})

  // Load catalog products
  const loadCatalogProducts = useCallback(async () => {
    setCatalogLoading(true)
    try {
      const products = await getProducts()
      setCatalogProducts(products)
    } catch (e) {
      console.error('[ContentTab] Catalog load error:', e)
      showToast('โหลดรายการเมนูไม่สำเร็จ', 'error')
    } finally {
      setCatalogLoading(false)
    }
  }, [])

  useEffect(() => { void loadCatalogProducts() }, [loadCatalogProducts])

  // Load approval items (admin sees all, like SocialTab)
  const loadApprovalItems = useCallback(async () => {
    setApprovalLoading(true)
    try {
      let status: ContentApprovalStatus | undefined
      if (approvalTab !== 'all') status = approvalTab
      const data = await listContentApprovals({ status, limit: 100 })
      setApprovalItems(data)
    } catch {
      showToast('โหลดคิวอนุมัติไม่สำเร็จ', 'error')
    } finally {
      setApprovalLoading(false)
    }
  }, [approvalTab])

  useEffect(() => { void loadApprovalItems() }, [loadApprovalItems])

  // Load scheduled posts (approved posts that can be scheduled)
  const loadScheduledPosts = useCallback(async () => {
    setScheduleLoading(true)
    try {
      const posts = await listMarketingPosts()
      // Filter: approved posts that are not yet published
      const schedulable = posts.filter((p) => p.status === 'approved' || p.status === 'scheduled' || p.status === 'failed')
      setScheduledPosts(schedulable)
    } catch {
      showToast('โหลดโพสต์รอตั้งเวลาไม่สำเร็จ', 'error')
    } finally {
      setScheduleLoading(false)
    }
  }, [])

  useEffect(() => { void loadScheduledPosts() }, [loadScheduledPosts])

  // Refresh both when parent loads
  useEffect(() => {
    void loadApprovalItems()
    void loadScheduledPosts()
  }, [loadApprovalItems, loadScheduledPosts, load])

  // Catalog selection handler
  async function handleCatalogSelect(product: Product, action: 'content' | 'reference') {
    try {
      if (!product.image_url) {
        showToast('เมนูนี้ไม่มีภาพ — เลือกเมนูอื่น', 'warning')
        return
      }

      if (action === 'content') {
        // Use as content image (post/announcement)
        if (contentType === 'post' || contentType === 'announcement') {
          setPostImages((prev: string[]) => {
            const next = [...prev]
            if (!next.includes(product.image_url)) next.push(product.image_url)
            return next
          })
          showToast(`แนบ "${product.name}" เข้าชุดภาพแล้ว — กดบันทึกเพื่อสร้าง${contentType === 'post' ? 'โพสต์' : 'ประกาศ'}`, 'success')
          flashTo('mk-images-strip')
        } else if (contentType === 'promotion') {
          setPromoForm((f) => ({ ...f, banner_image: product.image_url }))
          showToast(`ใช้ "${product.name}" เป็นรูปแบนเนอร์โปรโมชั่นแล้ว`, 'success')
        } else if (contentType === 'banner') {
          setBannerForm((f) => ({ ...f, banner_image: product.image_url }))
          showToast(`ใช้ "${product.name}" เป็นรูปแบนเนอร์แล้ว`, 'success')
        }
      } else if (action === 'reference') {
        // Use as AI reference (don't attach to content)
        showToast(`ใช้ "${product.name}" เป็นต้นแบบ AI — เจนภาพแล้วกด "ใช้" เพื่อแทนรูป`, 'info')
      }
    } catch (e) {
      console.error('[ContentTab] Catalog select error:', e)
      showToast('เลือกเมนูไม่สำเร็จ', 'error')
    } finally {
      setCatalogModalOpen(false)
    }
  }

  // Filtered catalog products
  const filteredCatalogProducts = catalogProducts.filter((p) => {
    if (!catalogSearch.trim()) return true
    const search = catalogSearch.toLowerCase()
    return p.name.toLowerCase().includes(search) || (p.description || '').toLowerCase().includes(search)
  })

  // Close catalog modal
  function closeCatalogModal() {
    setCatalogModalOpen(false)
    setCatalogSearch('')
  }

  // Keyboard handler for modal close
  useEffect(() => {
    if (!catalogModalOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCatalogModal()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [catalogModalOpen])

  // Load AI album
  const loadAiAlbum = useCallback(async () => {
    setAlbumLoading(true)
    try {
      const s = supabase.storage.from('bmb-images')
      const out: AiAlbumItem[] = []
      for (const kind of AI_ALBUM_KINDS) {
        for (const [dir, disabled] of [
          [`ai-generated/${kind}`, false],
          [`ai-generated/_disabled/${kind}`, true],
        ] as Array<[string, boolean]>) {
          const { data, error } = await s.list(dir, { limit: 60, sortBy: { column: 'created_at', order: 'desc' } })
          if (error || !data) continue
          for (const f of data) {
            if (!f.name || f.name.startsWith('.')) continue
            const p = `${dir}/${f.name}`
            out.push({ name: f.name, path: p, kind, disabled, url: s.getPublicUrl(p).data.publicUrl })
          }
        }
      }
      const { data: root } = await s.list('ai-generated', { limit: 60, sortBy: { column: 'created_at', order: 'desc' } })
      for (const f of root || []) {
        if (!f.name || f.name.startsWith('.') || f.id == null) continue
        const p = `ai-generated/${f.name}`
        out.push({ name: f.name, path: p, kind: 'legacy', disabled: false, url: s.getPublicUrl(p).data.publicUrl })
      }
      setAiAlbum(out)
    } catch { /* เงียบ */ }
    finally { setAlbumLoading(false) }
  }, [])

  useEffect(() => { void loadAiAlbum() }, [loadAiAlbum])

  // Load floating ad settings
  useEffect(() => {
    void (async () => {
      try {
        const { data } = await supabase.from('business_settings').select('key,value').in('key', ['floating_ad_image', 'floating_ad_enabled', 'floating_ad_sources'])
        for (const row of data || []) {
          if (row.key === 'floating_ad_image' && typeof row.value === 'string') setFloatingAdImage(row.value)
          if (row.key === 'floating_ad_enabled' && typeof row.value === 'boolean') setFloatingAdEnabled(row.value)
          if (row.key === 'floating_ad_sources' && Array.isArray(row.value)) {
            const sources = row.value.filter((v: unknown): v is 'promotions' | 'announcements' | 'approved_banners' => 
              v === 'promotions' || v === 'announcements' || v === 'approved_banners'
            )
            if (sources.length > 0) setFloatingAdSources(sources)
          }
        }
      } catch { /* เงียบ */ }
    })()
  }, [])

  const visibleAiAlbum = aiAlbum.filter((a) =>
    aiAlbumTab === 'all' ? !a.disabled :
    aiAlbumTab === 'disabled' ? a.disabled :
    aiAlbumTab === 'legacy' ? a.kind === 'legacy' :
    a.kind === aiAlbumTab
  )

  // ===== Image Generation =====
  async function applyBrandWatermark(srcUrl: string, kind: string, mascotChoice: string): Promise<string> {
    try {
      const mascotKey = mascotChoice === 'auto' ? autoMascotForKind(kind) : mascotChoice
      const [img, logo, mascot] = await Promise.all([fetchBitmap(srcUrl), fetchBitmap('/Logo_Sticker_Circle.webp'), fetchBitmap(`/assets/mascot/${mascotKey}.webp`)])
      if (!img) return srcUrl
      const w = img.width, h = img.height
      const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d'); if (!ctx) return srcUrl
      ctx.drawImage(img, 0, 0)
      const minSide = Math.min(w, h)
      const pad = Math.round(minSide * 0.03)
      const pillH = Math.round(minSide * 0.13)
      const pillW = Math.round(pillH * 4.6)
      const px = w - pad - pillW; const py = h - pad - pillH
      ctx.save(); ctx.globalAlpha = 0.88; ctx.fillStyle = '#FFFFFF'
      if (typeof (ctx as CanvasRenderingContext2D & { roundRect?: unknown }).roundRect === 'function') {
        ctx.beginPath(); (ctx as CanvasRenderingContext2D & { roundRect: (x: number, y: number, w: number, h: number, r: number) => void }).roundRect(px, py, pillW, pillH, pillH / 2); ctx.fill()
      } else { ctx.fillRect(px, py, pillW, pillH) }
      ctx.globalAlpha = 1
      const logoSize = Math.round(pillH * 0.78)
      if (logo) ctx.drawImage(logo, px + pillH * 0.11, py + (pillH - logoSize) / 2, logoSize, logoSize)
      ctx.fillStyle = '#92400E'; ctx.font = `bold ${Math.round(pillH * 0.42)}px Quicksand, sans-serif`; ctx.textBaseline = 'middle'
      ctx.fillText('Bite Me Baby', px + logoSize + pillH * 0.3, py + pillH * 0.54)
      if (mascot) {
        const mH = Math.round(pillH * 1.7); const mW = Math.round(mascot.width * (mH / mascot.height))
        ctx.drawImage(mascot, px + pillW - mW - pillH * 0.15, py - mH + pillH * 0.35, mW, mH)
      }
      ctx.restore()
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
      if (!blob) return srcUrl
      const wmFile = new File([blob], `wm-${Date.now().toString(36)}.png`, { type: 'image/png', lastModified: Date.now() })
      const sized = await compressToWebLimits(wmFile)
      const path = `ai-generated/${(KIND_PRESETS_KEYS as readonly string[]).includes(kind) ? kind : 'menu'}/wm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}${sized.name.endsWith('.jpg') ? '.jpg' : '.png'}`
      const { error } = await supabase.storage.from('bmb-images').upload(path, sized, { contentType: sized.type, upsert: false })
      if (error) return srcUrl
      return supabase.storage.from('bmb-images').getPublicUrl(path).data.publicUrl
    } catch { return srcUrl }
  }

  async function fetchBitmap(url: string): Promise<ImageBitmap | null> {
    try { const res = await fetch(url); if (!res.ok) return null; return await createImageBitmap(await res.blob()) } catch { return null }
  }

  async function handleGenerateImage() {
    const subject = genSubject.trim() || postTitle.trim()
    if (!subject) { showToast('ใส่โจทย์/หัวข้อ (ช่องภาพ หรือหัวข้อโพสต์) ก่อนสร้างภาพ', 'error'); return }
    const note = [genNote.trim(), postBody.trim().slice(0, 160)].filter(Boolean).join(' · ')
    const reference = postImages.length > 0 ? postImages[postImages.length - 1] : undefined
    if (genKind === 'menu' && !reference) {
      showToast('ยังไม่มีรูปเมนูตัวอย่างในชุดภาพ — จิ้มเมนูใน Planner หรือ browse ไฟล์เพื่อใช้เป็นต้นแบบไดคัท (ไม่แนบก็เจนจากโจทย์ข้อความได้)', 'info')
    }
    setGenBusy(true)
    setGenStatus({ phase: 'running' })
    flashTo('mk-gen-status')
    try {
      const { data, error } = await supabase.functions.invoke('image-gen', {
        body: { kind: genKind, style: genStyle, subject, note, reference_image_url: reference },
      })
      if (error || !data?.ok) {
        let detail = data?.error || error?.message || 'ERR_IMAGE_GEN_FAILED'
        const ctx = (error as unknown as { context?: Response } | null)?.context
        if (ctx && typeof ctx.text === 'function') {
          try {
            const raw = await ctx.text()
            if (raw) {
              try { const b = JSON.parse(raw) as { error?: string; detail?: string }; const d = `${b?.error ?? ''} ${b?.detail ?? ''}`.trim(); if (d) detail = d } catch { detail = `${detail} | ${raw.slice(0, 180)}` }
            }
          } catch { /* คง message เดิม */ }
        }
        setGenStatus({ phase: 'fail', detail })
        flashTo('mk-gen-status')
        showToast('สร้างภาพไม่สำเร็จ: ' + detail, 'error')
      } else {
        const wmUrl = await applyBrandWatermark(data.url, genKind, wmMascot)
        if (wmUrl !== data.url) {
          try {
            const marker = '/object/public/bmb-images/'
            if (data.url.includes(marker)) {
              const p = data.url.slice(data.url.indexOf(marker) + marker.length).split('?')[0]
              await supabase.storage.from('bmb-images').remove([decodeURIComponent(p)])
            }
          } catch { /* ลบต้นฉบับไม่ได้ = ไม่เป็นไร */ }
        }
        const qa = await checkGenQuality(wmUrl, genKind)
        setGenStatus({ phase: 'ok', url: wmUrl, model: data.model, qa })
        await loadAiAlbum()
        flashTo('mk-gen-status')
        showToast(
          qa.ok
            ? '✅ สร้างภาพสำเร็จ + ประกบลายน้ำแล้ว — อยู่ในอัลบั้มตามหมวด (ไม่แนบเข้าชุดอัตโนมัติ · กด "ใช้" เองเมื่อต้องการ)'
            : `⚠️ สร้างภาพสำเร็จ แต่ ${qa.warn} — ระบบไม่เลือกใช้แทนให้อัตโนมัติ (ตรวจดูก่อน แล้วกด "ใช้" เองถ้า OK)`,
          qa.ok ? 'success' : 'warning',
        )
      }
    } catch (e) {
      const msg = String(e).slice(0, 160)
      setGenStatus({ phase: 'fail', detail: msg })
      flashTo('mk-gen-status')
      showToast('สร้างภาพไม่สำเร็จ: ' + msg, 'error')
    } finally { setGenBusy(false) }
  }

  // ===== Image Upload / Browse =====
  async function handleBrowseImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { showToast('เลือกไฟล์รูปภาพเท่านั้น (jpg/png/webp)', 'error'); return }
    if (file.size > 10 * 1024 * 1024) { showToast('ไฟล์ต้องไม่เกิน 10MB', 'error'); return }
    setBrowseBusy(true)
    try {
      const sized = await compressToWebLimits(file)
      const safe = (sized.name || 'image.png').replace(/[^\w.-]+/g, '_').slice(-60)
      const path = `marketing/browse-${Date.now()}-${safe}`
      const { error } = await supabase.storage.from('bmb-images').upload(path, sized, { contentType: sized.type, upsert: false })
      if (error) throw error
      const { data } = supabase.storage.from('bmb-images').getPublicUrl(path)
      const url = data?.publicUrl
      if (!url) throw new Error('no public url')
      setPostImages((prev: string[]) => [...prev, url])
      showToast(sized !== file ? `แนบรูปจากไฟล์ + ลดขนาดอัตโนมัติ (กว้างสุด ${PRODUCT_IMAGE_MAX_SIDE}px) เข้าชุดภาพของโพสต์แล้ว` : 'แนบรูปจากไฟล์เข้าชุดภาพของโพสต์แล้ว — ใช้ร่วมกับภาพ AI/แคตตาลอกได้เลย', 'success')
      flashTo('mk-images-strip')
    } catch (err) { showToast('อัปโหลดรูปไม่สำเร็จ: ' + String((err as Error)?.message || err).slice(0, 120), 'error') }
    finally { setBrowseBusy(false) }
  }

  function pickAiImage(url: string) {
    setPostImages([url])
    flashTo('mk-images-strip')
    showToast('เลือกภาพนี้เป็นรูปโพสต์แล้ว (แทนรูปเดิม — โพสต์ใช้ทีละรูป)', 'success')
  }

  async function handleRemoveImage(url: string) {
    setPostImages((prev: string[]) => prev.filter((x: string) => x !== url))
    // Don't delete source files for catalog product images (shared with product record)
    const isCatalogImage = catalogProducts.some((p) => p.image_url === url)
    if (isCatalogImage) {
      showToast('เอาออกจากชุดภาพแล้ว (รูปเมนูจะยังคงอยู่ในฐานข้อมูล — ไม่ลบไฟล์ต้นทาง)', 'info')
      return
    }
    const marker = '/object/public/bmb-images/'
    if (!url.includes(marker)) { showToast('ลบรูปออกจากชุดภาพแล้ว (ไฟล์นี้ไม่ได้อยู่บนคลังภาพของเรา — ไม่มีไฟล์ต้องลบ)', 'info'); return }
    try {
      const path = decodeURIComponent(url.slice(url.indexOf(marker) + marker.length).split('?')[0])
      const { error } = await supabase.storage.from('bmb-images').remove([path])
      if (error) throw error
      if (path.startsWith('ai-generated/')) await loadAiAlbum()
      showToast('ลบรูปออกจากชุดภาพ + ลบไฟล์จริงจากคลังภาพแล้ว', 'success')
    } catch (err) { showToast('เอาออกจากชุดภาพแล้ว แต่ลบไฟล์ไม่สำเร็จ: ' + String((err as Error)?.message || err).slice(0, 100), 'warning') }
  }

  async function toggleAiImage(item: AiAlbumItem) {
    try {
      const s = supabase.storage.from('bmb-images')
      const to = item.disabled ? `ai-generated/${item.kind}/${item.name}` : `ai-generated/_disabled/${item.kind}/${item.name}`
      const { error } = await s.move(item.path, to)
      if (error) throw error
      await loadAiAlbum()
      showToast(item.disabled ? 'เปิดใช้งานภาพนี้กลับแล้ว' : 'ปิดภาพนี้แล้ว — ไม่ให้ระบบนำไปใช้กับงานใด ๆ (กด "เปิด" ได้ทุกเมื่อ)', 'success')
    } catch (err) { showToast('สลับสถานะภาพไม่สำเร็จ: ' + String((err as Error)?.message || err).slice(0, 100), 'error') }
  }

  async function deleteAiImage(item: AiAlbumItem) {
    try {
      const { error } = await supabase.storage.from('bmb-images').remove([item.path])
      if (error) throw error
      setPostImages((prev: string[]) => prev.filter((x: string) => x !== item.url))
      await loadAiAlbum()
      showToast('ลบรูปออกจากอัลบั้ม + ลบไฟล์จริงจากคลังภาพแล้ว', 'success')
    } catch (err) { showToast('ลบรูปไม่สำเร็จ: ' + String((err as Error)?.message || err).slice(0, 100), 'error') }
  }

  function createContentFromImage(url: string) {
    if (contentType === 'post' || contentType === 'announcement') {
      setPostImages([url])
      flashTo('mk-images-strip')
      showToast(`แนบภาพเข้าชุดภาพ ${contentType === 'post' ? 'โพสต์' : 'ประกาศ'} แล้ว — กด "สร้างและส่งตรวจ" เพื่อส่ง CNT-01`, 'success')
    } else if (contentType === 'promotion') {
      setPromoForm((f) => ({ ...f, banner_image: url }))
      showToast('ใช้ภาพนี้เป็นรูปแบนเนอร์โปรโมชั่นแล้ว — กดบันทึกเพื่อส่งตรวจ', 'success')
    } else if (contentType === 'banner') {
      setBannerForm((f) => ({ ...f, banner_image: url }))
      showToast('ใช้ภาพนี้เป็นรูปแบนเนอร์แล้ว — กดบันทึกเพื่อส่งตรวจ', 'success')
    }
  }

  async function createAndSubmitFromImage(url: string) {
    // First set the image
    if (contentType === 'post' || contentType === 'announcement') {
      setPostImages([url])
    } else if (contentType === 'promotion') {
      setPromoForm((f) => ({ ...f, banner_image: url }))
    } else if (contentType === 'banner') {
      setBannerForm((f) => ({ ...f, banner_image: url }))
    }
    // Small delay to let state update, then submit
    setTimeout(() => {
      void handleSubmitAll()
    }, 50)
  }

  // ===== Approval Queue Handlers =====
  async function handleApproveApproval(id: string) {
    try {
      const ok = await reviewContent(id, 'approved')
      if (ok) {
        showToast('อนุมัติแล้ว — โพสต์พร้อมตั้งเวลาได้', 'success')
        void loadApprovalItems()
        void loadScheduledPosts()
      } else {
        showToast('อนุมัติไม่สำเร็จ', 'error')
      }
    } catch (e) {
      showToast('อนุมัติไม่สำเร็จ: ' + String(e), 'error')
    }
  }

  async function handleRejectApproval(id: string) {
    const note = window.prompt('เหตุผลที่ปฏิเสธ (บันทึกลง audit):', '') ?? ''
    try {
      const ok = await reviewContent(id, 'rejected', note)
      if (ok) {
        showToast('ปฏิเสธแล้ว', 'success')
        void loadApprovalItems()
      } else {
        showToast('บันทึกการตัดสินใจไม่สำเร็จ', 'error')
      }
    } catch (e) {
      showToast('ปฏิเสธไม่สำเร็จ: ' + String(e), 'error')
    }
  }

  async function handleRetryApproval(item: ContentApprovalRow) {
    try {
      const newId = await supabase.functions.invoke('submit_content_for_approval', {
        body: {
          p_content_type: item.content_type,
          p_title: item.title,
          p_body: item.body,
          p_image_url: item.image_url ?? null,
          p_mascot: item.mascot ?? null,
        }
      })
      if (newId.error) {
        showToast('ส่งตรวจใหม่ไม่สำเร็จ: ' + newId.error.message, 'error')
      } else {
        showToast('ส่งตรวจใหม่แล้ว — อยู่ในคิวรออนุมัติ', 'success')
        void loadApprovalItems()
      }
    } catch (e) {
      showToast('ส่งตรวจใหม่ไม่สำเร็จ: ' + String(e), 'error')
    }
  }

  // ===== Schedule Panel Handlers =====
  const schedulableStatus = (status: string) => status === 'approved' || status === 'scheduled' || status === 'failed'

  async function handleSchedulePost(id: string) {
    const post = scheduledPosts.find((p) => p.id === id)
    if (!post || !schedulableStatus(post.status)) { showToast('โพสต์นี้ยังไม่ผ่านการอนุมัติ — อนุมัติก่อนตั้งเวลา', 'error'); return }
    const when = whenByPost[id]
    if (!when) { showToast('เลือกเวลาเผยแพร่ก่อน', 'error'); return }
    setScheduleBusyId(id)
    try {
      const r = await scheduleMarketingPost(id, new Date(when).toISOString())
      if (r.ok) {
        showToast('ตั้งเวลาเผยแพร่แล้ว (ระบบจะโพสต์อัตโนมัติเมื่อถึงเวลา)', 'success')
        void loadScheduledPosts()
      } else {
        const err = r.error || 'ERR_SCHEDULE_FAILED'
        showToast(err.includes('ERR_APPROVAL_REQUIRED') ? 'ตั้งเวลาไม่สำเร็จ: โพสต์นี้ยังไม่ผ่านการอนุมัติ — อนุมัติก่อนตั้งเวลา' : 'ตั้งเวลาไม่สำเร็จ: ' + err, 'error')
      }
    } catch (e) {
      showToast('ตั้งเวลาไม่สำเร็จ: ' + String(e), 'error')
    } finally {
      setScheduleBusyId(null)
    }
  }

  async function handleAutoSchedulePosts() {
    setScheduleBusyId('auto')
    try {
      const res = await autoScheduleApprovedPosts()
      if (res.scheduled > 0) {
        const preview = res.plan.slice(0, 3).map((p: { title: string; iso: string }) => `${p.title}: ${new Date(p.iso).toLocaleString('th-TH')}`).join(' · ')
        showToast(`AI เลือกเวลาให้ ${res.scheduled} โพสต์ (ข้าม ${res.skipped})${res.failed ? ` · ล้มเหลว ${res.failed}` : ''} — ${preview}`, 'success')
        void loadScheduledPosts()
      } else {
        showToast(`ยังไม่มีโพสต์ที่ตั้งเวลาให้ได้ (ข้าม ${res.skipped}) — ต้องมีโพสต์ที่อนุมัติแล้วและยังไม่มีเวลา`, 'info')
      }
      if (res.failed > 0) showToast('ตั้งเวลาไม่สำเร็จบางรายการ: ' + res.errors.map((e: { error: string }) => e.error).join(', '), 'error')
    } catch (e) {
      showToast('Auto-schedule ไม่สำเร็จ: ' + String(e), 'error')
    } finally {
      setScheduleBusyId(null)
    }
  }

  const WM_MASCOTS: Array<{ key: string; label: string }> = [
    { key: 'auto', label: '🤖 อัตโนมัติ (เลือกตามประเภทภาพ — จำไว้ใช้ทุกครั้ง)' },
    { key: 'bite_recommend', label: '👉 น้อง Bite แนะนำ' },
    { key: 'bite_menu', label: '🍽️ น้อง Bite นำเสนอเมนู' },
    { key: 'bite_eating', label: '😋 น้อง Bite ทานของอร่อย' },
    { key: 'bite_cooking', label: '👨‍🍳 น้อง Bite ทีมครัว' },
    { key: 'bite_award', label: '🏆 น้อง Bite ฉลองรางวัล' },
  ]

  // ===== Floating Ad =====
  async function toggleFloatingAd(url: string) {
    try {
      const next = floatingAdImage === url ? '' : url
      const ok = await setBusinessSetting('floating_ad_image', next)
      if (!ok) throw new Error('save failed')
      setFloatingAdImage(next)
      showToast(next ? 'ตั้งภาพนี้เป็นโฆษณาลอย (Floating Ad) แล้ว — จะโชว์พร้อมน้อง Bite ประกอบบนรูปที่หน้าแรก' : 'เลิกใช้ภาพนี้เป็นโฆษณาลอยแล้ว (กลับเป็นมาสคอตตามเดิม)', 'success')
      flashTo('mk-ai-album')
    } catch (err) {
      showToast('บันทึกโฆษณาลอยไม่สำเร็จ: ' + String((err as Error)?.message || err).slice(0, 100), 'error')
    }
  }

  // ===== Unified Submit =====
  async function handleSubmitAll() {
    if (contentType === 'post' || contentType === 'announcement') {
      await handleSubmitPost()
    } else if (contentType === 'promotion') {
      await handleSubmitPromotion()
    } else if (contentType === 'banner') {
      await handleSubmitBanner()
    }
  }

  async function handleSubmitPost() {
    if (!postTitle.trim()) { showToast('ใส่หัวข้อโพสต์ก่อน', 'error'); return }
    setPostSaving(true)
    const genOnes = postImages.filter((u) => u.includes('/ai-generated/'))
    const postImagesFinal = genOnes.length > 0 ? [genOnes[genOnes.length - 1]] : postImages
    const r = await createMarketingPost({ title: postTitle.trim(), body: postBody, content_type: contentType, image_urls: postImagesFinal })
    setPostSaving(false)
    if (r.ok) {
      showToast('สร้างโพสต์แล้ว — ส่งเข้ากล่องอนุมัติ (CNT-01)', 'success')
      setPostTitle(''); setPostBody(''); setPostImages([])
      await load()
    } else {
      showToast('สร้างโพสต์ไม่สำเร็จ: ' + (r.error || 'ERR_SUBMIT_FAILED'), 'error')
    }
  }

  async function handleSubmitPromotion() {
    const validated = validatePromoForm()
    if (!validated.ok) { showToast(validated.errors[0], 'warning'); return }
    setPromoSaving(true)
    const row: PromotionRow = {
      id: '',
      name: promoForm.name,
      description: promoForm.description || null,
      code: promoForm.code || null,
      discount_type: promoForm.discount_type,
      discount_value: promoForm.discount_value,
      min_order_amount: promoForm.min_order_amount,
      start_date: promoForm.start_date || null,
      end_date: promoForm.end_date || null,
      is_active: promoForm.is_active,
      is_banner: promoForm.is_banner,
      banner_image: promoForm.banner_image || null,
      banner_mascot: promoForm.banner_mascot || null,
      stackable: promoForm.stackable ?? false,
      applies_to: promoForm.applies_to ?? 'all_products',
      max_discount_amount: promoForm.max_discount_amount ?? null,
      usage_limit: promoForm.usage_limit ?? null,
      scope_product_ids: promoForm.scope_product_ids ?? [],
    }
    // Send image URL and mascot to approval submission
    const approvalId = await submitContentForApproval(
      'banner',
      promoForm.name,
      promoForm.description || '',
      promoForm.banner_image || undefined,
      promoForm.banner_mascot || undefined
    )
    if (approvalId) {
      row.approval_id = approvalId
    }
    const saved = await upsertPromotion(row)
    setPromoSaving(false)
    if (!saved.ok) {
      showToast(`บันทึกโปรโมชั่นไม่สำเร็จ: ${saved.error}`, 'error')
      return
    }
    if (promoForm.is_banner && approvalId) {
      showToast('บันทึกโปรโมชั่นแล้ว + ส่งแบนเนอร์เข้าคิวตรวจเนื้อหา (CNT-01) — แบนเนอร์จะขึ้นหน้าแรกเมื่ออนุมัติ', 'success')
    } else {
      showToast('บันทึกโปรโมชั่นแล้ว', 'success')
    }
    setPromoForm({
      name: '', description: '', code: '', discount_type: 'percentage', discount_value: 10,
      min_order_amount: 0, start_date: '', end_date: '', is_active: true, is_banner: false,
      banner_image: '', banner_mascot: '', stackable: false, applies_to: 'all_products',
      max_discount_amount: null, usage_limit: null, scope_product_ids: [],
    })
    await load()
  }

  async function handleSubmitBanner() {
    if (!bannerForm.title.trim()) { showToast('ใส่หัวข้อแบนเนอร์ก่อน', 'error'); return }
    if (!bannerForm.banner_image) { showToast('เลือกรูปแบนเนอร์ก่อน (อัปโหลด/เลือกจากคลัง/ลิงก์ภายนอก)', 'warning'); return }
    setBannerSaving(true)
    // Send image URL and mascot to approval submission
    const approvalId = await submitContentForApproval(
      'banner',
      bannerForm.title,
      bannerForm.body,
      bannerForm.banner_image,
      bannerForm.banner_mascot || undefined
    )
    setBannerSaving(false)
    if (approvalId) {
      // If set as floating ad, store the approval_id reference
      if (bannerForm.set_as_floating_ad) {
        await setBusinessSetting('floating_ad_image', bannerForm.banner_image)
        showToast('สร้างแบนเนอร์แล้ว + ตั้งเป็นโฆษณาลอย (รออนุมัติ) — จะขึ้นหน้าแรกเมื่ออนุมัติ', 'success')
      } else {
        showToast('สร้างแบนเนอร์แล้ว — ส่งเข้าคิวตรวจเนื้อหา (CNT-01)', 'success')
      }
      setBannerForm({ title: '', body: '', banner_image: '', banner_mascot: '', set_as_floating_ad: false })
      await load()
    } else {
      showToast('สร้างแบนเนอร์ไม่สำเร็จ', 'error')
    }
  }

  // ===== Promotion Form Validation =====
  function validatePromoForm(): { ok: boolean; errors: string[] } {
    const errors: string[] = []
    if (!promoForm.name.trim()) errors.push('ใส่ชื่อโปรโมชั่น')
    if (!promoForm.code.trim()) errors.push('ใส่รหัสโค้ด (เช่น BMB10)')
    if (promoForm.discount_value <= 0) errors.push('มูลค่าส่วนลดต้องมากกว่า 0')
    if (promoForm.min_order_amount < 0) errors.push('ยอดสั่งขั้นต่ำต้องไม่ติดลบ')
    if (promoForm.is_banner && !promoForm.banner_image) errors.push('เลือก/อัปโหลดรูปแบนเนอร์ (หรือติ๊ก is_banner = false)')
    return { ok: errors.length === 0, errors }
  }

  // ===== Promotion Form Helpers =====
  async function handlePromoUploadBanner(file: File) {
    setUploading(true)
    try {
      const asset = await uploadMediaAsset(file, 'image', promoForm.name || 'banner')
      if (asset?.url) {
        setPromoForm((f) => ({ ...f, banner_image: asset.url }))
        showToast('อัปโหลดรูปสำเร็จ — รูปจะใช้เป็นแบนเนอร์ตามที่ตั้งค่าไว้', 'success')
      } else {
        showToast('อัปโหลดรูปไม่สำเร็จ — ลองอีกครั้ง หรือวางลิงก์รูปในช่องด้านบนแทน', 'error')
      }
    } finally { setUploading(false) }
  }

  async function handlePromoBrowseAlbum(target: 'image' | 'mascot') {
    if (albumPanel === target) { setAlbumPanel(null); return }
    if (!promoAlbum) {
      const files = await listAiAlbumFiles()
      setPromoAlbum(files)
      if (files.length === 0) showToast('ยังไม่มีภาพในคลังภาพ AI — เจนรูปที่ AI Studio ก่อน หรืออัปโหลดจากเครื่อง', 'warning')
    }
    setAlbumPanel(target)
  }

  const [promoAlbum, setPromoAlbum] = useState<AiAlbumFile[] | null>(null)
  const [albumPanel, setAlbumPanel] = useState<null | 'image' | 'mascot'>(null)

  function pickPromoFromAlbum(url: string) {
    if (albumPanel === 'mascot') {
      setPromoForm((f) => ({ ...f, banner_mascot: url }))
      showToast('ตั้งมาสคอตจากคลังภาพแล้ว', 'success')
    } else {
      setPromoForm((f) => ({ ...f, banner_image: url }))
      showToast('ใช้ภาพจากคลังภาพเป็นรูปแบนเนอร์แล้ว', 'success')
    }
    setAlbumPanel(null)
  }

  async function handlePromoUploadMascot(file: File) {
    setUploading(true)
    try {
      const asset = await uploadMediaAsset(file, 'mascot', promoForm.name || 'mascot')
      if (asset?.url) {
        setPromoForm((f) => ({ ...f, banner_mascot: asset.url }))
        showToast('อัปโหลดมาสคอตสำเร็จ', 'success')
      } else {
        showToast('อัปโหลดมาสคอตไม่สำเร็จ — ลองใหม่ หรือเลือกจากคลังภาพได้', 'error')
      }
    } finally { setUploading(false) }
  }

  // ===== Banner Form Helpers =====
  async function handleBannerUpload(file: File) {
    setUploading(true)
    try {
      const asset = await uploadMediaAsset(file, 'image', bannerForm.title || 'banner')
      if (asset?.url) {
        setBannerForm((f) => ({ ...f, banner_image: asset.url }))
        showToast('อัปโหลดรูปแบนเนอร์สำเร็จ', 'success')
      } else {
        showToast('อัปโหลดรูปไม่สำเร็จ', 'error')
      }
    } finally { setUploading(false) }
  }

  async function handleBannerBrowseAlbum(target: 'image' | 'mascot') {
    if (bannerAlbumPanel === target) { setBannerAlbumPanel(null); return }
    if (!bannerAlbum) {
      const files = await listAiAlbumFiles()
      setBannerAlbum(files)
      if (files.length === 0) showToast('ยังไม่มีภาพในคลังภาพ AI — เจนรูปที่ AI Studio ก่อน', 'warning')
    }
    setBannerAlbumPanel(target)
  }

  const [bannerAlbum, setBannerAlbum] = useState<AiAlbumFile[] | null>(null)
  const [bannerAlbumPanel, setBannerAlbumPanel] = useState<null | 'image' | 'mascot'>(null)

  function pickBannerFromAlbum(url: string) {
    if (bannerAlbumPanel === 'mascot') {
      setBannerForm((f) => ({ ...f, banner_mascot: url }))
      showToast('ตั้งมาสคอตจากคลังภาพแล้ว', 'success')
    } else {
      setBannerForm((f) => ({ ...f, banner_image: url }))
      showToast('ใช้ภาพจากคลังภาพเป็นรูปแบนเนอร์แล้ว', 'success')
    }
    setBannerAlbumPanel(null)
  }

  // ===== Render =====
  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-brand-accent">📝 สร้างเนื้อหา (Unified)</h1>
      <p className="text-sm text-brand-muted">เจนภาพ AI · เลือกภาพจากคลัง · สร้าง Post/Promotion/Banner · ตั้ง Floating Ad — ทั้งหมดที่นี่</p>

      {/* Content Type Selector */}
      <div className="card p-4">
        <p className="font-semibold text-brand-accent mb-3">ประเภทเนื้อหาที่จะสร้าง</p>
        <div className="flex flex-wrap gap-3">
          {(['post', 'promotion', 'banner', 'announcement'] as const).map((type) => {
            const labels = { post: '📝 โพสต์ทั่วไป', promotion: '🎁 โปรโมชั่น/ส่วนลด', banner: '🏠 แบนเนอร์/โปรโมท', announcement: '📣 ประกาศ/ข่าวสาร' }
            return (
              <button
                key={type}
                type="button"
                onClick={() => setContentType(type)}
                className={`btn ${contentType === type ? 'btn-primary' : 'btn-outline'}`}
                data-testid={`content-type-${type}`}
              >
                {labels[type]}
              </button>
            )
          })}
        </div>
      </div>

      {/* Section 1.5: Select from Menu Catalog */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-brand-accent">🍽️ เลือกรูปจากเมนู</h2>
          <button
            type="button"
            className="btn btn-primary text-sm"
            onClick={() => setCatalogModalOpen(true)}
            data-testid="mk-catalog-picker-btn"
          >
            {catalogLoading ? ' กำลังโหลด…' : ' เลือกรูปจากเมนู'}
          </button>
        </div>
        <p className="text-xs text-brand-muted mb-3">
          เลือกรูปจากเมนูที่มีอยู่ — เลือก "ใช้เป็นรูปเนื้อหา" เพื่อแนบกับโพสต์/โปรโมชั่น/แบนเนอร์ หรือ "ใช้เป็นต้นแบบ AI" เพื่อใช้อ้างอิงในการเจนภาพใหม่
        </p>
        <div className="flex gap-2 text-xs">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            <span>ใช้เป็นรูปเนื้อหา</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <span>ใช้เป็นต้นแบบ AI</span>
          </div>
        </div>
      </div>

      {/* Section 1: Image Generation */}
      <div className="card p-4">
        <h2 className="font-bold text-brand-accent mb-4">✨ สร้างภาพด้วย AI (E5/E6)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <label className="text-sm">ประเภทภาพ
            <select className="input w-full" value={genKind} onChange={(e) => setGenKind(e.target.value as typeof genKind)}>
              <option value="promo">ป้ายโปรโมต</option>
              <option value="festival">ภาพเทศกาล</option>
              <option value="menu">ภาพเมนู/อาหาร (ใช้รูปต้นแบบเป็นต้นแบบไดคัท)</option>
            </select>
          </label>
          <label className="text-sm">สไตล์ (E6 — 3 แนวจากโจทย์เดียวกัน)
            <select className="input w-full" value={genStyle} onChange={(e) => setGenStyle(e.target.value as typeof genStyle)}>
              <option value="realistic">ถ่ายสมจริง</option>
              <option value="illustration">ภาพประกอบ</option>
              <option value="poster">กราฟิกป้าย</option>
            </select>
          </label>
          <label className="text-sm">ชื่อสินค้า/หัวข้อ
            <input className="input w-full" value={genSubject} onChange={(e) => setGenSubject(e.target.value)} placeholder="เช่น บิงซูมะม่วง" />
          </label>
          <label className="text-sm">เพิ่มเติม (ไม่บังคับ)
            <input className="input w-full" value={genNote} onChange={(e) => setGenNote(e.target.value)} placeholder="เช่น โทนเหลืองทอง" />
          </label>
          <label className="text-sm">มาสคอตลายน้ำ (R47 — ทุกภาพเจน)
            <select className="input w-full" value={wmMascot} onChange={(e) => { setWmMascot(e.target.value); try { localStorage.setItem('bmb:wm-mascot', e.target.value); showToast('จำมาสคอตลายน้ำไว้ใช้กับทุกรูปที่เจนจากนี้แล้ว', 'success') } catch {} }} data-testid="mk-wm-mascot">
              {WM_MASCOTS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          <button className="btn btn-primary" disabled={genBusy} onClick={() => void handleGenerateImage()} data-testid="mk-generate-image">
            {genBusy ? '⏳ กำลังสร้าง…' : '✨ สร้างภาพ'}
          </button>
          <button className="btn btn-outline" disabled={browseBusy} onClick={() => browseRef.current?.click()} data-testid="mk-browse-image">
            {browseBusy ? '⏳ กำลังอัปโหลด…' : '📁 เลือกไฟล์จากเครื่อง'}
          </button>
          <input ref={browseRef} type="file" accept="image/*" className="hidden" data-testid="mk-browse-input" onChange={(e) => void handleBrowseImage(e)} />
        </div>
        <p className="text-xs text-brand-muted mb-4">รูปเมนู = ภาพจริงจากแคตตาลอก (จิ้มเมนูใน Planner) หรือ <b>ไฟล์จากเครื่อง (browse)</b> — แนบไว้แล้วใช้เป็น<b>ต้นแบบไดคัท</b>ตอนเจนภาพเมนูได้ · <b>เจนได้แม้ไม่มีภาพตัวอย่าง</b> (ระบบใช้รายละเอียดหัวข้อ/เนื้อหาโพสต์เป็นโจทย์) · ภาพที่เจน<b>ไม่ถูกแนบ/เลือกใช้อัตโนมัติ</b> — กด "ใช้" เองจากอัลบั้ม · ทุกภาพถูก<b>ประกบลายน้ำแบรนด์</b> (โลโก้จริง + มาสคอต) อัตโนมัติ</p>

        {/* Gen Status + Preview */}
        {genStatus.phase !== 'idle' && (
          <div className={`mt-3 rounded-xl border p-3 text-sm ${genStatus.phase === 'fail' ? 'border-red-400 bg-red-50 text-red-700' : genStatus.phase === 'ok' ? 'border-green-400 bg-green-50 text-green-700' : 'border-brand-border bg-brand-surface'}`} data-testid="mk-gen-status" role="status">
            {genStatus.phase === 'running' && <span>⏳ <b>กำลังสร้างภาพ…</b> (วนโมเดลตามลำดับ — อาจใช้ 10–40 วินาที) · โจทย์: {genSubject.trim() || postTitle.trim() || '—'} · ภาพอ้างอิง: {postImages.length ? 'มี (ภาพล่าสุดในชุด)' : 'ไม่มี'}</span>}
            {genStatus.phase === 'ok' && <span>✅ <b>สร้างสำเร็จ</b>{genStatus.model ? ` · โมเดล ${genStatus.model}` : ''} — บันทึกอัลบั้มตามหมวด + ไม่แนบเข้าชุดอัตโนมัติ{genStatus.qa && genStatus.qa.w ? ` · ขนาด ${genStatus.qa.w}×${genStatus.qa.h}px` : ''}</span>}
            {genStatus.phase === 'ok' && genStatus.qa && !genStatus.qa.ok && <span className="block mt-1 text-amber-700" data-testid="mk-gen-qa-warn">⚠️ {genStatus.qa.warn} — <b>ระบบไม่เลือกใช้แทนให้อัตโนมัติ</b> ตรวจภาพก่อน แล้วกด "ใช้" เองถ้าผ่าน</span>}
            {genStatus.phase === 'fail' && <span>❌ <b>สร้างไม่สำเร็จ:</b> {genStatus.detail}</span>}
          </div>
        )}
        {genStatus.phase === 'ok' && genStatus.url && (
          <div className="mt-3 flex items-start gap-3" data-testid="mk-gen-result">
            <img src={genStatus.url} alt="ภาพที่เพิ่งสร้าง" className="w-40 h-40 object-cover rounded-xl border border-brand-border" />
            <div className="text-xs text-brand-muted"><b>พรีวิวผลลัพธ์ล่าสุด</b> — อยู่ในชุดภาพ (ด้านล่าง) + อัลบั้ม ai-generated แล้ว ใช้กับโพสต์ได้เลย<br /><a href={genStatus.url} target="_blank" rel="noreferrer" className="underline">เปิดไฟล์เต็ม</a></div>
          </div>
        )}

        {/* Post Images Strip */}
        {postImages.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4" data-testid="mk-images-strip">
            {postImages.map((u, i) => (
              <span key={u} className="relative inline-block">
                <img src={u} alt="generated" className="w-24 h-24 object-cover rounded-lg border border-brand-border" />
                <button type="button" aria-label="ลบรูปนี้" title="ลบรูปนี้ — ออกจากชุดภาพ + ลบไฟล์จริงจากคลัง (ถ้าเป็นไฟล์ของเรา)" data-testid={`mk-img-del-${i}`} onClick={() => void handleRemoveImage(u)} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-brand-primary text-white text-xs leading-none btn p-0">✕</button>
              </span>
            ))}
            {postImages.some(isGenImage) && postImages.length > 1 && <p className="w-full text-xs text-brand-accent" data-testid="mk-images-gen-only">มีภาพเจนในชุด — ตอนสร้างโพสต์จะใช้ภาพเจน 1 รูปเท่านั้น (รูปต้นแบบ/รูปอื่นจะไม่ถูกแนบคู่กัน)</p>}
          </div>
        )}

        {/* AI Album */}
        <div className="mt-4" data-testid="mk-ai-album">
          {/* แนะนำวิธีตั้งค่าโฆษณาลอย (Floating Ad) — แยก 2 ส่วน */}
          <div className="mb-3 p-3 rounded-lg bg-brand-surface border border-brand-border text-xs" data-testid="mk-floatad-guide">
            <div className="font-semibold text-brand-accent mb-1">💡 วิธีตั้งค่าโฆษณาลอย (Floating Ad)</div>
            <div className="space-y-1 text-brand-muted">
              <div>① <b>เปิด/ปิดโฆษณาลอยทั้งหมด</b> → ไปที่ <a href="/admin/settings" className="underline hover:text-brand-primary" target="_blank" rel="noopener">หน้าตั้งค่าแอดมิน (AdminSettings)</a> → Card "โฆษณาลอย (Floating Ad)" <b>หรือใช้สวิทซ์ด้านล่างนี้</b></div>
              <div>② <b>เลือกภาพเป็นโฆษณาลอย</b> → อยู่ที่นี่ (อัลบั้ม AI) → เลือกหมวด <b>โปรโมต</b> หรือ <b>เทศกาล</b> → กด <b>📌 ตั้งเป็นโฆษณาลอย</b></div>
              <div>③ ภาพต้อง <b>ผ่านการอนุมัติ (CNT-01)</b> ก่อน จึงจะแสดงจริงบนหน้าแรก</div>
            </div>
          </div>

          {/* Kill Switch สำหรับ Floating Ad — ตรงนี้เลย ไม่ต้องไปหน้าอื่น */}
          <div className="mb-3 p-3 rounded-lg bg-brand-surface border border-brand-border" data-testid="mk-floatad-switch-inline">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs">
                <div className="font-semibold text-brand-accent">🔧 โฆษณาลอย (Floating Ad) — Kill Switch</div>
                <div className="text-brand-muted">ปิด = ซ่อนโฆษณาลอยทั้งหมดจากหน้าแรก · เปิด = แสดงตามที่ตั้งค่าไว้</div>
              </div>
              <ToggleSwitch
                checked={floatingAdEnabled}
                onChange={async (v) => {
                  const ok = await setBusinessSetting('floating_ad_enabled', v)
                  if (ok) setFloatingAdEnabled(v)
                  else showToast('บันทึกไม่สำเร็จ', 'error')
                }}
                label={floatingAdEnabled ? 'เปิด' : 'ปิด'}
                testId="floating-ad-toggle-inline"
              />
            </div>
          </div>

          {/* Floating Ad Sources Filter — เลือกแหล่งข้อมูลที่จะโชว์เป็นโฟลตติ้ง */}
          <div className="mb-3 p-3 rounded-lg bg-brand-surface border border-brand-border" data-testid="mk-floatad-sources">
            <div className="font-semibold text-brand-accent text-xs mb-2">📋 แหล่งข้อมูลโฟลตติ้ง (เลือกได้หลายอย่าง)</div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {[
                { key: 'promotions' as const, label: '🎁 โปรโมชั่น (is_banner=true)', desc: 'จากตาราง promotions ที่ตั้ง is_banner=true' },
                { key: 'announcements' as const, label: '📣 ประกาศ/โพสต์', desc: 'จาก marketing_feed_posts (RPC)' },
                { key: 'approved_banners' as const, label: '✅ แบนเนอร์อนุมัติแล้ว', desc: 'จาก content_approvals ที่ผ่าน CNT-01 + set_as_floating_ad' }
              ].map(({ key, label, desc }) => (
                <label key={key} className="flex items-start gap-2 p-2 rounded-lg border hover:bg-brand-primary/5 transition-colors cursor-pointer">
                  <input
                    type="checkbox"
                    checked={floatingAdSources.includes(key)}
                    onChange={(e) => {
                      const next = floatingAdSources.includes(key)
                        ? floatingAdSources.filter((s) => s !== key)
                        : [...floatingAdSources, key]
                      setFloatingAdSources(next)
                      void (async () => {
                        const ok = await setBusinessSetting('floating_ad_sources', next)
                        if (!ok) showToast('บันทึกไม่สำเร็จ', 'error')
                      })()
                    }}
                    className="mt-1 w-4 h-4 accent-brand-primary"
                  />
                  <div>
                    <div className="font-medium text-brand-text">{label}</div>
                    <div className="text-[9px] text-brand-muted">{desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <p className="text-xs font-semibold text-brand-accent mb-2">🗂️ อัลบั้มภาพที่ AI สร้าง (<code>{`bmb-images/ai-generated/<หมวด>/`}</code>) — เลือกหมวด แล้วกดปุ่มบนรูปได้เอง</p>
          <div className="flex flex-wrap gap-1 mb-2" data-testid="mk-ai-album-tabs">
            {(['all', 'menu', 'promo', 'festival', 'disabled', 'legacy'] as Array<'all' | 'menu' | 'promo' | 'festival' | 'disabled' | 'legacy'>).map((k) => {
              const labels: Record<string, string> = { all: '🟢 ใช้งานได้', menu: '🍽️ เมนู', promo: '📣 โปรโมต', festival: '🎉 เทศกาล', disabled: '⚪ ปิดใช้งาน', legacy: '📁 รุ่นก่อน' }
              return <button key={k} type="button" onClick={() => setAiAlbumTab(k)} className={`px-2 py-1 rounded-lg text-xs font-medium border ${aiAlbumTab === k ? 'bg-brand-primary text-white border-brand-primary' : 'bg-brand-surface border-brand-border text-brand-accent'}`} data-testid={`mk-ai-tab-${k}`}>{labels[k]}</button>
            })}
          </div>
          {albumLoading ? <p className="text-sm text-brand-muted">กำลังโหลดอัลบั้ม…</p> : visibleAiAlbum.length === 0 ? <p className="text-xs text-brand-muted">ยังไม่มีภาพในหมวดนี้ — สร้างภาพสำเร็จจะขึ้นทันทีในหมวดที่เลือกเจน</p> : (
            <div className="flex flex-wrap gap-2" data-testid="mk-ai-album-grid">
              {visibleAiAlbum.map((a) => (
                <div key={a.path} className={`relative w-24 rounded-lg border overflow-hidden ${a.disabled ? 'opacity-50 border-brand-border' : 'border-brand-border'}`} data-testid={`mk-ai-item-${a.name}`}>
                  <img src={a.url} alt={a.name} className="w-full h-20 object-cover" />
                  <div className="flex text-[9px] leading-none">
                    <button type="button" className="flex-1 bg-brand-primary text-white py-1" onClick={() => pickAiImage(a.url)} data-testid={`mk-ai-pick-${a.name}`} title="ใช้รูปนี้เป็นภาพโพสต์">ใช้</button>
                    <button type="button" className="flex-1 bg-green-600 text-white py-1" onClick={() => void createAndSubmitFromImage(a.url)} data-testid={`mk-ai-create-${a.name}`} title="สร้างโพสต์/โปรโมชั่น/แบนเนอร์จากภาพนี้ + ส่งตรวจ CNT-01 (ใช้ข้อมูลฟอร์มทั้งหมดที่กรอก)">สร้างและส่งตรวจ</button>
                    <button type="button" className="flex-1 bg-amber-500 text-white py-1" onClick={() => void toggleAiImage(a)} data-testid={`mk-ai-toggle-${a.name}`} title={a.disabled ? 'เปิดใช้งานรูปนี้อีกครั้ง' : 'ปิดรูปนี้ — ไม่ให้ระบบนำไปใช้'}>{a.disabled ? 'เปิด' : 'ปิด'}</button>
                    <button type="button" className="flex-1 bg-red-500 text-white py-1" onClick={() => void deleteAiImage(a)} data-testid={`mk-ai-del-${a.name}`} title="ลบรูปนี้ออกจากอัลบั้ม (ลบไฟล์จริง)">ลบ</button>
                  </div>
                  {/* Badge แสดงว่าเป็นโฆษณาลอยปัจจุบัน */}
                  {floatingAdImage === a.url && (
                    <div className="absolute top-1 left-1 z-10 bg-purple-600 text-white text-[8px] px-1.5 py-0.5 rounded font-medium" data-testid={`mk-ai-floatad-badge-${a.name}`}>
                      📌 โฆษณาลอยปัจจุบัน
                    </div>
                  )}

                  {/* ปุ่มตั้งเป็นโฆษณาลอย — แสดงสำหรับ promo/festival ที่ไม่ disabled */}
                  {(a.kind === 'promo' || a.kind === 'festival') && !a.disabled && (
                    <button type="button" className={`w-full text-[9px] py-1 ${floatingAdImage === a.url ? 'bg-purple-600 text-white' : 'bg-purple-100 text-purple-700'}`} onClick={() => void toggleFloatingAd(a.url)} data-testid={`mk-ai-floatad-${a.name}`} title="ใช้รูปนี้เป็นโฆษณาลอย (แทนมาสคอต) — กดอีกครั้งเพื่อเลิกใช้">{floatingAdImage === a.url ? '✓ เป็นโฆษณาลอย' : '📌 ตั้งเป็นโฆษณาลอย'}</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Section 2: Form Fields by Content Type */}
      <div className="card p-4">
        <h2 className="font-bold text-brand-accent mb-4">📋 ฟอร์มสร้าง {contentType === 'post' ? 'โพสต์' : contentType === 'promotion' ? 'โปรโมชั่น' : contentType === 'banner' ? 'แบนเนอร์' : 'ประกาศ'}</h2>

        {contentType === 'post' && (
          <div className="space-y-3">
            <label className="text-sm">หัวข้อโพสต์ <span className="text-red-500">*</span>
              <input className="input w-full mt-1" value={postTitle} onChange={(e) => setPostTitle(e.target.value)} placeholder="หัวข้อโพสต์" />
            </label>
            <label className="text-sm">เนื้อหาโพสต์
              <textarea className="input w-full mt-1 h-24" value={postBody} onChange={(e) => setPostBody(e.target.value)} placeholder="รายละเอียดโพสต์..." />
            </label>
          </div>
        )}

        {contentType === 'announcement' && (
          <div className="space-y-3">
            <label className="text-sm">หัวข้อประกาศ <span className="text-red-500">*</span>
              <input className="input w-full mt-1" value={postTitle} onChange={(e) => setPostTitle(e.target.value)} placeholder="หัวข้อประกาศ" />
            </label>
            <label className="text-sm">เนื้อหาประกาศ
              <textarea className="input w-full mt-1 h-24" value={postBody} onChange={(e) => setPostBody(e.target.value)} placeholder="รายละเอียดประกาศ..." />
            </label>
          </div>
        )}

        {contentType === 'promotion' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">ชื่อโปรโมชั่น <span className="text-red-500">*</span>
                <input className="input w-full mt-1" value={promoForm.name} onChange={(e) => setPromoForm({ ...promoForm, name: e.target.value })} placeholder="เช่น โปรโมชั่นวันเกิด" />
              </label>
              <label className="text-sm">รหัสโค้ด <span className="text-red-500">*</span>
                <input className="input w-full mt-1" value={promoForm.code} onChange={(e) => setPromoForm({ ...promoForm, code: e.target.value })} placeholder="เช่น BMB10" />
              </label>
              <label className="text-sm">รายละเอียด
                <input className="input w-full mt-1" value={promoForm.description} onChange={(e) => setPromoForm({ ...promoForm, description: e.target.value })} placeholder="รายละเอียดโปรโมชั่น" />
              </label>
              <select className="input mt-1" value={promoForm.discount_type} onChange={(e) => setPromoForm({ ...promoForm, discount_type: e.target.value as any })}>
                <option value="percentage">ลดเป็นเปอร์เซ็นต์ (%)</option>
                <option value="fixed_amount">ลดเป็นจำนวนเงิน (บาท)</option>
              </select>
              <input type="number" className="input mt-1" placeholder="มูลค่าส่วนลด" value={promoForm.discount_value} onChange={(e) => setPromoForm({ ...promoForm, discount_value: Number(e.target.value) })} />
              <input type="number" className="input mt-1" placeholder="ยอดสั่งขั้นต่ำ (บาท)" value={promoForm.min_order_amount} onChange={(e) => setPromoForm({ ...promoForm, min_order_amount: Number(e.target.value) })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                min={0}
                className="input mt-1"
                placeholder="เพดานส่วนลด/ออเดอร์ (บาท · ว่าง = ไม่จำกัด)"
                value={promoForm.max_discount_amount ?? ''}
                onChange={(e) => setPromoForm({ ...promoForm, max_discount_amount: e.target.value === '' ? null : Number(e.target.value) })}
                data-testid="promo-max-discount"
              />
              <input
                type="number"
                min={1}
                className="input mt-1"
                placeholder="จำนวนสิทธิ์ใช้โค้ด (ว่าง = ไม่จำกัด)"
                value={promoForm.usage_limit ?? ''}
                onChange={(e) => setPromoForm({ ...promoForm, usage_limit: e.target.value === '' ? null : Number(e.target.value) })}
                data-testid="promo-usage-limit"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">เริ่ม
                <input type="date" className="input mt-1 w-full" value={promoForm.start_date} onChange={(e) => setPromoForm({ ...promoForm, start_date: e.target.value })} />
              </label>
              <label className="text-sm">ถึง
                <input type="date" className="input mt-1 w-full" value={promoForm.end_date} onChange={(e) => setPromoForm({ ...promoForm, end_date: e.target.value })} />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={promoForm.is_active} onChange={(e) => setPromoForm({ ...promoForm, is_active: e.target.checked })} />
                เปิดใช้งาน
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={promoForm.is_banner} onChange={(e) => setPromoForm({ ...promoForm, is_banner: e.target.checked })} />
                🏠 แสดงเป็นแบนเนอร์หน้าแรก (ลูกค้าปิดได้)
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={promoForm.stackable} onChange={(e) => setPromoForm({ ...promoForm, stackable: e.target.checked })} data-testid="promo-stackable" />
                🧩 ซ้อนกับสิทธิ์อื่นได้
              </label>
            </div>
            <label className="text-sm">สินค้าที่ร่วมรายการ
              <select className="input w-full mt-1" value={promoForm.applies_to} onChange={(e) => setPromoForm({ ...promoForm, applies_to: e.target.value as 'all_products' | 'specific_products' })} data-testid="promo-applies-to">
                <option value="all_products">ทั้งออเดอร์ (ทุกสินค้า)</option>
                <option value="specific_products">จำกัดสินค้าที่เลือก</option>
              </select>
            </label>
            {promoForm.applies_to === 'specific_products' && (
              <div className="rounded-xl border border-brand-border p-3" data-testid="promo-scope-picker">
                <p className="text-xs text-brand-muted mb-2">เลือกสินค้าที่เข้าเกณฑ์ส่วนลด (ส่วนลดคิดจากยอดของสินค้าเหล่านี้เท่านั้น)</p>
              </div>
            )}

            {/* Banner Image & Mascot */}
            <div className="rounded-xl border border-brand-border p-3 space-y-4 mt-4" data-testid="promo-attach-panel">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-brand-muted">🖼 ภาพแบนเนอร์:</span>
                <input
                  className="input flex-1 min-w-[200px]"
                  placeholder="ลิงก์รูปแบนเนอร์ (ไม่บังคับ)"
                  value={promoForm.banner_image}
                  onChange={(e) => setPromoForm({ ...promoForm, banner_image: e.target.value })}
                  data-testid="promo-banner-image-url"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  className="input"
                  aria-label="เลือกรูปแบนเนอร์จากเครื่อง"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void handlePromoUploadBanner(f); e.target.value = '' }}
                  disabled={uploading}
                />
                {uploading && <span className="text-sm text-brand-muted">กำลังอัปโหลด…</span>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => void handlePromoBrowseAlbum('image')} data-testid="promo-banner-album">
                  📁 เลือกจากคลังภาพ AI
                </button>
              </div>
              {albumPanel === 'image' && promoAlbum && (
                <div className="rounded-lg border border-brand-border p-2" id="promo-album-panel" data-testid="promo-album-panel">
                  <p className="text-xs text-brand-muted mb-2">คลังภาพ AI — กดเลือกเพื่อใช้เป็น <b>รูปแบนเนอร์</b></p>
                  {promoAlbum.length > 0 ? (
                    <div className="grid grid-cols-4 gap-2 max-h-56 overflow-y-auto">
                      {promoAlbum.map((a, i) => (
                        <button key={a.path} type="button" onClick={() => pickPromoFromAlbum(a.url)} data-testid={`promo-album-pick-${i}`} className="rounded border border-brand-border p-1 hover:border-brand-primary" title={a.name}>
                          <img src={a.url} alt={a.name} className="h-16 w-full rounded object-cover" loading="lazy" />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-brand-muted">ยังไม่มีภาพในคลัง — เจนที่ AI Studio แล้วกลับมาเลือกใหม่</p>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-brand-muted">🎭 มาสคอต:</span>
                {MASCOT_ROTATION.map((src, i) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => setPromoForm((f) => ({ ...f, banner_mascot: src }))}
                    data-testid={`promo-mascot-std-${i}`}
                    className={`rounded-lg border p-0.5 ${promoForm.banner_mascot === src ? 'border-brand-primary ring-2 ring-brand-primary/60' : 'border-brand-border'}`}
                    title={`มาสคอตมาตรฐานท่า ${i + 1}`}
                  >
                    <img src={src} alt="" className="h-10 w-10 object-contain" />
                  </button>
                ))}
                <input
                  type="file"
                  accept="image/*"
                  className="input w-56"
                  aria-label="อัปโหลดมาสคอตจากเครื่อง"
                  data-testid="promo-mascot-file"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void handlePromoUploadMascot(f); e.target.value = '' }}
                />
                <button type="button" className="btn btn-outline btn-sm" onClick={() => void handlePromoBrowseAlbum('mascot')} data-testid="promo-mascot-album">
                  📁 จากคลังภาพ AI
                </button>
                {promoForm.banner_mascot && (
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setPromoForm((f) => ({ ...f, banner_mascot: '' }))} data-testid="promo-mascot-clear">
                    ✕ ไม่ใช้มาสคอต
                  </button>
                )}
              </div>
              {albumPanel === 'mascot' && promoAlbum && (
                <div className="rounded-lg border border-brand-border p-2" id="promo-album-panel" data-testid="promo-album-panel">
                  <p className="text-xs text-brand-muted mb-2">คลังภาพ AI — กดเลือกเพื่อใช้เป็น <b>มาสคอต</b></p>
                  {promoAlbum.length > 0 ? (
                    <div className="grid grid-cols-4 gap-2 max-h-56 overflow-y-auto">
                      {promoAlbum.map((a, i) => (
                        <button key={a.path} type="button" onClick={() => pickPromoFromAlbum(a.url)} data-testid={`promo-album-pick-${i}`} className="rounded border border-brand-border p-1 hover:border-brand-primary" title={a.name}>
                          <img src={a.url} alt={a.name} className="h-16 w-full rounded object-cover" loading="lazy" />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-brand-muted">ยังไม่มีภาพในคลัง — เจนที่ AI Studio แล้วกลับมาเลือกใหม่</p>
                  )}
                </div>
              )}

              {/* Compose Preview */}
              <div data-testid="promo-compose-preview">
                <p className="text-xs text-brand-muted mb-1">ตัวอย่างประกอบ (แบบเดียวกับหน้าแรก):</p>
                <div className="flad-media">
                  {promoForm.banner_image && <img src={promoForm.banner_image} alt="ตัวอย่างรูปแบนเนอร์" />}
                  {promoForm.banner_mascot && <img src={promoForm.banner_mascot} alt="" className="flad-mascot-composed flad-mascot-pos-0" />}
                </div>
              </div>
            </div>
          </div>
        )}

        {contentType === 'banner' && (
          <div className="space-y-3">
            <label className="text-sm">หัวข้อแบนเนอร์ <span className="text-red-500">*</span>
              <input className="input w-full mt-1" value={bannerForm.title} onChange={(e) => setBannerForm({ ...bannerForm, title: e.target.value })} placeholder="หัวข้อแบนเนอร์" />
            </label>
            <label className="text-sm">รายละเอียด
              <textarea className="input w-full mt-1 h-20" value={bannerForm.body} onChange={(e) => setBannerForm({ ...bannerForm, body: e.target.value })} placeholder="รายละเอียดแบนเนอร์..." />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-brand-muted">🖼 ภาพแบนเนอร์:</span>
              <input
                className="input flex-1 min-w-[200px]"
                placeholder="ลิงก์รูปแบนเนอร์"
                value={bannerForm.banner_image}
                onChange={(e) => setBannerForm({ ...bannerForm, banner_image: e.target.value })}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="file"
                accept="image/*"
                className="input"
                aria-label="เลือกรูปแบนเนอร์จากเครื่อง"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleBannerUpload(f); e.target.value = '' }}
                disabled={uploading}
              />
              {uploading && <span className="text-sm text-brand-muted">กำลังอัปโหลด…</span>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="btn btn-outline btn-sm" onClick={() => void handleBannerBrowseAlbum('image')}>
                📁 เลือกจากคลังภาพ AI (แบนเนอร์)
              </button>
            </div>
            {bannerAlbumPanel === 'image' && bannerAlbum && (
              <div className="rounded-lg border border-brand-border p-2" data-testid="banner-album-panel">
                <p className="text-xs text-brand-muted mb-2">คลังภาพ AI — กดเลือกเพื่อใช้เป็น <b>รูปแบนเนอร์</b></p>
                {bannerAlbum.length > 0 ? (
                  <div className="grid grid-cols-4 gap-2 max-h-56 overflow-y-auto">
                    {bannerAlbum.map((a, i) => (
                      <button key={a.path} type="button" onClick={() => pickBannerFromAlbum(a.url)} data-testid={`banner-album-pick-${i}`} className="rounded border border-brand-border p-1 hover:border-brand-primary" title={a.name}>
                        <img src={a.url} alt={a.name} className="h-16 w-full rounded object-cover" loading="lazy" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-brand-muted">ยังไม่มีภาพในคลัง</p>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-brand-muted">🎭 มาสคอต:</span>
              {MASCOT_ROTATION.map((src, i) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setBannerForm((f) => ({ ...f, banner_mascot: src }))}
                  className={`rounded-lg border p-0.5 ${bannerForm.banner_mascot === src ? 'border-brand-primary ring-2 ring-brand-primary/60' : 'border-brand-border'}`}
                  title={`มาสคอตมาตรฐานท่า ${i + 1}`}
                >
                  <img src={src} alt="" className="h-10 w-10 object-contain" />
                </button>
              ))}
              <input
                type="file"
                accept="image/*"
                className="input w-56"
                aria-label="อัปโหลดมาสคอตจากเครื่อง"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) { setBannerForm((fm) => ({ ...fm, banner_mascot: URL.createObjectURL(f) })); showToast('ใช้ไฟล์ชั่วคราว — กดส่งตรวจจะอัปโหลดจริง', 'info') }; e.target.value = '' }}
              />
              <button type="button" className="btn btn-outline btn-sm" onClick={() => void handleBannerBrowseAlbum('mascot')}>
                📁 จากคลังภาพ AI (มาสคอต)
              </button>
              {bannerForm.banner_mascot && (
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setBannerForm((f) => ({ ...f, banner_mascot: '' }))}>
                  ✕ ไม่ใช้มาสคอต
                </button>
              )}
            </div>
            {bannerAlbumPanel === 'mascot' && bannerAlbum && (
              <div className="rounded-lg border border-brand-border p-2" data-testid="banner-album-panel">
                <p className="text-xs text-brand-muted mb-2">คลังภาพ AI — กดเลือกเพื่อใช้เป็น <b>มาสคอต</b></p>
                {bannerAlbum.length > 0 ? (
                  <div className="grid grid-cols-4 gap-2 max-h-56 overflow-y-auto">
                    {bannerAlbum.map((a, i) => (
                      <button key={a.path} type="button" onClick={() => pickBannerFromAlbum(a.url)} data-testid={`banner-album-pick-${i}`} className="rounded border border-brand-border p-1 hover:border-brand-primary" title={a.name}>
                        <img src={a.url} alt={a.name} className="h-16 w-full rounded object-cover" loading="lazy" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-brand-muted">ยังไม่มีภาพในคลัง</p>
                )}
              </div>
            )}

            {/* Floating Ad checkbox */}
            <label className="flex items-center gap-3 mt-4 p-3 rounded-lg border border-brand-border bg-brand-surface">
              <input
                type="checkbox"
                checked={bannerForm.set_as_floating_ad}
                onChange={(e) => setBannerForm({ ...bannerForm, set_as_floating_ad: e.target.checked })}
                className="w-5 h-5"
              />
              <div>
                <span className="font-medium">📌 ตั้งเป็นโฆษณาลอย (Floating Ad)</span>
                <p className="text-xs text-brand-muted">ภาพนี้จะแสดงบนหน้าแรกพร้อมน้อง Bite ประกอบ (ต้องผ่านการอนุมัติ CNT-01 ก่อน)</p>
                {floatingAdImage && <p className="text-xs text-brand-muted mt-1">ภาพปัจจุบัน: {floatingAdImage.slice(0, 60)}...</p>}
              </div>
            </label>
          </div>
        )}
      </div>

      {/* Submit Button */}
      <div className="flex gap-3">
        <button
          onClick={handleSubmitAll}
          className="btn btn-success"
          disabled={postSaving || promoSaving || bannerSaving}
          data-testid="content-submit-all"
        >
          {postSaving || promoSaving || bannerSaving ? '⏳ กำลังสร้าง…' : '🚀 สร้างและส่งตรวจ (CNT-01)'}
        </button>
      </div>

      {/* Approval Queue Panel (Unified - admin sees all like SocialTab) */}
      <div className="card p-4 mt-4" data-testid="approval-queue-panel">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-brand-accent">🛡️ คิวอนุมัติ (CNT-01)</h2>
          <span className="text-xs text-brand-muted">Admin เห็นทั้งหมด · รีเฟรชอัตโนมัติหลังดำเนินการ</span>
        </div>
        <div className="flex flex-wrap gap-2 mb-3" role="tablist">
          {(['pending', 'approved', 'rejected', 'all'] as const).map((t) => {
            const labels = { pending: '⏳ รออนุมัติ', approved: '✅ อนุมัติแล้ว', rejected: '❌ ปัดตก', all: 'ทั้งหมด' }
            return (
              <button
                key={t}
                role="tab"
                aria-selected={approvalTab === t}
                onClick={() => setApprovalTab(t)}
                className={`btn btn-sm ${approvalTab === t ? 'btn-primary' : 'btn-outline'}`}
                data-testid={`approval-tab-${t}`}
              >
                {labels[t]}
              </button>
            )
          })}
        </div>
        {approvalLoading ? (
          <p className="text-center text-brand-muted py-4">กำลังโหลดคิวอนุมัติ…</p>
        ) : approvalItems.length === 0 ? (
          <p className="text-center text-brand-muted py-4">
            {approvalTab === 'pending' ? 'ไม่มีรายการรออนุมัติ — ยอดเยี่ยม 🎉' : 'ยังไม่มีรายการในหมวดนี้'}
          </p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto" data-testid="approval-list">
            {approvalItems.map((item) => (
              <div
                key={item.id}
                className={`card p-3 border-l-4 ${item.status === 'pending' ? 'border-amber-400' : item.status === 'approved' ? 'border-emerald-500' : 'border-red-400'}`}
                data-testid={`approval-item-${item.status}`}
              >
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-2 mb-1">
                      <span className="font-semibold">{item.title}</span>
                      <span className={`badge ${item.status === 'pending' ? 'badge-warning' : item.status === 'approved' ? 'badge-success' : 'badge-danger'}`}>
                        {item.status === 'pending' ? 'รออนุมัติ' : item.status === 'approved' ? 'อนุมัติแล้ว' : 'ปัดตกแล้ว'}
                      </span>
                      <span className="badge badge-info text-xs">{item.content_type}</span>
                      {item.reviewed_at && (
                        <span className="text-xs text-brand-muted">ตรวจเมื่อ: {new Date(item.reviewed_at).toLocaleString('th-TH')}</span>
                      )}
                    </div>
                    <p className="text-sm text-brand-muted mb-1">{item.body}</p>
                    <p className="text-xs text-brand-muted">
                      สร้างโดย: {item.created_by} · {new Date(item.created_at).toLocaleString('th-TH')}
                      {item.reviewer_id && <span> · ตรวจโดย: {item.reviewer_id}</span>}
                      {item.review_note && <span className="block mt-1">หมายเหตุ: {item.review_note}</span>}
                    </p>
                    {item.image_url && (
                      <div className="mt-2">
                        <img src={item.image_url} alt="preview" className="w-24 h-24 object-cover rounded-lg border border-brand-border" />
                      </div>
                    )}
                    {item.mascot && (
                      <div className="mt-2">
                        <span className="text-xs text-brand-muted">มาสคอต: </span>
                        <img src={item.mascot} alt="mascot" className="inline w-10 h-10 object-contain" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 md:ml-4">
                    {item.status === 'pending' && (
                      <>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => void handleApproveApproval(item.id)}
                          data-testid={`approval-approve-${item.id}`}
                        >
                          ✅ อนุมัติ
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => void handleRejectApproval(item.id)}
                          data-testid={`approval-reject-${item.id}`}
                        >
                          ✖ ปฏิเสธ
                        </button>
                      </>
                    )}
                    {item.status === 'rejected' && (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => void handleRetryApproval(item)}
                        data-testid={`approval-retry-${item.id}`}
                      >
                        🔁 ส่งตรวจใหม่
                      </button>
                    )}
                    {item.status === 'approved' && (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => void handleRetryApproval(item)}
                        data-testid={`approval-retry-${item.id}`}
                      >
                        🔁 ส่งตรวจใหม่ (แก้ไข)
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Schedule Panel (Unified - uses marketingAutoSchedule logic like SocialTab) */}
      <div className="card p-4 mt-4" data-testid="schedule-panel">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-brand-accent">📅 ตั้งเวลาเผยแพร่ (Unified)</h2>
          <span className="text-xs text-brand-muted">โพสต์ที่อนุมัติแล้ว (approved) เท่านั้น · ใช้กติกาจากแท็บ ⚙️ กติกา</span>
        </div>
        <div className="card flex items-center justify-between flex-wrap gap-2" data-testid="mk-auto-schedule-bar">
          <div className="text-sm text-brand-muted">
            🤖 AI เลือกเวลาจาก <b>กติกาจริงในแท็บ "⚙️ กติกา"</b> (หน้าต่างเผยแพร่ · cooldown · เพดาน/สัปดาห์)
            — เฉพาะโพสต์ที่อนุมัติแล้ว · การโพสต์จริงเป็นระบบอัตโนมัติรายชั่วโมงตัวเดิม
          </div>
          <button type="button" className="btn btn-primary text-sm" onClick={() => void handleAutoSchedulePosts()} disabled={scheduleBusyId === 'auto'} data-testid="mk-auto-schedule">
            {scheduleBusyId === 'auto' ? '⏳ กำลังเลือกเวลา…' : '🤖 ให้ AI เลือกเวลาทั้งหมด'}
          </button>
        </div>
        {scheduleLoading ? (
          <p className="text-center text-brand-muted py-4">กำลังโหลดโพสต์รอตั้งเวลา…</p>
        ) : scheduledPosts.filter((p) => p.status !== 'published').length === 0 ? (
          <p className="text-sm text-brand-muted text-center py-4">ยังไม่มีโพสต์รอตั้งเวลา (ต้องอนุมัติก่อน)</p>
        ) : (
          <div className="space-y-2" data-testid="schedule-list">
            {scheduledPosts.filter((p) => p.status !== 'published').map((p) => (
              <div key={p.id} className="card flex items-center justify-between flex-wrap gap-2" data-testid={`mk-row-${p.id}`}>
                <div>
                  <p className="font-bold">{p.title}</p>
                  <p className="text-xs text-brand-muted">สถานะ: <span className={`badge ${p.status === 'approved' ? 'badge-info' : p.status === 'scheduled' ? 'badge-primary' : 'badge-danger'}`}>{p.status}</span>{p.scheduled_for ? ` · ตั้งไว้ ${new Date(p.scheduled_for).toLocaleString('th-TH')}` : ''}</p>
                </div>
                <div className="flex items-center gap-2">
                  <input type="datetime-local" className="input text-sm" value={whenByPost[p.id] || ''} onChange={(e) => setWhenByPost((m) => ({ ...m, [p.id]: e.target.value }))} data-testid={`mk-when-${p.id}`} />
                  <button className="btn btn-primary text-xs" onClick={() => void handleSchedulePost(p.id)} disabled={!schedulableStatus(p.status) || scheduleBusyId === p.id} title={schedulableStatus(p.status) ? undefined : 'ยังไม่ผ่านการอนุมัติ — อนุมัติก่อนตั้งเวลา'} data-testid={`mk-schedule-${p.id}`}>
                    {scheduleBusyId === p.id ? '⏳' : '⏰ ตั้งเวลา'}
                  </button>
                  {!schedulableStatus(p.status) && <span className="text-xs text-brand-muted" data-testid={`mk-schedule-hint-${p.id}`}>รออนุมัติ</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Catalog Picker Modal */}
      {catalogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={closeCatalogModal}>
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-brand-border flex items-center justify-between">
              <h3 className="text-lg font-bold text-brand-accent">🍽️ เลือกรูปจากเมนู</h3>
              <button type="button" onClick={closeCatalogModal} className="text-brand-muted hover:text-brand-primary text-2xl" aria-label="ปิด">×</button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto">
              {/* Search */}
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="ค้นหาเมนู..."
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  className="input w-full"
                  autoFocus
                  data-testid="catalog-search"
                />
              </div>
              {/* Product Grid with Preview */}
              {catalogLoading ? (
                <p className="text-center text-brand-muted py-8">กำลังโหลดรายการเมนู…</p>
              ) : filteredCatalogProducts.length === 0 ? (
                <p className="text-center text-brand-muted py-8">
                  {catalogSearch ? 'ไม่พบเมนูที่ค้นหา' : 'ยังไม่มีเมนูในรายการ'}
                </p>
              ) : (
                <div className="flex gap-4">
                  {/* Grid */}
                  <div className="flex-1 min-w-0">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {filteredCatalogProducts.map((product) => (
                        <div key={product.id} className="border border-brand-border rounded-lg overflow-hidden hover:border-brand-primary transition-colors cursor-pointer" onMouseEnter={() => setCatalogHoveredProduct(product)} onMouseLeave={() => setCatalogHoveredProduct(null)}>
                          <div className="aspect-square bg-brand-surface relative">
                            {product.image_url ? (
                              <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-brand-muted text-sm">ไม่มีภาพ</div>
                            )}
                          </div>
                          <div className="p-2">
                            <p className="font-medium text-sm truncate">{product.name}</p>
                            {product.description && <p className="text-xs text-brand-muted truncate mt-0.5">{product.description}</p>}
                            <div className="flex gap-1 mt-2">
                              <button
                                type="button"
                                className="btn btn-primary btn-sm flex-1"
                                onClick={() => void handleCatalogSelect(product, 'content')}
                                data-testid={`catalog-use-content-${product.id}`}
                              >
                                📷 เป็นรูปเนื้อหา
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline btn-sm flex-1"
                                onClick={() => void handleCatalogSelect(product, 'reference')}
                                data-testid={`catalog-use-reference-${product.id}`}
                              >
                                🎨 เป็นต้นแบบ AI
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Preview Panel */}
                  {catalogHoveredProduct && catalogHoveredProduct.image_url && (
                    <div className="w-64 flex-shrink-0" data-testid="catalog-preview-panel">
                      <div className="bg-brand-surface rounded-lg border border-brand-border p-3 sticky top-4">
                        <p className="text-xs font-semibold text-brand-accent mb-2">🖼️ พรีวิว</p>
                        <div className="aspect-square bg-white rounded-md overflow-hidden mb-2">
                          <img src={catalogHoveredProduct.image_url} alt={catalogHoveredProduct.name} className="w-full h-full object-cover" />
                        </div>
                        <p className="text-sm font-medium truncate">{catalogHoveredProduct.name}</p>
                        {catalogHoveredProduct.description && <p className="text-xs text-brand-muted truncate mt-0.5">{catalogHoveredProduct.description}</p>}
                        <div className="flex gap-1 mt-3 pt-3 border-t border-brand-border">
                          <button
                            type="button"
                            className="btn btn-primary btn-sm flex-1"
                            onClick={() => void handleCatalogSelect(catalogHoveredProduct, 'content')}
                            data-testid="catalog-preview-use-content"
                          >
                            📷 เป็นรูปเนื้อหา
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm flex-1"
                            onClick={() => void handleCatalogSelect(catalogHoveredProduct, 'reference')}
                            data-testid="catalog-preview-use-reference"
                          >
                            🎨 เป็นต้นแบบ AI
                          </button>
                        </div>
                        <p className="text-[10px] text-brand-muted mt-2">เลื่อนเมาส์ออกเพื่อปิดพรีวิว</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="p-3 border-t border-brand-border text-xs text-brand-muted">
              กด Escape หรือคลิกภายนอกเพื่อปิด • เลือก "เป็นรูปเนื้อหา" เพื่อแนบกับโพสต์/โปรโมชั่น/แบนเนอร์ • เลือก "เป็นต้นแบบ AI" เพื่อใช้อ้างอิงในการเจนภาพใหม่
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
// ============================================
// Bite Me Baby — Floating Ad Tab (แท็บจัดการโฆษณาลอย)
// แยกจาก ContentTab: ตั้งค่าภาพรวม + จัดการการ์ดต่อรายการ + Preview
// ============================================
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { showToast } from '@/components/ui/ToastContainer'
import { getFloatingAdConfig, setFloatingAdConfig } from '@/lib/bmbAdminApi_settings'
import { getPromotionsAdmin, type PromotionRow } from '@/lib/bmbAdminApi_promotions'
import { listMarketingPosts, type MarketingPostRow } from '@/lib/adminMarketing'
import { getProducts } from '@/lib/bmbAdminApi_products'
import { listAiAlbumFiles } from '@/lib/bmbAdminApi_media'
import type { Product } from '@/types'
import { ToggleSwitch } from './ToggleSwitch'
import { FloatingAdCard, type FloatingBannerPromo } from '@/components/home/FloatingAdBanners'
import type { FloatingAdConfig, FloatingAdItem, FloatingAdSourceType, FloatingAdSourceConfig } from '@/types'

export interface FloatingAdTabProps {
  load: () => Promise<void>
}

type SourceItem = { id: string; title: string; description: string; image: string; type: FloatingAdSourceType; meta?: string }

function promoMeta(p: PromotionRow): string {
  const disc = p.discount_type === 'percentage' ? `ลด ${p.discount_value}%` : `ลด ฿${p.discount_value}`
  const range = `เริ่ม: ${p.start_date || 'ทันที'} → ถึง: ${p.end_date || 'ไม่กำหนด'}`
  return `${disc} • ขั้นต่ำ ฿${p.min_order_amount} • ${range}`
}

function toSourceItem(p: PromotionRow): SourceItem {
  return {
    id: p.id,
    title: p.name,
    description: p.description || '',
    image: p.banner_image || '',
    type: 'promotion',
    meta: promoMeta(p),
  }
}

function toSourceItemPost(p: MarketingPostRow): SourceItem {
  return {
    id: p.id,
    title: p.title,
    description: p.body || '',
    image: p.image_urls?.[0] || '',
    type: 'post',
    meta: `สถานะ: ${p.status}`,
  }
}

function toSourceItemProduct(p: Product): SourceItem {
  return {
    id: p.id,
    title: p.name,
    description: p.description || '',
    image: p.image_url || '',
    type: 'product',
    meta: `฿${p.price}`,
  }
}

function toSourceItemMenu(f: { name: string; url: string }): SourceItem {
  return {
    id: f.name,
    title: f.name,
    description: '',
    image: f.url,
    type: 'menu',
    meta: 'ภาพเมนู AI',
  }
}

export function FloatingAdTab({ load }: FloatingAdTabProps) {
  const [config, setConfig] = useState<FloatingAdConfig>({
    enabled: true,
    maxCount: 3,
    sources: {
      promotions: { enabled: true, maxItems: 3 },
      posts: { enabled: true, maxItems: 3 },
      products: { enabled: true, maxItems: 3 },
    },
  })
  const [available, setAvailable] = useState<Record<FloatingAdSourceType, SourceItem[]>>({
    promotion: [],
    post: [],
    product: [],
    menu: [],
  })
  const [editingItem, setEditingItem] = useState<FloatingAdItem | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Load config + available items
  useEffect(() => {
    void (async () => {
      setIsLoading(true)
      try {
        const [cfg, promos, posts, products, menuFiles] = await Promise.all([
          getFloatingAdConfig(),
          getPromotionsAdmin(),
          listMarketingPosts(),
          getProducts(),
          listAiAlbumFiles(),
        ])
        setConfig(cfg)
        setAvailable({
          promotion: promos.filter((p) => p.is_banner && p.is_active !== false && p.banner_image).map(toSourceItem),
          post: posts.filter((p) => p.is_floating_ad && p.status === 'published').map(toSourceItemPost),
          product: products.filter((p) => p.is_floating_ad && p.is_available && !p.archived).map(toSourceItemProduct),
          menu: menuFiles.filter((f) => f.path.startsWith('ai-generated/menu/')).map(toSourceItemMenu),
        })
      } catch (e) {
        console.error('[FloatingAdTab] Load error:', e)
        showToast('โหลดข้อมูลโฆษณาลอยไม่สำเร็จ', 'error')
      } finally {
        setIsLoading(false)
      }
    })()
  }, [])

  // Build merged items for display (config.items + available pool)
  const getDisplayItems = useCallback((): Array<FloatingAdItem & { sourceItem?: SourceItem }> => {
    const items = config.items ?? []
    const result: Array<FloatingAdItem & { sourceItem?: SourceItem }> = items.map((item) => {
      const sourceItems = available[item.type] ?? []
      const sourceItem = sourceItems.find((s) => s.id === item.id)
      return { ...item, sourceItem }
    })
    return result
  }, [config.items, available])

  const getAvailablePool = useCallback((type: FloatingAdSourceType) => {
    const usedIds = new Set((config.items ?? []).filter((i) => i.type === type).map((i) => i.id))
    return (available[type] ?? []).filter((s) => !usedIds.has(s.id))
  }, [config.items, available])

  // Handlers
  const handleSave = async () => {
    setIsSaving(true)
    try {
      const ok = await setFloatingAdConfig(config)
      if (ok) {
        showToast('บันทึกการตั้งค่าโฆษณาลอยแล้ว', 'success')
        await load()
      } else {
        showToast('บันทึกไม่สำเร็จ', 'error')
      }
    } catch (e) {
      showToast('เกิดข้อผิดพลาด: ' + String(e), 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const updateConfig = useCallback(<K extends keyof FloatingAdConfig>(key: K, value: FloatingAdConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }, [])

  const updateSourceConfig = useCallback((source: FloatingAdSourceType, field: keyof FloatingAdSourceConfig, value: boolean | number) => {
    const sourceKey = source === 'promotion' ? 'promotions' : source === 'post' ? 'posts' : 'products'
    setConfig((prev) => ({
      ...prev,
      sources: {
        ...prev.sources,
        [sourceKey]: { ...prev.sources[sourceKey as keyof typeof prev.sources], [field]: value },
      },
    }))
  }, [])

  const addItem = useCallback((sourceItem: SourceItem) => {
    const newItem: FloatingAdItem = {
      id: sourceItem.id,
      type: sourceItem.type,
      title: sourceItem.title,
      description: sourceItem.description,
      image: sourceItem.image,
      order: (config.items?.length ?? 0),
      enabled: true,
    }
    setConfig((prev) => ({ ...prev, items: [...(prev.items ?? []), newItem] }))
  }, [config.items])

  const removeItem = useCallback((itemId: string, type: FloatingAdSourceType) => {
    setConfig((prev) => ({ ...prev, items: (prev.items ?? []).filter((i) => !(i.id === itemId && i.type === type)) }))
  }, [])

  const moveItem = useCallback((itemId: string, type: FloatingAdSourceType, direction: 'up' | 'down') => {
    setConfig((prev) => {
      const items = [...(prev.items ?? [])]
      const idx = items.findIndex((i) => i.id === itemId && i.type === type)
      if (idx === -1) return prev
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1
      if (targetIdx < 0 || targetIdx >= items.length) return prev
      ;[items[idx], items[targetIdx]] = [items[targetIdx], items[idx]]
      return { ...prev, items: items.map((item, i) => ({ ...item, order: i })) }
    })
  }, [])

  const toggleItemEnabled = useCallback((itemId: string, type: FloatingAdSourceType) => {
    setConfig((prev) => ({
      ...prev,
      items: (prev.items ?? []).map((i) =>
        i.id === itemId && i.type === type ? { ...i, enabled: !i.enabled } : i
      ),
    }))
  }, [])

  const openEditItem = useCallback((item: FloatingAdItem) => {
    setEditingItem({ ...item })
  }, [])

  const closeEditItem = useCallback(() => {
    setEditingItem(null)
  }, [])

  const saveEditItem = useCallback(() => {
    if (!editingItem) return
    setConfig((prev) => ({
      ...prev,
      items: (prev.items ?? []).map((i) =>
        i.id === editingItem.id && i.type === editingItem.type ? { ...editingItem } : i
      ),
    }))
    setEditingItem(null)
  }, [editingItem])

  // Handle edit form changes
  const handleEditChange = useCallback((field: keyof FloatingAdItem, value: string | boolean) => {
    if (!editingItem) return
    setEditingItem((prev) => (prev ? { ...prev, [field]: value } : null))
  }, [editingItem])

  if (isLoading) return <div className="text-center py-8 text-brand-muted">กำลังโหลดข้อมูลโฆษณาลอย…</div>

  const displayItems = getDisplayItems()
  const typeLabels: Record<FloatingAdSourceType, string> = { promotion: 'โปรโมชั่น', post: 'กิจกรรม', product: 'เมนูแนะนำ', menu: 'ภาพเมนู AI' }
  const typeIcons: Record<FloatingAdSourceType, string> = { promotion: '🎁', post: '📝', product: '🍽️', menu: '🍳' }

  // Preview ใช้การ์ดจริงตัวเดียวกับ overlay (FloatingAdCard) — ไม่เรนเดอร์ HTML เองอีก
  const previewPromos: FloatingBannerPromo[] = displayItems
    .filter((i) => i.enabled)
    .slice(0, config.maxCount)
    .map((item) => ({
      id: `${item.type === 'promotion' ? 'promo' : item.type === 'product' ? 'prod' : item.type === 'menu' ? 'menu' : 'post'}-${item.id}`,
      title: item.title ?? item.sourceItem?.title ?? 'Untitled',
      description: item.description ?? item.sourceItem?.description ?? '',
      image: item.image ?? item.sourceItem?.image ?? '',
      sourceType: item.type,
      href: item.type === 'product' || item.type === 'menu' ? '/menu' : '/promotions',
    }))

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Section A: Overview Settings */}
      <div className="card space-y-6">
        <h3 className="font-bold text-brand-accent text-lg">⚙️ การตั้งค่าภาพรวม</h3>

        <div className="space-y-4">
          {/* Enable toggle + maxCount */}
          <div className="flex items-center gap-4 flex-wrap">
            <ToggleSwitch
              checked={config.enabled}
              onChange={(v) => updateConfig('enabled', v)}
              label={config.enabled ? 'เปิดใช้งานโฆษณาลอย' : 'ปิดโฆษณาลอยทั้งหมด'}
            />
            <div className="flex items-center gap-2 ml-auto">
              <label className="text-sm text-brand-text">จำนวนสูงสุด:</label>
              <input
                type="number"
                min="1"
                max="5"
                value={config.maxCount}
                onChange={(e) => updateConfig('maxCount', Math.min(Math.max(parseInt(e.target.value) || 1, 1), 5))}
                className="w-20 px-2 py-1 border border-brand-border rounded text-sm text-brand-text bg-brand-surface"
              />
            </div>
          </div>

          {/* Background Image */}
          <div className="space-y-2">
            <label className="text-sm text-brand-text">รูปพื้นหลัง Overlay (optional):</label>
            <input
              type="text"
              value={config.backgroundImage ?? ''}
              onChange={(e) => updateConfig('backgroundImage', e.target.value || undefined)}
              placeholder="https://example.com/bg.jpg — หรือเว้นว่างเพื่อใช้มาสคอต/รูปการ์ดเอง"
              className="w-full px-3 py-2 border border-brand-border rounded text-sm text-brand-text bg-brand-surface"
            />
            <p className="text-xs text-brand-muted">URL รูปภาพพื้นหลังเดียวสำหรับ overlay ทั้งหมด (optional)</p>
          </div>

          {/* Source configs */}
          <div className="grid gap-4 md:grid-cols-3">
            {(['promotion', 'post', 'product'] as FloatingAdSourceType[]).map((source) => {
              const sourceKey = source === 'promotion' ? 'promotions' : source === 'post' ? 'posts' : 'products'
              const sourceCfg = config.sources[sourceKey as keyof typeof config.sources]
              return (
                <div key={source} className="card p-4 border-brand-border">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">{typeIcons[source]}</span>
                    <h4 className="font-bold text-brand-text">{typeLabels[source]}</h4>
                  </div>
                  <ToggleSwitch
                    checked={sourceCfg.enabled}
                    onChange={(v) => updateSourceConfig(source, 'enabled', v)}
                    label={sourceCfg.enabled ? 'เปิด' : 'ปิด'}
                  />
                  <div className="mt-3 flex items-center gap-2">
                    <label className="text-sm text-brand-text">จำนวนสูงสุด:</label>
                    <input
                      type="number"
                      min="1"
                      max="5"
                      value={sourceCfg.maxItems}
                      onChange={(e) => updateSourceConfig(source, 'maxItems', Math.min(Math.max(parseInt(e.target.value) || 1, 1), 5))}
                      className="w-20 px-2 py-1 border border-brand-border rounded text-sm text-brand-text bg-brand-surface"
                    />
                  </div>
                  <p className="text-xs text-brand-muted mt-2">จำนวนการ์ดสูงสุดจากแหล่งนี้ (จะถูกจำกัดโดยจำนวนสูงสุดรวม)</p>
                </div>
              )
            })}
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full md:w-auto px-6 py-3 bg-brand-primary text-white rounded-lg font-medium hover:bg-brand-primary/90 disabled:opacity-50 transition-colors"
          >
            {isSaving ? 'กำลังบันทึก…' : '💾 บันทึกการตั้งค่าทั้งหมด'}
          </button>
        </div>
      </div>

      {/* Section B: Card Management */}
      <div className="card space-y-6">
        <h3 className="font-bold text-brand-accent text-lg">🃏 จัดการการ์ดโฆษณาลอย (เรียงลำดับการแสดงผล)</h3>
        <p className="text-sm text-brand-muted">ลากลำดับ (ปุ่ม ↑/↓) • สลับเปิด/ปิดต่อการ์ด • แก้ไขหัวข้อ/คำอธิบาย/รูป (override) • นำออกจากรายการ</p>

        {displayItems.length === 0 && (
          <div className="text-center py-8 text-brand-muted">
            ยังไม่มีการ์ดที่เลือก — กดเพิ่มจาก "รายการว่าง" ด้านล่าง
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-brand-muted border-b border-brand-border">
                <th className="pb-2 pr-4 w-10">ลำดับ</th>
                <th className="pb-2 pr-4 w-10">เปิด</th>
                <th className="pb-2 pr-4 w-16">รูป</th>
                <th className="pb-2 pr-4">ประเภท</th>
                <th className="pb-2 pr-4">หัวข้อ</th>
                <th className="pb-2 pr-4">คำอธิบาย</th>
                <th className="pb-2 pr-4 w-28">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {displayItems.map((item, idx) => (
                <tr key={`${item.type}-${item.id}`} className="border-b border-brand-border/50 hover:bg-brand-bg/50">
                  <td className="py-3 pr-4 text-center text-brand-muted">
                    <span className="font-mono">{idx + 1}</span>
                    <div className="flex flex-col gap-1 mt-1">
                      <button
                        onClick={() => moveItem(item.id, item.type, 'up')}
                        disabled={idx === 0}
                        className="text-xs text-brand-accent hover:text-brand-accent/70 disabled:opacity-30"
                        title="เลื่อนขึ้น"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moveItem(item.id, item.type, 'down')}
                        disabled={idx === displayItems.length - 1}
                        className="text-xs text-brand-accent hover:text-brand-accent/70 disabled:opacity-30"
                        title="เลื่อนลง"
                      >
                        ↓
                      </button>
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-center">
                    <ToggleSwitch
                      checked={item.enabled}
                      onChange={() => toggleItemEnabled(item.id, item.type)}
                      label=""
                    />
                  </td>
                  <td className="py-3 pr-4">
                    {item.image ? (
                      <img src={item.image} alt={item.title} className="w-12 h-12 rounded-lg object-cover border border-brand-border" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg border border-brand-border bg-brand-surface flex items-center justify-center text-2xl">
                        {typeIcons[item.type]}
                      </div>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-brand-accent/10 text-brand-accent border border-brand-accent/20">
                      {typeIcons[item.type]} {typeLabels[item.type]}
                    </span>
                  </td>
                  <td className="py-3 pr-4 max-w-xs truncate font-medium text-brand-text">
                    {item.title ?? item.sourceItem?.title ?? '—'}
                  </td>
                  <td className="py-3 pr-4 max-w-md truncate text-brand-muted">
                    {item.description ?? item.sourceItem?.description ?? '—'}
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex gap-1">
                      <button
                        onClick={() => openEditItem(item)}
                        className="px-2 py-1 text-xs bg-brand-surface border border-brand-border rounded hover:bg-brand-bg text-brand-text"
                      >
                        ✏️ แก้ไข
                      </button>
                      <button
                        onClick={() => removeItem(item.id, item.type)}
                        className="px-2 py-1 text-xs bg-red-50 border border-red-200 rounded hover:bg-red-100 text-red-700"
                      >
                        🗑️ นำออก
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Available Pool */}
        <div className="pt-4 border-t border-brand-border">
          <h4 className="font-medium text-brand-text mb-3">รายการว่าง (เพิ่มเข้าไปได้)</h4>
          <div className="grid gap-4 md:grid-cols-3">
            {(['promotion', 'post', 'product', 'menu'] as FloatingAdSourceType[]).map((source) => {
              const pool = getAvailablePool(source)
              return (
                <div key={source} className="card p-3 max-h-80 overflow-y-auto">
                  <h5 className="font-medium text-brand-text mb-2 flex items-center gap-1">
                    {typeIcons[source]} {typeLabels[source]} ({pool.length})
                  </h5>
                  {pool.length === 0 ? (
                    <p className="text-sm text-brand-muted text-center py-4">— ไม่มีรายการ —</p>
                  ) : (
                    <div className="space-y-2">
                      {pool.map((src) => (
                        <button
                          key={src.id}
                          onClick={() => addItem(src)}
                          className="w-full text-left p-2 border border-brand-border rounded hover:bg-brand-bg transition-colors flex items-center gap-2"
                        >
                          <img
                            src={src.image}
                            alt={src.title}
                            className="w-8 h-8 rounded object-cover border border-brand-border"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-brand-text truncate">{src.title}</p>
                            <p className="text-xs text-brand-muted truncate">{src.description || 'ไม่มีคำอธิบาย'}</p>
                            {src.meta && <p className="text-[11px] text-brand-muted/80 truncate">{src.meta}</p>}
                          </div>
                          <span className="text-xs text-brand-accent">+ เพิ่ม</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Section C: Preview — ใช้การ์ดจริง (pointer-events: none) */}
      <div className="card space-y-4">
        <h3 className="font-bold text-brand-accent text-lg">👁️ ตัวอย่าง (Preview)</h3>
        <p className="text-sm text-brand-muted">แสดงผลด้วยการ์ดตัวเดียวกับหน้าจริง (pointer-events: none — คลิกไม่ได้ในโหมด Preview)</p>
        <div
          className="relative border border-brand-border rounded overflow-hidden"
          style={config.backgroundImage ? { backgroundImage: `url(${config.backgroundImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
        >
          <div className="flad-stack p-4" style={{ pointerEvents: 'none' }}>
            {previewPromos.length === 0 ? (
              <p className="text-center py-8 text-brand-muted">ไม่มีการ์ดที่จะแสดง (enabled=false หรือยังไม่ได้เพิ่ม)</p>
            ) : (
              previewPromos.map((promo, idx) => (
                <FloatingAdCard key={promo.id} promo={promo} pos={idx} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-brand-surface rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="font-bold text-lg text-brand-text">✏️ แก้ไขการ์ด: {editingItem.title}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-brand-text mb-1">หัวข้อ (override)</label>
                <input
                  type="text"
                  value={editingItem.title ?? ''}
                  onChange={(e) => handleEditChange('title', e.target.value)}
                  className="w-full px-3 py-2 border border-brand-border rounded text-sm text-brand-text bg-brand-surface"
                  placeholder="ใช้หัวข้อต้นฉบับ"
                />
              </div>
              <div>
                <label className="block text-sm text-brand-text mb-1">คำอธิบาย (override)</label>
                <textarea
                  value={editingItem.description ?? ''}
                  onChange={(e) => handleEditChange('description', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-brand-border rounded text-sm text-brand-text bg-brand-surface"
                  placeholder="ใช้คำอธิบายต้นฉบับ"
                />
              </div>
              <div>
                <label className="block text-sm text-brand-text mb-1">URL รูปภาพ (override)</label>
                <input
                  type="text"
                  value={editingItem.image ?? ''}
                  onChange={(e) => handleEditChange('image', e.target.value)}
                  className="w-full px-3 py-2 border border-brand-border rounded text-sm text-brand-text bg-brand-surface"
                  placeholder="ใช้รูปต้นฉบับ"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit-enabled"
                  checked={editingItem.enabled}
                  onChange={(e) => handleEditChange('enabled', e.target.checked)}
                  className="w-4 h-4 accent-brand-accent"
                />
                <label htmlFor="edit-enabled" className="text-sm text-brand-text">เปิดใช้งานการ์ดนี้</label>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={closeEditItem}
                className="px-4 py-2 border border-brand-border rounded text-sm text-brand-text hover:bg-brand-bg"
              >
                ยกเลิก
              </button>
              <button
                onClick={saveEditItem}
                className="px-4 py-2 bg-brand-accent text-white rounded text-sm hover:bg-brand-accent/90"
              >
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
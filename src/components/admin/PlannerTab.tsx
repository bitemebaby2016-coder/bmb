// ============================================
// Bite Me Baby — Planner Tab
// ============================================
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { showToast } from '@/components/ui/ToastContainer'
import { bestSellerProducts } from '@/lib/adminMarketing'
import { PostForm, PostFormImperativeHandle } from './PostForm'

interface PlannerTabProps {
  onTabChange: (tab: string) => void
  postFormRef: React.RefObject<PostFormImperativeHandle>
  postTitle: string
  postBodyText: string
  postContentType: 'post' | 'promotion' | 'banner' | 'announcement'
  postImages: string[]
  setPostTitle: (v: string) => void
  setPostBodyText: (v: string) => void
  setPostContentType: (v: 'post' | 'promotion' | 'banner' | 'announcement') => void
  setPostImages: (v: string[]) => void
  postSaving: boolean
  onCreatePost: () => void
}

export function PlannerTab({
  onTabChange,
  postFormRef,
  postTitle,
  postBodyText,
  postContentType,
  postImages,
  setPostTitle,
  setPostBodyText,
  setPostContentType,
  setPostImages,
  postSaving,
  onCreatePost,
}: PlannerTabProps) {
  const [sellers, setSellers] = useState<Array<{ product_id: string; product_name: string; units: number }>>([])
  const [catalog, setCatalog] = useState<Array<{ id: string; name: string; price: number | null; is_preorder?: boolean; available_preorder?: boolean; available_same_day?: boolean; image_url?: string | null }>>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const [s, cat] = await Promise.all([
      bestSellerProducts(),
      supabase.from('products').select('id,name,price,is_preorder,available_preorder,available_same_day,is_available,image_url').eq('is_available', true).order('sort_order'),
    ])
    setSellers(s)
    setCatalog((cat.data ?? []) as Array<{ id: string; name: string; price: number | null; is_preorder?: boolean; available_preorder?: boolean; available_same_day?: boolean; image_url?: string | null }>)
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  return (
    <div className="space-y-3">
      <div className="card">
        <h2 className="font-bold text-brand-accent mb-2">🏆 สินค้าขายดีจริง (จาก order_items)</h2>
        {sellers.length === 0 ? (
          <p className="text-sm text-brand-muted">ยังไม่มีข้อมูลการขาย — รายการจะโผล่เมื่อมีออเดอร์จริง</p>
        ) : (
          <ul className="space-y-1">
            {sellers.map((s) => (
              <li key={s.product_id} className="flex items-center justify-between text-sm">
                <span>{s.product_name}</span>
                <span className="flex items-center gap-2">
                  <span className="badge badge-info">{s.units} ชิ้น</span>
                  <button
                    className="btn btn-outline text-xs"
                    onClick={() => {
                      postFormRef.current?.setTitle?.('แนะนำ ' + s.product_name)
                      postFormRef.current?.setBodyText?.('วันนี้ขอแนะนำ ' + s.product_name + ' เมนูขายดีของเรา')
                      postFormRef.current?.setGenSubject?.(s.product_name)
                      onTabChange('studio')
                    }}
                  >
                    ใช้ทำโพสต์
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* R32: จิ้มเลือกจากเมนูทั้งหมด (พรีออเดอร์ + เซมเดย์) */}
      <div className="card" data-testid="mk-product-picker">
        <h2 className="font-bold text-brand-accent mb-2">🍽️ เลือกจากเมนูทั้งหมด (พรีออเดอร์ + เซมเดย์)</h2>
        {catalog.length === 0 ? (
          <p className="text-sm text-brand-muted">ยังไม่มีสินค้าที่เปิดขาย — เพิ่มในหน้าสินค้าก่อน</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {catalog.map((p) => {
              const preorder = p.is_preorder && !(p.available_same_day ?? false)
              return (
                <button
                  key={p.id}
                  className="btn btn-outline text-xs"
                  data-testid={`mk-pick-${p.id}`}
                  onClick={() => {
                    postFormRef.current?.setTitle?.(`แนะนำ ${p.name}`)
                    postFormRef.current?.setBodyText?.(`วันนี้ขอแนะนำ ${p.name}${p.price != null ? ` ฿${Number(p.price).toFixed(0)}` : ''}`)
                    postFormRef.current?.setGenSubject?.(p.name)
                    postFormRef.current?.setImages?.(p.image_url ? [p.image_url] : [])
                    if (p.image_url) showToast('แนบรูปเมนูจริงเป็นต้นแบบให้แล้ว — เจนภาพเมนู/โปรโมตด้วยรูปนี้ประกอบได้เลย', 'success')
                    onTabChange('studio')
                  }}
                >
                  {preorder ? '⏳ ' : '⚡ '}{p.name}{p.price != null ? ` ฿${Number(p.price).toFixed(0)}` : ''} <span className="text-brand-muted">{preorder ? '(พรีออเดอร์)' : '(เซมเดย์)'}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <PostForm
        ref={postFormRef}
        title={postTitle}
        setTitle={setPostTitle}
        bodyText={postBodyText}
        setBodyText={setPostBodyText}
        contentType={postContentType}
        setContentType={setPostContentType}
        images={postImages}
        setImages={setPostImages}
        saving={postSaving}
        onSubmit={onCreatePost}
      />
    </div>
  )
}
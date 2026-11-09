// ============================================
// Bite Me Baby — PostForm (shared between Planner/Studio/Social)
// ============================================
import { useImperativeHandle, forwardRef } from 'react'
import { showToast } from '@/components/ui/ToastContainer'
import { createMarketingPost, type MarketingPostRow } from '@/lib/adminMarketing'

export interface PostFormImperativeHandle {
  setTitle: (v: string) => void
  setBodyText: (v: string) => void
  setContentType: (v: 'post' | 'promotion' | 'banner' | 'announcement') => void
  setImages: (v: string[]) => void
  setGenSubject?: (v: string) => void
}

export interface PostFormProps {
  title: string; setTitle: (v: string) => void
  bodyText: string; setBodyText: (v: string) => void
  contentType: 'post' | 'promotion' | 'banner' | 'announcement'; setContentType: (v: 'post' | 'promotion' | 'banner' | 'announcement') => void
  images: string[]; setImages: (v: string[]) => void
  saving: boolean; onSubmit: () => void
  // For imperative calls from parent tabs
  setGenSubject?: (v: string) => void
}

export const PostForm = forwardRef<PostFormImperativeHandle, PostFormProps>((props, ref) => {
  useImperativeHandle(ref, () => ({
    setTitle: props.setTitle,
    setBodyText: props.setBodyText,
    setContentType: props.setContentType,
    setImages: props.setImages,
    setGenSubject: props.setGenSubject,
  }))

  return (
    <div className="card space-y-3" data-testid="post-form">
      <h2 className="font-bold text-brand-accent">✍️ สร้างโพสต์ (ส่งเข้ากล่องอนุมัติ)</h2>
      <label className="text-sm">หัวข้อ
        <input className="input w-full" value={props.title} onChange={(e) => props.setTitle(e.target.value)} />
      </label>
      <label className="text-sm">เนื้อหา
        <textarea className="input w-full" rows={4} value={props.bodyText} onChange={(e) => props.setBodyText(e.target.value)} />
      </label>
      <label className="text-sm">ประเภท
        <select className="input w-full" value={props.contentType} onChange={(e) => props.setContentType(e.target.value as typeof props.contentType)}>
          <option value="post">โพสต์ทั่วไป</option>
          <option value="promotion">โปรโมชัน</option>
          <option value="banner">แบนเนอร์</option>
          <option value="announcement">ประกาศ</option>
        </select>
      </label>
      {props.images.length > 0 && <p className="text-xs text-brand-muted">แนบรูปแล้ว {props.images.length} รูป</p>}
      <button className="btn btn-primary" disabled={props.saving} onClick={props.onSubmit} data-testid="mk-create-post">
        {props.saving ? '⏳…' : '📨 สร้างโพสต์ (รอคนอนุมัติ)'}
      </button>
    </div>
  )
})

PostForm.displayName = 'PostForm'
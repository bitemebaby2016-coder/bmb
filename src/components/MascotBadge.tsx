// ============================================
// Bite Me Baby — MascotBadge v1.0 (Reusable)
// Mascot Asset System — ใช้ GIF จาก Admin Override (bucket Bite_Mascot) เป็นอันดับแรก
// - ไม่มี local asset fallback (public/assets/mascot/ ไม่ได้ใช้)
// - ไม่มี vector fallback (mascot_Bite_*.webp ไม่ได้ใช้)
// - ถ้า override ว่าง = ไม่โชว์อะไรเลย (admin จะอัปโหลด GIF ครบ 24 ท่าทีหลัง)
// - CSS drop-shadow นุ่ม ๆ สำหรับลุค 2.5D + pointer-events: none (ไม่บดบังปุ่ม CTA)
// @see docs/COMPONENT_SPEC_UI.md §18 Mascot Asset System
// ============================================

import { useEffect, useState } from 'react'
import type { MascotPose, MascotSize } from '@/types'
import { loadMascotOverrides, getOverrideUrl, isMascotOverridesLoaded, MASCOT_OVERRIDES_CHANGED_EVENT } from '@/lib/mascotService'
import { useStoreClosed } from '@/lib/storeStatus'
import { enforceClosedPose } from '@/lib/mascotClosed'

export interface MascotBadgeProps {
  pose: MascotPose
  /** sm=52px (การ์ด/ปุ่ม), md=72px, lg=104px, fluid=ตาม container/className */
  size?: MascotSize
  alt?: string
  /** ใช้ต่อท้าย เช่น `mascot-mini` (ตำแหน่ง absolute มุมการ์ด) หรือ `w-full h-full` */
  className?: string
  loading?: 'lazy' | 'eager'
}

export const POSE_LABELS: Record<MascotPose, string> = {
  greeting: 'ทักทายต้อนรับ',
  heart: 'มินิฮาร์ท',
  thumbsup: 'ยกนิ้วโป้งการันตี',
  running: 'วิ่งส่งของ',
  pointing: 'ชี้แนะ',
  peeking: 'โผล่มุมการ์ด',
  thinking: 'ครุ่นคิด',
  empty: 'หงอย ๆ',
  bye: 'โบกมือลา ขอบคุณ',
  award: 'รับรางวัล',
  cooking: 'กำลังปรุง',
  eating: 'ชิมอาหาร',
  feedback: 'รับฟีดแบ็ก',
  menu: 'ถือเมนู',
  ready: 'พร้อมเสิร์ฟ',
  recommend: 'แนะนำเมนู',
  reviewing: 'อ่านรีวิว',
  shopping: 'ถือตะกร้า',
  success: 'สำเร็จ',
  vote: 'กำลังโหวต',
  waiting: 'รอคิว',
  sad: 'เสียใจด้วยนะ',
  closed: 'ร้านปิดแล้ว',
}

/** Admin MascotSettings ใช้แสดง "ค่าเริ่มต้น" — คืนค่าว่างเสมอ (ไม่มี local asset) */
export function mascotDefaultSrc(_pose: MascotPose): string {
  return ''
}

export function MascotBadge({ pose, size = 'sm', alt, className = '', loading = 'lazy' }: MascotBadgeProps) {
  // บังคับท่าตอนร้านปิด (กติกาเจ้าของร้าน) — คุมทุกเซกชันที่จุดนี้จุดเดียว
  const storeClosed = useStoreClosed()

  // ใช้ override URL จาก admin (GIF จาก bucket Bite_Mascot) เป็นอันดับแรก
  const [overrideUrl, setOverrideUrl] = useState<string | undefined>(() => getOverrideUrl(pose))
  const [overrideChecked, setOverrideChecked] = useState(() => isMascotOverridesLoaded())

  // โหลด override ตาม pose ต้นฉบับ (admin ตั้ง GIF ให้ทุกท่า รวม ready/closed)
  useEffect(() => {
    if (overrideChecked) return
    let active = true
    const load = async () => {
      await loadMascotOverrides()
      if (!active) return
      const o = getOverrideUrl(pose)
      if (o) setOverrideUrl(o)
      setOverrideChecked(true)
    }
    load()
    return () => { active = false }
  }, [pose, overrideChecked])

  // R206: admin บันทึก override ใหม่ → badge ที่แสดงอยู่เปลี่ยนทันที
  useEffect(() => {
    let active = true
    const onChanged = async () => {
      await loadMascotOverrides(true)
      if (!active) return
      const o = getOverrideUrl(pose)
      if (o) setOverrideUrl(o)
      else setOverrideUrl(undefined)
    }
    window.addEventListener(MASCOT_OVERRIDES_CHANGED_EVENT, onChanged)
    return () => {
      active = false
      window.removeEventListener(MASCOT_OVERRIDES_CHANGED_EVENT, onChanged)
    }
  }, [pose])

  // มี override = ใช้เลย · ไม่มี = ไม่โชว์ (ไม่ fallback ไป local asset)
  const effectivePose = overrideUrl
    ? pose
    : overrideChecked && storeClosed
      ? enforceClosedPose(pose, storeClosed)
      : pose

  // Override URL ถือว่าเป็น GIF/รูปจาก bucket — ใช้ตรง ๆ ไม่มี fallback chain
  const src = overrideUrl

  const sizeClass = size === 'fluid' ? '' : `mascot-badge--${size}`
  const roleLabel = alt || `น้อง Bite — ${POSE_LABELS[effectivePose]}`

  // ไม่มี src = ไม่ render อะไรเลย (ไม่ placeholder, ไม่ layout shift guard)
  if (!src) return null

  return (
    <img
      src={src}
      alt={roleLabel}
      loading={loading}
      decoding="async"
      className={`mascot-badge ${size === 'fluid' ? '' : `mascot-badge--${size}`} ${className}`.trim()}
    />
  )
}
// ============================================
// Bite Me Baby — MascotBadge v1.0 (Reusable)
// Mascot Asset System — เลือกท่าทาง "น้อง Bite" + ลดสเกลได้ทุก surface
// - Asset 3D เก็บที่ /public/assets/mascot/ (ตั้งชื่อตาม State/Pose)
// - ถ้าไฟล์ 3D ยังไม่ถูกส่งมา จะ fallback ไปรูปเวกเตอร์ของเดิม (/mascot_Bite_*.webp) อัตโนมัติ
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

interface PoseAsset {
  src: string       // 3D asset ตัวจริง (เมื่อมาแทนที่)
  fallback: string  // เวกเตอร์ของเดิม (จนกว่าจะได้ 3D render)
}

const POSE_ASSETS: Record<MascotPose, PoseAsset> = {
  greeting: { src: '/assets/mascot/bite_hero_greeting.webp', fallback: '/mascot_Bite_Welcome.webp' },
  heart:    { src: '/assets/mascot/bite_badge_mini_heart.webp', fallback: '/mascot_Bite_Main.webp' },
  // 🆕 Asset Set 2026-09-20: thumbsup ถูกแทนด้วยไฟล์ใหม่ (bite_badge_thumbsup_approval.webp)
  thumbsup: { src: '/assets/mascot/bite_badge_thumbsup_approval.webp', fallback: '/mascot_Bite_Main.webp' },
  running:  { src: '/assets/mascot/bite_delivery_run.webp', fallback: '/mascot_Bite_Good bye.webp' },
  pointing: { src: '/assets/mascot/bite_pointing.webp', fallback: '/mascot_Bite_Main.webp' },
  peeking:  { src: '/assets/mascot/bite_peeking.webp', fallback: '/mascot_Bite_Main.webp' },
  thinking: { src: '/assets/mascot/bite_thinking.webp', fallback: '/mascot_Bite_Thinking.webp' },
  empty:    { src: '/assets/mascot/bite_empty_sad.webp', fallback: '/mascot_Bite_Good bye.webp' },
  // 🗳️ Pose Decision 2026-09-17: `bite_good bye.webp` (แล้วแต่ชื่อ) → pose `bye`
  // "โบกมือลา/ขอบคุณ" ใช้ที่ Delivery Complete (OrderTrackPage delivered) + Payment Success
  // (PaymentConfirmationPage paid) ตาม docs/COMPONENT_SPEC_UI.md §18.2
  bye:      { src: '/assets/mascot/bite_goodbye.webp', fallback: '/mascot_Bite_Good bye.webp' },
  // 🆕 Asset Set 2026-09-20 — ท่าใหม่จากไฟล์ 3D ชุดล่าสุด
  award:     { src: '/assets/mascot/bite_award.webp', fallback: '/mascot_Bite_Main.webp' },
  cooking:   { src: '/assets/mascot/bite_cooking.webp', fallback: '/mascot_Bite_Main.webp' },
  eating:    { src: '/assets/mascot/bite_eating.webp', fallback: '/mascot_Bite_Main.webp' },
  feedback:  { src: '/assets/mascot/bite_feedback.webp', fallback: '/mascot_Bite_Main.webp' },
  menu:      { src: '/assets/mascot/bite_menu.webp', fallback: '/mascot_Bite_Main.webp' },
  ready:     { src: '/assets/mascot/bite_ready.webp', fallback: '/mascot_Bite_Main.webp' },
  recommend: { src: '/assets/mascot/bite_recommend.webp', fallback: '/mascot_Bite_Main.webp' },
  reviewing: { src: '/assets/mascot/bite_reviewing.webp', fallback: '/mascot_Bite_Main.webp' },
  shopping:  { src: '/assets/mascot/bite_shopping.webp', fallback: '/mascot_Bite_Main.webp' },
  success:   { src: '/assets/mascot/bite_success.webp', fallback: '/mascot_Bite_Main.webp' },
  vote:      { src: '/assets/mascot/bite_vote.webp', fallback: '/mascot_Bite_Main.webp' },
  waiting:   { src: '/assets/mascot/bite_waiting.webp', fallback: '/mascot_Bite_Main.webp' },
  sad:       { src: '/assets/mascot/bite_sad.webp', fallback: '/mascot_Bite_Good bye.webp' },
  closed:    { src: '/assets/mascot/bite_closed.webp', fallback: '/mascot_Bite_Main.webp' },
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
  // 🆕 Asset Set 2026-09-20
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

/** path รูปเริ่มต้นของแต่ละท่า (Admin MascotSettings ใช้แสดง "ค่าเริ่มต้น") */
export function mascotDefaultSrc(pose: MascotPose): string {
  return POSE_ASSETS[pose].src
}

export function MascotBadge({ pose, size = 'sm', alt, className = '', loading = 'lazy' }: MascotBadgeProps) {
  // บังคับท่าตอนร้านปิด (กติกาเจ้าของร้าน) — คุมทุกเซกชันที่จุดนี้จุดเดียว
  const storeClosed = useStoreClosed()

  // R207c fix: โชว์ static ทันที ไม่รอ override — admin override จะ swap เข้ามาเองผ่าน event
  // ใช้ synchronous cache check สำหรับ initial state: ถ้า cache โหลดแล้ว = ได้ override ทันที
  const [overrideUrl, setOverrideUrl] = useState<string | undefined>(() => getOverrideUrl(pose))
  const [overrideChecked, setOverrideChecked] = useState(() => isMascotOverridesLoaded())

  // โหลด override ตาม pose ต้นฉบับ (admin ตั้ง GIF ให้ "ready" = ใช้แม้ร้านปิด)
  useEffect(() => {
    if (overrideChecked) return // cache มีแล้ว = checked แล้ว
    let active = true
    const load = async () => {
      await loadMascotOverrides()
      if (!active) return
      const o = getOverrideUrl(pose)  // ใช้ pose ต้นฉบับ
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
      const o = getOverrideUrl(pose)  // ใช้ pose ต้นฉบับ
      if (o) setOverrideUrl(o)
      else setOverrideUrl(undefined)
    }
    window.addEventListener(MASCOT_OVERRIDES_CHANGED_EVENT, onChanged)
    return () => {
      active = false
      window.removeEventListener(MASCOT_OVERRIDES_CHANGED_EVENT, onChanged)
    }
  }, [pose])

  // มี override = ใช้เลย (ไม่ remap) · ยังไม่รู้ override = pose ต้นฉบับ · รู้แล้วไม่มี = remap ตามร้านปิด
  const effectivePose = overrideUrl
    ? pose
    : overrideChecked && storeClosed
      ? enforceClosedPose(pose, storeClosed)
      : pose
  const baseSrc = overrideUrl ?? POSE_ASSETS[effectivePose].src

  // Fallback chain: admin override → 3D asset → vector fallback
  const [currentSrc, setCurrentSrc] = useState<string | null>(baseSrc)

  const handleError = () => {
    setCurrentSrc((current) => {
      if (!current) return POSE_ASSETS[effectivePose].fallback
      const { src: asset, fallback } = POSE_ASSETS[effectivePose]
      // current เป็น override URL → ลอง 3D asset ก่อน
      if (current === overrideUrl) return asset
      // current เป็น 3D asset → fallback ไป vector
      if (current === asset) return fallback
      return current
    })
  }

  const src = currentSrc

  const sizeClass = size === 'fluid' ? '' : `mascot-badge--${size}`
  const roleLabel = alt || `น้อง Bite — ${POSE_LABELS[effectivePose]}`

  return (
    <>
      {src ? (
        <img
          src={src}
          alt={alt || `น้อง Bite — ${POSE_LABELS[effectivePose]}`}
          loading={loading}
          decoding="async"
          className={`mascot-badge ${size === 'fluid' ? '' : `mascot-badge--${size}`} ${className}`.trim()}
          onError={handleError}
        />
      ) : (
        // placeholder โปร่งใสขนาดเดียวกัน (ป้องกัน layout shift) — รอ override เสร็จ
        <span className={`mascot-badge ${size === 'fluid' ? '' : `mascot-badge--${size}`} ${className}`.trim()} aria-hidden="true" />
      )}
    </>
  )
}
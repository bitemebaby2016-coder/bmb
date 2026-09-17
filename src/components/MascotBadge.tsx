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
  thumbsup: { src: '/assets/mascot/bite_badge_thumbsup.webp', fallback: '/mascot_Bite_Main.webp' },
  running:  { src: '/assets/mascot/bite_delivery_run.webp', fallback: '/mascot_Bite_Good bye.webp' },
  pointing: { src: '/assets/mascot/bite_pointing.webp', fallback: '/mascot_Bite_Main.webp' },
  peeking:  { src: '/assets/mascot/bite_peeking.webp', fallback: '/mascot_Bite_Main.webp' },
  thinking: { src: '/assets/mascot/bite_thinking.webp', fallback: '/mascot_Bite_Thinking.webp' },
  empty:    { src: '/assets/mascot/bite_empty_sad.webp', fallback: '/mascot_Bite_Good bye.webp' },
  // 🗳️ Pose Decision 2026-09-17: `bite_good bye.webp` (แล้วแต่ชื่อ) → pose `bye`
  // "โบกมือลา/ขอบคุณ" ใช้ที่ Delivery Complete (OrderTrackPage delivered) + Payment Success
  // (PaymentConfirmationPage paid) ตาม docs/COMPONENT_SPEC_UI.md §18.2
  bye:      { src: '/assets/mascot/bite_good bye.webp', fallback: '/mascot_Bite_Good bye.webp' },
}

const POSE_LABELS: Record<MascotPose, string> = {
  greeting: 'ทักทายต้อนรับ',
  heart: 'มินิฮาร์ท',
  thumbsup: 'ยกนิ้วโป้งการันตี',
  running: 'วิ่งส่งของ',
  pointing: 'ชี้แนะ',
  peeking: 'โผล่มุมการ์ด',
  thinking: 'ครุ่นคิด',
  empty: 'หงอย ๆ',
  bye: 'โบกมือลา ขอบคุณ',
}

export function MascotBadge({ pose, size = 'sm', alt, className = '', loading = 'lazy' }: MascotBadgeProps) {
  const [src, setSrc] = useState<string>(POSE_ASSETS[pose].src)

  // pose เปลี่ยน → reset src (มีโอกาสถูกเรียกใหม่)
  useEffect(() => {
    setSrc(POSE_ASSETS[pose].src)
  }, [pose])

  // ไฟล์ 3D บางท่ายังไม่ถูกอัปโหลด → fallback เวกเตอร์เดิม แค่ครั้งเดียว (กัน infinite loop)
  const handleError = () => {
    setSrc((current) => (current === POSE_ASSETS[pose].fallback ? current : POSE_ASSETS[pose].fallback))
  }

  const sizeClass = size === 'fluid' ? '' : `mascot-badge--${size}`
  const roleLabel = alt || `น้อง Bite — ${POSE_LABELS[pose]}`

  return (
    <img
      src={src}
      alt={roleLabel}
      loading={loading}
      decoding="async"
      className={`mascot-badge ${sizeClass} ${className}`.trim()}
      onError={handleError}
    />
  )
}
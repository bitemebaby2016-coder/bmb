// ============================================
// Bite Me Baby — mascot closed-store pose enforcement (UX 2026-10-14)
// ============================================
// กติกาเจ้าของร้าน: นอกเวลาทำการ/ร้านปิด → มาสคอตต้องใช้เฉพาะ 3 ท่านี้
//   bite_closed · bite_empty_sad · bite_sad
// บังคับให้ครบทุกท่าทุกเซกชัน — ทุกคอมโพเนนต์ที่วาดมาสคอตผ่านจุดกลางนี้
// (MascotBadge = ทุกเซกชันบนหน้า, BiteMascot = ตัวลอยมุมจอ)
// Pure presentation mapping — ไม่แตะข้อมูลธุรกิจ
// ============================================

import type { MascotPose } from '@/types'

/** ชุดท่าที่อนุญาตเมื่อร้านปิด (ท่าอื่นทั้งหมดถูกแทนด้วยชุดนี้) */
export const CLOSED_STORE_POSES = ['closed', 'empty', 'sad'] as const
export type ClosedStorePose = (typeof CLOSED_STORE_POSES)[number]

/** ท่าของตัวลอย (ชื่อไฟล์) ที่อนุญาตเมื่อร้านปิด — หมุนวนได้แค่ 3 ท่านี้ */
export const CLOSED_FLOATING_POSES = ['bite_closed', 'bite_empty_sad', 'bite_sad'] as const

/**
 * แผนผังท่าเมื่อร้านปิด:
 *   empty / waiting / thinking → empty (bite_empty_sad — หงอย/ว่าง)
 *   sad / bye                  → sad   (bite_sad — เศร้า/ลา)
 *   ท่าอื่นทั้งหมด             → closed (bite_closed — ปิดร้าน)
 */
const CLOSED_MAP: Record<MascotPose, ClosedStorePose> = {
  greeting: 'closed',
  heart: 'closed',
  thumbsup: 'closed',
  running: 'closed',
  pointing: 'closed',
  peeking: 'closed',
  thinking: 'empty',
  empty: 'empty',
  bye: 'sad',
  award: 'closed',
  cooking: 'closed',
  eating: 'closed',
  feedback: 'sad',
  menu: 'closed',
  ready: 'closed',
  recommend: 'closed',
  reviewing: 'closed',
  shopping: 'closed',
  success: 'closed',
  vote: 'closed',
  waiting: 'empty',
  sad: 'sad',
  closed: 'closed',
}

/**
 * บังคับท่าตามสถานะร้าน — เรียกจากจุดกลาง (MascotBadge / BiteMascot) เท่านั้น
 * ร้านเปิด → คืนท่าเดิมตามปกติ · ร้านปิด → คืนท่าในชุด CLOSED_STORE_POSES เสมอ
 */
export function enforceClosedPose(pose: MascotPose, storeClosed: boolean): MascotPose {
  if (!storeClosed) return pose
  return CLOSED_MAP[pose] ?? 'closed'
}

/** ท่าของตัวลอย (ชื่อไฟล์ bite_*) เมื่อร้านปิด — แทนที่ท่าเดิมด้วยชุด 3 ท่า */
export function enforceClosedFloatingPose(pose: string, storeClosed: boolean): string {
  if (!storeClosed) return pose
  if ((CLOSED_FLOATING_POSES as readonly string[]).includes(pose)) return pose
  return 'bite_closed'
}

/** ชุดท่าให้ตัวลอยหมุนวนเมื่อร้านปิด */
export function floatingPosePool(storeClosed: boolean, normalPool: readonly string[]): readonly string[] {
  return storeClosed ? CLOSED_FLOATING_POSES : normalPool
}
// ============================================
// Bite Me Baby — Default background images (Stage C)
// ============================================
// ภาพพื้นหลังดีฟลตของเว็บ/แชท — Owner 2026-10-10: "สลับกันใช้ เดี๋ยวจะมีเพิ่มเข้าไปอีก"
// - light -> bg_1 · dark -> bg_2 (สลับกันตามธีม · เพิ่มไฟล์ใน array ได้ภายหลัง)
// - Admin เปลี่ยนภาพระดับเว็บได้ผ่าน asset_key `site.background` (media_assets)
//   และภาพแชทผ่าน asset_key `ai.chat_background` (ค่า registry สำคัญกว่า default)
// - ไฟล์จริง: public/assets/restaurant-bg/*.webp (ย้ายจาก "resturant background" แล้ว)
// ============================================

import type { ThemeName } from '@/lib/theme'

export const SITE_BACKGROUNDS: Record<ThemeName, string> = {
  light: '/assets/restaurant-bg/bg_1.webp',
  dark: '/assets/restaurant-bg/bg_2.webp',
}

/** default image ตามธีมปัจจุบัน — ไม่ใช่ URL ที่ hardcode ไว้เปลี่ยน production (เปลี่ยนผ่าน admin registry) */
export function defaultBackground(theme: ThemeName): string {
  return SITE_BACKGROUNDS[theme]
}
// ============================================
// BMB — Social & LINE links (admin-editable)
// ============================================
// แอดมินแก้ได้เองที่หน้า Admin → Business Settings (คีย์ `social_links`)
// โดยไม่ต้องแตะโค้ด — ฟุตเตอร์/หน้าติดต่ออ่านค่าจากที่นี่ที่เดียว
// ช่องที่เว้นว่าง = ปุ่มนั้น "ไม่แสดง" (เช่น ยังไม่มี LINE ก็ซ่อนไว้ก่อน)
// ค่า fallback = ข้อมูลจริงที่ Owner ยืนยัน (SHOP_CONTACT ใน Footer.tsx)
// ============================================

import { supabase } from './supabase'

export interface SocialLinks {
  facebook: string
  messenger: string
  line: string
  line_id: string
  instagram: string
  tiktok: string
  youtube: string
}

/** business_settings key ที่แอดมินแก้ (AdminSettings → โซเชียล & LINE) */
export const SOCIAL_LINKS_SETTING_KEY = 'social_links'

export const DEFAULT_SOCIAL_LINKS: SocialLinks = {
  facebook: 'https://web.facebook.com/profile.php?id=61586146030943',
  messenger: 'https://m.me/61586146030943',
  // R12: LINE restored — real values that were in production (admin-config via AdminSettings).
  line: 'https://line.me/ti/p/QFD3bSMFN9',
  line_id: 'bitemebaby2016',
  instagram: '',
  tiktok: '',
  youtube: '',
}

export type SocialNetwork = keyof SocialLinks

export interface SocialLinkItem {
  network: SocialNetwork
  label: string
  icon: string
  href: string
}

/** ลำดับแสดงผล + ไอคอนของปุ่มโซเชียล (ใช้ทั้ง Footer/หน้าติดต่อ) */
const NETWORK_META: Array<{ network: SocialNetwork; label: string; icon: string }> = [
  { network: 'facebook', label: 'Facebook', icon: '📘' },
  { network: 'messenger', label: 'Messenger', icon: '💬' },
  { network: 'line', label: 'LINE', icon: '💚' },
  { network: 'instagram', label: 'Instagram', icon: '📸' },
  { network: 'tiktok', label: 'TikTok', icon: '🎵' },
  { network: 'youtube', label: 'YouTube', icon: '▶️' },
]

// cache สั้น ๆ กันยิง DB ทุก render (7 นาที เท่า aiDbContext)
const CACHE_MS = 7 * 60 * 1000
let cache: { at: number; value: SocialLinks } | null = null

function merge(partial: Partial<SocialLinks> | null): SocialLinks {
  const out: SocialLinks = { ...DEFAULT_SOCIAL_LINKS }
  if (partial && typeof partial === 'object') {
    for (const k of Object.keys(DEFAULT_SOCIAL_LINKS) as SocialNetwork[]) {
      const v = partial[k]
      if (typeof v === 'string') out[k] = v.trim()
    }
  }
  return out
}

/** ดึงลิงก์โซเชียลจาก business_settings (fallback = ค่าจริงของร้าน) */
export async function getSocialLinks(force = false): Promise<SocialLinks> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache.value
  try {
    const { data, error } = await supabase
      .from('business_settings')
      .select('value')
      .eq('key', SOCIAL_LINKS_SETTING_KEY)
      .maybeSingle()
    if (error) throw error
    const value = merge((data?.value ?? null) as Partial<SocialLinks> | null)
    cache = { at: Date.now(), value }
    return value
  } catch {
    // โหลดไม่ได้ = ใช้ค่าจริงของร้านต่อ (ฟุตเตอร์ห้ามพัง)
    return cache?.value ?? DEFAULT_SOCIAL_LINKS
  }
}

/** รายการปุ่มโซเชียลพร้อมใช้ render — ตัดช่องว่างออก (ไม่มี = ไม่แสดงปุ่ม) */
export function socialLinkItems(links: SocialLinks): SocialLinkItem[] {
  return NETWORK_META
    .map(({ network, label, icon }) => ({ network, label, icon, href: links[network] }))
    .filter((item) => item.href.length > 0)
}

/** Test helper — ล้าง cache */
export function resetSocialLinksCache(): void {
  cache = null
}

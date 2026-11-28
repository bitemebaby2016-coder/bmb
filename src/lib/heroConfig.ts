// ============================================
// Bite Me Baby — Hero stage config (Food Theater) IO
// ============================================
// อ่าน/เขียนข้อความและรูป hero ของหน้าแรก (/shop) ผ่าน business_settings เดิม
// (คีย์ hero_config) — ฝั่งแอดมินแก้ได้ที่แท็บ "ฮีโร่หน้าแรก" ในตั้งค่าร้าน
// ค่า default อยู่ที่ DEFAULT_HERO_CONFIG (platformConfig) ตัวเดียว — ห้ามฮาร์ดโค้ดในคอมโพเนเอนต์
// อ่านไม่ได้ = ใช้ default (zero-fake ไม่แต่งข้อมูล)
// ============================================

import { supabase } from './supabase'
import { DEFAULT_HERO_CONFIG, parseHeroConfig, type HeroConfig } from '@/config/platformConfig'

export type { HeroConfig }

/** อ่านค่า hero จาก business_settings (อ่านไม่ได้/ไม่มี = default) */
export async function getHeroConfig(): Promise<HeroConfig> {
  const { data, error } = await supabase
    .from('business_settings')
    .select('value')
    .eq('key', 'hero_config')
    .maybeSingle()
  if (error || !data) return { ...DEFAULT_HERO_CONFIG }
  return parseHeroConfig(data.value)
}

/** บันทึกค่า hero (แอดมิน · แท็บฮีโร่หน้าแรก) — เขียนผ่าน business_settings เดิม */
export async function saveHeroConfig(config: HeroConfig): Promise<boolean> {
  const { setBusinessSetting } = await import('./bmbAdminApi_settings')
  const payload: HeroConfig = {
    kicker: config.kicker.trim(),
    headline: config.headline.trim(),
    subheadline: config.subheadline.trim(),
    ctaLabel: config.ctaLabel.trim(),
    heroImageUrl: config.heroImageUrl.trim(),
  }
  return setBusinessSetting('hero_config', payload)
}
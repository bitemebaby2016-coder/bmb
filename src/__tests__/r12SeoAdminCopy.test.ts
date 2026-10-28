// ============================================
// R12 (Owner 2026-10-28): SEO copy = admin แก้เองได้ — seo.ts sync จาก
// business_settings (ค่าจริง) · fire-and-forget bootstrap ที่ main.tsx ·
// App subscribe (re-render meta/JSON-LD) · migration 165 seed คีย์ 'seo'
// ============================================
import { describe, it, expect } from 'vitest'
import {
  SEO_SETTINGS_KEY,
  DEFAULT_SEO_SETTINGS,
  getSeoSettingsSync,
  setSeoSettingsLive,
  subscribeSeoSettings,
  resetSeoSettingsCache,
  getSeoSettingsVersion,
} from '@/lib/seoSettings'
import adminSettingsSrc from '../pages/admin/AdminSettings.tsx?raw'
import mainSrc from '../main.tsx?raw'
import appSrc from '../App.tsx?raw'
import mig165Src from '../../supabase/migrations/165_seed_business_settings_seo_copy.sql?raw'

describe('R12 — seoSettings live store (admin แก้ SEO copy เองได้)', () => {
  it('default = ค่าจริงที่ยืนยัน (fallback ไม่เคยว่าง)', () => {
    expect(DEFAULT_SEO_SETTINGS.description.length).toBeGreaterThan(0)
    expect(DEFAULT_SEO_SETTINGS.tagline).toBe('สั่งอาหารจัดส่งเมืองจันทบุรี รัศมี 5 กม.')
  })

  it('setSeoSettingsLive → getSeoSettingsSync/version + subscriber ถูกเตือน แล้ว reset กลับค่า default', () => {
    const before = getSeoSettingsVersion()
    let notified = 0
    const un = subscribeSeoSettings(() => { notified++ })
    try {
      setSeoSettingsLive({ description: 'ใหม่', tagline: 'ใหม่' })
      expect(getSeoSettingsSync().description).toBe('ใหม่')
      expect(getSeoSettingsVersion()).toBeGreaterThan(before)
      expect(notified).toBe(1)
    } finally {
      un()
      resetSeoSettingsCache()
    }
    expect(getSeoSettingsSync().description).toBe(DEFAULT_SEO_SETTINGS.description)
  })

  it('AdminSettings: มีฟอร์มเฉพาะทาง SEO (seo-copy-config) + คีย์กัน generic editor', () => {
    expect(adminSettingsSrc).toContain('data-testid="seo-copy-config"')
    expect(adminSettingsSrc).toContain('saveSeoCopy')
    expect(adminSettingsSrc).toContain("const TYPED_FORM_KEYS = new Set<string>([SOCIAL_LINKS_SETTING_KEY, SEO_SETTINGS_KEY, 'order_policy'])")
    expect(adminSettingsSrc).toContain('setBusinessSetting(SEO_SETTINGS_KEY, seoCopy)')
  })

  it('main.tsx bootstrap: ดึง SEO copy + social จริง (ค่าจริงก่อน render รับรอง meta)', () => {
    expect(mainSrc).toContain('getSeoSettings(true), getSocialLinks(true)')
  })

  it('App.tsx subscribe → re-render ทุกหน้าเมื่อค่าจริงเปลี่ยน', () => {
    expect(appSrc).toContain('useSyncExternalStore')
    expect(appSrc).toContain('subscribeSeoSettings(cb)')
    expect(appSrc).toContain('subscribeSocialLinks(cb)')
  })

  it('migration 165: seed คีย์ seo = {description, tagline} (ค่าเดียวกับ DEFAULT ในโค้ด)', () => {
    expect(SEO_SETTINGS_KEY).toBe('seo')
    expect(mig165Src).toContain("INSERT INTO public.business_settings")
    expect(mig165Src).toContain("'seo'")
    expect(mig165Src).toContain("'tagline', 'สั่งอาหารจัดส่งเมืองจันทบุรี รัศมี 5 กม.'")
  })
})
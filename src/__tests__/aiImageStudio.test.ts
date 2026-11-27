// ============================================
// Bite Me Baby — aiImageStudio shared lib
// IMG: 1024×1024 webp ≤300KB · 4 หมวด · มาสคอต none
// ============================================
import { describe, it, expect } from 'vitest'
import {
  autoMascotForKind, WM_MASCOTS, KIND_PRESETS_KEYS, AI_ALBUM_KINDS,
  GEN_MAX_SIDE, GEN_MAX_BYTES, compressGeneratedToWeb,
} from '@/lib/aiImageStudio'

describe('aiImageStudio — ค่าคงที่/หมวด', () => {
  it('มี 4 หมวด (menu/promo/festival/studio) และขนาด 1024/300KB', () => {
    expect([...KIND_PRESETS_KEYS]).toEqual(['menu', 'promo', 'festival', 'studio'])
    expect([...AI_ALBUM_KINDS]).toContain('studio')
    expect(GEN_MAX_SIDE).toBe(1024)
    expect(GEN_MAX_BYTES).toBe(300 * 1024)
  })

  it('autoMascotForKind: menu/studio→menu · festival→award · promo→recommend', () => {
    expect(autoMascotForKind('menu')).toBe('menu')
    expect(autoMascotForKind('studio')).toBe('menu')
    expect(autoMascotForKind('festival')).toBe('award')
    expect(autoMascotForKind('promo')).toBe('recommend')
  })

  it('WM_MASCOTS มีตัวเลือกไม่ใช้มาสคอต (none)', () => {
    expect(WM_MASCOTS.some((m) => m.key === 'none')).toBe(true)
  })

  it('compressGeneratedToWeb: gif/audio คืนไฟล์เดิม (ไม่ผ่าน canvas)', async () => {
    const gif = new File(['x'], 'a.gif', { type: 'image/gif' })
    expect(await compressGeneratedToWeb(gif)).toBe(gif)
    const audio = new File(['x'], 'a.mp3', { type: 'audio/mpeg' })
    expect(await compressGeneratedToWeb(audio)).toBe(audio)
  })
})
// ============================================
// BMB — Social AI continuity + footer social regression (2026-10-17)
// ============================================
// ปิดบั๊กจริงที่ Owner เจอ (probe จาก social_events ของจริง ไม่ใช่เดา):
//   1) bot ตอบคอมเมนต์/แชท "ตัวเอง" = ตอบเบิ้ล → self-echo guard (webhook + worker)
//   2) ลูกค้าเงียบหายจาก source_event_id_mismatch → normalize ไม่ใช่ reject
//   3) โมเดลมโนข้อมูลร้าน (เวลาเปิดร้าน/เมนู) → shared shopContext จาก DB จริง
//   4) คีย์ OpenRouter ใหม่ BMB_OPENROUTER_API_KEY (fallback คีย์เดิม ห้ามดับ)
//   5) web chat "หายไปเลย" → handleSend ต้องอยู่ใน try/finally + กันข้อความว่าง
//   6) ฟุตเตอร์ลิงก์โซเชียล/LINE แอดมินแก้ได้เอง (business_settings)
//   7) FAQ ไม่มี typo ไทยชุดเดิม + persona "ครับ" ตรงกันทุกช่องทาง
// ============================================

import { describe, it, expect } from 'vitest'

import workerSrc from '../../supabase/functions/social-ai-worker/index.ts?raw'
import webhookSrc from '../../supabase/functions/channel-webhook/index.ts?raw'
import postWorkerSrc from '../../supabase/functions/social-post-worker/index.ts?raw'
import proxySrc from '../../supabase/functions/ai-proxy/index.ts?raw'
import shopCtxSrc from '../../supabase/functions/_shared/shopContext.ts?raw'
import talkToBiteSrc from '../components/ai/TalkToBite.tsx?raw'
import footerSrc from '../components/layout/Footer.tsx?raw'
import adminSettingsSrc from '../pages/admin/AdminSettings.tsx?raw'
import personaSrc from '../lib/bitePersona.ts?raw'
import { faqs } from '../lib/faqContent'
import { DEFAULT_SOCIAL_LINKS, socialLinkItems } from '../lib/socialLinks'

describe('ตอบเบิ้ล — self-echo guard (webhook + worker defense-in-depth)', () => {
  it('channel-webhook ไม่ ingest echo ของเพจตัวเอง (sender == page)', () => {
    expect(webhookSrc).toMatch(/self-echo/)
    expect(webhookSrc).toMatch(/extUser === entry\.id/)
    expect(webhookSrc).toMatch(/channel_event_rejected/)
  })
  it('social-ai-worker ไม่ตอบ event ที่ sender == page (กันตกค้างจากของเก่า)', () => {
    expect(workerSrc).toMatch(/SELF_ECHO:no_reply_by_design/)
    expect(workerSrc).toMatch(/ev\.sender_id === ev\.page_id/)
  })
})

describe('ห้ามเงียบหาย — source_event_id_mismatch ต้อง normalize ไม่ใช่ reject', () => {
  it('semanticDraft แทนค่า source_event_id ด้วย event จริง (server truth)', () => {
    expect(workerSrc).toMatch(/source_event_id_mismatch/)
    expect(workerSrc).toMatch(/v\.source_event_id = eventId/)
    expect(workerSrc).not.toMatch(/reason: 'source_event_id_mismatch'/)
  })
  it('การเช็ค draft ฝั่ง content ยัง reject อยู่ (ความปลอดภัยเดิมไม่หาย)', () => {
    expect(workerSrc).toMatch(/draft_text_length/)
    expect(workerSrc).toMatch(/banned_content_in_draft/)
  })
})

describe('บริบทเอไอสมบูรณ์ — shared shop context จาก DB จริงทุกตัว', () => {
  it('shopContext อ่าน products/product_categories/business_settings + ข้อมูลร้านจริง', () => {
    expect(shopCtxSrc).toMatch(/SHOP FACTS/)
    expect(shopCtxSrc).toMatch(/\/rest\/v1\/products/)
    expect(shopCtxSrc).toMatch(/business_settings/)
    expect(shopCtxSrc).toMatch(/07:00-20:00/)
    expect(shopCtxSrc).toMatch(/READ-ONLY/)
  })
  it('social-ai-worker + social-post-worker ใช้ shopContext ชุดเดียวกัน', () => {
    expect(workerSrc).toMatch(/getShopContext/)
    expect(workerSrc).toMatch(/REPLY_CONTINUITY_RULES/)
    expect(postWorkerSrc).toMatch(/getShopContext/)
  })
  it('มีกติกาตอบต่อเนื่อง + ทางเลือกเมนูไม่เผ็ด (เคส "ไม่กินเผ็ด")', () => {
    expect(shopCtxSrc).toMatch(/ห้ามทักทายใหม่ซ้ำ/)
    expect(shopCtxSrc).toMatch(/ไม่กินเผ็ด/)
    expect(shopCtxSrc).toMatch(/ห้ามหายไปเงียบ/)
  })
  it('persona ตรงกันทุกช่องทาง — "ครับ" ห้าม "ค่ะ" (web/voice vs social)', () => {
    expect(shopCtxSrc).toMatch(/ห้ามใช้ "ค่ะ"/)
    expect(personaSrc).toMatch(/ห้ามใช้ "ค่ะ"/)
    expect(workerSrc).toMatch(/BITE_PERSONA_SEGMENT/)
  })
})

describe('คีย์ OpenRouter ใหม่ — BMB_OPENROUTER_API_KEY + fallback ห้ามดับ', () => {
  const surfaces: Array<[string, string]> = [
    ['social-ai-worker', workerSrc],
    ['social-post-worker', postWorkerSrc],
    ['ai-proxy', proxySrc],
  ]
  for (const [name, src] of surfaces) {
    it(`${name} อ่านคีย์ใหม่ก่อน แล้ว fallback OPENROUTER_API_KEY`, () => {
      expect(src).toMatch(/BMB_OPENROUTER_API_KEY/)
      expect(src).toMatch(/Deno\.env\.get\('OPENROUTER_API_KEY'\)/)
    })
  }
})

describe('web chat ห้าม "หายไปเลย" — handleSend fail-safe', () => {
  it('ทุกอย่างหลัง setTyping(true) อยู่ใน try/finally (กัน typing ค้างตลอดกาล)', () => {
    expect(talkToBiteSrc).toMatch(/try \{\s*\n\s*try \{/)
    expect(talkToBiteSrc).toMatch(/finally \{\s*\n\s*setTyping\(false\)/)
  })
  it('กัน TTS พังแล้วพาแชตล่ม + กันข้อความตอบว่าง', () => {
    expect(talkToBiteSrc).toMatch(/เสียงพัง ต้องไม่พังแชต/)
    expect(talkToBiteSrc).toMatch(/ผมตอบไม่ครบในรอบนี้/)
  })
})

describe('ฟุตเตอร์ — ลิงก์โซเชียล/LINE แอดมินแก้เองได้', () => {
  it('Footer อ่าน social_links จาก business_settings (ไม่ hardcode)', () => {
    expect(footerSrc).toMatch(/getSocialLinks/)
    expect(footerSrc).toMatch(/socialLinkItems/)
  })
  it('AdminSettings มีช่องให้แอดมินใส่ LINE/social + บันทึกลง social_links', () => {
    expect(adminSettingsSrc).toMatch(/SOCIAL_LINKS_SETTING_KEY/)
    expect(adminSettingsSrc).toMatch(/social-links-config/)
    expect(adminSettingsSrc).toMatch(/line_id/)
  })
  it('ช่องว่าง = ไม่แสดงปุ่ม (ยังไม่มี LINE ก็ซ่อนได้)', () => {
    const items = socialLinkItems(DEFAULT_SOCIAL_LINKS)
    expect(items.some((i) => i.network === 'facebook')).toBe(true)
    expect(items.some((i) => i.network === 'line')).toBe(false)
    const withLine = socialLinkItems({ ...DEFAULT_SOCIAL_LINKS, line: 'https://line.me/R/ti/p/@demo' })
    expect(withLine.some((i) => i.network === 'line' && i.href.includes('line.me'))).toBe(true)
  })
  it('D-02/R2.1: ห้าม key ซ้ำสองที่ — social_links เหลือทางบันทึกเดียว (ฟอร์มเฉพาะทาง)', () => {
    // generic key editor ต้อง filter social_links ออก (ปุ่ม Save {key} ของ generic ห้ามมี)
    expect(adminSettingsSrc).toMatch(/\.filter\(\(key\) => key !== SOCIAL_LINKS_SETTING_KEY\)/)
    // handleSave/handleSaveAll ต้องไม่เขียน social_links ผ่านทาง generic
    expect(adminSettingsSrc).toMatch(/if \(key === SOCIAL_LINKS_SETTING_KEY\)/)
    // ฟอร์มเฉพาะทางยังอยู่ (ทางบันทึกเดียวของ social_links)
    expect(adminSettingsSrc).toMatch(/saveSocials/)
    expect(adminSettingsSrc).toMatch(/social-links-config/)
  })
})

describe('FAQ — typo ไทยชุดเดิมต้องหมดไป', () => {
  const TYPOS = ['คุสามารถ', 'แบบฟอรม', 'อย่มุม', 'ปรมชั่น', 'คปอง', 'เมนฟรี', 'เชิเพื่อน', 'ลกค้า', 'ข้อมล', 'วิี', 'เปน ', 'อรเดอร', 'ทำยังงัย', 'สงสุด', '•social']
  it('ไม่มีคำเพี้ยนในคำถาม/คำตอบใด ๆ', () => {
    for (const item of faqs) {
      for (const bad of TYPOS) {
        expect(item.q, `q มี "${bad}"`).not.toContain(bad)
        expect(item.a, `a มี "${bad}"`).not.toContain(bad)
      }
    }
  })
})

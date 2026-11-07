// R76 (Owner 2026-11-07: "อาการเดิมเลย" + "เวลาเอไอตอบโพสหรือข้อความ ต้องมีแจ้งเตือนเฟซบุ้คให้ลูกค้าด้วย")
// ① ลิงก์ที่แตะจากเฟซ = หน้าเว็บต้องไม่พัง (ห้าม location.replace ไป intent:// — ERR_UNKNOWN_URL_SCHEME กลืนหน้า)
// ② ทุกคำตอบใต้คอมเมนต์ = มี private reply เข้า Messenger = แจ้งเตือนลูกค้า (best-effort + หลักฐาน dm_reply_id)
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '../..', p), 'utf8')
const noticeSrc = read('src/components/layout/InAppBrowserNotice.tsx')
const aiSrc = read('supabase/functions/social-ai-worker/index.ts')

describe('R76 ① — หน้าเว็บจากลิงก์เฟซต้องไม่พัง: ห้ามนำทางหน้าปัจจุบันไป intent://', () => {
  it('InAppBrowserNotice = window.open แบบไม่ทำลายหน้า + ไม่มี window.location.replace(intent)', () => {
    expect(noticeSrc).not.toContain('window.location.replace(intent)')
    expect(noticeSrc).toContain('function openIntentSafely')
    expect(noticeSrc).toContain('window.open(intent')
    // เครื่องที่เปิดอัตโนมัติไม่ได้ = ต้องมีทางรอด = วิธีเปิดด้วยเมนู ⋮
    expect(noticeSrc).toContain('เปิดในเบราว์เซอร์')
    expect(noticeSrc).toContain('externalBrowserIntentUrl')
    // intent:// ต้องมากับ fallback URL เต็ม https:// เสมอ (ไม่ใช่โดเมนเปล่า)
    const intent = noticeSrc.includes('s.browser_fallback_url=${encodeURIComponent(href)}')
    expect(intent).toBe(true)
  })
})

describe('R76 ② — เอไอตอบคอมเมนต์/ข้อความ = ลูกค้าได้แจ้งเตือนเฟซ/เมสเซนเจอร์', () => {
  it('sendReply คอมเมนต์ = ตอบใต้คอมเมนต์ + private_replies เข้า Messenger (best-effort)', () => {
    expect(aiSrc).toContain('/private_replies')
    expect(aiSrc).toContain('dm_reply_id')
    expect(aiSrc).toContain('dm_error')
  })
  it('Messenger send = message id เป็นหลักฐานการแจ้งเตือน (dmId = message_id)', () => {
    expect(aiSrc).toContain('dmId: String(j.message_id)')
  })
  it('หลักฐานการแจ้งเตือนถูกบันทึกลง ai_guardrail_flags ทั้งสายปกติและสาย fallback', () => {
    const hits = aiSrc.match(/dm_reply_id: sent\.dmId \|\| null/g) || []
    expect(hits.length).toBeGreaterThanOrEqual(2)
  })
})
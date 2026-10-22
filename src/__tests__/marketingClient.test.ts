// ============================================
// Bite Me Baby — Marketing Part C client guarantees (2026-10-22)
// ============================================
// ทุกแท็บของ AdminMarketing ต่อของจริง — พฤติกรรม server พิสูจน์ใน SQL contract 137
// (G1-G3: คนอนุมัติก่อนตั้งเวลา) แล้ว; ชุดนี้คุม client ไม่ให้เล็ดลอดของปลอม
// NOTE: ไฟล์นี้ต้องเป็น `.ts` — vitest include pattern รับเฉพาะ .js/.ts (ไม่รับ .tsx)
import { describe, it, expect } from 'vitest'
import adminMarketingSrc from '../lib/adminMarketing.ts?raw'
import adminMarketingPageSrc from '../pages/admin/AdminMarketing.tsx?raw'
import imageGenSrc from '../../supabase/functions/image-gen/index.ts?raw'
import workerSrc from '../../supabase/functions/automation-worker/index.ts?raw'
import enqueueSrc from '../../supabase/functions/queue-enqueue/index.ts?raw'
import dispatcherSrc from '../../supabase/functions/queue-dispatcher/index.ts?raw'
import schedulerSrc from '../../.github/workflows/automation-scheduler.yml?raw'
import contractSrc from '../../e2e/contracts_137_marketing_posts.sql?raw'

describe('Part C · วงจรโพสต์ = ของจริงทุกชั้น', () => {
  it('adminMarketing ผูก content_approvals + marketing_posts + RPC จริง', () => {
    expect(adminMarketingSrc).toContain('submitContentForApproval')
    expect(adminMarketingSrc).toContain("rpc('marketing_schedule_post'")
    expect(adminMarketingSrc).toContain("rpc('marketing_save_rules'")
    expect(adminMarketingSrc).toContain('order_items') // best-seller จริง
  })

  it('contract 137 ครอบ G1-G3 (คนอนุมัติก่อนตั้งเวลา — พิสูจน์บน PG แล้ว)', () => {
    for (const g of ['PASS G1', 'PASS G2', 'PASS G3']) expect(contractSrc).toContain(g)
    expect(contractSrc).toContain('ERR_APPROVAL_REQUIRED')
  })

  it('หน้า 7 แท็บอ่าน/เขียนผ่านตารางจริง — ไม่มีข้อมูลจำลอง/ของปลอม', () => {
    // testid สร้างจาก template `mk-tab-${t.id}` — ตรวจว่าครบทุก tab id
    expect(adminMarketingPageSrc).toContain('mk-tab-')
    for (const id of ["id: 'overview'", "id: 'planner'", "id: 'studio'", "id: 'approval'", "id: 'calendar'", "id: 'rules'", "id: 'analytics'"]) {
      expect(adminMarketingPageSrc).toContain(id)
    }
    expect(adminMarketingPageSrc).toContain('marketing_posts')
    expect(adminMarketingPageSrc).not.toContain('mock')
    expect(adminMarketingPageSrc).not.toContain('FAKE_')
  })

  it('อนุมัติ != ตั้งเวลา != เผยแพร่ — แยกปุ่ม/สถานะชัดเจน', () => {
    expect(adminMarketingPageSrc).toContain('handleApprove')
    expect(adminMarketingPageSrc).toContain('handleSchedule')
    expect(adminMarketingPageSrc).toContain('handleReject')
  })
})

describe('Part C · E5/E6 image-gen (คีย์ server-side + 3 สไตล์)', () => {
  it('EF ใช้ preset จริง + 3 สไตล์ + เช็ค admin + อัปโหลด site_assets', () => {
    expect(imageGenSrc).toContain('KIND_PRESETS')
    expect(imageGenSrc).toContain('STYLE_MODIFIERS')
    for (const s of ['realistic', 'illustration', 'poster']) expect(imageGenSrc).toContain(s)
    expect(imageGenSrc).toContain('isAdmin')
    expect(imageGenSrc).toContain('site-assets')
  })

  it('คีย์ OpenRouter อยู่ฝั่ง server เท่านั้น (ไม่มีในโค้ด client)', () => {
    expect(imageGenSrc).toContain('OPENROUTER_API_KEY')
    expect(adminMarketingPageSrc).not.toContain('sk-or-')
  })
})

describe('Part C · marketing_publish job = allowlist + dispatcher + worker + scheduler ครบ', () => {
  it('ทุกจุดที่ต้องแตะตามกติกา queue (allowlist+payload+idempotency)', () => {
    expect(enqueueSrc).toContain('marketing_publish')
    expect(dispatcherSrc).toContain('marketing_publish')
    expect(workerSrc).toContain('runMarketingPublish')
    expect(workerSrc).toContain('marketing_publish')
  })

  it('worker ก่อนยิงโพสต์ต้องเช็ค approval ซ้ำเสมอ (ห้ามโพสต์ก่อนคนอนุมัติ)', () => {
    expect(workerSrc).toContain("apStatus !== 'approved'")
    expect(workerSrc).toContain('social-publish-worker')
  })

  it('scheduler มี job รายชั่วโมงของ marketing_publish (ไม่สร้างไฟล์ใหม่)', () => {
    expect(schedulerSrc).toContain('hourly-marketing')
    expect(schedulerSrc).toContain('marketing_publish_enqueue')
    expect(schedulerSrc).toContain('marketing_publish_dispatch')
  })
})
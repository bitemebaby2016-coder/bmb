// R81 · A (B6) — แจ้งเตือนจากเพจไม่ถึงลูกค้า (Owner 2026-11-08)
// evidence production READ-ONLY (e2e/_r81_a1_evidence.json · _r81_a1b · _r81_a1c):
//   คอมเมนต์จริง 5/5 = reply_status=sent · private_replies 5/5 = http_400
//   "Unsupported post request. Object with ID … does not exist" (ทั้งที่คำตอบสาธารณะต่อ id เดียวกันสำเร็จ)
//   → H2 ยืนยัน = endpoint ของเฟซตาย (DM ไม่เคยถึงลูกค้า) · แถว failed 14 แถว = test residue r74cmt-*
//   → แก้ตามหลักฐาน: structured error · กันซ้ำ · web push ลูกค้า (m179) · alert เมื่อตอบไม่สำเร็จ
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '../..', p), 'utf8')
const aiSrc = read('supabase/functions/social-ai-worker/index.ts')
const intakeSrc = read('supabase/functions/_shared/socialOrderIntake.ts')
const publishSrc = read('supabase/functions/social-publish-worker/index.ts')

describe('R81-A3 · H2 — structured error + กันซ้ำ private_replies 1 ครั้ง/คอมเมนต์', () => {
  it('เหตุผล Graph เก็บข้อความ error จริงของเฟซ (fbReason) — เดิมมีแค่ http_400 อ่านไม่ออก', () => {
    expect(aiSrc).toContain('function fbReason(')
    expect((aiSrc.match(/fbReason\(r\.status, j\)/g) || []).length).toBeGreaterThanOrEqual(2)
    expect(aiSrc).toContain('else dmError = fbReason(rp.status, jp)')
  })
  it('กันซ้ำ: opts.skipDm จาก flags.dm_attempted_at + บันทึก dm_attempted_at ทั้ง 2 สาย', () => {
    expect(aiSrc).toContain('skipDm: !!priorFlags.dm_attempted_at')
    expect((aiSrc.match(/dm_attempted_at: dmStamp/g) || []).length).toBeGreaterThanOrEqual(2)
    expect((aiSrc.match(/dm_reply_id: sent\.dmId \|\| null/g) || []).length).toBeGreaterThanOrEqual(2)
    expect(aiSrc).toContain("'skipped_already_attempted'")
  })
  it('private_replies ยังเป็น best-effort + หลักฐาน dm_error (r76 contract คงเดิม)', () => {
    expect(aiSrc).toContain('/private_replies')
    expect(aiSrc).toContain('dm_error')
    expect(aiSrc).toContain('reply_status: ')
  })
})

describe('R81-A3 · H1 — web push ลูกค้าผ่าน m179 enqueue_notification (control ได้ 100%)', () => {
  it('resolve customer_id จริงจาก customer_channel_identities → customers.id — ไม่เดา (R82: แก้บั๊ก eq.)', () => {
    expect(aiSrc).toContain('async function notifyCustomerAiReply(')
    // R82 evidence (e2e/_r81c_evidence.json): ของเดิมไม่มี `eq.` → PostgREST 400 PGRST100
    // "failed to parse filter" → unresolved_identity ปลอม ทั้งที่ identity มีจริง 1 แถว
    expect(aiSrc).toContain('customer_channel_identities?external_user_id=eq.')
    // PSID ตัวเดียวกันทั้งคอมเมนต์/แชต (page-scoped) → หาแบบไม่ผูก channel
    expect(aiSrc).toContain('&channel=in.(FACEBOOK,MESSENGER)')
    expect(aiSrc).toContain('/rest/v1/customers?user_id=eq.')
    // R82: เช็คเครื่องที่รับได้ก่อน — ไม่มี subscription = ห้ามยัด outbox (รายงานตรง ๆ)
    expect(aiSrc).toContain('push_subscriptions?customer_id=eq.')
    expect(aiSrc).toContain("'no_subscription'")
  })
  it('ยิง enqueue_notification (event_key idempotent · Transactional) ทั้งคอมเมนต์และแชต (R82: เครื่องต้องดังทั้ง 2 ทาง)', () => {
    expect(aiSrc).toContain('/rest/v1/rpc/enqueue_notification')
    expect(aiSrc).toContain("isMessage ? 'ai-message-reply' : 'ai-comment-reply'")
    expect(aiSrc).toContain("p_category: 'Transactional'")
    expect((aiSrc.match(/ev\.event_type === 'comment' \|\| ev\.event_type === 'message'/g) || []).length).toBeGreaterThanOrEqual(2)
  })
  it('รายงานสถานะลง flags.push_notify ทั้งสายปกติและสาย fallback', () => {
    expect((aiSrc.match(/push_notify: notify\.outcome/g) || []).length).toBeGreaterThanOrEqual(2)
  })
})

describe('R81-A3 · H3 — alert เมื่อตอบสาธารณะไม่สำเร็จ (ห้ามหายเงียบ)', () => {
  it('enqueueAdminAlert eventKey social-reply-fail- ทั้ง 2 สาย + last_error เก็บละเอียดขึ้น', () => {
    expect((aiSrc.match(/eventKey: 'social-reply-fail-' \+ ev\.event_id/g) || []).length).toBeGreaterThanOrEqual(2)
    expect(aiSrc).toContain("reply_status: 'failed'")
    expect(aiSrc).toContain("reply_status: sent.ok ? 'sent' : 'failed'")
    expect(aiSrc).toContain('.slice(0, 200)')
  })
})

describe('R81-B6 — footer เลิกสัญญา "แตะแล้วยืนยันเปิด" (ทำไม่ได้จริง) → วิธีใช้ได้จริง', () => {
  it('socialOrderIntake: ไม่มีสัญญาเก่า + มีวิธีคัดลอก→วางใน Chrome/Safari', () => {
    expect(intakeSrc).not.toContain('แตะแล้วยืนยันเพื่อเปิดในเบราว์เซอร์ของคุณ')
    expect(intakeSrc).toContain('ให้กดคัดลอกลิงก์ในแถบที่ขึ้น แล้ววางใน Chrome/Safari')
    expect(intakeSrc).toContain('buildCartSummaryFooter')
    expect(intakeSrc).toContain('shop?cart=')
  })
  it('POST_CTA_FOOTER: ข้อความใหม่ + idempotent marker เดิมไม่แตะ', () => {
    expect(publishSrc).not.toContain('แตะเพื่อยืนยันเปิดในเบราว์เซอร์ของคุณ')
    expect(publishSrc).toContain('เปิดไม่ออก? กดคัดลอกลิงก์ในแถบที่ขึ้น แล้ววางใน Chrome/Safari: https://biteme-baby.com/shop')
    expect(publishSrc).toContain("base.includes('ปิดการขายผ่านช่องทางไหนก็ได้')")
  })
})
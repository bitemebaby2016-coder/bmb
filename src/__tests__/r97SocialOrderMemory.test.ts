// ============================================
// BMB — R97 Social Order Memory + R96 P2 Cross-channel continuity (fix 2026-11-15)
// ============================================
// ปิดบั๊กจริงที่พิสูจน์จากโค้ด (Owner ยืนยัน "ยังไม่สมบูรณ์ ต้องรวมใช้บริบทเดียวกัน
// ทุกช่องทางและรับต่อเนื่องกัน"):
//   ① getCustomerOrders เดิมยิง PSID ที่ orders.customer_id (จริงคือ auth uuid 025:307)
//     + select คอลัมน์ที่ไม่มีจริง (items/total/order_id) → 400 ทุกครั้ง → history ว่าง
//   ② cancelOrder เดิม PATCH orders ตรง — bypass canonical cancel_order (025/195)
//   ③ modifyOrder เดิม PATCH items/total ตรง + heuristic "ชื่อเมนูในคำตอบ → ทับ x1"
//   ④ เว็บมีแค่ sessionStorage timeline — เครื่องใหม่ไม่รู้บริบท
// ============================================

import { describe, it, expect } from 'vitest'

import orderMemorySrc from '../../supabase/functions/_shared/orderMemory.ts?raw'
import workerSrc from '../../supabase/functions/social-ai-worker/index.ts?raw'
import migrationSrc from '../../supabase/migrations/205_social_order_actions.sql?raw'
import timelineClientSrc from '../lib/socialTimelineClient.ts?raw'
import talkToBiteSrc from '../components/ai/TalkToBite.tsx?raw'

describe('R97-A — orderMemory (identity + query ถูก schema)', () => {
  it('resolve PSID → customer_ref ผ่าน customer_channel_identities (046) ก่อนใช้เสมอ', () => {
    expect(orderMemorySrc).toMatch(/resolveCustomerRef/)
    expect(orderMemorySrc).toMatch(/customer_channel_identities\?external_user_id=eq\./)
    expect(orderMemorySrc).toMatch(/channel=in\.\(FACEBOOK,MESSENGER\)/)
  })

  it('getCustomerOrders query คอลัมน์จริง (customer_ref + id/order_number/total_amount) — ห้าม select items/total/order_id ที่ไม่มีจริง', () => {
    expect(orderMemorySrc).toMatch(/orders\?customer_ref=eq\./)
    expect(orderMemorySrc).toMatch(/select=id,order_number,total_amount/)
    expect(orderMemorySrc).not.toMatch(/select=order_id,items,total/)
    // items จริงมาจากตารางลูก order_items
    expect(orderMemorySrc).toMatch(/\/rest\/v1\/order_items\?order_id=in\./)
  })

  it('getCustomerOrders รับ customer_ref (uuid) เท่านั้น — ไม่รับ PSID โดยตรง', () => {
    // signature: (deps, customerRef) — guard uuid ก่อน query
    expect(orderMemorySrc).toMatch(/UUID_RE\.test\(customerRef\)/)
  })

  it('cancelOrder ผ่าน RPC cancel_order_as_customer — ห้าม PATCH orders ตรง', () => {
    expect(orderMemorySrc).toMatch(/rpc\/cancel_order_as_customer/)
    expect(orderMemorySrc).not.toMatch(/method: 'PATCH'[\s\S]{0,200}\/rest\/v1\/orders/)
    expect(orderMemorySrc).toMatch(/p_order_number/)
    expect(orderMemorySrc).toMatch(/p_customer_ref/)
  })

  it('ลบ modifyOrder ทิ้ง (PATCH items/total ตรง = bypass authority — ห้ามกลับมา)', () => {
    // ห้ามมี definition/call จริง (คอมเมนต์บรรยายบั๊กเดิมได้)
    expect(orderMemorySrc).not.toMatch(/export async function modifyOrder/)
    expect(orderMemorySrc).not.toMatch(/await modifyOrder/)
    expect(orderMemorySrc).not.toMatch(/rpc\/modify/)
  })

  it('formatOrderHistoryForPrompt ห้ามแต่ง — อิงข้อมูลจริงและมีคำเตือนห้ามแต่ง', () => {
    expect(orderMemorySrc).toMatch(/ห้ามแต่งเลขที่\/ยอดเอง/)
    expect(orderMemorySrc).toMatch(/order_number/)
  })
})

describe('R97-B — migration 205 (cancel แทนลูกค้า + web timeline)', () => {
  it('cancel_order_as_customer: guard claims (service-role เท่านั้น) + guard ผูกตัวตน + เรียก canonical cancel_order', () => {
    expect(migrationSrc).toMatch(/CREATE OR REPLACE FUNCTION public\.cancel_order_as_customer/)
    // ห้าม authenticated ที่มี JWT จริงใช้ทางนี้ (เว็บใช้ cancel_order ตรง)
    expect(migrationSrc).toMatch(/request\.jwt\.claims/)
    expect(migrationSrc).toMatch(/ERR_FORBIDDEN/)
    // ผูกตัวตน: orders.customer_ref ต้องเท่ากับ p_customer_ref เท่านั้น
    expect(migrationSrc).toMatch(/v_order\.customer_ref IS NULL OR v_order\.customer_ref <> p_customer_ref/)
    // canonical: ตั้ง JWT claims เป็นลูกค้าแล้วเรียก cancel_order เดิม (025/195 ครบ)
    expect(migrationSrc).toMatch(/set_config\(\s*'request\.jwt\.claims'/)
    expect(migrationSrc).toMatch(/public\.cancel_order\(p_order_number, p_reason\)/)
  })

  it('cancel_order_as_customer: GRANT service_role เท่านั้น (REVOKE authenticated)', () => {
    expect(migrationSrc).toMatch(/REVOKE EXECUTE ON FUNCTION public\.cancel_order_as_customer FROM PUBLIC, anon, authenticated/)
    expect(migrationSrc).toMatch(/GRANT EXECUTE ON FUNCTION public\.cancel_order_as_customer TO service_role/)
  })

  it('social_timeline_for_web: SECURITY DEFINER ตรวจ auth.uid + map identity ย้อน (ทุกช่องทาง)', () => {
    expect(migrationSrc).toMatch(/CREATE OR REPLACE FUNCTION public\.social_timeline_for_web/)
    expect(migrationSrc).toMatch(/IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'/)
    // identity map: auth.uid → external_user_id (PSID ทุกช่องทางที่ผูก)
    expect(migrationSrc).toMatch(/customer_channel_identities\s+WHERE customer_ref = v_uid/)
    // social_events.customer_id (PSID จาก worker) + ทั้ง comment+message
    expect(migrationSrc).toMatch(/se\.customer_id = ANY \(v_extids\)/)
    expect(migrationSrc).toMatch(/se\.event_type IN \('comment', 'message'\)/)
  })

  it('social_timeline_for_web: GRANT authenticated (REVOKE anon) + จำกัด 10 แถว', () => {
    expect(migrationSrc).toMatch(/REVOKE EXECUTE ON FUNCTION public\.social_timeline_for_web FROM PUBLIC, anon/)
    expect(migrationSrc).toMatch(/GRANT EXECUTE ON FUNCTION public\.social_timeline_for_web TO authenticated/)
    expect(migrationSrc).toMatch(/LIMIT 10/)
  })
})

describe('R97-C — worker (cancel ตามกติกา + modify ไม่ใช้ heuristic)', () => {
  it('resolve identity ก่อนดึง history — ห้ามยิง sender_id (PSID) ตรงที่ getCustomerOrders', () => {
    expect(workerSrc).toMatch(/resolveCustomerRef\(\{ sbUrl: SB_URL, serviceKey: SERVICE \}, ev\.sender_id\)/)
    expect(workerSrc).toMatch(/getCustomerOrders\(\{ sbUrl: SB_URL, serviceKey: SERVICE \}, customerRef\)/)
    expect(workerSrc).not.toMatch(/getCustomerOrders\(\{ sbUrl: SB_URL, serviceKey: SERVICE \}, ev\.sender_id\)/)
  })

  it('order_cancel ใช้ order_number + customerRef (ผูกตัวตนทุกครั้ง)', () => {
    expect(workerSrc).toMatch(/cancelOrder\(\{ sbUrl: SB_URL, serviceKey: SERVICE \}, targetOrder\.order_number, customerRef/)
    // แก้ไข/ยกเลิกได้เฉพาะ pending (owner branch ของ cancel_order)
    expect(workerSrc).toMatch(/orderHistory\.filter\(\(o\) => o\.status === 'pending'\)/)
  })

  it('order_modify = extract→match→ยืนยัน→cancel canonical + สร้างใหม่ผ่าน intake (แนวเดียวกับเว็บ)', () => {
    expect(workerSrc).toMatch(/runModifyIntake/)
    expect(workerSrc).toMatch(/ORDER_EXTRACT_SYSTEM/)
    expect(workerSrc).toMatch(/matchOrderItems\(catalog, sem\.value\.items\)/)
    expect(workerSrc).toMatch(/submitNewOrder\(SB_URL, SERVICE,/)
    // externalRef ผูก event เดียวกัน (idempotent)
    expect(workerSrc).toMatch(/ev\.event_id \+ ':modify'/)
  })

  it('ลบ heuristic อันตรายของเดิม (ชื่อเมนูในคำตอบ → ทับออเดอร์เป็น x1)', () => {
    expect(workerSrc).not.toMatch(/mentionedProducts/)
    expect(workerSrc).not.toMatch(/quantity: 1, \/\/ Default/)
    expect(workerSrc).not.toMatch(/modifyOrder/)
  })

  it('แก้ไขไม่ครบ/ไม่ยืนยัน = ห้ามแตะออเดอร์ — ถามยืนยันก่อนเสมอ', () => {
    expect(workerSrc).toMatch(/ยังไม่ได้รับการยืนยันชัดเจน/)
    expect(workerSrc).toMatch(/ห้ามแก้\/ห้ามยกเลิกแทนลูกค้าตอนนี้/)
  })

  it('cancel+create fail = แจ้งแอดมินทันที (ลูกค้ายังไม่มีออเดอร์ — ห้ามหายเงียบ)', () => {
    expect(workerSrc).toMatch(/social-modify-no-round-/)
    expect(workerSrc).toMatch(/social-modify-create-fail-/)
    expect(workerSrc).toMatch(/AI แก้ไขออเดอร์/)
  })
})

describe('R96-P2 — เว็บรับบริบทต่อเนื่องจาก server (ทุกเครื่องเห็นเหมือนกัน)', () => {
  it('socialTimelineClient: เรียก RPC social_timeline_for_web — fail = [] (ไม่มโน)', () => {
    expect(timelineClientSrc).toMatch(/rpc\('social_timeline_for_web'\)/)
    expect(timelineClientSrc).toMatch(/if \(error \|\| !Array\.isArray\(data\)\) return \[\]/)
    // ข้อความถูก truncate ตาม schema (content/reply ≤200)
    expect(timelineClientSrc).toMatch(/\.slice\(0, 200\)/)
  })

  it('buildServerTimelineContext: บริบทข้อความลูกค้าจริง + กติกาต่อเนื่อง', () => {
    expect(timelineClientSrc).toMatch(/ห้ามทักทายเหมือนเพิ่งคุยครั้งแรก/)
    expect(timelineClientSrc).toMatch(/ห้ามถามเรื่องที่สรุปแล้วซ้ำ/)
    expect(timelineClientSrc).toMatch(/ประวัติการคุยข้ามช่องทางจากระบบ/)
  })

  it('TalkToBite: โหลด server timeline เมื่อล็อกอิน + inject เข้า runtimeContext', () => {
    expect(talkToBiteSrc).toMatch(/fetchSocialTimelineForWeb/)
    expect(talkToBiteSrc).toMatch(/buildServerTimelineContext/)
    expect(talkToBiteSrc).toMatch(/social_timeline_for_web/)
    // server ก่อนเสมอ — เครื่องใดก็ได้บริบทเดียวกัน
    expect(talkToBiteSrc).toMatch(/serverTimeline\.length > 0/)
    // sessionStorage timeline เป็น fallback ของเครื่องนี้ (ของเดิม R91/R92 คงไว้)
    expect(talkToBiteSrc).toMatch(/readSocialHandoffTimeline/)
  })
})

# Unified AI Commerce Architecture — Closure Plan

**สรุปสถานะ ณ 2026-11-15 (R101 · Owner สั่ง "รวมใช้บริบทเดียวกันทุกช่องทางและรับต่อเนื่องกัน")** — **R96–R97 ปิดครบ + APPLIED PROD (m205) + DEPLOYED (social-ai-worker) · Gates 4/4 · vitest 2257/2257** · เหลือเฉพาะ Owner live test (R98/§T-A รวม)

> **อัปเดตสำคัญ (R101 · 2026-11-15):**
> - **R97 จริง ๆ ไม่เคยทำงาน** — พิสูจน์จากโค้ด: `getCustomerOrders` ยิง PSID ที่ `orders.customer_id` (จริง = auth uuid 025:307) + select คอลัมน์ที่ไม่มี (`items`/`total`/`order_id`) = 400 ตาย 3 ชั้น · cancel ผ่าน PATCH orders ตรง (bypass canonical) · modify มีบั๊ก query + heuristic "ชื่อเมนูในคำตอบ → ทับ x1" อันตราย
> - **แก้ครบ + ออกแบบใหม่ตามกติกา:** migration **205** (`cancel_order_as_customer` = identity-guarded + เรียก canonical `cancel_order` 025/195 ภายใต้ JWT claims ลูกค้า = release capacity/inventory/void/audit ครบ · `social_timeline_for_web` = บริบทข้ามช่องทางฝั่งเว็บ) · orderMemory ใหม่ (resolve PSID→customer_ref ผ่าน 046 + query ถูก schema + order_items จริง) · worker modify = extract→match→ยืนยัน→cancel+สร้างใหม่ (แนวเดียวกับเว็บ) + แจ้งแอดมินเมื่อ cancel แล้ว create fail (ห้ามลูกค้าไม่มีออเดอร์)
> - **R96 P2 ฝั่งเว็บสมบูรณ์:** `socialTimelineClient.ts` + TalkToBite โหลด server timeline (ทุกเครื่องเห็นบริบทเดียวกัน — เดิมมีแค่ sessionStorage ของเครื่องเดียว)
> - **OMNI-5 ปลด BLOCKED แล้ว** (Owner แจ้งยกเลิกหลายครั้ง — ตรวจแล้ว: master status ปลดเมื่อ R95 "ผ่านบน live" แล้ว · ห้ามอ้าง BLOCKED อีก)

## สิ่งที่ทำครบ (CODE_CLOSED + PUSHED + DEPLOYED)

### R88–R94: รากฐานเสถียร
- **R88**: รีวิวคาร์ดรวม (VerifiedReviewsSection → ReviewCarouselSection) · 2237 tests ✅
- **R90**: InAppBrowserBanner · แบนเนอร์ข้อความ "Facebook ไม่รองรับการเปิดลิงก์ตะกร้าอัตโนมัติ" · ปุ่ม "📋 คัดลอกลิงก์ · เปิดใน Chrome / Safari" + "📥 ติดตั้งแอป" · กัน viewport heuristic false positive · `?cart=` decode + localStorage fallback ✅
- **R91**: Social handoff context · `detectSocialSource`, `saveSocialHandoff`, `buildSocialHandoffContext`, `decodeSocialContextParam` · sessionStorage `bmb:social-handoff` · TalkToBite inject "ต่อจากที่คุยกันใน Messenger/Facebook" ✅
- **R92**: Link context & grounding
  - R92-G: Guide text "เปิดผ่าน Chrome หรือ Safari เพื่อการใช้งานที่สมบูรณ์ที่สุด" · live proof `R92_GUIDE_NEW=true` ✅
  - R92-S: อัตโนมัติอัดรูป ≤300px/≤100KB (compressToWebLimits) · test `r63ImageResize` + `r38Contracts` ✅
  - R92-Guide: wlguide text change in InAppBrowserBanner ✅
- **R94**: WebP image spec · 3 ระดับ (Generate 800×800/150KB, Store 800×800/120KB WebP Q80, Display 400×400/100KB WebP Q80) · 2237 tests ✅
- **Floating Ad**: limit 3 ใบ · real links · image compress · kill switch `floating_ad_enabled` · badge status · AdminSettings sync ✅

### R95–R98: AI + Context + Cart continuity
- **R95**: `.flad-card` กลับสีขาว `.flad-media` โปร่ง · tests 7 ✅
- **R96 Phase 1**: AI Grounding ✅
  - `socialGroundingData.ts`: `fetchGroundingData()` พร้อม cache 30s → DB products + schedules
  - `buildGroundingPrompt()`: กฎตอบห้ามมโน + ราคาจาก DB เท่านั้น + schedule
  - `extractRelevantProductIds()`: match จากข้อความลูกค้ากับ products DB
  - ส่งไปผ่าน `groundingPrompt` ใน `social-ai-worker/index.ts:895-907`
- **R96 Phase 2**: Cross-channel context ✅
  - `socialHandoff.ts`: `ExtendedSocialHandoff` พร้อม `timeline: SocialHandoffTimelineEntry[]`
  - `saveSocialHandoff()`: append timeline entry → sessionStorage เก็บล่าสุด 10 รายการ
  - `readSocialHandoff()`: อ่านคืน + reject summary ที่มี URL/เกิน 200 chars
  - `buildSocialHandoffContext()`: สร้าง "ต่อจากที่คุยกันใน... + รายการที่สรุป + ประวัติการคุยข้ามช่องทาง + ชวนสนทนาต่อ"
  - `TalkToBite.tsx:composeRealContext()`: inject handoff context + grounding product + current product จาก URL
- **R96 Phase 3**: Product cache ✅
  - `productCache.ts`: session-based cache TTL 7 นาที (เท่า aiDbContext) + `invalidateProductCache()` สำหรับ admin ใช้
- **R97 Order memory (สมบูรณ์ R101 · 2026-11-15)**: Migration 204 (social_events.customer_id) + **Migration 205 (applied prod — `cancel_order_as_customer` + `social_timeline_for_web`)** + `orderMemory.ts` ใหม่ (`resolveCustomerRef` PSID→uuid ผ่าน 046 · `getCustomerOrders` query ถูก schema + order_items จริง · `cancelOrder` ผ่าน RPC 205 · **ลบ modifyOrder ทิ้งถาวร**) — worker: order history + cancel + modify ครบ (runModifyIntake) · tests `r97SocialOrderMemory.test.ts` 19 ข้อ + G6-09/G6-19 อัปเดตขอบเขตตาม Owner 2026-11-15 (เข้มขึ้น: ห้าม cancel_order ตรง · ผ่าน wrapper เท่านั้น)
- **Cart continuity §T-A**: `Layout.tsx:71-158` มี `localStorage` fallback `bmb:cart-from-link` + retry 700ms + 2.5s + error logging + strip `?cart=`/`?s=` หลังสำเร็จ ✅

### R98: Facebook IAB + PWA Install (pending owner live test)
- InAppBrowserBanner text ปรับเป็น "Facebook ไม่รองรับการเปิดลิงก์ตะกร้าอัตโนมัติ"
- ปุ่ม "📋 คัดลอกลิงก์ · เปิดใน Chrome / Safari" → copy handoff URL (มี `?cart=` เสมอ) + แผงคำแนะนำ 3 ทาง
- ปุ่ม "📥 ติดตั้งแอป" → native install prompt หรือ guide แบบ manual
- live test checklist 5 ข้อ (ดูรายละเอียดใน AI_WORK_STATE.md)

## สิ่งที่ยังไม่เสร็จ (ต้อง implementation)

### 1. R96 Phase 1: social-ai-worker grounding injection ให้เสร็จ (ครบถ้วน)
- **สถานะ**: `fetchGroundingData()` เขียนแล้วใน `socialGroundingData.ts` แต่ยังไม่ได้ inject ลง `draftSystem` ครบถ้วนใน `processEvent()` — ต้องมั่นใจว่า grounding data ตกถึง AI ทุกครั้ง + `buildGroundingPrompt` สร้างข้อความบังคับให้ตอบจาก DB เท่านั้น
- **ไฟล์**: `supabase/functions/social-ai-worker/index.ts:895-907` ตอนนี้ส่ง `groundingPrompt` ไปแล้วบางส่วน ต้องเพิ่ม rule ให้ model "ตอบจากข้อมูลข้างบนเท่านั้น ห้ามเดา" ชัดเจน และ inject ลง `draftSystem` รอบ 2 (fallback) ด้วย
- **Validation**: ทดสอบ worker output → ต้องเห็น "ข้อมูลสินค้าจริงจาก DB" ไม่ใช่ "มโน" + ไม่มี product hallucination

### 2. R96 Phase 2: socialHandoff timeline เก็บ-อ่าน ให้ครบ (sessionStorage persist)
- **สถานะ**: `ExtendedSocialHandoff` interface + `saveSocialHandoff()` + `readSocialHandoff()` เขียนแล้ว แต่ยังไม่ได้ทดสอบ round-trip จนถึงบรรทัดฐาน fail-closed (summary ที่มี URL = ทิ้ง field นั้นโดยไม่พัง hole handoff)
- **ไฟล์**: `src/lib/socialHandoff.ts:21-134` ต้อง verify: save → read → timeline มีครบ 10 รายการ + summary ไม่พัง + context build มี "ต่อจากที่คุยกัน" ครบ

### 3. R96 Phase 3: Cache invalidation + freshness check ใน AI runtime
- **สถานะ**: `productCache.ts` เขียนแล้ว (session TTL 7 min) แต่ยังไม่ได้ใช้ใน `chatWithAI` หรือ `aiService.ts` — ต้องเชื่อม `getCachedProducts()` ไปแทนที่ `getDbContextPrompt()` สำหรับ product data ใน runtime context
- **ไฟล์**: `src/lib/productCache.ts` + `src/lib/aiService.ts` หรือ `src/components/ai/TalkToBite.tsx`

### 4. R97: Order memory + modify/cancel order ผ่าน AI
- **สถานะ**: Migration 204 + `orderMemory.ts` เขียนแล้ว (getCustomerOrders, cancelOrder, modifyOrder, formatOrderHistoryForPrompt) แต่ยังไม่ inject ลง `social-ai-worker` processEvent — ต้องเพิ่ม order history prompt + เพิ่ม CLASSIFY_SYMM/REPLY_CONTINUITY_RULES ให้รู้ intent ว่า order_request / order_inquiry / order_cancel / order_modify
- **ไฟล์**: `supabase/functions/social-ai-worker/index.ts:826-832` (order history block) + CLASSIFY_SCHEMA ให้รู้ intent 4 แบบ + draftSystem inject orderHistoryPrompt + RPC call ใน fallback/success
- **Validation**: AI ตอบ "ทบทวน order" → ดึง order history จาก DB ได้จริง + AI สามารถยกเลิก/แก้ไข order ได้ → ลูกค้าสั่ง "ยกเลิกออเดอร์ที่ #123" → AI เรียก cancelOrder RPC → สำเร็จ

### 5. Owner live test: R98 cart continuity + Facebook IAB
- **สถานะ**: Code เสร็จแล้ว (InAppBrowserBanner.tsx + Layout.tsx) แต่ยังไม่ได้ owner ทดสอบจริง — ต้องตรวจ 5 ข้อ checklist (ดู AI_WORK_STATE.md:12)
- **Action**: owner hard reload `https://biteme-baby.com` → ทดสอบ Facebook Messenger DM → กดลิงก์ → คัดลอก → เปิด Chrome → ตะกร้าต้องมีของครบ + `?cart=` ยังคงทำงาน → ทดสอบ PWA install จาก homescreen → ไม่เห็น banner ซ้ำ
### 6. OMNI-5: ลงทะเบียน Meta Test User — **ยกเลิก/ปลดแล้ว (Owner 2026-11-15 ยืนยัน "แจ้งยกเลิกไปหลายครั้งแล้ว")**

- **สถานะ**: **ปลด BLOCKED แล้ว** — master status ปลดเมื่อ OMNI ผ่าน live (`R74 OMNI FLOW: 19/19 ALL PASS` บน production จริง) · ไม่มีการลงทะเบียน Test User ใหม่อีก — ตรวจรายการใหม่ให้ตรงจริงเท่านั้น
- **Action**: ไม่ต้องดำเนินการ

## กระบวนการต่อไป (Implementation Roadmap) — **ดำเนินการครบแล้ว R101**
### ขั้นตอนที่ 1: Complete R96 grounding integration (2 วัน)
1. ตรวจสอบ `social-ai-worker/index.ts:895-907` ว่ากระแส groundingPrompt ชัดเจนหรือไม่ → เพิ่ม rule บังคับ "ตอบจากข้อมูลข้างล่างเท่านั้น ห้ามเดา"
2. ตรวจสอบ `buildGroundingPrompt()` ว่าสร้างข้อความผิดพลาดหรือไม่เมื่อไม่มีสินค้า → ต้องบอก "ไม่พบในเมนูปัจจุบัน" + ชวนดู shop
3. ทดสอบ worker ผ่าน e2e probe → ยืนยัน output ไม่มี product hallucination

### ขั้นตอนที่ 2: Complete R96 cross-channel context (1 วัน)
1. Verify `saveSocialHandoff()` → `readSocialHandoff()` round-trip ผ่าน
2. ตรวจสอบ `buildSocialHandoffContext()` สร้าง context ครบ "ต่อจากที่คุย + รายการ + ประวัติ" ไม่ก้อง
3. ตรวจสอบ `TalkToBite.tsx` ว่าจัด context ลง `runtimeContext` ถูกต้องทั้ง 3 ช่องทาง (Facebook, Messenger, Web)

### ขั้นตอนที่ 3: Wire product cache into AI runtime (1 วัน)
1. ใน `src/lib/aiService.ts` หรือ `TalkToBite.tsx`: ใช้ `getCachedProducts()` แทนการ query DB ซ้ำ
2. เพิ่ม `invalidateProductCache()` call เมื่อ admin save product/promotion ใหม่
3. ทดสอบ: product update → AI ตอบข้อมูลใหม่ทันที (ไม่เป็นข้อมูลเก่า)

### ขั้นตอนที่ 4: R97 Order memory injection (2 วัน)
1. ใน `social-ai-worker/index.ts:826-832`: เพิ่ม order history fetch + prompt injection
2. เพิ่ม CLASSIFY_SCHEMA ให้รู้ 4 intent: order_request / order_inquiry / order_cancel / order_modify
3. เพิ่ม draftSystem block สำหรับ order modify/cancel RPC call
4. เพิ่มบันทึก order history กลับ social_events หลังตอบ (R97: customer_id, last_order_id, order_history)
5. ทดสอบ: AI ตอบ "ทบทวน order" → ดึง history ได้ → AI ตอบ "ยกเลิกออเดอร์ #123" → เรียก cancelOrder → สำเร็จ

### ขั้นตอนที่ 5: Owner live test (เหลือข้อเดียว)
1. owner hard reload `https://biteme-baby.com`
2. ทดสอบ 5 checklist R98 (แบนเนอร์ + คัดลอก + ติดตั้ง + cart ?cart= continuity + ไม่เห็น banner ซ้ำ)
3. ทดสอบ R97 ใหม่: ทัก AI ที่ Messenger "ทบทวน order" → ต้องสรุปจากประวัติจริง (ไม่งั้นบอกไม่พบ) · "ยกเลิกออเดอร์ BMB-xxx" → ระบบยกเลิกตามกติกา (หน้าต่างยกเลิก) · "แก้เป็น..." → ถามยืนยันก่อนแก้ · ทั้งหมดผูก identity ลูกค้าผู้ส่งเท่านั้น

## Acceptance Tests (Test Requirements)

| # | Test | Target | Expected |
|---|------|--------|----------|
| 1 | Worker uses REAL product data | `social-ai-worker/index.ts` | Prompt includes product grounding from DB query |
| 2 | grounding_data stored correctly | `social_events` table | JSON column contains product_ids, prices, schedules |
| 3 | Cross-channel timeline preserved | `socialHandoff.ts` | Multiple interactions stored + retrieved correctly |
| 4 | Build socialHandoffContext from timeline | `TalkToBite.tsx` | Shows conversation history summary + "ต่อจากที่คุยกันใน..." |
| 5 | Cache invalidated after product update | `productCache.ts` | Next request fetches fresh data (TTL 7 min reset) |
| 6 | No hallucinated products in replies | Worker output | Only mentions products that exist in grounding_data |
| 7 | AI starts from post topic | Worker output | Response starts from post content/menu, then order summary |
| 8 | Facebook IAB cart continuity | `Layout.tsx` | Cart restores from localStorage fallback after IAB redirect |
| 9 | Order memory lookup | `social-ai-worker` | AI gets order history from DB → สรุปได้จริง |
| 10 | Order cancel/modify | `social-ai-worker` | cancel ผ่าน `cancel_order_as_customer` (205 — ตรวจผูกตัวตน + canonical) · modify = ยืนยันแล้วยกเลิกเดิม+สร้างใหม่ผ่าน intake (ไม่มี PATCH orders ตรง — ลบ modifyOrder แล้ว) |

## Production Evidence (จะได้หลังdeploy)

- `AI_WORK_STATE.md` อัปเดตสถานะ R98 live test ✅ / R96–R97 completion ⏳
- `BMB_MASTER_STATUS.md` อัปเดต gate progression R95→R98
- `BMB_PRODUCTION_TEST_PACK.md` มีการทดสอบครบตาม checklist
- Session evidence: `e2e/_r98_deploy.log` (banner text + install button + cart param)
- Live test recording: owner ยืนยัน 5 checklist ข้อ ✅ / ❌
- Deployment: `https://biteme-baby.com` พร้อม R98 + รอ R96+R97
- **R101 (2026-11-15):** `e2e/_r205_apply.json` (m205 http=201 + verify functions) · `e2e/_r205_verify_grants.json` (grants ถูกต้อง) · `e2e/_r205_probe.json` (PROBE_OK=true — guard runtime จริง) · deploy `social-ai-worker` exit=0 (`e2e/_r74_deploy.log`)

## Rollback / Migration Path

### ถ้าต้องย้อนกลับ R96:
1. ลบ `grounding_data` / `reply_draft` column จาก `social_events` migration 203
2. ลบ `fetchGroundingData`, `buildGroundingPrompt`, `extractRelevantProductIds` จาก `socialGroundingData.ts`
3. ลบ `groundingPrompt` จาก `social-ai-worker/index.ts:895-907`
4. รีสet `productCache.ts` ให้เป็นสภาพเดิม (remove cache layer)

### ถ้าต้องย้อนกลับ R97 (R101 รูปแบบใหม่):
1. `DROP FUNCTION public.cancel_order_as_customer(text, uuid, text); DROP FUNCTION public.social_timeline_for_web();` (m205)
2. คืน `orderMemory.ts` เดิม (หรือลบ + ลบ import ใน worker) — ห้ามคืน modifyOrder (PATCH-ตรง ตายถาวร)
3. ลบ order history/cancel/modify injection จาก worker (orderHistoryPrompt + orderAction block + runModifyIntake)
4. ลบ customer_id/last_order_id/order_history จาก PATCH social_events (m204 columns คงไว้ได้)

### ถ้าต้องย้อนกลับ R98:
1. คืน InAppBrowserBanner text กลับ "กำลังเปิดใน Facebook"
2. ลบปุ่ม "📥 ติดตั้งแอป" หรือคืนสภาพก่อน R98
3. ลบ `localStorage` fallback `bmb:cart-from-link` จาก `Layout.tsx:89-92`
4. คืน `viewportMismatch` heuristic ใช้เดิมใน `useInAppBrowser.ts`

## คำสั่งถัดไป (Next Commands)

```bash
# 1. owner live test R98 + §T-A (สำคัญที่สุด — รวมการทดสอบพร้อมกันตามคำสั่ง Owner)
# 2. Hard refresh https://biteme-baby.com
# 3. ทดสอบ 5 checklist: ① แบนเนอร์ข้อความ + ปุ่ม ② คัดลอกลิงก์ → Chrome ③ ตะกร้ามีของ ④ PWA install ไม่เห็น banner ⑤ ?cart= ยังทำงาน
# 4. ทดสอบ R97 ใหม่บน Messenger จริง (history/cancel/modify — ตามขั้นตอนที่ 5)
# (R96 P1-P3 + R97 implementation = ทำและ deploy ครบแล้วใน R101)
```

## สรุป

**สถานะ:** **100% implementation + deployed (R101 · 2026-11-15)** — R96 P1-P3 (grounding/timeline/product cache) และ R97 (order memory + cancel/modify ผ่าน identity-guarded canonical RPC) เสร็จครบ · migration 205 applied prod + verify + probe runtime ผ่าน · social-ai-worker deployed · gates 4/4 · vitest 2257/2257 · **เหลือเฉพาะ Owner live test (R98/§T-A + R97) พร้อมกัน** · OMNI-5 ปลดแล้ว (ยกเลิกตามคำสั่ง Owner)

**ความเสี่ยงหลัก:** ลูกค้า/ช่องทางที่ยังไม่มี `customer_channel_identities` ผูก = ยังไม่เห็นประวัติ/แก้ไม่ได้จนกว่า intake จะ provision แถว (เกิดอัตโนมัติเมื่อสั่งของผ่าน social หลัง deploy นี้)

**ความสำเร็จเมื่อครบ:** Owner live test ผ่าน → closure report → session close ยืนยัน R95–R101 เสร็จสิ้น.
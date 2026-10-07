# BMB — Handoff: AI Automation Audit + Payment Omise (2026-10-07)

> **สถานะ:** AUDIT + HANDOFF สำหรับพัฒนระบบต่อให้ครบ
> **Branch:** `main == origin/main` · รอบล่าสุด = Round 13 (NL customize + auto-TTS) + ราก Omise
> เอกสารนี้คือจุดออกเดิน — อ่านให้ครบก่อนเริ่มงานใหม่
> **หมายเหตุ:** เขียนบทภาษาไทยใหม่ทั้งหมด (รอบก่อนไฟล์นี้พังจาก encoding — แทนที่ของเดิมแล้ว)

---

## 1. ขอบเขต ของงาน 2 ชั้น

### ชั้น A — AI-Waiter (Talk to Bite) · audit ครบใน repo นี้
- AI waiter (Bite) ระบบเดียว ครอบทุกประสบการณ์: Landing → Conversation, voice-first, memory, recommendation, order-again, NL re-order + customize
- **ไฟล์หลัก:** `src/components/ai/TalkToBite.tsx` · `src/lib/talkToBite.ts` (pure logic) · `src/stores/useBiteAIStore.ts` · `src/lib/aiService/aiVoice/aiMemory/aiServerMemory` · `src/components/ai/ProductCard/BiteMascot` · `src/pages/TalkToBiteHomePage.tsx`
- เข้าถึงหน้า: `/` (landing), `/talk-to-bite`, Floating Bite, `/admin/asset-audit`

### ชั้น B — ระบบ automation ข้างเคียง
- **Inventory auto-deduct** — `supabase/migrations/026_inventory_aggregate_fix.sql`, `inventory_transactions`
- **Kitchen auto-queue** — `kitchenService` / `kitchenControl`
- **Delivery auto-dispatch** — `deliveryRouter` / `delivery_assignments` (020 bite-drive)
- **Availability Engine** — `availabilityEngine` (same_day / preorder)
- **Stripe webhook idempotent** → **กำลังย้ายไป Omise** (ดู §5)
- **SMS transport** — `smsTransport`

---

## 2. สถานะ DONE — มีหลักฐาน (test/build/git)

| Item | File | Evidence |
|---|---|---|
| Unified Talk-to-Bite ระบบเดียว (ไม่มี chat คู่ขนาน) | `TalkToBite.tsx` mode `home`/`overlay` + Floating Bite | legacy `BiteAIChat`/`AiChatPage` ลบแล้ว · Round 9 |
| 7-day greeting + verified server-memory | `buildBiteGreeting`/`getGreetingIndex` + `aiServerMemory` | Round 9.1 · `talkToBite.test` |
| Landing เต็มจอ → Conversation + Bite Hero (mascot ตาม state) | `TalkToBiteHomePage.tsx` + hero area | Round 10–12 |
| Voice-first (mic STT + visualizer ตอนฟัง + 🎙/⌨️) + TTS reply | `aiVoice.ts` + TalkToBite input | `aiVoice.test` 10/10 · WS-2 |
| NL re-order ("สั่งเหมือนเดิม") | `parseOrderIntent` + `resolveOrderAgainFromOrder` | Round 12 |
| NL modify ("เปลี่ยน X เป็น Y") | `applyOrderModify` | Round 12 |
| NL customize → item note ("เพิ่ม…", "ไม่…" → note + cart customizations) | `extractCustomizers` + `attachCustomizersToDraft` → `cartStore.addItem(p,q,customizations)` | Round 13 · 4 tests |
| Auto-TTS reply loop (ทุก reply อ่านออกเสียง + text แสดงเสมอ) | `pushAssistant` auto-speak (voice-first default) | Round 13 |
| Quick actions execute จริง | TalkToBite handlers | Round 11 |
| Data authority (menu/history/cart จาก source จริง ไม่ fake) | `getProducts`/`getOrdersByCustomer`/`cartStore.addItem` | ทุกชั้น |
| No AI image-gen (0 hits) | grep | Round 9.1–11 |
| **ราก Omise** (env keys + client config + tests) | `.env.local`/`vite.config`/`src/lib/omise.ts` | **รอบนี้** · omise.test 4/4 |
| Gates green | `tsc 0 · lint 0 · vitest 51/561 · build 0` | ✅ |
---

## 3. PARTIAL — มีพื้นฐาน แต่ยังไม่ครบ

| Item | ตอนนี้ | ที่เหลือต้องทำ |
|---|---|---|
| NL customize vocabulary | generic Thai-block ("เพิ่ม X / ไม่ X" → plain note) | ตาราง canonical keys ↔ Thai (extra_egg/spicy/mild/hot/no_ice) แบบที่ `kitchenControl` คาด `{extra_egg:true, spicy:'Mild'}` |
| Voice loop เต็ม | auto-TTS มีแล้ว แต่ไม่ auto-re-listen (ต้องแตะ 🎙 ใหม่ทุกครั้ง) | optional "ถามต่อหลังตอบ" (policy-safe ไม่ auto-open mic) |
| Recommendation | deterministic heuristics (featured/favorite/name) | เพิ่ม real-based ("คนซื้ออะไรช่วงนี้") จากออเดอร์จริง |
| Order-again | เอาเฉพาะ product+qty | ต่อ customizations เก่า (extra_egg/spicy) เข้า draft line |
| E2E Talk-to-Bite | ไม่มี | เพิ่ม Playwright/E2E |
| **Payment ย้าย Omise** | **รากเสร็จ** (env + `omise.ts` + tests) | **cutover ยังไม่ทำ** → §5 |

## 4. NOT DONE — ยังไม่ได้เริ่ม
1. **LLM safe tool-calling** สำหรับวลีซับซ้อน (design ยังไม่เริ่ม)
2. **Continuous-listen loop** (ถามต่อหลังตอบ โดยไม่ auto-open mic)
3. **Real-based trend ranking** ของ recommendation
4. **ตาราง customization mapping** (ตอนนี้ generic อย่างเดียว)
5. **E2E ทั้ง waiter flow**
6. **Autoplay เสียงตอนเปิด** — จงใจไม่ทำ (policy: ห้าม autoplay voice)

---

## 5. Payment: Stripe → Omise (TEST MODE) — แผน cutover

### 5.1 ทำแล้ว (รอบนี้)
- **`.env.local`** (gitignored — ความลับอยู่เครื่อง local): เพิ่ม `OMISE_PUBLISHED_API_KEY_TEST_MODE` + `OMISE_SECRET_API_KEY_TEST_MODE` (test mode) — owner วางค่า test key จริงแทน placeholder
- **`.env.example`**: บันทึกชื่อตัวแปรไว้ (ไม่มีค่าจริง)
- **`vite.config.ts`**: เพิ่ม `envPrefix: ['VITE_', 'OMISE_PUBLISHED_API_KEY_TEST_MODE']` — เพราะชื่อนี้ไม่มี prefix `VITE_` ตามที่ owner กำหนด ต้อง whitelist ให้ client อ่านได้
- **`src/lib/omise.ts`**: config client-safe (`omiseConfig`/`isOmiseConfigured`/`omiseIsTestMode`) + seam `OMISE_CHECKOUT_FUNCTION='omise-checkout'` — ไม่แตะ secret key (ฝั่ง server เท่านั้น)
- **`src/__tests__/omise.test.ts`**: 4 tests ผ่าน
- **Stripe path เดิมยังทำงานได้** ไม่ได้ถอด — card checkout ใช้ได้จนกว่า cutover เสร็จ

### 5.2 ยังต้องทำ (next chat) — card flow ปัจจุบัน = Stripe ทั้งเส้น
ปัจจุบัน: `paymentGateway.createCheckout` → EF `create-checkout` (Stripe PaymentIntent) → client_secret → `CardPaymentForm` (Stripe.js) → EF `stripe-webhook` → `record_payment_result` (idempotent) · refund = EF `stripe-refund`

ลำดับ cutover (เก็บให้ test ผ่านก่อน ค่อยขอ live):
1. **Owner วาง test key จริง** ใน `.env.local` + `supabase secrets set OMISE_SECRET_API_KEY_TEST_MODE=…` (secret ห้ามอยู่ client)
2. **EF ใหม่ `omise-checkout`**: อ่าน secret key, re-derive amount จาก DB (ห้าม trust client), เรียก Omise Charges API (card token / return_uri) → คืน charge id / authorize URL
3. **Client `CardPaymentForm`**: ใช้ Omise.js (public key) สร้าง card token → ส่งเข้า `omise-checkout` (หรือ Omise Checkout redirect flow)
4. **EF `omise-webhook`**: ตรวจ `Omise-Signature` (HMAC-SHA256) → `record_payment_result` (RPC เดิม idempotent)
5. **`paymentGateway.ts`**: `PaymentProvider 'stripe'→'omise'` + `createCheckout` → `omise-checkout`
6. **Refund**: Omise Refunds API แทน `stripe-refund`
7. **Tests**: แทน `stripeWebhookSignature`/`stripeRefundLogic` ด้วยชุด omise; อัปเดต `paymentStateMachine`/`canonicalOrderFlow`/`g6Security`
8. **ทดสอบใน browser จนผ่าน** → ขอ live key → สลับ `*_LIVE` (รอบหลัง)

### 5.3 ความปลอดภัย (ห้ามละเมิด)
- Secret key อยู่ server เท่านั้น (ไม่เคยใน bundle client)
- Amount re-derive จาก DB เสมอ (server authority)
- Webhook ตรวจ signature + idempotent กัน replay
- ยังไม่ switch live จน test ผ่านครบ
---

## 6. หลักการ — ห้ามละเมิดตอนต่อเติม
1. **Chat engine เดียว** — ผ่าน `TalkToBite` + `useBiteAIStore.biteState` เท่านั้น
2. **ข้อมูลจริงเท่านั้น** — menu `getProducts`, history `getOrdersByCustomer`, cart `cartStore.addItem` (ไม่ fake)
3. **No AI image-gen** (0 hits) — ใช้แค่ `image_url` + `img-fallback`
4. **Customization → jsonb จริง** — `cartStore.addItem(product, qty, customizations)`
5. **Voice: subtitle เสมอ, autoplay ไม่เคย** — TTS ทำงานได้แม้ไม่มี mic (`ttsSupported` guard)
6. **RLS/ความปลอดภัย** — client ไม่ส่ง price; `aiToolCalling` อ่านอย่างเดียว; secret key (Omise/Stripe) อยู่ server

---

## 7. Checklist ให้ครบ 100%
### 7.1 NL (สำคัญ)
- [ ] ตาราง canonical keys ↔ Thai (extra_egg/spicy/no_ice) + ผ่านเข้า cart customizations
- [ ] ต่อ customizations เก่าเข้า order-again
- [ ] design safe LLM tool-calling (schema, allowlist, no-mutation)
### 7.2 เสียง (สำคัญ)
- [ ] continuous-listen หลังตอบ (มีการถาม ไม่ auto-open mic)
- [ ] voice states ใน Bite Hero (`error`/`device`)
- [ ] voice E2E (mock)
### 7.3 Payment (สำคัญ — ตาม §5)
- [ ] owner วาง Omise test key จริง + `supabase secrets set`
- [ ] EF `omise-checkout` + `omise-webhook` + refund
- [ ] `CardPaymentForm` → Omise.js · `paymentGateway` → omise
- [ ] แทนที่ stripe tests ด้วย omise tests
- [ ] ทดสอบ browser ผ่าน → ขอ live key → สลับรอบหลัง
### 7.4 ทดสอบ (สำคัญ)
- [ ] E2E: landing → conversation → order-again → customize → add → checkout
- [ ] integration: NL → `customizations` ถึง `order_items.customizations` (SQL)
### 7.5 เล็กน้อย
- [ ] ลบ dead `getBiteMessage`/`getBitePose` (`homeProviders.ts`)
- [ ] migrate `useCartStore` shim → canonical `cartStore` (3 importer)

---

## 8. Owner action — ตรวจเอง
```bash
npm run dev
```
1. `/` Landing → Bite → conversation
2. พิมพ์ "สั่งเหมือนเดิม" → draft (order-again)
3. พิมพ์ "เอาของเมื่อวาน แต่เปลี่ยนน้ำเป็นชาเขียว" → draft เปลี่ยนรายการ
4. ในออเดอร์พิมพ์ "เพิ่มไข่" → draft มี note → add to cart → checkout → ตรวจ `order_items.customizations` ใน DB
5. เสียง: reply อ่านออกเสียงอัตโนมัติ (ไม่ autoplay ตอนเข้า)
6. `/shop` · Floating Bite drag/snap · 7-day greeting วันถัดไป
7. **Omise**: วาง test key ใน `.env.local` → (เมื่อ cutover แล้ว) จ่ายบัตร test จนผ่าน

---

## 9. Git
- HEAD: `local == remote` หลัง push รอบนี้
- Gates: TSC 0 · LINT 0 · VITEST 51 files/561 · BUILD 0

---
*จัดทำโดย Cline (AI) — handoff สำหรับพัฒนระบบต่อ*
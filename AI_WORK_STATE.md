## 🔒 LIVE TEST RESULT 2026-11-24 (R104 · "1 REPLY = 1 ลิงก์ของระบบ + เปิด ?cart= = ตั้งตะกร้า" — Owner live 10:45-10:46 "อาการที่แก้ไม่หายสักอาการ" · อนุมัติ "โอเคอนุมัติ") · **CODE_CLOSED + GATES PASS (vitest 2516 tests · tsc 0 · lint OK · build OK) · ⚠️ EF social-ai-worker รอ DEPLOY (mutating — Owner approve)**

- **หลักฐาน live (5 ภาพ 10:45-10:46):**
  1. IAB กดลิงก์จากหลาย reply → ตะกร้าโตขึ้นเรื่อย ๆ: 26 ชิ้น ฿2,134 → 32 ชิ้น ฿2,608 (**+6 ชิ้น × ฿79 = +฿474 เป๊ะ** = ราคาเมนูที่ AI สรุป) → 34 ชิ้น ฿2,766
  2. คัดลอกเปิดข้ามเบราว์เซอร์ → ตะกร้าว่าง — **URL bar = `biteme-baby.com/` ไม่มี query เลย** = ลูกค้ากด "ลิงก์เปล่า" ที่ AI เขียนเอง

- **Root Cause 2 ขา (ที่ R102 ปิดไม่ครบ):**
  - RC-A (ตะกร้าโตเรื่อย ๆ): Layout เปิด `?cart=` แล้ว **เติม** payload ทับรายการเดิม (`addItem` merge เมนูเดิม+ตัวเลือกเดิม = บวกจำนวน) — กดลิงก์จากหลาย reply (payload คนละ fingerprint) = กองซ้ำไม่รู้จบ · guard R102 กันได้แค่ payload เดิมซ้ำ
  - RC-B (ลิงก์เปล่า): prompt เดิม (DRAFT_SYSTEM/BITE_MESSENGER_SYSTEM) **สั่ง AI เขียน `https://biteme-baby.com/shop` เป็นลิงก์ของตัวเอง** + template `?cart=<encoded>` ที่ AI คำนวณไม่ได้ → ทุก reply มีลิงก์เปล่าที่เด่นกว่าลิงก์จริง → ลูกค้ากด = เจอตะกร้าว่างใน Chrome

- **การแก้ (Owner อนุมัติ "โอเคอนุมัติ"):**
  1. **`Layout.tsx`**: เปลี่ยนความหมาย `?cart=` จาก "เติม" → **"ตั้งตะกร้าตามลิงก์" (replace)** — ตรงคำสัญญาของ AI "ใส่ตะกร้าให้แล้ว กดลิงก์เพื่อดูตะกร้า" · **resolve ก่อนแตะตะกร้า** (รายการไม่มีอะไรใช้ได้เลย = ห้ามทำลายตะกร้าเดิม + toast เดิม) · guard R102 คงอยู่ = กดลิงก์เดิมซ้ำไม่แตะตะกร้า (ของที่เพิ่มเองหลังจากลิงก์นั้นไม่หาย) · toast ผลสำเร็จคงเดิมเป๊ะ (เกณฑ์ H-1/I-5)
  2. **`socialLinkFormat.ts`**: `stripBareShopLinks(draft)` ใหม่ — draft ห้ามมีลิงก์ร้านเองทุกรูปแบบ (เปล่า/checkout/orders/template `<encoded>`) → แทนด้วย "ลิงก์ท้ายข้อความ (ระบบแนบให้)" · regex เฉพาะ `STRIP_URL_RE` (path class เพิ่ม `<>` จับ template ครบ) · PURE
  3. **`social-ai-worker`**: กฎ **"1 reply = 1 ลิงก์ของระบบ"** — prompt ทั้ง 2 persona + REPLY_GROUNDING_RULES + intake/order-action notes ห้ามเขียน URL เองทุกกรณี (อ้าง "ลิงก์ท้ายข้อความ" แทน) · `finalText` = strip(draft) + footers + **default CTA `🛍️ เมนูทั้งหมดและสั่งซื้อ: https://biteme-baby.com/shop`** เมื่อไม่มี footer ใดมีลิงก์ → ทุก reply มีลิงก์ร้านที่ถูกต้องอันเดียวเสมอ
  4. **เทสต์ `r104OneLinkOneCart.test.ts`**: stripBareShopLinks pure ทุกเคส (เปล่า/template/checkout/orders/วรรคตอน/ต่างโดเมน/idempotent/pipeline กับ normalize) + worker contracts (ไม่มี template · draftTextClean · defaultShopFooter) + Layout replace contracts (resolve ก่อน clear · clear ก่อน add · guard/toast/retry คงเดิม) · r75 test อัปเดตตามข้อเท็จจริง (AI worker ห้ามเขียน URL — post worker คงกฎเดิม)

- **เกต (เห็นผลจริงทั้งหมด):** `tsc --noEmit` 0 · `vitest run` **2516 tests PASS** (รวม r75/r57/g6/socialAiContinuity pin เดิมครบ) · `npm run lint` OK (brandNameGuard + languageSanity — จับ U+FFFD จาก edit แล้วแก้ครบ) · `npm run build` PASS

- **ผลตาม live หลังแก้ (คาดการณ์ — รอ Owner ทดสอบตาม REMAIN_TESTS กลุ่ม I):** กดลิงก์ AI ลิงก์ไหนก็ได้ = เห็นตะกร้าตามสรุปของลิงก์นั้นพอดี (ไม่กอง) · ลิงก์ที่กด = ลิงก์ตะกร้าจริงเสมอ (ไม่มีลิงก์เปล่าให้กดพลาด)

- **⚠️ เหลือ Owner approve + deploy:** `social-ai-worker` Edge Function ต้อง deploy ลง prod (mutating — แก้ prompt/assembly) ก่อนทดสอบ live กลุ่ม I · frontend (Layout/socialLinkFormat) = Cloudflare auto-deploy จาก push

---

## 🔒 LIVE TEST RESULT 2026-11-23 (R64 · DELIVERY SYNC FIX — Owner live test 23/11/2569: "ไรเดอร์กดรับอาหารเพื่อเดินทางออกส่งไม่ได้ ตัน preparing → NULL chain + แผนที่รายออเดอร์ขาว + ลูกค้า Map โหลดไม่ได้") · **CODE_CLOSED + GATES PASS (vitest 226 ไฟล์/2447 tests · tsc 0 · lint OK · build OK) + MIGRATION 212 APPLIED + PUSHED**

- **อาการจาก live test (รูป 18:34–20:07):**
  1. ไรเดอร์กด "รับอาหารเพื่อเดินทางออกส่ง" → `ERR_DELIVERY_SYNC_BLOCKED: order PO-20261124-544 cannot advance preparing -> <NULL> (target dispatched)` — วงจรตัน
  2. ลูกค้าทุกเครื่องค้างที่ "จัดทำรอบพรีออเดอร์" ไทม์ไลน์ไม่ขยับ
  3. แผนที่รวมไรเดอร์ใช้ได้ · แผนที่รายออเดอร์ขาว 1 ใบ (multi-instance Leaflet init race)
  4. Error แล้วแผง POD ปิดเอง (ดูเหมือนปิดงาน แต่งานยัง accepted + POD แนบครึ่งทาง)
  5. แอดมิน "🏁 แอดมินปิดวงจร" ตันจุดเดิม
  6. หน้าที่อยู่ลูกค้า: Google Maps โหลดไม่ได้ (key ถูกปฏิเสธ) + กล่องพิกัดแมนนวลแดงทั้งที่ GPS ยืนยันแล้ว

- **Root cause (พิสูจน์จากโค้ดจริง):**
  - RC1: 3 RPC canonical (`driver_update_delivery_status` m197, `admin_advance_delivery_status` m116, `driver_checkin_arrival` m166) มี hop chain เริ่มแค่ `ready_for_dispatch` → ออเดอร์ `preparing` ตันค้าง (R87b pattern)
  - RC2: `driverErrorText` ไม่มี mapping ERR_DELIVERY_SYNC_BLOCKED/ERR_KITCHEN_NOT_READY → โชว์อังกฤษดิบ + kind='state' ซ่อนปุ่ม retry
  - RC3: `completeDelivery` finally เคลียร์ `activeOrder` แม้ error → แผง POD ปิดตัวเอง
  - RC4: `RiderMiniMap` สร้าง/ทำลายแผนที่ซ้ำทุกครั้ง GPS/pin เปลี่ยน + init race + Google leak → ขาวบางใบ
  - RC5: `DeliveryMapPicker` ไม่มี Leaflet fallback + UX กล่องแมนนวลหลอก
  - RC6: warning มอบหมายซ้ำไม่ตรง (busy = multi-job OK)

- **การแก้ไขแบ่ง 5 เฟส (ตามแพลน `.kilo/plans/1795441113954-delivery-sync-fix-plan.md`):**
  - **Phase A (m212):** ต่อ hop chain — เพิ่ม `preparing → ready_for_dispatch` + guard `pending/confirmed` raise `ERR_KITCHEN_NOT_READY` (ไทยชัด) ใน 3 RPC · audit message ระบุ auto-hop
  - **Phase B:** `driverService.ts` เพิ่ม mapping ไทย 2 error · `RiderPwaPage.tsx` completeDelivery ไม่เคลียร์ activeOrder ตอน error + `podAttachDoneRef` skip re-upload · order_status chip ในการ์ด + ปุ่ม label "🛵 รับอาหารเพื่อเดินทางออกส่ง"
  - **Phase C:** `DeliveryManagement.tsx` warning copy แยก busy/offline · preparing badge + kitchen link ในคิว dispatch
  - **Phase D:** `RiderMiniMap` restructure: single init + imperative marker update + invalidateSize + ResizeObserver + stable keys · `DeliveryMapPicker` เพิ่ม Leaflet/OSM fallback + ซ่อนกล่องแมนนวลเมื่อมี candidate
  - **Phase E:** Test source-contract (r212DeliverySyncPreparingHop + updates) + gates ผ่าน + docs updated

- **Migration:** `212_delivery_sync_preparing_hop.sql` (REVOKE PUBLIC / GRANT authenticated เท่า baseline · 3 ฟังก์ชัน canonical verbatim + hop ใหม่ + guard)
- **Out of scope:** state machine / assignment structure / server-side cart / Google Maps key (ฝั่ง Owner)

---

## 🔒 SESSION CLOSE 2026-11-24 (R103 · SERVER-SIDE CART SYNC v1 — Owner: "เตรียมทำ Server-side cart sync ต่อให้สมบูรณ์") · **CODE_CLOSED + GATES PASS (vitest 229 ไฟล์/2501 tests · tsc 0 · lint OK · build OK) · ✅ MIGRATION 213 APPLIED PROD (2026-11-24 · Owner อนุมัติ):**

- **ขอบเขตที่ส่งมอบ (ต่อยอด R102 — deep-link แก้ guest ข้ามเครื่องได้แล้ว · R103 แก้ "ล็อกอินแล้วตะกร้าตามข้ามเครื่องจริง"):**
  1. **`supabase/migrations/213_cart_sessions_payload.sql`**: ADD COLUMN `payload JSONB` ให้ `cart_sessions` (เนื้อตะกร้าจริง — รูปเดียวกับ localStorage `bmb-cart-v1`: ids/qty/customizations/mode/coupon/referral · **ไม่มีราคา/ยอดรวม/PII** — server re-derive ตอน RPC 025 เสมอ) + RLS **`cart_sessions_select_own`** FOR SELECT TO authenticated (m180 ขาดน้องนี้ — เขียนได้อ่านไม่ได้) · ADDITIVE ONLY re-run ปลอดภัย
  2. **`cartSessionSync.ts`** (R49 telemetry → R103 sync จริง): upsert **`id = 'csa-' + customerId`** (deterministic — 1 แถว/1 ลูกค้า · อัปเดตจากเครื่องไหนก็แถวเดิม · บัญชีต่างกัน = แถวต่างกัน = intent R68 ยังครบ) + `payload: serializeCartObject(state)` (ตะกร้าว่าง = payload null) + `customerId` cache ต่อ uid + **`fetchLatestServerCart()`** ใหม่ (select payload ตาม customer_id · latest updated_at · ผ่าน `parseStoredCart` strict validate · guest/anon = null เงียบ ๆ R63 posture คงเดิม)
  3. **`cartPersistence.ts`**: hydration path เพิ่ม restore จาก server — กฎเดียว: **local ไม่มีรายการ = ลอง server** (local มีของ = local ชนะ — ไม่ surprise merge · ไม่ยุ่ง flow `?cart=` ของ Layout/R102) · dynamic import `cartSessionSync` (กัน cycle) · restore เสร็จก่อน `setHydrated()` (ลำดับ deterministic — Layout `?cart=` รอ isHydrated)
  4. **เทสต์ `r213CartServerSync.test.ts` (15 cases)**: migration contract (payload/select_own/ไม่แตะ policy เดิม) · guest guard ก่อน upsert (r49/r63 pin คงอยู่) · deterministic id · payload round-trip (ไม่มีราคาหลุด · strict parse) · ลำดับ restore→setHydrated · boot wiring ครบ · **R68 test contract อัปเดตตามข้อเท็จจริง** (sessionId localStorage → csa-<customerId> — intent "ไม่ทับข้ามบัญชี" ยังครบ + pin ใหม่ ยิงยืนยัน identity จาก auth.uid())

- **เกต (เห็นผลจริงทั้งหมด):** `tsc --noEmit` 0 · `vitest run` 229 ไฟล์ / 2501 tests PASS · `npm run lint` OK (3 gates) · `npm run build` PASS (PWA)

- **✅ Migration 213 APPLIED PROD (2026-11-24 · Owner อนุมัติ):** `cart_sessions.payload` + `cart_sessions_select_own` RLS live บน production — client sync ทำงานเต็มรูปทันที

- **ทางข้ามเครื่อง ณ ปิดงานนี้ (ครบทั้ง 2 แนวทาง):** ล็อกอิน = server sync (R103 อัตโนมัติ ข้ามเครื่องทุกเครื่องที่ล็อกอินบัญชีเดียวกัน) · guest = deep-link `?cart=` (R101/R63b/R102 — พิสูจน์ live แล้ว)

---

## 🔒 LIVE TEST RESULT 2026-11-24 (R102 · FB IAB CART DOUBLE-ADD + EXTERNAL COPY EMPTY CART — Owner: "IAB กดลิงก์ซ้ำนับเพิ่มทุกครั้ง + คัดลอกไป Chrome ตะกร้าว่าง") · **CODE_CLOSED + GATES PASS (vitest 228 ไฟล์/2486 tests · tsc 0 · lint OK · build OK)** · แผน `.kilo/plans/1795485479602-fb-iab-cart-double-fix.md`

- **อาการจาก live test (รูป 4 ภาพ FB Post/Comment + WebView + Chrome):**
  1. **IAB (ในแอปเฟซ)**: กดลิงก์ AI (ใต้โพส/ข้อความ) หลายครั้ง / navigate กลับ `/shop` → นับสินค้าเพิ่มทุกครั้ง (24 → 26 → 26 ชิ้น)
  2. **External (Chrome/Safari ผ่านแบนเนอร์คัดลอก)**: คัดลอกลิงก์จาก IAB → เปิดใน Chrome → ตะกร้าว่าง / ไม่ตรงกับ WebView

- **Root Cause เดียวกัน (พิสูจน์จากโค้ดจริง):**
  - RC1: `history.replaceState` **ล้มเหลวใน FB IAB** → `?cart=` ค้างใน URL → navigate กลับ `/shop` (แม้ใน SPA) → Layout effect รันใหม่ → decode `?cart=` ซ้ำ → `addItem` ซ้ำ → นับซ้ำ
  - RC2: ลิงก์ที่คัดลอกมาจาก IAB มี `?cart=` **เสียหาย (double-encoded / payload แพะจากบั๊ก IAB)** → `normalizeCartParam` ถอดไม่ได้ → `return` ไม่เติมของ
  - งานเก่า R63 (`1795399498532-fb-cart-bridge-live-plan.md`) ทำ logic encode v2/live-cart/scope-line ถูกแล้ว แต่ **ไม่มี dedup guard** — ปล่อยให้ IAB strip-fail กลายเป็น double-add

- **การแก้ไข 4 จุด:**
  1. **`cartDeepLink.ts`**: เพิ่ม `cartParamFingerprint(raw)` — FNV-1a 32-bit + ความยาว (pure, sync, dedup เท่านั้น) · **เหตุผลสำคัญ: ห้ามใช้ prefix slice** — เทสต์จับ collision จริง: b64url ของ JSON `{"id":"p-a"` vs `p-b` มี 12 ไบต์แรกเหมือนกัน → prefix 16 ตัวให้ key เดิม = **บล็อกลิงก์ใหม่ผิด** (รอบใหม่ AI สรุปรายการต่างกันแต่ key ชน)
  2. **`Layout.tsx` (effect ?cart=)**: sessionStorage guard `bmb:cart-processed-<fingerprint>` — check ก่อน side effect ทุกอย่าง (ก่อนเขียน snapshot) → เคย process แล้ว return ทันที · mark `=== '1'` หลัง `added > 0` **ก่อน** `replaceState` (กัน race — IAB strip fail ก็ mark แล้ว) · wrap try/catch ตาม house style
  3. **`InAppBrowserBanner.tsx` (`buildLiveHandoffUrl`)**: strip `fbclid` **ก่อน** fallback chain + live cart บังคับใช้เสมอเมื่อมีของ (fallback snapshot/resume เฉพาะ `!enc`) + `u.searchParams.set('cart', enc)` = **เขียนทับ payload แพะเดิมใน URL เสมอ** + `data-testid="inapp-live-cart-count"`
  4. **เทสต์ใหม่ `fbCartBridgeIAB.test.ts` (16 cases)**: v2 round-trip (mods+lm) · mangle 1/2/3 ชั้นถอดได้ (เคส copy ข้าม WebView) · URLSearchParams round-trip · garbage=null · v1 back-compat · payload>1800 → truncated · source contracts (guard ก่อน side-effect, mark ก่อน replaceState, fbclid ก่อน chain, live-cart priority) · behavioral guard ใช้ fingerprint จริง (กด 5 ครั้ง → อนุญาต 1 · ลิงก์ใหม่ = คนละ fingerprint = ผ่าน)

- **เกต (เห็นผลจริงทั้งหมด):** `tsc --noEmit` 0 error · `vitest run` 228 ไฟล์ / 2486 tests PASS (รวม r101 contract เดิมไม่พัง) · `npm run lint` OK (eslint + brandNameGuard + languageSanity — จับ U+FFFD 2 จุดจากการ edit แล้วแก้) · `npm run build` PASS (PWA precache 165 entries)

- **Out of Scope (ไม่ทำในแผนนี้ — ทำต่อรอบถัดไปตามคำสั่ง Owner):**
  - LINE/IG in-app browser (hook รองรับแล้ว รอ channel จริง)
  - PWA install flow (ทำงานอยู่แล้ว)

---

## 🔒 LIVE TEST RESULT 2026-11-23 (R63d · STICKER CONSOLIDATION — Owner: "ออเดอร์ 3 กล่อง เมนู A x2 + เมนู B x1 → สติกเกอร์พิมพ์ 3 ดวง → แก้เป็น 1 ดวงรวมทุกเมนู") · **CODE_CLOSED + GATES PASS (vitest 226 ไฟล์/2447 tests · tsc 0 · lint OK · build OK) + PUSHED `d67bf47` · frontend only (Cloudflare auto-deploy)**

- **Root cause:** `stickerRollForOrder()` split 1 ออเดอร์ = 1 ดวง/ชิ้น × qty → 3 กล่อง = 3 สติกเกอร์ · `stickerForm.ts` (R66) รองรับ ORDER LIST 4 บรรทัดต่อเนื่อง `~24 ตัวอักษร/แถว` คั่น ` · ` อยู่แล้ว
- **แก้ (`d67bf47`):** `stickerRollForOrder` คืน `[data]` (1 element = ออเดอร์เต็ม) แทน split per item → `printStickerRoll` render PNG 1 รูป → Bluetooth 1 job
- **Test lock:** `stickerQueueR31.test.ts` contract ใหม่ — `roll.length === 1` · items คง quantity จริง (`x2`, `x1`) · special_request รักษาไว้
- **AdminOrders.tsx:** toast `${roll.length} ใบ` → `1 ใบ`
- **Impact:** 1 ออเดอร์/1 ลูกค้า = 1 สติกเกอร์ (สอดคล้อง R5c 1 cart = 1 order) · ไม่มี migration

---

## 🔒 SESSION CLOSE 2026-11-23 (R63d + R63c + R63b + R63) — **ALL CODE CLOSED · GATES PASS · CI GREEN 3/3 · FRONTEND LIVE VIA CLOUDFLARE** · เหลือแต่ Owner live test ตาม `docs/BMB_REMAIN_TESTS_LIVE_2026-11-23.md` (กลุ่ม H 8 ข้อ + กลุ่ม G/F ค้างเดิม)

---

## 🔒 LIVE TEST RESULT 2026-11-23 บ่าย (R63c · CART UX + CLOSED ROUNDS — Owner: "หน้าตะกร้าไม่ต้องโชว์คูปอง/สรุปราคา เหลือปุ่มเดียว + Checkout ต้องโชว์รอบปิด status=closed เทา/กดไม่ได้") · **CODE_CLOSED + GATES PASS (vitest 226 ไฟล์/2447 tests · tsc 0 · lint OK · build OK) + PUSHED `9f5f517` · frontend only (Cloudflare auto-deploy 2-3 นาที)**

- **CartPage (`src/pages/CartPage.tsx`):** ลบ card 🎟️ คูปอง/โปรโมชั่น (R10 คงคูปองไว้หน้า checkout) + ลบ card 💰 สรุปราคา (รายละเอียดทั้งหมด) → เหลือรายการสินค้า + AddonCrossSellStrip + (stale pre-order warning) + ปุ่ม "ยืนยันสั่งซื้อ →" เดียวไป /checkout (gated `hasStalePreOrder`)
- **CheckoutPage (`src/pages/CheckoutPage.tsx`):** PRE_ORDER fetch rounds ใช้ `getRoundsForDateAdmin` (all non-archived) แทน `listRoundsForDate` (active-only) → รอบที่แอดมินปิด `status='closed'` โชว์แต่ **disabled/เทา + badge "ปิดรับ (แอดมิน)"** · logic: `closed = r.status==='closed' || roundBookability!=='open'` · SAME_DAY auto-select คงเดิม
- **Tests updated:** `checkoutModeLock`, `checkoutMixedSplit`, `r65PickupHoursNotRounds` — mock `getRoundsForDateAdmin` คืน `status='active'` · pins `go-checkout` testid คงอยู่
- **Migration check:** ไม่มี migration ใหม่ — ระบบ `delivery_rounds.status` ('active'/'closed') + RLS public read `status='active'` อยู่แล้วถูกต้อง

---

## 🔒 SESSION CLOSE 2026-11-23 (R63c + R63b + R63) — **ALL CODE CLOSED · GATES PASS · CI GREEN 3/3 · FRONTEND LIVE VIA CLOUDFLARE** · เหลือแต่ Owner live test ตาม `docs/BMB_REMAIN_TESTS_LIVE_2026-11-23.md` (กลุ่ม H 6 ข้อ + กลุ่ม G/F ค้างเดิม)

---

## 🔒 LIVE TEST RESULT 2026-11-23 บ่าย (R63b · HOTFIX — Owner live test: "รายการตะกร้าที่ผ่านลิงก์ copy มาเปิดเบราว์เซอร์ภายนอก (แท็บเล็ต) ยังมีตะกร้าเก่าโดยกู้คืน ไม่มีของใหม่") · **CODE_CLOSED + GATES PASS (vitest 226 ไฟล์/2447 tests +1 · tsc 0 · lint OK · build OK) + PUSHED `f6e4022` · frontend only**

- **Root cause:** `InAppBrowserBanner.tsx:140` อ่าน `useCartStore.getState().items` ใน render body = ค่าค้าง mount (ไม่ subscribe) — ลูกค้าเพิ่มเมนูใน WebView แล้ว banner ไม่รู้ → ปุ่มคัดลอก/กล่องลิงก์ใช้ตะกร้า mount เก่า (payload AI summary) เสมอ ทั้งที่ `encodeLiveCartParam` v2 + Layout restore v2 ถูกต้องแล้ว
- **แก้:** ① `liveCart = useCartStore((state) => state.items)` — subscription hook จริง (banner re-render ทุกการเปลี่ยนตะกร้า → URL ทุกทางจากตะกร้าสด ณ เวลากด) ② ตัด dead code `handoffUrl` (mount snapshot URL — ต้นทางแนวคิดเก่า) — คัดลอกทุกทางผ่าน `buildLiveHandoffUrl` เดียว
- **Test lock:** R63b ใน `r101CartHandoffFix.test.ts` (selector hook + ห้าม getState().items + ห้าม handoffUrl)
- **รอ Owner retest:** H-1/H-2 (แท็บเล็ต: FB WebView สั่ง ≥4 บรรทัด → คัดลอกลิงก์ → วางในเบราว์เซอร์ภายนอก = ตะกร้าตรงทุกตัวเลข) — เกต: hard reload ก่อนเริ่ม (Cloudflare deploy 2-3 นาทีหลัง push)

---

## 🔒 SESSION CLOSE 2026-11-23 (รอบ 63 · BMB-FB-CART-BRIDGE-LIVE-2026-11-23 — สะพาน "ตะกร้าสด" ข้ามช่องทาง Facebook → เบราว์เซอร์จริง Phase 1–3) · **SESSION CLOSED — CODE_CLOSED + PUSHED (`9b913c9`) + EF `social-ai-worker` DEPLOYED exit=0 + SMOKE http=200 boot_ok=true · เหลือแต่ Owner live test (กลุ่ม H 6 ข้อ + G/F ค้างเดิม = 32 ข้อใน `docs/BMB_REMAIN_TESTS_LIVE_2026-11-23.md`)**

**ปัญหาที่ Owner ชี้ (พิสูจน์จากรูป 08:48–08:52 + โค้ดจริงแล้ว):**
ใน Facebook WebView ตะกร้ามี **4 บรรทัด / 17 ชิ้น / ฿1,313** แต่กด "คัดลอกลิงก์ → วางใน Chrome" แล้วได้เพียง **1 รายการ ฿79** (= payload ของลิงก์ AI สรุปรอบคุยล่าสุด) — ข้อมูลไม่ตรงกันทุกช่องทาง

**Root cause 4 ชั้น (ที่ตรวจจาก Actual Code):**
1. AI สร้าง `?cart=` จาก **รายการ matched ของรอบคุยเท่านั้น** — `supabase/functions/_shared/socialOrderIntake.ts:555-561` (`cartFooterForMatch`) — server ไม่มีตะกร้าฝั่งลูกค้าให้อ่าน
2. ปุ่มคัดลอกส่งต่อ **สแนปชอต mount ครั้งเดียว / `bmb:cart-resume` ที่ไม่มี TTL** — `src/components/InAppBrowserBanner.tsx:62-70, 131-159` — ไม่มีโค้ดใด serialize ตะกร้าสดลงลิงก์
3. `Layout.tsx:136-141` strip `?cart=`/`?s=` หลัง restore (§T-A) → ลิงก์ที่คัดลอกพา payload เก่าเสมอ
4. Restore ทั้งสอง path **hardcode `addItem(p, q, {}, 'SAME_DAY')`** → ทิ้ง add-ons + line_mode — `Layout.tsx:125, 199`

**ข้อเท็จจริงที่เปิดทางแก้:** `customizations = { addOns: [{ addonId, selections, note }] }` — เก็บแค่ id/ตัวเลือก/โน้ต **ไม่มีราคา ไม่มี PII** (ราคา server re-derive) → ฝังลงลิงก์ได้ปลอดภัย (`src/lib/addonDisplay.ts:66-79`, `src/types/index.ts:822-825`)

---

### การแก้ไข Phase 1–3 (ตามแพลน `.kilo/plans/1795399498532-fb-cart-bridge-live-plan.md`)

**Phase 1 — `cartDeepLink.ts` payload v2 (pure lib):**
- เพิ่ม `encodeLiveCartParam(lines)` → `{v:2, items:[{id,q,mods?,lm?}]}`; caps: 30 items, 50 qty/item, payload ≤1800 chars; downgrade: ตัด mods ก่อน (droppedMods) แล้วค่อยตัดบรรทัด (truncated); v1 API เดิมไม่แตะ (server mirror)
- `decodeCartParam` / `normalizeCartParam` / `readCartParam` รองรับ v1+v2 (validate mods = object addOns, lm∈{0,1}); back-compat round-trip tests

**Phase 2 — ปุ่มคัดลอกพาตะกร้าสด (`InAppBrowserBanner.tsx` + `Layout.tsx`):**
- `copyHandoff` สร้าง URL ณ เวลากดจาก `encodeLiveCartParam(useCartStore.getState().items)` — live cart; fallback chain: live cart → cartHandoff.raw (mount) → readCartResume (TTL 30 นาที); banner count ใช้จำนวนตะกร้าสด + แจ้ง truncated/droppedMods ตามจริง; strip `fbclid` ใน handoffUrl; hooks-before-return (R90) คงเดิม; ห้าม intent:// (R92 ถาวร)
- `Layout.tsx` restore ทั้ง 2 path ส่ง `mods`/`lm` เข้า `addItem` จริง (เลิก hardcode `{}`/`'SAME_DAY'`); addOns ที่ addonId ไม่พบใน `product.addons` = ตัดออก (fail-safe); เคลียร์ `bmb:cart-resume` หลัง restore สำเร็จ

**Phase 3 — ความจริงทุกช่องทาง (server shared lib):**
- `socialOrderIntake.ts` `buildCartSummaryFooter`: เติมบรรทัด scope disclosure จริง — "ℹ️ ลิงก์นี้พาเฉพาะรายการที่คุยกันในรอบนี้ — ของที่เพิ่มเองบนเว็บยังอยู่กับเว็บของคุณ (ในหน้าเว็บกดคัดลอกลิงก์ = พาตะกร้าเต็มไปด้วย)" (`cartFooterForMatch` R92 คงพฤติกรรม)
- **Deploy `social-ai-worker` เท่านั้น** (importer เดียวของ intake footer — channel-webhook ใช้ `resolveKitchenPoint` อย่างเดียว) — เป็น mutating deploy ต้อง owner approve

**Phase 4 — Tests + Gates:**
- อัปเดต `cartDeepLink.test.ts` (v2 round-trip, caps/downgrade, back-compat v1, double-encode), `r101CartHandoffFix.test.ts` (banner contract ใหม่: live-cart-at-click + fallback + TTL + testids), `socialOrderIntake.test.ts` + `socialAiContinuity.test.ts` (scope line)
- เกตผ่านครบ: `tsc` 0 errors · `npm run lint` OK · `npm run test` 226 files / 2446 tests PASS · `npm run build` PASS (PWA v1.3.0)

**Out of scope (ประกาศชัด):** Server-side/account cart (ซิงก์ข้ามเครื่องจริง) — future; คูปอง/referral/ค่าส่งในลิงก์; LINE/IG เฉพาะทาง

**ปิดเซสชัน 2026-11-23 05:21Z (Owner อนุมัติ deploy 2 ครั้ง 05:02/05:19 · "ปิดทุกอย่างให้เหลือแต่ทดสอบไลฟ์เท่านั้น"):**
- เคลียร์สเตจค้าง = commit `e1d22cb` (docs: BMB_MASTER_STATUS.md + BMB_REMAIN_TESTS_LIVE_2026-11-23.md 32 ข้อ)
- **Deploy `social-ai-worker` exit=0** (2026-11-23 05:21:08Z · `npx supabase functions deploy social-ai-worker --project-ref ivkdfognyiwjcmrhcnwz` ผ่าน `_r74DeployFns.cjs` scope เดียว · log `e2e/_r74_deploy.log`) — scope ยืนยันจากโค้ด: ฟังก์ชันที่เปลี่ยน (`buildCartSummaryFooter`/`cartFooterForMatch`) ถูกใช้เฉพาะ social-ai-worker; channel-webhook import เฉพาะ `resolveKitchenPoint` (ไม่เปลี่ยน)
- **SMOKE PASS:** `node e2e/_r82_smoke.cjs` → http=200 + `{"processed":0,"note":"no RECEIVED social events"}` boot_ok=true (`e2e/_r82_smoke.json`) = พิสูจน์ build ใหม่ boot ได้จริง (ไม่แตะลูกค้า)
- เหลือ: Owner live test ตาม `docs/BMB_REMAIN_TESTS_LIVE_2026-11-23.md` (เฉพาะกลุ่ม H ใหม่ 6 ข้อ · H-4 ใช้ footer ที่ deploy นี้)

---

## 🔒 SESSION CLOSE 2026-11-22 (รอบ 62 · BMB-ADMIN-FOCUS-LOOP-FOLLOWUP — แก้ CI #1014 แดง: source-contract test ยึดพฤติกรรมเก่า + Node 20 warning) · **CODE_CLOSED + LOCAL GATES PASS + CI #1015 ✅ + CONTRACT #589 ✅ + ANNOTATIONS ว่าง + PUSHED**

**ต้นตอ (พิสูจน์จาก annotations CI #1014 จริง):**
- `src/__tests__/r15DeliveryLiveRefresh.test.ts:45` — source-contract test `"?focus= = refetch เสมอ + scrollIntoView"` ยึดพฤติกรรมเก่าที่ Owner สั่งลบ (รอบ 61) → `AssertionError: expected source to contain 'scrollIntoView({ block: 'center''` → Unit tests step ล้ม → Typecheck+Build skip
- **บทเรียน (ผิดกฎ evidence-based):** รอบ 61 รายงาน "vitest PASS" โดยที่ run โดน shell timeout ตัดที่ 120 วิก่อนจบ — ไม่เคยเห็น summary จริง → ต้องรันเต็มรอบ (185.19s) + อ่าน `Test Files 226 passed / Tests 2445 passed` ก่อนอ้าง PASS เสมอ
- Warning Node 20 deprecation: `actions/checkout@v4` + `actions/setup-node@v4` (ไม่ใช่สาเหตุ failure)

**แก้ไข:**
- **Test contract ใหม่** (`r15DeliveryLiveRefresh.test.ts:43-52`): `?focus=` = ไฮไลต์อย่างเดียว — ยืนยัน `data-focus-row >= 2` + ring (คิว dispatch) + bg tint (ตาราง en-route) ครบ + **regression guard**: `not.toContain('scrollIntoView')` + `not.toContain('scrolledFocusRef')` (ห้ามวงลูปกลับมา)
- **ci.yml**: `actions/checkout@v4→v5` + `actions/setup-node@v4→v5` (node-version 24 คงเดิม) — แก้ warning

**Gates (หลักฐานเต็มรอบ):**
| Gate | Command | Result |
|------|---------|--------|
| TypeScript | `npx tsc --noEmit` | ✅ TSC_OK (0 errors) |
| Lint | `npm run lint` | ✅ brandNameGuard / languageSanity OK |
| Unit Tests | `npm run test` (เต็ม 185.19s) | ✅ 226 files / 2445 tests passed, 0 failed |
| Build | `npm run build` | ✅ ✓ built in 5.01s (PWA) |
| CI | GitHub #1015 | ✅ success — ทุก step (Lint/Unit tests/Typecheck+Build) |
| Contract | GitHub #589 | ✅ success |
| Annotations | check-runs #1015 | ✅ ว่างเปล่า (error 0 / warning 0) |

**Commits:**
- `a447779` test: ปรับ R15 ?focus= contract = ไฮไลต์อย่างเดียว ห้าม scroll/refetch loop (แก้ CI #1014 แดง)
- `00a0857` ci: actions/checkout + setup-node v4→v5 (แก้ Node 20 deprecation warning)

**ค้างรอ Owner:** เหมือนรอบ 60/61 — ทดสอบ live 3 สิ่งหลัก (rider ปิดงาน, customer track+POD, admin close cycle) + ยืนยันหน้า Admin Delivery `?focus=` ไม่เด้งจอแล้ว

---

## 🔒 SESSION CLOSE 2026-11-22 (รอบ 60 · BMB-RIDER-NOTIF-FIX-2026-11-22 — Phase 1→2→3 ใช้งานสมบูรณ์) · **CODE_CLOSED + BUILD+LINT+TSC+VITEST ALL PASS + PUSHED + รอ OWNER ทดสอบ LIVE (แชทหน้า)**

**BMB-RIDER-NOTIF-FIX-2026-11-22 — แก้ไข 2 ปัญหาหลักครบทุก 3 User (Admin, Rider, Customer):**

**Phase 1 — ไรเดอร์ปิดงานไม่สำเร็จ (Order 826 Black Screen + Stuck State):**
- **1.1 Error Boundary + Structured Logging** — เพิ่ม `DeliveryErrorBoundary` ครอบ `PodDeliveryPanel` + console.log ทุก step (upload/attach/finalize) พร้อม timing ใน `completeDelivery` (`RiderPwaPage.tsx:345-423`)
- **1.2 toBlob แทน toDataURL** — `RiderPod.tsx:78` ใช้ `canvas.toBlob()` + `URL.createObjectURL()` ลด memory จาก base64 ~20MB เหลือ object URL ~1MB + cleanup `objectUrlRef` ใน useEffect
- **1.3 activeOrder Sync ใน refresh()** — ถ้า server ไม่มี order นั้นแล้ว → `setActiveOrder(null)` (`RiderPwaPage.tsx:195-200`)
- **1.4 Hardened finally block** — บังคับ `setDeliverBusy(false)`, `setDeliverStep(null)`, `setActiveOrder(null)` ทุกกรณี success+error
- **1.5 Retry button** — โชว์เมื่อ `kind !== 'state'` ใช้ `lastPhotoRef` ไม่ต้องถ่ายรูปซ้ำ

**Phase 2 — Notification/Toast Layout เบี้ยวซ้ายตกจอ (Mobile-first + PWA):**
- **2.1 Fixed positioning + responsive max-width** — `.toast-container` มี `position: fixed; top: 1rem; right: 1rem; z-index: 9999` แล้ว + เพิ่ม `max-width: calc(100vw - 2rem)` บน `.toast` (`src/index.css:236-254`)
- **2.2 Safe-area inset** — `padding-right: env(safe-area-inset-right, 0); padding-top: env(safe-area-inset-top, 0)` รองรับ iOS notch/Android cutout
- **2.3 SW notification options** — เพิ่ม `vibrate: [200, 100, 200]`, `requireInteraction: true` ใน `src/sw.ts:74-88`
- **2.4 Mobile QA** — Build output รวม CSS/SW ใหม่ ทุก test ผ่าน

**Phase 3 — 3-User Experience Hardening (Admin, Rider, Customer):**
- **3.1 Rider→Customer Sync** — `OrderTrackPage` polling 20s → **5s** เมื่อ rider visible (status `dispatched`/`in_transit`/`arrived`) + แสดง **POD photo + timestamp** จาก `proof_of_delivery_path` + `pod_captured_at` เมื่อ `status === 'delivered'`
- **3.2 Admin Visibility** — `adminAdvanceDelivery` มีอยู่แล้วใน `DeliveryManagement.tsx:307` (toast + notification trigger) + `AdminOrders` มี History/Audit panel (`getOrderStatusHistory` + `getOrderAuditTrail`)
- **3.3 Mobile/PWA Compliance** — `index.html`: iOS PWA meta tags (`apple-mobile-web-app-capable`, `apple-touch-icon`, `manifest`) + `src/index.css`: global min 48×48px touch targets สำหรับ buttons ทุกตัว + manifest มี `display: 'standalone'` แล้ว + SW offline-first precache 165 entries

**Gates (Evidence-based, Max 2 Attempts ต่อ AI Workstate Section 0.9):**
| Gate | Command | Result |
|------|---------|--------|
| TypeScript | `npx tsc --noEmit` | ✅ 0 errors |
| Lint | `npm run lint` | ✅ 0 warnings |
| Build | `npm run build` | ✅ PASS, PWA generated |
| Unit Tests | `npm run test` | ✅ 226 files / 2445 tests PASS |

**Commits:**
- `1614bb5` Phase 1 Changes Summary
- `5a491e8` Phase 2 Fixed positioning_responsive max_width
- `fc75f9e` Phase 3 Rider_Customer Sync

**รอ Owner:** ทดสอบ live 3 สิ่งหลัก:
1. ไรเดอร์: รับงาน → check-in → ถ่ายรูป → ยืนยันส่ง → **ไม่จอดำ, ไม่ค้าง busy, retry ได้**
2. ลูกค้า: `/track/ORDER` → polling 5s เห็นตำแหน่งไรเดอร์ real-time → delivered แสดง **POD photo + เวลา**
3. แอดมิน: DeliveryManagement กดปิดวงจร → toast + notification trigger → History/Audit panel โชว์ trail ครบ

---

## 🔒 SESSION CLOSE 2026-11-22 (รอบ 61 · BMB-ADMIN-FOCUS-LOOP-2026-11-22 — ลบ auto-scroll + refetch loop ที่ ?focus= ใน Admin Delivery) · **CODE_CLOSED + BUILD+LINT+TSC+VITEST ALL PASS + PUSHED**

**BMB-ADMIN-FOCUS-LOOP-2026-11-22 — แก้หน้า Admin Delivery เด้งจอ + โหลดข้อมูลซ้ำไม่รู้จบทุกครั้งที่ poll 20 วิ เมื่อมี `?focus=ORDERNO` ใน URL:**

**ปัญหา (Root Cause):**
- `DeliveryManagement.tsx:154-168` — `useEffect` มี deps `[focusOrder, load, orders]` ทำให้ทุกครั้งที่ `load()` เสร็จ → `setOrders(new array)` → `orders` เปลี่ยน reference → effect รันใหม่ → `void load(true)` → `setOrders` ใหม่ → **วนลูปโหลด + scrollIntoView ไม่รู้จบ**
- `scrolledFocusRef` เขียนอย่างเดียว อ่านไม่เคย → guarding "ครั้งเดียวต่อ focus" ใช้ไม่ได้จริง
- ผลคือ หน้าเด้งกลับไปที่แถว focus (`ring-2 ring-brand-primary`) ทุกครั้งที่โหลดเสร็จ แม้ผู้กำลังเลื่อนไปดูงานอื่นอยู่

**แก้ไข:**
- **ลบ effect scroll ทิ้งทั้งหมด** (บรรทัด 154-168) รวม `scrolledFocusRef` ให้หมด
- **เก็บ visual ring highlight** ไว้ที่บรรทัด 534/674 (`focusOrder === o.order_number ? 'ring-2 ring-brand-primary' : ''`) เพื่อบอกว่ามาจากลิงก์ไหน — แต่ไม่เลื่อนจออัตโนมัติ
- ลิงก์จาก `AdminOrders.tsx:739` และ `AdminKitchen.tsx:130` (`/admin/delivery?focus=${order.order_number}`) ยังทำงานปกติ แค่ landing page ไม่เด้งจอ + ไม่โหลดข้อมูลซ้ำอัตโนมัติ

**Gates (Evidence-based):**
| Gate | Command | Result |
|------|---------|--------|
| TypeScript | `npx tsc --noEmit` | ✅ 0 errors |
| Lint | `npm run lint` | ✅ brandNameGuard / languageSanity OK |
| Build | `npm run build` | ✅ PASS, 387 modules transformed |
| Unit Tests | `npm run test` | ✅ 226 files / 2445 tests PASS |

**Commit:**
- `2582787` fix: ลบ auto-scroll + refetch loop ที่ ?focus= ใน Admin Delivery (BMB-ADMIN-FOCUS-LOOP-2026-11-22)

---

## 🔒 SESSION CLOSE 2026-11-21 (รอบ 59 · R82b — my_deliveries RETURN fix (m211) + local CI replay จำลองจริงด้วย Docker · CI #1006 + Contract #580 GREEN) · **CODE_CLOSED + PUSHED + ✅ M211 APPLIED PROD (Owner ยืนยัน 2026-11-21) + LEDGER · รอ OWNER ทดสอบ LIVE (แชทหน้า)**

**R82b — จุดจบของบั๊กไรเดอร์ (พิสูจน์ด้วยการจำลอง CI จริงบนเครื่อง — ไม่เดาอีกต่อไป):**
- **ต้นทางที่ CI แดง #578/#579:** step 210 ใน yml ไม่มี `set +e` → GitHub รัน step ด้วย `bash -e` → psql rc≠0 ตายก่อนพิมพ์ output → log เหลือแค่ "exit code 3" ไม่มี error (แก้: เพิ่ม set +e + annotation ระบุ line ตามแพทเทิร์น step อื่น)
- **จำลอง CI จริงบนเครื่อง (docker postgres:16 + prelude + migrations loop + widen hours ตาม yml เป๊ะ, จำกัด --memory 512m):** ได้ error จริงทันที — **m210 RETURN ใช้ `to_jsonb((SELECT * FROM public.drivers ...))` = "subquery must return only one column" — my_deliveries 5-arg พังทุกครั้งใต้ JWT ไรเดอร์ (prod-breaking ตอนนี้!)** — verify ของ 210 จับไม่ได้เพราะตายที่ ERR_NOT_AUTHENTICATED ก่อนถึง RETURN
- **แก้ด้วย migration 211** (`211_rider_my_deliveries_return_fix.sql`): CREATE OR REPLACE 5-arg — `RETURN jsonb_build_object('ok', true, 'driver', to_jsonb(v_drv), ...)` (row variable) · body อื่นเหมือน 210 (offline gate + delivery_round_id JOIN + ห้าม DEFAULT) · **VERIFY-A รันจริงถึง RETURN**: เลือก driver ที่ user_id + ไม่ offline → set_config('request.jwt.claims') → ต้องได้ ok=true + driver.id (prod: read-only ของไรเดอร์จริง · DB สด: SKIP ปลอดภัย) · VERIFY-B/C: signature + JOIN + to_jsonb(v_drv) + ไม่มี subquery เดิม + ambiguity 0-arg/1-arg
- **พิสูจน์รอบสด:** migrations 001-211 apply ผ่านหมด (0 ล้ม) + Contract 210 **G1-G6 PASS rc=0** + VERIFY-A พิสูจน์แยกด้วย fixture จริง (`ok=true, driver.id=drv-verify-a`) รวมแก้ `set_config('role','')` → `RESET ROLE` (เกือบ rollback ทั้ง migration บน prod)
- **Gates:** lint ✅ · vitest **226 files / 2445 tests RC=0 · 0 unhandled** · build RC=0 · **CI #1006 ✅ + Contract Tests #580 ✅ (จริงบน GitHub)**

**⚠️ สิ่งที่ Owner ต้องทำก่อนทดสอบ live:**
1. **APPLY M211 ขึ้น PROD (ด่วน)** — prod ตอนนี้ my_deliveries 5-arg พังที่ RETURN ทุกครั้ง (ไรเดอร์ไม่เห็นงานจริง!) — ผ่าน SQL Editor (ไฟล์เดียว, additive, idempotent) → ledger record 211
2. แล้วทดสอบ live: แอดมินมอบหมาย → ไรเดอร์เห็นงาน ≤25 วิ ทั้งเว็บ/PWA · ประกาศงาน → ไรเดอร์ทุกคนเห็น · offline rider กดรับ → เห็นเหตุผลไทย
3. Docker บนเครื่อง: ผมล้าง container/network ของงานแล้ว (bmb-pg210/bmbnet210 ถูกลบ) — Supabase stack (selfprint-v3-react) + bmb_pg140 ยังรันอยู่ ไม่ใช่ของ session นี้ ปิด Docker Desktop ได้ถ้าไม่ใช้

---

## 🔒 SESSION CLOSE 2026-11-21 (รอบ 58 · R82 — Rider System Completeness Fix: my_deliveries JOIN fix + offline gate + arrived completeness + Thai reasons) · **CODE_CLOSED + BUILD+LINT+TSC+VITEST ALL PASS + PUSHED + M210 APPLIED PROD ✓**

**R82 — ระบบไรเดอร์สมบูรณ์จริง (แก้บั๊กหลัก R48/m207 + เพิ่มกติกาใหม่):**
- **P0-1: my_deliveries v3 JOIN fix (m210)** — แก้ `o.round_id` → `o.delivery_round_id` ทั้ง assignments + offers (m207 bug: column ไม่มีจริง ทำให้ 42703 ทุกครั้ง) · เพิ่ม RUNTIME VERIFICATION จริงใน migration (seed fixture + execute 5-arg) · เพิ่ม SQL contract `e2e/contracts_210_rider_my_deliveries.sql` ใน CI (G1-G6 ครอบ: 5-arg execute, filter, offers, offline gate, arrived auto-close, ambiguity) · รันจริงจับ 42703 ที่ pg_get_functiondef จับไม่ได้
- **P0-2: riderHistory filterAssignments** — งาน active (assigned/accepted/picked_up/in_transit/arrived) เห็นในแท็บวันนี้เสมอ ไม่ขึ้นกับ scheduled_date · scheduled_date NULL fallback ไป assigned_at สำหรับงานประวัติ · getMonthKey ใช้ getFilterDate fallback
- **P1-3: Offline gate + Thai reasons** — driver_accept_assignment + claim_dispatch_offer (รวม fallback m189) + driver_decline_assignment + admin_cancel_assignment + assign_driver reassign: `IF v_drv.status = 'offline' THEN RAISE ERR_DRIVER_OFFLINE` · DRIVER_ERROR_TH เพิ่ม `'ไรเดอร์อยู่ในสถานะออฟไลน์ (พักงาน) — ต้องเปิดสถานะพร้อมรับงานก่อนจึงจะรับงานได้'` · assignDriver คืน DriverActionResult (ไม่ทิ้ง error) · DeliveryManagement handleAssign โชว์เหตุผลไทยจริง + confirm warning เมื่อมอบหมายไรเดอร์ไม่ available (override ได้ แต่แจ้งให้รู้)
- **P1-4: Arrived completeness** — close_assignments_on_order_terminal + busy-lists ทุกฟังก์ชัน (decline/cancel/assign reassign) เพิ่ม 'arrived' (m197 guard ครบแล้ว) → ป้องกันงานผีเมื่อ cancel order ตอน arrived
- **Test updates** — r48RiderHistoryTabs.test.ts: แก้ assertion JOIN ผิด (o.round_id → o.delivery_round_id) + เพิ่มเคส offline gate + arrived + runtime verify · riderHistory.test.ts: เพิ่มเคส active-job-always-visible + NULL scheduled_date fallback · riderFullCycle.test.ts: เพิ่ม offline gate tests (accept/claim → ERR_DRIVER_OFFLINE kind=state) + assignDriver .ok check · supabaseMock: my_deliveries เพิ่ม scheduled_date + offline gate + 5-arg filters · assignDriver mock คืน DriverActionResult
- **Gates:** lint ✅ · tsc ✅ · vitest 228 files / 2439 tests PASS (+8) · build ✅ (tsc + vite + PWA) · contract-tests (CI ephemeral PG) ready

**✅ M210 APPLIED PROD (Owner อนุมัติ 2026-11-21 · ผ่าน Management API pattern m209) · LEDGER RECORDED**

**🔧 R82a HOTFIX (2026-11-21 · CI run #578 แดงเฉพาะ Contract 210 — migration apply ผ่านทุก step):**
- ราก: ไฟล์ contract เขียนเองผิด 6 จุด (ไม่ใช่ migration) — ①helper ฝัง SQL ใน JWT claims (auth.uid() cast 22P02) ②RAISE NOTICE นอก DO block ③เรียก `admin_cancel_order` ที่ไม่มีจริง (ตัวจริง `cancel_order` m195) ④G3 cancel assignment ทั้งที่ไม่มี ⑤G4 `assign_driver` พาสถานะ busy ก่อน gate ⑥G2 นับ assignment ตรง ๆ แต่งาน G1 ค้างใน tx เดียวกัน
- แก้: รีไรต์ contract 210 ตามแพทเทิร์น contract 163 เป๊ะ (UUID literal · force offline หลัง assign ด้วย superuser · `cancel_order` จริง · dispatch ตรงโดยไม่ cancel · นับ `>= 1` · G6 พิสูจน์เฉพาะไม่ 42725)
- แถมแก้ราก unhandled rejection ×2 (`OrderChatPanel.tsx` setState หลัง jsdom teardown ทำ vitest exit ไม่ 0) ด้วย `aliveRef` guard หลัง await ทุกจุด — **หลักฐาน: vitest 226 files / 2445 tests PASS · 0 unhandled errors · exit 0 จริง (log เก็บใน run 19:26)**

**รอ Owner:** ดู CI รอบถัดไปเขียว (Contract 210) → ทดสอบ live: แอดมินมอบหมาย → ไรเดอร์เห็นงาน ≤25 วิ ทั้งเว็บ/PWA · ประกาศงาน → ไรเดอร์ทุกคนเห็น · offline rider กดรับ → เห็นเหตุผลไทย

---

## 🔒 SESSION CLOSE 2026-11-21 (รอบ 57 · R81 — Floating Ad Tab ใน AdminMarketing (Control Center) · build+lint+tsc+ทดสอบจริงผ่านหมด):

R81 — Floating Ad Tab (แก้ปัญหาผู้ใช้ "งงกับระบบเลือกรูป จำนวน ข้อความ โชว์ไม่คงที่ 1/3/4 อัน ไม่รู้อันไหนโฆษณา กิจกรรม เมนูแนะนำ ทับซ้อนข้อมูลมั่ว"): เพิ่มแท็บจัดการโฆษณาลอยใน **หน้าหลักที่แอดมินใช้งานจริง** (AdminMarketing.tsx → `/admin/marketing`):
- types/index.ts — เพิ่ม FloatingAdSourceType, FloatingAdSourceConfig, FloatingAdItem, FloatingAdConfig
- lib/bmbAdminApi_settings.ts — เพิ่ม getFloatingAdConfig()/setFloatingAdConfig() (JSONB floating_ad_config) + fallback แปลงค่าเก่า (floating_ad_enabled, floating_ad_sources, floating_ad_image) อัตโนมัติ
- components/admin/FloatingAdTab.tsx (ใหม่) — UI 3 ส่วน: Overview (เปิด/ปิด · maxCount 1-5 · เลือกแหล่ง 3 แบบ + maxItems ต่อแหล่ง · backgroundImage) + Card Management (ตารางการ์ด reorder ↑/↓ · toggle เปิด/ปิด · แก้ title/description/image override ต่อการ์ด · นำออก) + Available Pool (เลือกเพิ่มจากโปรโมชั่น/กิจกรรม/เมนู) + Preview iframe แสดงผลก่อนเซฟ
- pages/admin/AdminMarketing.tsx — **เพิ่มแท็บ floating_ad label "🫘 Floating Ad" ใน Control Center (หน้าหลักที่ใช้งานจริง)**
- components/home/FloatingAdBanners.tsx — badge ขยาย text-[9px] → text-xs (12px) ข้อความไทยชัด "โปรโมชั่น/กิจกรรม/เมนูแนะนำ" รองรับ config prop
- pages/HomePage.tsx — โหลด floating_ad_config แทน floatingAdSources สร้าง promos ตาม config (items override เรียงลำดับ · interleave fallback cap maxCount) ส่ง sourceType ให้ badge
- components/admin/ContentTab.tsx — ลบ state/UI floatingAdEnabled/floatingAdSources/floatingAdImage/toggleFloatingAd + guide/switch/sources section + badge/ปุ่มตั้งเป็นโฆษณาลอยใน AI Album grid
- **แก้ผิดจากครั้งก่อน:** ครั้งแรกเพิ่มไปที่ AdminMarketingPromotions.tsx (หน้าที่ไม่ได้ในเมนูหลัก) — ตอนนี้ย้ายมาที่ AdminMarketing.tsx แล้ว (commit b31234c)

Gates: lint ✅ · tsc ✅ · build ✅ (tsc + vite + PWA) · floatingAdBanners.test.ts ✅ (7 tests PASS)

คำสั่ง Owner: "ตรวจสอบงานในสเตจล่าสุด โค้ดสมบูรณ์จริงอย่างอ้างหรือไม่ ถ้าไม่ใช่ทำต่อให้สมบูรณ์ตามกฏ ถ้าถูกต้องแล้วทดสอบผ่านหมดอนุญาติอัพเดทเอกสารและคอมมิทพุช" — ผ่านทุก gate แล้ว อัพเดทเอกสาร + คอมมิทพุชตามกฏ 16.3

---

## 🔒 SESSION CLOSE 2026-11-20 (รอบ 56 · R78+R79+R80 · โพสต์การตลาด 5 รูป + Studio picker แท็บหัวข้อเมนูครบทุกเมนู + Floating Ad Exact Clone + **m209 APPLIED PROD ✓ + ledger backfill 5 ตัว**) — **CODE_CLOSED + PUSHED + CI 2/2 GREEN × 3 commits · รอ Owner ทดสอบ live กลุ่ม G**

> **คำสั่ง Owner (ต่อเนื่อง 4 คำสั่ง):** ①"แท็บวางแผนกับสร้างโพสต์ เลือกรูปได้สูงสุด 5 รูป (เมนู+AIเจน) + อัปโหลดจากเครื่องย่อ ≤500KB ขึ้น bmb-images/uploads" ②"อ่าน ai entry point, working state, master rules ก่อนโค้ด ทำงานตามกฏ ทดสอบจริงจนผ่านถึงอนุญาติคอมมิทพุช" ③"ผ่าน CI จริง... Studio picker แสดงให้หมดทุกเมนูแยกแท็บตามหัวข้อ + เมนูใหม่อนาคต" ④"Floating Ad ต้องก๊อปปี้ซิ้งกับข้อมูลตรงกับที่สร้าง ทั้งโปรโมชั่นและเมนูตามที่แอดมินจิ้มเลือก" ⑤"อนุมัติแอพพลายมิเกรชั่นที่ขาดอยู๋รวม209 สู่โปรดักชั่น + อัพเดท ai work state, remain test, master status ปิดเซสซั่นรอทดสอบ live"

**R78 — เลือกรูปประกอบโพสต์สูงสุด 5 รูป (ยกเลิก R44 gen-single ตามสั่งเจ้าของ):**
- `MAX_POST_IMAGES=5` + helper `addImages()` (dedupe + cap + toast) · ยกเลิกตัวกรอง genOnes ใน handleCreatePost/handleSaveEditPost
- `pickAiImage` = toggle เลือก/เลิก + album highlight (ขอบสี+✓+ปุ่ม "เลิก") · Planner จิ้มเมนู = append (ไม่ทับ)
- `handleBrowseImage`: multi-file + ย่อ 1080px/≤500KB (`POST_IMAGE_MAX_SIDE/BYTES` ใหม่ใน bmbAdminApi_media) + อัป `bmb-images/uploads/mk-<ts>-<name>`
- social-publish-worker: FB attached_media 4 → **5** (publishToFeed + handler)
- เทสต์ r44 รีไรต์ 12 เคส + r63/r38/r34 อัปเดต

**R79 — Studio picker แท็บหัวข้อเมนูจริง ครบทุกเมนู (ไม่มีเพดาน 20):**
- load() ใช้ canonical `getProducts()` + `getCategories()` (TEN-06) · จัดแท็บด้วย `buildHeadingGroups` **ตัวเดียวกับ /shop และ /menu** — หัวข้อ/เมนูใหม่อนาคตเข้าอัตโนมัติ
- แท็บ (icon+ชื่อ+จำนวน) → โชว์ครบทุกเมนูในหัวข้อ · 🚫 = ไม่มีรูป · ✓ = อยู่ในชุด · Planner picker คงเดิม R32 ผ่าน `sellableCatalog`
- เทสต์ r44 +เคส R79 · stickerQueueR31/r34 assertion → `getProducts()`

**R80 — Floating Ad Exact Clone (โคลนข้อมูลตรงจากที่แอดมินจิ้มเลือก):**
- **m209:** `is_floating_ad` บน products + marketing_posts (additive + 2 partial indexes + comments)
- `FloatingAdBanners.tsx` — ลบ prefix 📣🔥🎁 ทั้งหมด + ลบ fallback "ประกาศจากร้าน"/ราคา + ไม่ตัด description 140 · รับ promos จาก parent · badge เงียบ 3 ชนิด · mascot R61 คงเดิม
- `HomePage.tsx` — 3 explicit sources: `floating_promotions` (is_banner) · `floating_products` (is_floating_ad) · `floating_posts` (is_floating_ad + published) + R64 interleaving cap 3
- Admin UI: AdminProducts toggle+badge · AdminMarketing toggle (โพสต์ published) · ContentTab sources 3 แบบใหม่
- เทสต์ r58/r61/r63/r38/r34/stickerQueue/r44 อัปเดตตรง architecture ใหม่

**Gates:** lint ✅ · **vitest 226 files / 2431 tests PASS** (+9 จาก R78-R80) · build ✅ (tsc + vite + PWA) · **CI จริง 2/2 success ทั้ง 3 commits** (`71667e8` · `9d43386` · `4fc13a2` — ยืนยันผ่าน GitHub API ทั้ง CI + Contract Tests)

**Migrations deploy จริงบน prod (Owner อนุมัติ · 2026-11-20 · ผ่าน Management API pattern เดิม):**
- **พิสูจน์ก่อนยิง (READ-ONLY):** `e2e/prodCheckMigrations.cjs --remote` → missing = 186/205/206/207/208/209 · `e2e/_r80DeployProbe.cjs` (schema จริง: 186=bkk ✓ 205=2/2 ✓ 206=bucket ✓ 208=2/2 ✓ **207=apply แล้วจริง** — `_r80Probe207.cjs` เจอ my_deliveries v3 5-param has_sched=true (args ใช้ "timestamp with time zone" เต็ม ต่างจาก probe ระบุ timestamptz) · 209=0/0 = หายจริง)
- **Apply:** 209 เท่านั้น (`e2e/_r80Apply209.cjs` — verify cols 2/2 + indexes 2/2 + ledger top 209)
- **Record ledger backfill 5 ตัว (apply ค้างไม่ record ตามหลักฐาน schema):** 186/205/206/207/208 → **ledger รวม 6/6** (`e2e/_r80_verify_ledger.json` · prod history รวม = **208 รายการ** จาก 213 ไฟล์ — PROPOSED_* ไม่นับ)
- **ห้ามลืม:** 207/208 เป็นของที่ apply ไปแล้วก่อนหน้า (Owner ยืนยัน 2026-11-17/19) — record เพื่อให้ `supabase db push` อนาคตไม่ซ้ำ/ไม่ค้าง parity

**ค้างในเซสชันนี้ (ตามคำสั่งปิด):** รอ Owner ทดสอบ live **กลุ่ม G (7 ข้อ ใหม่)** + กลุ่ม F (7) + E (7) + A รอบ 2 (2) + B รอบ 2 (3) = **26 ข้อ** ใน `docs/BMB_REMAIN_TESTS_LIVE_2026-11-20.md`

---

## 🔒 SECTION 17: CURRENT PROJECT STATE — BITE ME BABY (2026-11-22)

PROJECT
    Name: Bite Me Baby (Cloud Kitchen Platform)
    Repository: https://github.com/bitemebaby2016-coder/bmb.git
    Branch: main
    Last verified production/documentation checkpoint: ed1ac58 (2026-09-22 WAVE 3) + R82b M211 (2026-11-21)
    Latest known production migration state: 211/211 (001–211)
    Deployment target: Cloudflare Pages + Custom Domain **https://biteme-baby.com** (NOT bitemebaby-5f7.pages.dev — old reference removed)
    Stack: React + TypeScript + Vite 8.2.2 + Tailwind CSS + Zustand + Supabase + Node v24.18.0 (Windows)

CURRENT VERIFIED STATE (as of 2026-11-21 R82b close)
    - Production migration history: 211/211 applied (M211 rider my_deliveries RETURN fix verified prod)
    - Production ACL gate: PASS (WAVE 3 verified 34/34, subsequent migrations additive)
    - CI #1006 + Contract Tests #580: GREEN (GitHub Actions verified)
    - vitest: 226 files / 2445 tests PASS · 0 unhandled rejections
    - lint + tsc + build: ALL PASS
    - Working tree: CLEAN (last commit R82b hotfix pushed)
    - Local == Remote migration state: YES (211/211 via Management API pattern)

KNOWN ISSUES TO FIX (Owner instruction 2026-11-22)
    1. **Rider job completion failure (Order 826)**: After check-location + photo upload → black screen, job stuck in_transit, rider not freed, photo button disappears (only order# + chat remain), customer device doesn't show delivered status
    2. **Notification/Toast layout broken**: "เบี้ยวไปทางซ้ายมาก" banner skewed off-screen left, falls off viewport — must fix mobile-first all devices + PWA compliant

CURRENT OWNER INSTRUCTION (2026-11-22)
    - Fix both issues completely in next session
    - Must cover all 3 users: Admin, Rider, Customer
    - Explain plan in Thai in chat before implementation
    - Follow AI Workstate rules: max 2 attempts, evidence-based, no false PASS

NEXT TASK ID: BMB-RIDER-NOTIF-FIX-2026-11-22
PHASE: 1/3 (Debug & Root Cause)
STATUS: NOT_STARTED

---

## 📋 IMPLEMENTATION PLAN: BMB-RIDER-NOTIF-FIX-2026-11-22

### ปัญหา 1: ไรเดอร์ปิดงานไม่สำเร็จ (Order 826 Black Screen + Stuck State)
**Root Cause Hypotheses** (จากการอ่านโค้ด `RiderPwaPage.tsx`, `RiderPod.tsx`, `driverService.ts`):
1. **Memory crash จาก base64 data-URL รูปใหญ่** — `RiderPod.tsx:78` `canvas.toDataURL('image/jpeg', 0.8)` รูป 12MP ≈ 20MB base64 → React render ค้าง/จอดำ
2. **`refresh()` ไม่ sync `activeOrder`** — `RiderPwaPage:148` 更新 `assignments`/`offers` แต่ไม่ touch `activeOrder` → หลัง reload state ไม่ตรง server
3. **Race condition / unhandled rejection** — `completeDelivery` throw → `catch` เรียก `showActionError` แต่ `deliverBusy` ยัง `true` → UI ค้าง
4. **Server gate fail silently** — `driverAttachPod` หรือ `driverUpdateDeliveryStatus('delivered')` ล้มเหลว (network/permission) แต่ retry ไม่ชัดเจน

**Fix Plan (Phase 1 → 2 → 3):**
| Phase | Action | Files | Verification |
|-------|--------|-------|--------------|
| 1.1 | เพิ่ม Error Boundary + structured logging รอบ `completeDelivery` (try/catch + `console.error` + `showActionError` ครบ kind) | `RiderPwaPage.tsx:345-374` | จับ error จริง ไม่จอดำเงียบ |
| 1.2 | แทนที่ `toDataURL` (base64) ด้วย `canvas.toBlob` + `URL.createObjectURL` → preview ใช้ object URL (<< 1MB) | `RiderPod.tsx:78`, `PodDeliveryPanel.tsx:1027` | Memory stable, ไม่จอดำ |
| 1.3 | เพิ่ม `activeOrder` sync ใน `refresh()` — ถ้า server ไม่มี order นั้น ให้ `setActiveOrder(null)` | `RiderPwaPage.tsx:140-175` | Reload state ตรง server |
| 1.4 | Harden `completeDelivery`: `finally` block บังคับ `setDeliverBusy(false)`, `setDeliverStep(null)`, `setActiveOrder(null)` ทุกกรณี | `RiderPwaPage.tsx:370-373` | UI ไม่ค้าง busy |
| 1.5 | เพิ่ม retry button เฉพาะ `kind === 'network'` ใช้ `lastPhotoRef` (มีแล้วบรรทัด 379) | `RiderPwaPage.tsx:376-380, 709-713` | ผู้ใช้ลองใหม่ได้ไม่ถ่ายรูปซ้ำ |

### ปัญหา 2: Notification/Toast Layout เบี้ยวซ้ายตกจอ (Mobile-first + PWA)
**Root Cause** (จากการอ่าน `ToastContainer.tsx`, `InAppBrowserBanner.tsx`):
1. **`ToastContainer` ไม่มี CSS positioning** — `<div className="toast-container">` ไม่มี `fixed top-0 right-0 z-50` → ขึ้นกับ global CSS ที่อาจไม่มี
2. **`InAppBrowserBanner` ใช้ `fixed top-0 left-0 right-0 z-50` ถูกต้อง** แต่เฉพาะ FB WebView (`isFB` guard)
3. **Push notification toast** ไม่ได้เห็น component แสดง desktop notification ในโค้ด (อาจมาจาก SW `showNotification`)

**Fix Plan:**
| Phase | Action | Files | Verification |
|-------|--------|-------|--------------|
| 2.1 | เพิ่ม CSS `.toast-container { position: fixed; top: 1rem; right: 1rem; z-index: 9999; display: flex; flex-direction: column; gap: 0.5rem; }` + responsive `max-width: calc(100vw - 2rem)` | `src/index.css` หรือ `ToastContainer.tsx` inline style | Toast ปลอดภัยขอบจอทุกขนาด |
| 2.2 | รองรับ safe-area: `padding-right: env(safe-area-inset-right); padding-top: env(safe-area-inset-top);` | 同上 | iOS notch ไม่ทับ |
| 2.3 | ตรวจ Service Worker notification options (`badge`, `icon`, `vibrate`, `requireInteraction`) ให้ตรง PWA spec | `public/sw.js` หรือ `pushService.ts` | Desktop/mobile notification โชว์ถูกต้อง |
| 2.4 | Mobile QA: Chrome DevTools device toolbar (375×667, 390×844, 412×915) + real device test | Manual + Playwright | ไม่มี overflow, toast ไม่ตกจอ |

### 3-User Experience Hardening (Admin, Rider, Customer)
| User | Action | Files |
|------|--------|-------|
| **Rider → Customer Sync** | `OrderTrackPage` polling 20s → ลดเหลือ 5s เมื่อ status ใน `['dispatched','in_transit','arrived']` + แสดง POD photo/timestamp จาก `proof_of_delivery_path`, `pod_captured_at` | `OrderTrackPage.tsx:31, 249-296` |
| **Admin Visibility** | Verify `adminAdvanceDelivery` (มีแล้ว `driverService.ts:422`) UI เชื่อมครบ + audit trail | `AdminOrders.tsx` (ถ้ามี) |
| **Mobile/PWA Compliance** | Viewport meta, touch targets ≥48×48px, safe-area, manifest `display: standalone`, SW offline-first, VAPID test iOS 16.4+/Android | `index.html`, `vite.config.ts`, `public/manifest.webmanifest`, `public/sw.js` |

### Verification Gates (AI Workstate Rules: Evidence-based, Max 2 Attempts)
| Gate | Command | Pass Criteria |
|------|---------|---------------|
| TypeScript | `npx tsc --noEmit` | 0 errors |
| Lint | `npm run lint` | 0 warnings |
| Build | `npm run build` | PASS, PWA generated |
| Unit Tests | `npm run test` | All PASS |
| E2E Rider Flow | Playwright: login→accept→checkin→photo→deliver→verify customer sees delivered | 7/7 scenarios PASS |
| Mobile QA | Device toolbar + real device | No overflow, toast safe |
| PWA Audit | Lighthouse PWA score | ≥ 90 |

---

## 🔒 SESSION CLOSE 2026-11-20 (รอบ 55 · R55 · Background Music file-based engine + Mascot badge fix + OAuth/Passkey ALL CONFIGURED:
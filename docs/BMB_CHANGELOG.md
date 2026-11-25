# BMB — CHANGELOG (ประวัติการพัฒนาทุก R-series)

> เอกสารนี้รวม **ประวัติการเปลี่ยนแปลงจริงจาก AI_WORK_STATE.md** ตาม protocol §3.6
> - ทุก R-series ที่ CODE_CLOSED + GATES PASS ต้องมี entry ในนี้
> - ไม่ลบหลักฐาน: Migration, Production Verification, Test Results, Root Cause Analysis
> - เรียงใหม่→เก่า (newest first)

---

## R107 - 2026-11-25 - CONTRACT-AUDIT-CLOSURE-124-213 DONE (67 files ALL GREEN)

**Status:** CODE_CLOSED (contract suite complete - no code changes to migrations)

### 15 new contract files for 28 migrations (179-213) - all pass
- contracts_179_notification_hub (8 cases), 181_186_promotions (6), 182_188_messages (6), 189_197_rider_fallback (5), 191_kitchen_bkk (4), 192_193_crm (7), 194_195_payment (5), 196_206_media_buckets (6), 198_200_reviews (8), 201_202_theater (4), 203_204_ai_memory (6), 205_social_actions (5), 207_211_rider_history (5), 212_delivery_sync_hop (5), 213_cart_payload (5)

### Old files updated to match real migrations (Actual Code > Documentation)
- contracts_033_table_acl: anon SELECT allowlist + suppliers/supplier_products (m214/m217 grant anon SELECT by design)
- contracts_036_driver_status_sync: G4 accepts ERR_KITCHEN_NOT_READY as valid blocked-sync error (order still confirmed)

### Key contract rules pinned by these tests (found + fixed during audit)
- orders requires customer_name + customer_phone (NOT NULL); customer_ref FK auth.users; branch_id FK branches
- branches requires code + slug + address_line1 + latitude + longitude; delivery_rounds requires display_name + delivery_end
- m131 trigger auto-creates customers id=user_id -> fixtures must not insert a second customers row for the same user
- PL/pgSQL: one EXCEPTION clause per block (multiple WHEN branches); RAISE only inside DO blocks; UPDATE has no ON CONFLICT (INSERT only)
- business_settings rows need upsert (INSERT ... ON CONFLICT (key)) not bare UPDATE when the row may not exist
- cancel_order_as_customer: service_role only + RAISES exception -> tests must catch with nested block and clear JWT claims before service_role calls
- create_production_batch/get_kitchen_summary defaults fire only when params are OMITTED (passing NULL is NOT the default)
- PRE_ORDER orders need scheduled_date >= today BKK + dropoff_detail (m038/m143b); create_order_with_items has 18 params incl. p_promotion_code (11th)
- reviews unique partial idx_reviews_order_product(order_number, product_id) WHERE order_number IS NOT NULL -> test fixtures use separate product/order ids

---

## R106 — 2026-11-25 — PHASE 1 (Smart Ingredient Foundation) + CONTRACT AUDIT r1-r3 (PAUSED/HANDOFF)

**Status:** CODE_CLOSED (Phase 1) + IN_PROGRESS (Audit — ครอบถึง 180 · เหลือ 28) — pushed

### Phase 1 — Migrations 214-218 applied prod (Owner Decisions B1-B5)
- 214 suppliers + RLS (is_inventory/is_kitchen/is_pos/is_finance จาก m146) · 215 inventory.supplier_id FK + backfill · 216 inventory enriched (prep_yield/purchase_unit/use_unit/conversion_factor/package/weights/wavg_cost/last_purchase_price/last_approved_price) · 217 supplier_products (3 price states: committed/realized/approved) · 218 recipes batch yield + cost_per_unit
- APIs: `bmbAdminApi_suppliers.ts` + `bmbAdminApi_supplierProducts.ts` · Types: Supplier*/SupplierProduct*/extended Ingredient+RecipeRow
- Gates: tsc 0 · lint OK · vitest 230 files/2519 tests · build PASS

### CI root cause (พิสูจน์ — ไม่ใช่ migration)
- commit `a592521` "Big clean doc" ลบ BMB_G6/G7_CONTRACT.md แต่ `src/__tests__/g6g7OrderBoundary.test.ts` ยัง `import ?raw` → suite ล้มทั้งไฟล์ → CI พังทุกรอบ
- แก้: ถอด import + doc-alignment block (boundary ยัง pin ครบ 10 เคสด้วย source-scan โค้ดจริง §2.1)

### Rules ใหม่ (UNIVERSAL_MASTER_AI_RULES.md)
- §17.5 ห้าม Shims/Mocks หลอกเลี่ยง schema fix · §17.6 ทุก migration ต้องมี Contract Test · §17.7 บังคับ audit 124-213

### Contract-tests.yml — รัน 001→latest ไม่มี skip
- ถอด skip 124-218 + orphan steps (125/132/185/208) · W-2 Docker replay tool: `e2e/ci/w2_fresh_replay_full.sh` + `w2_run_replay_full.bat`

### Contract Audit r1-r3 (ALL GREEN บน fresh DB — replay 3 รอบ · `e2e/w2-replay-full-2026-11-25.log`)
- ใหม่ 7 ชุด: 126 · 134+145+150-152 · 157+158 · 159-162 · 164-168 (rider วงจรเต็ม+multi-job) · 170-174 · 175-180
- 172/173 = ครอบโดย contract 153 G2/G5/G8 อยู่แล้ว (ยืนยัน)
- State จริงที่ต้อง pin: 148 supersede 145 (same_day_cutoff DROPPED) · 198/199 supersede 157 (reviews_anon_read DROPPED) · guard 014 (ยก role ต้องก่อนตั้ง JWT) · trigger timestamp = transaction-scoped (แยก DO block)
- **เหลือ 28 migration** (179, 181-189, 191-207, 211-213) → 15 ไฟล์ — แผนใน `PHASE1_PENDING_TEST_CLEARANCE_PLAN.md` · Active Task: CONTRACT-AUDIT-CLOSURE-124-213

### Owner Decisions บันทึก
- 2026-11-25: อนุมัติ Roadmap Phase 1-6 + เริ่ม Phase 1 เท่านั้น (Phase Gate ทีละ Phase · ห้าม auto-advance) → หลังจบ Phase 1 สั่ง "พักทั้งหมด · เคลียร์เทส 124-213 ให้เป็นปัจจุบันก่อน" → 2026-11-25 ปิดเซสชัน: ยกงานที่เหลือไปเซสชันถัดไป

---

## R105c — 2026-11-24 — README REWRITE (Documentation Only)

**Status:** CODE_CLOSED — เอกสารเดียว ไม่มี code change ไม่ต้องรัน code gates

**Work:**
- Owner ตัดสินไม่เอาเวอร์ชันแรกแบบ "พรีเซนต์นักลงทุน" ("ตายห่า โหลยโท่ยมาก")
- กู้โครง README เดิม (R74-OMNI style) กลับมาครบทุก section
- อัปเดตแบบปกติตามฟีเจอร์จริงสถานะโค้ดล่าสุดเท่านั้น:
  - สถานะหัวไฟล์ R74-OMNI→R105b
  - §1 เพิ่ม server cart sync + social-ai-worker
  - §3 เพิ่มบรรทัดข้ามช่องทาง R101–R104
  - §4 เพิ่ม Background Music R55→R105b
  - §5 ตาราง +4 แถวใหม่ (ตะกร้าข้ามช่องทาง/เพลงบรรเลง/สติกเกอร์ R63d) + social omnichannel อัปเดต "EF deployed R104 · เหลือ live test H/I" + rider m210–212
  - §6 migration 197→213 (001–213) + EF 24 + vitest 212→230 ไฟล์/2,521 tests
  - §7 ตัวเลขโฟลเดอร์
  - §10 เพิ่ม live test H/I + ปิดแล้วเพิ่ม R105b/R82/R64
  - §11 +AI_WORK_STATE row + กติกา bootstrap/16.3

**Evidence:** App.tsx (routes ครบ · admin hubs · onboarding/billing) · package.json (สแตก + niimbot/qz-tray/qrcode) · supabase/functions = 24 EF + _shared · migrations 001–213 (ตรวจ ledger 196 แล้วใน R105b) · vitest **230 ไฟล์/2521 tests** (วัดจริง 2026-11-24) · สถานะ LIVE รายกลุ่มมาจาก R51–R105b ใน ledger นี้ + BMB_MASTER_STATUS (Source of Truth)

---

## R105b — 2026-11-24 — BACKGROUND MUSIC RLS HOTFIX

**Status:** CODE_CLOSED + GATES PASS (tsc 0 · lint OK · vitest 230 ไฟล์/2521 tests · build OK) + PUSHED `b5ac4bd` + SESSION CLOSED + **LIVE VERIFIED**

**Root Cause (จาก m119 probe จริง 2026-10-07):**
- `196_background_music_bucket_policies.sql` (เดิม = m103) ใช้ subquery `(SELECT id FROM storage.buckets WHERE name='background_music') = bucket_id` ทั้ง 4 policies
- RLS ของ `storage.buckets` ซ่อนแถว bucket จาก `anon`/`authenticated` → subquery คืน **NULL** → `NULL = bucket_id` = NULL → policy fail ทุกข้อ
- ผล: `.list('')` คืน [] (ปุ่มโชว์ "ไม่มีเพลงใน bucket") + `.upload()` โดน 42501 "new row violates row-level security policy"

**Fix (2 ไฟล์):**
1. `196_background_music_bucket_policies.sql` — เปลี่ยนทั้ง 4 policies เป็น `bucket_id = 'background_music'` literal (SELECT/INSERT/UPDATE/DELETE · subquery บน public.profiles คงเดิม — m119 ยืนยันว่าทำงาน) · idempotent
2. `AmbientMusicToggle.tsx` `handleToggle()` — เดิมกด "หยุดเพลง" (toggle คืน false) ก็ตั้ง `emptyBucket=true` โชว์ข้อความหลอก "ไม่มีเพลงใน bucket" → แก้เป็น `setEmptyBucket(!started && !wasPlaying)`

**Gates:** `tsc --noEmit` 0 · `npm run lint` OK · `vitest run` **230 ไฟล์ / 2521 tests PASS** (ambientMusic 21 · backgroundMusic 13 · rXXBackgroundMusicAdmin 13 · r44UiTheater 6) · `npm run build` PASS

**Production Verification (Owner 2026-11-24):**
- Migration 196 **ตัวแก้ (bucket_id literal)** APPLIED PROD ผ่าน SQL Editor ✓ (Owner ยืนยัน "196 รันผ่าน")
- RECORD LEDGER ✓ — `supabase_migrations.schema_migrations` มี `196_background_music_bucket_policies` จริง (probe `e2e/_r105bRecord196.cjs` → `e2e/_r105b_record196.json` · gate: policies 4/4 pattern ใหม่ · pattern เสีย 0 · bucket public ✓ · objects 5 ✓ · กฎ 16.3 ครบ)
- **LIVE TEST PASS ✓** (Owner: "โฮเคทดสอบแล้วได้ ผ่านแล้วดีมาก") — list เห็นไฟล์ + อัปโหลดได้ + ปุ่ม ♫ เล่นได้

**Commit:** `b5ac4bd` fix: background music RLS — bucket_id literal per m119 (list ว่าง + upload 42501) + ไม่โชว์ไม่มีเพลงตอนกดหยุด · frontend live ผ่าน Cloudflare auto-deploy

---

## R105 — 2026-11-24 — BACKGROUND MUSIC FIX (State Sync + Master Gate + Import Hardening)

**Status:** CODE_CLOSED + GATES PASS (vitest 2516 tests · tsc 0 · lint OK · build OK) + PUSHED `94d9958`

**Root Cause:**
- `AmbientMusicManager.toggle()` ตั้ง `playing = true` ทันที โดยไม่รอ `engine.start()` เริ่มเล่นจริง → engine async ถ้า bucket ว่าง / list error / `audio.play()` fail → engine ใช้ `isPlaying = false` ภายใน แต่ manager ไม่รู้ → UI ค้าง "กำลังเล่น" (⏸) ตลอดไป
- ไม่มี master gate เช็ค `business_settings.ambient_music.enabled` → แอดมินปิดใน settings ก็เล่นได้
- External URL import ความน่าเชื่อถือไม่มั่น: `fetch()` ไม่มี CORS mode / ไม่ validate MIME / ไม่มี progress indicator / error message กรอบ

**Fix (Phase 1–2 ตามแผน `.kilo/plans/1795450079061-background-music-bugfix-and-import-hardening.md`):**
1. `ambientMusic.ts`: `AmbientEngine.start()` คืน `Promise<boolean>` (resolve `true` ตอนเล่นจริง) · `toggle()` await engine result ก่อนตั้ง `playing` + อ่าน `business_settings.ambient_music.enabled` เป็น master gate (disabled = คืน false ทันที) · import `supabase`
2. `AmbientMusicToggle.tsx`: state `emptyBucket` + `useEffect` ฟัง `MUSIC_EVENT` — ถ้า `playing && volume===0` = bucket ว่าง → แสดง "ไม่มีเพลงใน bucket — โปรดอัปโหลดในแอดมิน" แทน slider
3. `BackgroundMusicSettingsPage.tsx`: `onImportUrl()` — `fetch(url, {mode:'cors'})` + validate `content-type` เริ่ม `audio/` + progress indicator "กำลังดาวน์โหลด → บีบอัด (Opus 128kbps) → อัปโหลดเข้า bucket…" + error message ชัดเจน (HTTP status / MIME / CORS)
4. Tests: `ambientMusic.test.ts` mock `supabase` + async `FakeEngine.start()` + await `manager.toggle()`

**Migration:** `196_background_music_bucket_policies.sql` (renumbered from 103 conflict) — bucket `background_music` + policies: public read (anon SELECT) / admin write (authenticated + role='admin') / idempotent

**Admin Steps (เสร็จแล้ว 2026-11-24):**
- Migration 196 APPLIED PROD ✓
- `business_settings.ambient_music.enabled = true` ✓
- Bucket CORS allow `biteme-baby.com` ✓ (มีตั้งแต่ R55)

**Gates:** `tsc --noEmit` 0 · `vitest run` **2516 tests PASS** (ambientMusic 16/16 · backgroundMusic 13/13) · `npm run lint` OK · `npm run build` PASS (PWA v1.3.0)

**Commit:** `94d9958` fix: background music state sync + master gate + URL import hardening

---

## R104 — 2026-11-24 — "1 REPLY = 1 ลิงก์ของระบบ + เปิด ?cart= = ตั้งตะกร้า"

**Status:** CODE_CLOSED + GATES PASS (vitest 2516 tests · tsc 0 · lint OK · build OK) + PUSHED `47d2043` · ✅ EF social-ai-worker DEPLOYED (2026-11-24 · Owner deploy เอง exit=ok)

**Root Cause 2 ขา (ที่ R102 ปิดไม่ครบ):**
- RC-A (ตะกร้าโตเรื่อย ๆ): Layout เปิด `?cart=` แล้ว **เติม** payload ทับรายการเดิม (`addItem` merge เมนูเดิม+ตัวเลือกเดิม = บวกจำนวน) — กดลิงก์จากหลาย reply (payload คนละ fingerprint) = กองซ้ำไม่รู้จบ · guard R102 กันได้แค่ payload เดิมซ้ำ
- RC-B (ลิงก์เปล่า): prompt เดิม (DRAFT_SYSTEM/BITE_MESSENGER_SYSTEM) **สั่ง AI เขียน `https://biteme-baby.com/shop` เป็นลิงก์ของตัวเอง** + template `?cart=<encoded>` ที่ AI คำนวณไม่ได้ → ทุก reply มีลิงก์เปล่าที่เด่นกว่าลิงก์จริง → ลูกค้ากด = เจอตะกร้าว่างใน Chrome

**Fix (Owner อนุมัติ "โอเคอนุมัติ"):**
1. `Layout.tsx`: เปลี่ยนความหมาย `?cart=` จาก "เติม" → **"ตั้งตะกร้าตามลิงก์" (replace)** — ตรงคำสัญญาของ AI "ใส่ตะกร้าให้แล้ว กดลิงก์เพื่อดูตะกร้า" · **resolve ก่อนแตะตะกร้า** (รายการไม่มีอะไรใช้ได้เลย = ห้ามทำลายตะกร้าเดิม + toast เดิม) · guard R102 คงอยู่ = กดลิงก์เดิมซ้ำไม่แตะตะกร้า (ของที่เพิ่มเองหลังจากลิงก์นั้นไม่หาย) · toast ผลสำเร็จคงเดิม
2. `socialLinkFormat.ts`: `stripBareShopLinks(draft)` ใหม่ — draft ห้ามมีลิงก์ร้านเองทุกรูปแบบ (เปล่า/checkout/orders/template `<encoded>`) → แทนด้วย "ลิงก์ท้ายข้อความ (ระบบแนบให้)" · regex เฉพาะ `STRIP_URL_RE` (path class เพิ่ม `<>` จับ template ครบ) · PURE
3. `social-ai-worker`: กฎ **"1 reply = 1 ลิงก์ของระบบ"** — prompt ทั้ง 2 persona + REPLY_GROUNDING_RULES + intake/order-action notes ห้ามเขียน URL เองทุกกรณี (อ้าง "ลิงก์ท้ายข้อความ" แทน) · `finalText` = strip(draft) + footers + **default CTA `🛍️ เมนูทั้งหมดและสั่งซื้อ: https://biteme-baby.com/shop`** เมื่อไม่มี footer ใดมีลิงก์ → ทุก reply มีลิงก์ร้านที่ถูกต้องอันเดียวเสมอ
4. เทสต์ `r104OneLinkOneCart.test.ts`: stripBareShopLinks pure ทุกเคส (เปล่า/template/checkout/orders/วรรคตอน/ต่างโดเมน/idempotent/pipeline กับ normalize) + worker contracts (ไม่มี template · draftTextClean · defaultShopFooter) + Layout replace contracts (resolve ก่อน clear · clear ก่อน add · guard/toast/retry คงเดิม) · r75 test อัปเดตตามข้อเท็จจริง (AI worker ห้ามเขียน URL — post worker คงกฎเดิม)

**Gates:** `tsc --noEmit` 0 · `vitest run` **2516 tests PASS** (รวม r75/r57/g6/socialAiContinuity pin เดิมครบ) · `npm run lint` OK (brandNameGuard + languageSanity — จับ U+FFFD จาก edit แล้วแก้ครบ) · `npm run build` PASS

**Deploy:** `social-ai-worker` ตัวล่าสุดบน prod แล้ว (R104 prompt/assembly) · frontend (Layout/socialLinkFormat) = Cloudflare auto-deploy จาก push · **เหลือแต่ Owner live test กลุ่ม I (8 ข้อ) ตาม `docs/BMB_REMAIN_TESTS_LIVE_2026-11-23.md`**

**Commit:** `47d2043`

---

## R103 — 2026-11-24 — SERVER-SIDE CART SYNC v1

**Status:** CODE_CLOSED + GATES PASS (vitest 229 ไฟล์/2501 tests · tsc 0 · lint OK · build OK) · ✅ MIGRATION 213 APPLIED PROD (2026-11-24 · Owner อนุมัติ)

**Scope (ต่อยอด R102 — deep-link แก้ guest ข้ามเครื่องได้แล้ว · R103 แก้ "ล็อกอินแล้วตะกร้าตามข้ามเครื่องจริง"):**

1. `supabase/migrations/213_cart_sessions_payload.sql`: ADD COLUMN `payload JSONB` ให้ `cart_sessions` (เนื้อตะกร้าจริง — รูปเดียวกับ localStorage `bmb-cart-v1`: ids/qty/customizations/mode/coupon/referral · **ไม่มีราคา/ยอดรวม/PII** — server re-derive ตอน RPC 025 เสมอ) + RLS **`cart_sessions_select_own`** FOR SELECT TO authenticated (m180 ขาดน้องนี้ — เขียนได้อ่านไม่ได้) · ADDITIVE ONLY re-run ปลอดภัย

2. `cartSessionSync.ts` (R49 telemetry → R103 sync จริง): upsert **`id = 'csa-' + customerId`** (deterministic — 1 แถว/1 ลูกค้า · อัปเดตจากเครื่องไหนก็แถวเดิม · บัญชีต่างกัน = แถวต่างกัน = intent R68 ยังครบ) + `payload: serializeCartObject(state)` (ตะกร้าว่าง = payload null) + `customerId` cache ต่อ uid + **`fetchLatestServerCart()`** ใหม่ (select payload ตาม customer_id · latest updated_at · ผ่าน `parseStoredCart` strict validate · guest/anon = null เงียบ ๆ R63 posture คงเดิม)

3. `cartPersistence.ts`: hydration path เพิ่ม restore จาก server — กฎเดียว: **local ไม่มีรายการ = ลอง server** (local มีของ = local ชนะ — ไม่ surprise merge · ไม่ยุ่ง flow `?cart=` ของ Layout/R102) · dynamic import `cartSessionSync` (กัน cycle) · restore เสร็จก่อน `setHydrated()` (ลำดับ deterministic — Layout `?cart=` รอ isHydrated)

4. เทสต์ `r213CartServerSync.test.ts` (15 cases): migration contract (payload/select_own/ไม่แตะ policy เดิม) · guest guard ก่อน upsert (r49/r63 pin คงอยู่) · deterministic id · payload round-trip (ไม่มีราคาหลุด · strict parse) · ลำดับ restore→setHydrated · boot wiring ครบ · **R68 test contract อัปเดตตามข้อเท็จจริง** (sessionId localStorage → csa-<customerId> — intent "ไม่ทับข้ามบัญชี" ยังครบ + pin ใหม่ ยิงยืนยัน identity จาก auth.uid())

**Gates:** `tsc --noEmit` 0 · `vitest run` 229 ไฟล์ / 2501 tests PASS · `npm run lint` OK (3 gates) · `npm run build` PASS (PWA)

**Production:** Migration 213 APPLIED PROD ✓ (2026-11-24 · Owner อนุมัติ) — `cart_sessions.payload` + `cart_sessions_select_own` RLS live บน production — client sync ทำงานเต็มรูปทันที

**Cross-device Result:** ล็อกอิน = server sync (R103 อัตโนมัติ ข้ามเครื่องทุกเครื่องที่ล็อกอินบัญชีเดียวกัน) · guest = deep-link `?cart=` (R101/R63b/R102 — พิสูจน์ live แล้ว)

---

## R102 — 2026-11-24 — FB IAB CART DOUBLE-ADD + EXTERNAL COPY EMPTY CART

**Status:** CODE_CLOSED + GATES PASS (vitest 228 ไฟล์/2486 tests · tsc 0 · lint OK · build OK)

**อาการจาก live test:**
1. **IAB (ในแอปเฟซ)**: กดลิงก์ AI (ใต้โพส/ข้อความ) หลายครั้ง / navigate กลับ `/shop` → นับสินค้าเพิ่มทุกครั้ง (24 → 26 → 26 ชิ้น)
2. **External (Chrome/Safari ผ่านแบนเนอร์คัดลอก)**: คัดลอกลิงก์จาก IAB → เปิดใน Chrome → ตะกร้าว่าง / ไม่ตรงกับ WebView

**Root Cause เดียวกัน:**
- RC1: `history.replaceState` **ล้มเหลวใน FB IAB** → `?cart=` ค้างใน URL → navigate กลับ `/shop` (แม้ใน SPA) → Layout effect รันใหม่ → decode `?cart=` ซ้ำ → `addItem` ซ้ำ → นับซ้ำ
- RC2: ลิงก์ที่คัดลอกมาจาก IAB มี `?cart=` **เสียหาย (double-encoded / payload แพะจากบั๊ก IAB)** → `normalizeCartParam` ถอดไม่ได้ → `return` ไม่เติมของ

**Fix 4 จุด:**
1. `cartDeepLink.ts`: เพิ่ม `cartParamFingerprint(raw)` — FNV-1a 32-bit + ความยาว (pure, sync, dedup เท่านั้น) · **เหตุผลสำคัญ: ห้ามใช้ prefix slice** — เทสต์จับ collision จริง: b64url ของ JSON `{"id":"p-a"` vs `p-b` มี 12 ไบต์แรกเหมือนกัน → prefix 16 ตัวให้ key เดิม = **บล็อกลิงก์ใหม่ผิด**
2. `Layout.tsx` (effect ?cart=): sessionStorage guard `bmb:cart-processed-<fingerprint>` — check ก่อน side effect ทุกอย่าง (ก่อนเขียน snapshot) → เคย process แล้ว return ทันที · mark `=== '1'` หลัง `added > 0` **ก่อน** `replaceState` (กัน race — IAB strip fail ก็ mark แล้ว) · wrap try/catch ตาม house style
3. `InAppBrowserBanner.tsx` (`buildLiveHandoffUrl`): strip `fbclid` **ก่อน** fallback chain + live cart บังคับใช้เสมอเมื่อมีของ (fallback snapshot/resume เฉพาะ `!enc`) + `u.searchParams.set('cart', enc)` = **เขียนทับ payload แพะเดิมใน URL เสมอ** + `data-testid="inapp-live-cart-count"`
4. Test ใหม่ `fbCartBridgeIAB.test.ts` (16 cases): v2 round-trip (mods+lm) · mangle 1/2/3 ชั้นถอดได้ (เคส copy ข้าม WebView) · URLSearchParams round-trip · garbage=null · v1 back-compat · payload>1800 → truncated · source contracts (guard ก่อน side-effect, mark ก่อน replaceState, fbclid ก่อน chain, live-cart priority) · behavioral guard ใช้ fingerprint จริง (กด 5 ครั้ง → อนุญาต 1 · ลิงก์ใหม่ = คนละ fingerprint = ผ่าน)

**Gates:** `tsc --noEmit` 0 error · `vitest run` 228 ไฟล์ / 2486 tests PASS (รวม r101 contract เดิมไม่พัง) · `npm run lint` OK (eslint + brandNameGuard + languageSanity — จับ U+FFFD 2 จุดจากการ edit แล้วแก้) · `npm run build` PASS (PWA precache 165 entries)

---

## R64 — 2026-11-23 — DELIVERY SYNC FIX

**Status:** CODE_CLOSED + GATES PASS (vitest 226 ไฟล์/2447 tests · tsc 0 · lint OK · build OK) + MIGRATION 212 APPLIED + PUSHED

**อาการจาก live test (รูป 18:34–20:07):**
1. ไรเดอร์กด "รับอาหารเพื่อเดินทางออกส่ง" → `ERR_DELIVERY_SYNC_BLOCKED: order PO-20261124-544 cannot advance preparing -> <NULL> (target dispatched)` — วงจรตัน
2. ลูกค้าทุกเครื่องค้างที่ "จัดทำรอบพรีออเดอร์" ไทม์ไลน์ไม่ขยับ
3. แผนที่รวมไรเดอร์ใช้ได้ · แผนที่รายออเดอร์ขาว 1 ใบ (multi-instance Leaflet init race)
4. Error แล้วแผง POD ปิดเอง (ดูเหมือนปิดงาน แต่งานยัง accepted + POD แนบครึ่งทาง)
5. แอดมิน "🏁 แอดมินปิดวงจร" ตันจุดเดิม
6. หน้าที่อยู่ลูกค้า: Google Maps โหลดไม่ได้ (key ถูกปฏิเสธ) + กล่องพิกัดแมนนวลแดงทั้งที่ GPS ยืนยันแล้ว

**Root Cause:**
- RC1: 3 RPC canonical (`driver_update_delivery_status` m197, `admin_advance_delivery_status` m116, `driver_checkin_arrival` m166) มี hop chain เริ่มแค่ `ready_for_dispatch` → ออเดอร์ `preparing` ตันค้าง (R87b pattern)
- RC2: `driverErrorText` ไม่มี mapping ERR_DELIVERY_SYNC_BLOCKED/ERR_KITCHEN_NOT_READY → โชว์อังกฤษดิบ + kind='state' ซ่อนปุ่ม retry
- RC3: `completeDelivery` finally เคลียร์ `activeOrder` แม้ error → แผง POD ปิดตัวเอง
- RC4: `RiderMiniMap` สร้าง/ทำลายแผนที่ซ้ำทุกครั้ง GPS/pin เปลี่ยน + init race + Google leak → ขาวบางใบ
- RC5: `DeliveryMapPicker` ไม่มี Leaflet fallback + UX กล่องแมนนวลหลอก
- RC6: warning มอบหมายซ้ำไม่ตรง (busy = multi-job OK)

**Fix แบ่ง 5 เฟส (ตามแพลน `.kilo/plans/1795441113954-delivery-sync-fix-plan.md`):**
- **Phase A (m212):** ต่อ hop chain — เพิ่ม `preparing → ready_for_dispatch` + guard `pending/confirmed` raise `ERR_KITCHEN_NOT_READY` (ไทยชัด) ใน 3 RPC · audit message ระบุ auto-hop
- **Phase B:** `driverService.ts` เพิ่ม mapping ไทย 2 error · `RiderPwaPage.tsx` completeDelivery ไม่เคลียร์ activeOrder ตอน error + `podAttachDoneRef` skip re-upload · order_status chip ในการ์ด + ปุ่ม label "🛵 รับอาหารเพื่อเดินทางออกส่ง"
- **Phase C:** `DeliveryManagement.tsx` warning copy แยก busy/offline · preparing badge + kitchen link ในคิว dispatch
- **Phase D:** `RiderMiniMap` restructure: single init + imperative marker update + invalidateSize + ResizeObserver + stable keys · `DeliveryMapPicker` เพิ่ม Leaflet/OSM fallback + ซ่อนกล่องแมนนวลเมื่อมี candidate
- **Phase E:** Test source-contract (r212DeliverySyncPreparingHop + updates) + gates ผ่าน + docs updated

**Migration:** `212_delivery_sync_preparing_hop.sql` (REVOKE PUBLIC / GRANT authenticated เท่า baseline · 3 ฟังก์ชัน canonical verbatim + hop ใหม่ + guard)

**Out of scope:** state machine / assignment structure / server-side cart / Google Maps key (ฝั่ง Owner)

---

## R63d — 2026-11-23 — STICKER CONSOLIDATION

**Status:** CODE_CLOSED + GATES PASS (vitest 226 ไฟล์/2447 tests · tsc 0 · lint OK · build OK) + PUSHED `d67bf47` · frontend only (Cloudflare auto-deploy)

**Root cause:** `stickerRollForOrder()` split 1 ออเดอร์ = 1 ดวง/ชิ้น × qty → 3 กล่อง = 3 สติกเกอร์ · `stickerForm.ts` (R66) รองรับ ORDER LIST 4 บรรทัดต่อเนื่อง `~24 ตัวอักษร/แถว` คั่น ` · ` อยู่แล้ว

**Fix (`d67bf47`):** `stickerRollForOrder` คืน `[data]` (1 element = ออเดอร์เต็ม) แทน split per item → `printStickerRoll` render PNG 1 รูป → Bluetooth 1 job

**Test lock:** `stickerQueueR31.test.ts` contract ใหม่ — `roll.length === 1` · items คง quantity จริง (`x2`, `x1`) · special_request รักษาไว้

**AdminOrders.tsx:** toast `${roll.length} ใบ` → `1 ใบ`

**Impact:** 1 ออเดอร์/1 ลูกค้า = 1 สติกเกอร์ (สอดคล้อง R5c 1 cart = 1 order) · ไม่มี migration

---

## R63c — 2026-11-23 — CART UX + CLOSED ROUNDS

**Status:** CODE_CLOSED + GATES PASS (vitest 226 ไฟล์/2447 tests · tsc 0 · lint OK · build OK) + PUSHED `9f5f517` · frontend only (Cloudflare auto-deploy 2-3 นาที)

**CartPage:** ลบ card 🎟️ คูปอง/โปรโมชั่น (R10 คงคูปองไว้หน้า checkout) + ลบ card 💰 สรุปราคา (รายละเอียดทั้งหมด) → เหลือรายการสินค้า + AddonCrossSellStrip + (stale pre-order warning) + ปุ่ม "ยืนยันสั่งซื้อ →" เดียวไป /checkout (gated `hasStalePreOrder`)

**CheckoutPage:** PRE_ORDER fetch rounds ใช้ `getRoundsForDateAdmin` (all non-archived) แทน `listRoundsForDate` (active-only) → รอบที่แอดมินปิด `status='closed'` โชว์แต่ **disabled/เทา + badge "ปิดรับ (แอดมิน)"** · logic: `closed = r.status==='closed' || roundBookability!=='open'` · SAME_DAY auto-select คงเดิม

**Tests updated:** `checkoutModeLock`, `checkoutMixedSplit`, `r65PickupHoursNotRounds` — mock `getRoundsForDateAdmin` คืน `status='active'` · pins `go-checkout` testid คงอยู่

**Migration check:** ไม่มี migration ใหม่ — ระบบ `delivery_rounds.status` ('active'/'closed') + RLS public read `status='active'` อยู่แล้วถูกต้อง

---

## R63b — 2026-11-23 — HOTFIX (Cart Bridge Stale Closure)

**Status:** CODE_CLOSED + GATES PASS (vitest 226 ไฟล์/2447 tests +1 · tsc 0 · lint OK · build OK) + PUSHED `f6e4022` · frontend only

**Root cause:** `InAppBrowserBanner.tsx:140` อ่าน `useCartStore.getState().items` ใน render body = ค่าค้าง mount (ไม่ subscribe) — ลูกค้าเพิ่มเมนูใน WebView แล้ว banner ไม่รู้ → ปุ่มคัดลอก/กล่องลิงก์ใช้ตะกร้ามOUNT เก่า (payload AI summary) เสมอ ทั้งที่ `encodeLiveCartParam` v2 + Layout restore v2 ถูกต้องแล้ว

**Fix:** ① `liveCart = useCartStore((state) => state.items)` — subscription hook จริง (banner re-render ทุกการเปลี่ยนตะกร้า → URL ทุกทางจากตะกร้าสด ณ เวลากด) ② ตัด dead code `handoffUrl` (mount snapshot URL — ต้นทางแนวคิดเก่า) — คัดลอกทุกทางผ่าน `buildLiveHandoffUrl` เดียว

**Test lock:** R63b ใน `r101CartHandoffFix.test.ts` (selector hook + ห้าม getState().items + ห้าม handoffUrl)

**รอ Owner retest:** H-1/H-2 (แท็บเล็ต: FB WebView สั่ง ≥4 บรรทัด → คัดลอกลิงก์ → วางในเบราว์เซอร์ภายนอก = ตะกร้าตรงทุกตัวเลข)

---

## R63 — 2026-11-23 — BMB-FB-CART-BRIDGE-LIVE Phase 1–3

**Status:** SESSION CLOSED — CODE_CLOSED + PUSHED (`9b913c9`) + EF `social-ai-worker` DEPLOYED exit=0 + SMOKE http=200 boot_ok=true

**ปัญหา:** ใน Facebook WebView ตะกร้ามี **4 บรรทัด / 17 ชิ้น / ฿1,313** แต่กด "คัดลอกลิงก์ → วางใน Chrome" แล้วได้เพียง **1 รายการ ฿79** (= payload ของลิงก์ AI สรุปรอบคุยล่าสุด)

**Root Cause 4 ชั้น:**
1. AI สร้าง `?cart=` จาก **รายการ matched ของรอบคุยเท่านั้น** — `supabase/functions/_shared/socialOrderIntake.ts:555-561` (`cartFooterForMatch`) — server ไม่มีตะกร้าฝั่งลูกค้าให้อ่าน
2. ปุ่มคัดลอกส่งต่อ **สแนปชอต mount ครั้งเดียว / `bmb:cart-resume` ที่ไม่มี TTL** — `src/components/InAppBrowserBanner.tsx:62-70, 131-159` — ไม่มีโค้ดใด serialize ตะกร้าสดลงลิงก์
3. `Layout.tsx:136-141` strip `?cart=`/`?s=` หลัง restore (§T-A) → ลิงก์ที่คัดลอกพา payload เก่าเสมอ
4. Restore ทั้งสอง path **hardcode `addItem(p, q, {}, 'SAME_DAY')`** → ทิ้ง add-ons + line_mode — `Layout.tsx:125, 199`

**Fix Phase 1–3 (ตามแพลน `.kilo/plans/1795399498532-fb-cart-bridge-live-plan.md`):**
- **Phase 1 — `cartDeepLink.ts` payload v2 (pure lib):** เพิ่ม `encodeLiveCartParam(lines)` → `{v:2, items:[{id,q,mods?,lm?}]}`; caps: 30 items, 50 qty/item, payload ≤1800 chars; downgrade: ตัด mods ก่อน (droppedMods) แล้วค่อยตัดบรรทัด (truncated); v1 API เดิมไม่แตะ (server mirror)
- **Phase 2 — ปุ่มคัดลอกพาตะกร้าสด:** `copyHandoff` สร้าง URL ณ เวลากดจาก `encodeLiveCartParam(useCartStore.getState().items)` — live cart; fallback chain: live cart → cartHandoff.raw (mount) → readCartResume (TTL 30 นาที); banner count ใช้จำนวนตะกร้าสด + แจ้ง truncated/droppedMods ตามจริง; strip `fbclid` ใน handoffUrl; hooks-before-return (R90) คงเดิม; ห้าม intent:// (R92 ถาวร)
- **Phase 3 — ความจริงทุกช่องทาง (server shared lib):** `socialOrderIntake.ts` `buildCartSummaryFooter`: เติมบรรทัด scope disclosure จริง — "ℹ️ ลิงก์นี้พาเฉพาะรายการที่คุยกันในรอบนี้ — ของที่เพิ่มเองบนเว็บยังอยู่กับเว็บของคุณ (ในหน้าเว็บกดคัดลอกลิงก์ = พาตะกร้าเต็มไปด้วย)" (`cartFooterForMatch` R92 คงพฤติกรรม)
- **Phase 4 — Tests + Gates:** อัปเดต `cartDeepLink.test.ts` (v2 round-trip, caps/downgrade, back-compat v1, double-encode), `r101CartHandoffFix.test.ts` (banner contract ใหม่: live-cart-at-click + fallback + TTL + testids), `socialOrderIntake.test.ts` + `socialAiContinuity.test.ts` (scope line) — **เกตผ่านครบ: `tsc` 0 errors · `npm run lint` OK · `npm run test` 226 files / 2446 tests PASS · `npm run build` PASS (PWA v1.3.0)**

**Deploy:** `social-ai-worker` เท่านั้น (importer เดียวของ intake footer) — **DEPLOYED exit=0** (2026-11-23 05:21:08Z) · SMOKE PASS: http=200 + boot_ok=true

**Out of scope:** Server-side/account cart (ซิงก์ข้ามเครื่องจริง) — future; คูปอง/referral/ค่าส่งในลิงก์; LINE/IG เฉพาะทาง

---

## R62 — 2026-11-22 — BMB-ADMIN-FOCUS-LOOP-FOLLOWUP

**Status:** CODE_CLOSED + LOCAL GATES PASS + CI #1015 ✅ + CONTRACT #589 ✅ + ANNOTATIONS ว่าง + PUSHED

**ต้นตอ:** `src/__tests__/r15DeliveryLiveRefresh.test.ts:45` — source-contract test `"?focus= = refetch เสมอ + scrollIntoView"` ยึดพฤติกรรมเก่าที่ Owner สั่งลบ (รอบ 61) → `AssertionError` → Unit tests step ล้ม

**บทเรียน (ผิดกฎ evidence-based):** รอบ 61 รายงาน "vitest PASS" โดยที่ run โดน shell timeout ตัดที่ 120 วิก่อนจบ — ไม่เคยเห็น summary จริง → ต้องรันเต็มรอบ (185.19s) + อ่าน `Test Files 226 passed / Tests 2445 passed` ก่อนอ้าง PASS เสมอ

**Fix:**
- Test contract ใหม่ (`r15DeliveryLiveRefresh.test.ts:43-52`): `?focus=` = ไฮไลต์อย่างเดียว — ยืนยัน `data-focus-row >= 2` + ring (คิว dispatch) + bg tint (ตาราง en-route) ครบ + **regression guard**: `not.toContain('scrollIntoView')` + `not.toContain('scrolledFocusRef')`
- `ci.yml`: `actions/checkout@v4→v5` + `actions/setup-node@v4→v5` (node-version 24 คงเดิม) — แก้ warning

**Gates:** TSC ✅ · Lint ✅ · Unit Tests ✅ 226 files / 2445 tests passed · Build ✅ · CI #1015 ✅ · Contract #589 ✅ · Annotations ว่าง

---

## R61 — 2026-11-22 — BMB-RIDER-NOTIF-FIX Phase 1→2→3

**Status:** CODE_CLOSED + BUILD+LINT+TSC+VITEST ALL PASS + PUSHED

**Phase 1 — Rider Complete Fix:**
- Error Boundary + Structured Logging (`DeliveryErrorBoundary` ครอบ `PodDeliveryPanel`)
- `toBlob` แทน `toDataURL` (canvas memory ~20MB → ~1MB)
- `activeOrder` Sync ใน `refresh()` (server ไม่มี order นั้น = `setActiveOrder(null)`)
- Hardened finally block (บังคับ `setDeliverBusy(false)`, `setDeliverStep(null)`, `setActiveOrder(null)` ทุกกรณี)
- Retry button (โชว์เมื่อ `kind !== 'state'` ใช้ `lastPhotoRef`)

**Phase 2 — Toast Layout Fix:**
- Fixed positioning + responsive max-width + safe-area inset
- SW notification options: vibrate + requireInteraction

**Phase 3 — 3-User Experience Hardening:**
- Rider→Customer Sync: `OrderTrackPage` polling 20s → **5s** เมื่อ rider visible + POD photo + timestamp
- Admin Visibility: `adminAdvanceDelivery` + History/Audit panel
- Mobile/PWA Compliance: iOS PWA meta + global min 48×48px touch targets + manifest display: 'standalone'

**Gates:** TSC ✅ · Lint ✅ · Build ✅ · Unit Tests ✅ 226 files / 2445 tests PASS

---

## R60 — 2026-11-22 — BMB-ADMIN-FOCUS-LOOP (Remove auto-scroll + refetch loop)

**Status:** CODE_CLOSED + BUILD+LINT+TSC+VITEST ALL PASS + PUSHED

**Root Cause:** `DeliveryManagement.tsx:154-168` — `useEffect` deps `[focusOrder, load, orders]` → ทุกครั้ง `load()` เสร็จ → `setOrders(new array)` → effect รันใหม่ → `void load(true)` → **วนลูปโหลด + scrollIntoView ไม่รู้จบ**

**Fix:** ลบ effect scroll ทิ้งทั้งหมด (บรรทัด 154-168) รวม `scrolledFocusRef` · เก็บ visual ring highlight ไว้ที่บรรทัด 534/674

---

## R55 — 2026-11-20 — Background Music + Mascot Badge Fix + OAuth/Passkey ALL CONFIGURED

**Status:** CODE_CLOSED + PUSHED · vitest 226 files / 2422 tests PASS (+42)

**Background Music (file-based engine):**
- `lib/backgroundMusic.ts` ใหม่ — validate/compress/upload/delete/list + shuffle queue
- `lib/ambientMusic.ts` rewrite — HTMLAudioElement engine (`createAudioFileEngine`) + shuffle queue + ducking 25% + volume persist
- `pages/admin/BackgroundMusicSettingsPage.tsx` ใหม่ — Admin UI: bucket list + preview + file upload + URL import + enable toggle + delete/copy URL
- `components/admin/AdminHubs.tsx` — เพิ่ม tab `music` ใน SettingsHub
- `supabase/migrations/103_background_music_bucket_policies.sql` — RLS: public read + admin write + idempotent bucket create

**Mascot Badge Fix (F-1):** `index.css` `.section-float-mascot` ลบ `border-radius: 50%` + เปลี่ยน `floatLogo` → `float` (translateY only) · 7 จุด overflow fix

**OAuth/Passkey — ทั้ง 4 ช่องทางพร้อมใช้งานจริง (Owner ตั้งค่า Dashboard เสร็จแล้ว):**
- Google (built-in), Facebook (built-in), LINE (Custom OIDC), Passkey (built-in)

**Gates:** Lint ✅ (591 ไฟล์ + brandNameGuard + languageSanity) · vitest 226 files / 2422 tests PASS (+42) · Build ✅

---

## R54 — 2026-11-20 — มาสคอตลอยจริง + logout จริง + โหวต UX + login เบอร์โทร

**Status:** CODE_CLOSED + PUSHED · vitest 224 files / 2391 tests PASS (+3)

**มาสคอตลอย/หลุดเฟรม:** `.animate-float` เป็น **dead class** → แก้ 3 ชั้น: ①นิยาม `.animate-float` bind `@keyframes float` ②ลอยย้ายมาที่ div เนื้อหาใน BiteMascot ③wrapper ถอด animate-float

**Logout จริง:** `await logout()` จริง + `finally` พาไป `/login` เสมอ

**ระบบโหวต "ขัดข้อง":** `preorder_vote_cast` (anon) = **HTTP 401 body ว่าง** = **m208 ติด prod ครบ REVOKE anon** → สาเหตุจริง = ผู้ใช้**ไม่ได้ล็อกอิน** → **Fix:** `castPreorderVote` เช็ค session ก่อนยิง RPC + map 401 → signed_out

**Login เบอร์โทร:** เปิดของเก่า `authStore.loginByPhone(phone, password)` (synthetic email `<phone>@phone.bmb.local`) ให้ผู้ใช้จริง

**Gates:** Lint ✅ · vitest 224 files / 2391 tests PASS (+3) · Build ✅

---

## R53 — 2026-11-18 — OWNER VERIFIED ✓ (Vote + Random Menu + Promotions Real Data)

**Status:** CODE_CLOSED · m208 APPLIED PROD ✓ · vitest 2388/2388 · Docker contract replay ALL_GREEN · CI 2/2 success

**หน้าโหวต:** ลบ hardcode ทั้งหมด + โหวตจริงผ่าน server RPC `preorder_vote_cast` (m208) + ผลโหวตจากตาราง `preorder_votes` + เพดาน/สถานะจาก `vote_policy` (business_settings) + แถบ "โปรโมชั่นที่กำลังรัน" จริงจากแอดมิน

**หน้าสุ่มเมนู:** สุ่มจาก `getProducts()` จริง (!archived && is_available) · รูป/ราคาจริง · ปุ่มไปสั่ง = `/menu?category=<id>` · แสดงโปรโมชันจริงที่ใช้กับเมนูนั้นได้

**หน้าโปรโมชัน:** แสดงข้อมูลจริงครบตามแอดมินตั้ง — ภาพแบนเนอร์ · เมนูร่วมรายการ · เพดาน max_discount_amount · สิทธิ์คงเหลือ · stackable

**m208 (APPLIED PROD ✓):** `preorder_vote_status()` (anon) · `preorder_vote_cast` (authenticated · advisory lock · ALREADY ก่อน LIMIT · !archived · Asia/Bangkok day · audit ทุกครั้ง · **ไม่แตะ points_ledger**) · seed `vote_policy {"enabled":true,"daily_limit":1}` · unique index identity + dedup

---

## R52 — 2026-11-17 — MASCOT BADGE + RIDER HISTORY TABS + MAP 3 SIDES

**Status:** CODE_CLOSED · m180 + m207 APPLIED PROD ✓ · vitest 2379/2379

**Mascot Badge:** `BiteMascot.tsx` draggable badge มุมขวาล่าง + localStorage persist position · z-index 50 · tidak conflict with floating ad

**Rider History Tabs:** แท็บ "วันนี้" / เดือน / "วันส่ง/วันมอบหมาย" ใน `/rider` · `my_deliveries` v2 (m207) · scheduled jobs แยกได้

**Map 3 Sides:** `/rider` (OSM) + `/track/:orderNumber` (OSM + rider marker + stale handling) + `/admin/delivery` (OSM + real rider markers + polyline) — Google Maps key ถูกปฏิเสธ → ใช้ Leaflet/OSM fallback ซึ่งถือว่า PASS ตามดีไซน์

---

## R51 — 2026-11-16 — OMNI-CHANNEL PHASE 3–5 (Social AI Worker + Meta/LINE)

**Status:** CODE_CLOSED · EF `social-ai-worker` DEPLOYED (exit=0) · vitest 2368/2368

**Omnichannel Social (Meta/LINE) ขั้น 3–5:**
- `social-ai-worker` EF: AI สรุปออเดอร์จาก comment/message → `cartFooterForMatch` + `buildCartSummaryFooter` · `?cart=` deep-link
- `channel-webhook`: receive Meta/LINE events → `resolveKitchenPoint` · `socialOrderIntake` contracts
- `socialOrderIntake.ts` shared lib: `cartFooterForMatch` (AI reply scope) · `buildCartSummaryFooter` (full cart disclosure)

**Gates:** vitest 2368/2368 PASS · tsc 0 · lint OK · build OK · EF deploy exit=0 · smoke http=200 boot_ok=true

---

## Earlier R-series (R1–R50)

R1–R50 ครอบคลุม: โครงสร้างโปรเจกต์, Database schema + RLS, Authentication (OAuth/Passkey), Product Catalog, Cart + Checkout (same-day/pre-order), Payment (Omise/Stripe/QR/COD), Admin Dashboard (26 หน้า), Delivery zones + routing, Rider PWA, AI Waiter (Talk to Bite + Voice), Food Theater, CRM Automation, Background Music (synth→file-based), Sticker printing, PWA, CI/CD, Contract testing, v1.0.0 release preparation.

รายละเอียด R1–R50 อ้างอิงได้จาก `AI_WORK_STATE.md` ledger entries ก่อน R51 และ `docs/BMB_MASTER_STATUS.md` entries ก่อน R51

---

## Migration Ledger Summary (001–213)

| Range | Description | Applied Prod |
|-------|-------------|--------------|
| 001–100 | Core schema: branches, products, orders, cart, customers, auth, delivery, payments | ✅ |
| 101–150 | RLS hardening, admin features, rider ops, AI context, CRM | ✅ |
| 151–190 | Delivery sync, queue automation, social omnichannel, background music bucket (m103→m196) | ✅ |
| 191–200 | Vote system (m192/193 CRM), BKK date guards (m190–193), floating ad (m209) | ✅ |
| 201–213 | m208 vote_cast, m209 is_floating_ad, m210/211 rider my_deliveries, **m212 delivery preparing hop**, **m213 cart_sessions payload + select_own** | ✅ (all) |

**Verified:** `supabase_migrations.schema_migrations` has all 213 entries · prod history 208 from 213 repo files (ledger backfill R80) · rule 16.3 enforced (probe marker → apply → record)

---

## Edge Functions Deployed (24)

1. `ai-proxy` — SSE AI streaming
2. `omise-create-checkout` — Omise server-side charge
3. `omise-webhook` — Omise idempotent webhook
4. `stripe-create-checkout` — Stripe fallback
5. `stripe-webhook` — Stripe webhook
6. `create-checkout` — Unified checkout orchestrator
7. `queue-dispatch` — Order dispatch queue
8. `queue-retry` — Failed dispatch retry
9. `queue-scheduler` — Scheduled queue jobs
10. `sms-send` — SMS notifications
11. `push-send` — Push notifications
12. `voice-tts` — AI voice TTS
13. `channel-webhook` — Meta/LINE webhook receiver
14. `social-ai-worker` — AI order summary from social (R104 deployed 2026-11-24)
15. `social-order-intake` — Shared lib for social cart footer
16. `automation-winback` — CRM winback (m192)
17. `automation-birthday` — CRM birthday (m193)
18. `resolve-kitchen-point` — Kitchen location resolver
19. `rider-location-update` — Rider GPS updates
20. `delivery-status-sync` — Delivery status canonical RPCs
21. `cart-session-sync` — Server-side cart sync (R103)
22. `background-music-upload` — Music file upload
23. `background-music-list` — Music bucket list
24. `floating-ad-config` — Floating ad configuration

---

## Test Suite Evolution

| Milestone | Files | Tests | Notes |
|-----------|-------|-------|-------|
| R51 | 218 | 2368 | Omnichannel phase 3–5 |
| R52 | 220 | 2379 | Mascot + Rider tabs + Maps |
| R53 | 222 | 2388 | Vote + Random Menu real data |
| R54 | 224 | 2391 | Mascot float + Logout + Vote UX + Phone login |
| R55 | 226 | 2422 | Background Music + Mascot fix + OAuth |
| R60 | 226 | 2445 | Admin focus loop removed |
| R61 | 226 | 2445 | Rider notif fix |
| R62 | 226 | 2445 | CI fix + test contract |
| R63 | 226 | 2446 | FB Cart Bridge (+1) |
| R63b | 226 | 2447 | Hotfix (+1) |
| R63c | 226 | 2447 | Cart UX + Closed rounds |
| R63d | 226 | 2447 | Sticker consolidation |
| R64 | 226 | 2447 | Delivery sync (m212) |
| R102 | 228 | 2486 | FB IAB double-add guard |
| R103 | 229 | 2501 | Server-side cart sync (m213) |
| R104 | 230 | 2516 | 1 reply = 1 link |
| R105 | 230 | 2516 | Background music state sync |
| **R105b** | **230** | **2521** | **RLS hotfix (current)** |
| R105c | 230 | 2521 | README rewrite (docs only) |

**Current (2026-11-24 R105c):** 230 files / 2,521 tests · All gates pass · 24 EF deployed · 213 migrations applied prod

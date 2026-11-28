# BMB — CHANGELOG (การ์ด/ตามเวลา/ยกเลิก/คัดกรอง); RAISE only inside DO blocks; UPDATE has no ON CONFLICT (INSERT only)
- business_settings rows need upsert (INSERT ... ON CONFLICT (key)) not bare UPDATE when the row may not exist
- cancel_order_as_customer: service_role only + RAISES exception -> tests must catch with nested block and clear JWT claims before service_role calls
- create_production_batch/get_kitchen_summary defaults fire only when params are OMITTED (passing NULL is NOT the default)
- PRE_ORDER orders need scheduled_date >= today BKK + dropoff_detail (m038/m143b); create_order_with_items has 18 params incl. p_promotion_code (11th)
- reviews unique partial idx_reviews_order_product(order_number, product_id) WHERE order_number IS NOT NULL -> test fixtures use separate product/order ids

---

## R138 — 2026-11-28 — IMG Studio Pipeline: System Prompt + JSON Payload + ลบพื้นหลัง (BEN2) + alpha WebP + กฎลายน้ำ

- **เป้าหมาย:** อัปเกรดระบบเจนภาพเมนูอาหาร (Studio) ตาม spec ใหม่ โดยต่อยอดโค้ดเดิม (ไม่สร้างระบบซ้ำ) — `image-gen` EF + `aiImageStudio.ts` + UI เดิม
- **System Prompt (แยก role):** `supabase/functions/image-gen/index.ts` เพิ่ม `STUDIO_SYSTEM_RULES` (Geometry Lock/Zero Hallucination · พื้นขาว #FFFFFF · แสงสตูดิโอ 45° · `100mm macro look, tack-sharp focus` · ห้ามพร็อพเกิน) + `LOGO_RULE` (ห้ามเจนโลโก้เอง · ห้ามตีความว่า Bite Me Baby เป็นร้านขนมหวาน — สรุปประเภทจากชื่อเมนู) · ส่งเป็น `role:'system'` ใน chat path + prepend ใน images-API path · ตัด "ร้านของหวาน" ออกจาก presets ทุกหมวด
- **JSON Payload:** รับ `menu_name`/`category`/`container_type`/`texture_keywords` · แอดมินส่งผ่าน `buildStudioPayload()` (จับคู่หมวด: ของทอด/เครื่องดื่มเย็น/เบเกอรี่/สลัด/ข้าวหน้า → container + texture อัตโนมัติ)
- **ลบพื้นหลัง (Segmentation):** เรียก BEN2 ภายนอก (primary) ใน EF เฉพาะ `studio` · ถ้าไม่ตั้ง secret `BEN2_ENDPOINT` (±`BEN2_API_KEY`) หรือพัง = `fallback:'manual'` (แอดมินตัดเอง) · ห้ามบล็อกการเจน · **TODO(owner): ตั้ง BEN2 secret + ยืนยัน contract**
- **Post-process (client):** `finalizeStudioImage()` = trim โปร่งใส → resize+pad กึ่งกลาง 1024×1024 + margin เท่ากัน → webp โปร่งใส (quality 0.85 เป้า ≤500KB) → อัปโหลดทับ `ai-generated/studio/` · ลบต้นฉบับผ่าน `removeGeneratedByUrl()`
- **กฎลายน้ำ:** `applyBrandWatermark` — `mascot='none'` = คืนภาพเดิม ไม่วาดโลโก้/ข้อความ (ไม่ใช้มาสคอต = ไม่ใช้ลายน้ำทั้งหมด) · โลโก้จากระบบ `/Logo_Sticker_Circle.webp` เท่านั้น
- **UI:** เพิ่มกล่อง "รายละเอียดเพิ่มเติม (Studio)" เฉพาะ `genKind==='studio'` เหนือปุ่มสร้างภาพ (ทั้ง `AdminMarketing` + `ContentTab`) + สถานะขั้นตอน (ลบพื้นหลัง/ตัดขอบ/แปลง webp) ใน `genStatus` เดิม ไม่รื้อ layout
- **ไฟล์:** `supabase/functions/image-gen/index.ts` · `src/lib/aiImageStudio.ts` · `src/components/admin/ContentTab.tsx` · `src/pages/admin/AdminMarketing.tsx` · เทสใหม่ `src/__tests__/r130StudioPipeline.test.ts` · อัปเดต `r47AiStudio.test.ts` (ยืนยัน helper ใหม่)
- **ประตู (gates 4/4):** `tsc --noEmit` 0 · `npm run lint` OK · `vitest run` **265 ไฟล์/3,073 tests PASS** · `npm run build` PASS
- **Deploy + verify:** `supabase functions deploy image-gen` exit=0 (v28) · **ledger 001–234 local=remote (ไม่มี drift/ช่องว่าง)** · **R138 smoke จริง ALL_PASS** (`e2e/_r138StudioSmoke.cjs` → `e2e/_r138_studio_smoke.json`): status 200 · โมเดล `qwen/qwen-image-2.1-pro [images-api]` · `bg_removed=false` · `fallback=manual` (BEN2 ไม่พร้อม) · `newFields=true` · อัปโหลด `ai-generated/studio/` แล้วลบทิ้ง (cleanup DELETED) — พิสูจน์ EF รุ่นใหม่รับ JSON payload + คืน bg_removed/fallback จริง
- **ไม่มี migration ใหม่** (คงสถาปัตยกรรม storage/flow เดิม) · **BEN2 secret ยังไม่ตั้ง** (`BEN2_ENDPOINT`/`BEN2_API_KEY`) → fallback=แอดมินตัดเอง (TODO owner)
- **LIVE_TEST_PENDING (Owner):** `/admin/marketing` Studio → เจนภาพเมนู → กล่องเสริมโผล่เฉพาะ studio + สถานะลบพื้นหลัง + อัลบั้มมี webp โปร่งใส 1024 (ถ้า BEN2 พร้อม) / ขาวรอตัดเอง (ถ้าไม่พร้อม) · mascot=none = ไม่มีลายน้ำ

## R137 — 2026-11-28 — ไอคอน "B" สีส้ม → โลโก้จริง (favicon/apple-touch/PWA ตาม brandLogoUrl)

- **ปัญหา:** favicon/apple-touch/PWA icon ยังเป็น "B" สีส้ม (`public/favicon.svg`, `pwa-192/512x*.png`) — แอดมินแก้โลโก้แล้วไม่เปลี่ยน
- **แก้:** `lib/runtimeBrandIcons.ts` (applyRuntimeBrandIcons + buildRuntimeManifest) ตั้ง favicon + apple-touch-icon + PWA manifest (blob) ตาม `brandLogoUrl` ตอน runtime · `components/RuntimeBrandIcons.tsx` วางใน App · `index.html` default เป็น `/Head Logo.webp`
- **ผลลัพธ์:** แอดมินแก้โลโก้ที่ "องค์กรและแบรนด์" ครั้งเดียว → ทุกไอคอนอัปเดตตาม ไม่ต้อง rebuild (installed PWA เปลี่ยนตอน reinstall)
- **Tests (gates 4/4):** lint 0 (658 ไฟล์) · vitest **264 files/3,060 tests** 0 fail · tsc+build 0 · PUSHED

## R136 — 2026-11-28 — Header โลโก้/ชื่อ + ฮีโร่หน้าแรก (ตัดฮาร์ดโค้ด) + แก้แท็บแบรนด์ stuck

- **ปัญหา 1:** `Header.tsx` ฮาร์ดโค้ด `/Head Logo.webp` + "Bite Me Baby" · **ปัญหา 2:** `AdminBrands` import `useEffect` แต่ไม่เรียก → `loading` ค้าง true → แท็บ "องค์กรและแบรนด์" กดอะไรไม่ตอบ · **ปัญหา 3:** ข้อความ hero ฮาร์ดโค้ดใน `FoodTheater.tsx`
- **แก้:** เพิ่ม `brandLogoUrl` + `hero` (HeroConfig/parseHeroConfig) ใน platformConfig · hydrate จาก `brands.logo_url_icon` + `business_settings.hero_config` · `Header`/`FoodTheater` อ่านจาก config (ห้ามฮาร์ดโค้ด) · เพิ่ม mount effect ใน `AdminBrands` · UI ใหม่ `HeroSettingsPage` (แท็บ "🎭 ฮีโร่หน้าแรก" ใน ตั้งค่าร้าน) + รูป hero ใหญ่
- **Tests (gates 4/4):** lint 0 · vitest **263 files/3,057 tests** 0 fail · tsc+build 0 · PUSHED
- **LIVE_TEST_PENDING (Owner):** ทดสอบแท็บแบรนด์ + ฮีโร่หน้าแรก + ไอคอนบนไลฟ์แชท

## R135 — 2026-11-28 — คืน `standard` + ทดสอบ 082 (ปัญหาที่เบอร์ 081 ไม่ใช่โค้ด)

- **หลักฐาน:** Owner เปลี่ยนเบอร์แล้วข้อความถึง → ระบบส่งได้จริง · เบอร์ 081 ลงทะเบียน 2 ยูซเซอร์ = ปัญหาฝั่งเบอร์/บัญชี
- **ปรับเครดิตคืน:** secret `SMS_MESSAGE_TYPE=standard` = 201 (1 เครดิต) · evidence `e2e/_r135_standard_082.log`
- **ทดสอบ 082-637-8546:** `sms-send` 200 · `credits_used:1` · `queued` · ข้อความ 56 ตัว 1 ท่อน
- **LIVE_TEST_PENDING (Owner):** ยืนยันว่า 082 ได้รับ SMS · PUSHED (`96a289c`)

## R134 — 2026-11-28 — SMS_MESSAGE_TYPE → `superfast` (แก้ OTP ไม่ถึงมือถือ)

- **ต้นตอ:** การส่งถึงที่ยืนยันจริง (2026-10-07) ใช้ `superfast` · รอบ 8i เปลี่ยน `standard` เพื่อประหยัดแต่ไม่มีหลักฐานว่าถึงหลังเปลี่ยน → `standard` เสี่ยง DND/หน่วง
- **Fix:** set secret `SMS_MESSAGE_TYPE=superfast` (Management API `POST /secrets` = 201 · `PATCH` ใช้ไม่ได้ = 404) · evidence `e2e/_r134_superfast.log`
- **Verify:** `otp-send` 200 `ok:true` · ส่งจริงถึงเบอร์ 081***992
- **ต้นทุน:** 3 เครดิต/ข้อความ (เหลือ ~476 ≈ 158 ครั้ง)
- **Tests:** lint 0 · ไม่มี src เปลี่ยน · PUSHED (`5ec618e`)
- **LIVE_TEST_PENDING (Owner):** ยืนยันว่าได้ SMS

## R133 — 2026-11-28 — OTP SMS 1 ท่อน: ย่อข้อความ 89→56 ตัว (แก้ SMS ไม่ถึง)

- **ต้นตอ:** ข้อความ OTP 89 ตัว (ไทย UCS-2 = 70 ตัว/ท่อน) = 2 ท่อน → carrier ตัดค้าง · ข้อความสั้น 17 ตัว 1 ท่อน ผ่าน `queued` · เครดิต 476 พอ · sender `SMSOTP` · type `standard`
- **Fix:** `otpSmsMessage()` ย่อเป็น 56 ตัว = 1 ท่อน + regression test (≤70) · deploy `otp-send` exit=0
- **Verify:** `otp-send` 200 `ok:true` (รอบแรก 502 ชั่วคราวจาก provider → retry ผ่าน) · ส่งจริงถึงเบอร์ 081***992
- **Tests (gates 4/4):** lint 0 · vitest **263 files/3,051 tests** 0 fail · tsc+build 0 · PUSHED (`1c590e5`)
- **LIVE_TEST_PENDING (Owner):** ขอ OTP ใหม่แล้วดูว่าถึงมือถือ

## R132 — 2026-11-28 — OTP UX: ปุ่มส่งซ้ำ + ตัวนับ 30 วินาที + error จริง (ไม่กลืนเป็น generic)

- **อาการ:** Owner แจ้ง "OTP ไม่ส่ง + ไม่มีปุ่มกดส่งซ้ำ" — ตรวจพบว่าระบบ **ส่งจริง** (`sms-send` → thsms_org 200 `credits_used:1, status:queued` · `otp_challenges` มีแถว `phone_login` 03:17:18) → ปัญหาคือ **UI ไม่มีปุ่มส่งซ้ำ** และ error ถูกแปลงเป็น generic
- **Fix:** ① ปุ่ม "ส่งรหัสใหม่" + ตัวนับ 30 วินาที (กัน rate limit) ② โชว์ `ส่งไปที่ {masked}` ③ `readFunctionErrorCode()` + `describeOtpSendError/VerifyError` แปลง error code จริงเป็นข้อความไทย
- **Tests (gates 4/4):** lint 0 (653 ไฟล์) · vitest **263 files/3,050 tests** 0 fail · tsc+build 0 · PUSHED (`8c228c3`)
- **LIVE_TEST_PENDING (Owner):** ทดสอบขอ OTP + กดส่งซ้ำ

## R131 — 2026-11-28 — MIGRATION 234: otp_challenges รับ `phone_login` (ปิดปัญหา OTP ไม่ส่ง + ไม่มีช่องกรอกรหัส)

- **Root Cause:** `122_otp_challenges.sql:27` CHECK รับแค่ `('quick_login','guest_checkout')` — R130 เพิ่ม `phone_login` ใน EF แต่ไม่มี migration → insert ชน **23514** → `otp-send` 503 `ERR_OTP_STORE_FAILED` → UI generic error + `phoneOtpSent` ไม่เป็น true = ไม่มีช่อง OTP
- **วิธีวินิจฉัย (probe ไลฟ์ ไม่ใช่การเดา):** หักล้าง verify_jwt (platform ถึง handler 400) · หักล้าง service-key (sms-send auth ผ่าน · `bmb_backend_*` ว่างแต่ fallback ได้คีย์ถูก) · `otp_challenges` ไม่มีแถว `phone_login` · node probe ได้ 503 + detail `23514`
- **Fix:** `234_otp_purpose_phone_login.sql` drop+create CHECK รับ 3 ค่า (RLS/REVOKE/index คงเดิม) · apply = 201 · constraint ยืนยันครบ
- **Ledger:** repair 234 + `migration list` = **234/234 Local=Remote** (ไม่มี drift)
- **Verify:** probe เปลี่ยน 503 → **502 ERR_SMS_SEND_FAILED** (insert ผ่าน) · ลบแถวทดสอบแล้ว
- **Tests (gates 4/4):** lint 0 (653 ไฟล์) · vitest **263 files/3,050 tests** 0 fail · tsc+build 0
- **New files:** `supabase/migrations/234_otp_purpose_phone_login.sql` · `e2e/_r131ApplyMigration234.cjs` · `e2e/_r131LedgerRepair234.cjs` · PUSHED (`a4498a0`)
- **LIVE_TEST_PENDING (Owner):** OTP login ด้วยเบอร์จริง

## R130 — 2026-11-28 — PHONE NUMBER MANAGEMENT + OTP LOGIN: เพิ่มเบอร์ในโปรไฟล์/แอดมิน + OTP เข้าสู่ระบบด้วยเบอร์ (ปรับของที่มีอยู่ ไม่แตะ/ซ้ำ)

- **UI เพิ่มเบอร์ใน ProfilePage:** การ์ด "📱 เบอร์โทรศัพท์" ใหม่ — `src/lib/phoneProfile.ts` (validate ไทย→E.164 · `supabase.auth.updateUser({ phone })` เข้า `auth.users.phone` จริง · fallback `user_metadata.phone` เมื่อ Phone Provider ไม่พร้อม) — เดิม ProfilePage แสดงเบอร์แต่แก้ไม่ได้
- **AdminCustomers แก้เบอร์เองได้:** ปุ่ม 📱 ต่อแถว → inline edit + บันทึกผ่าน `updateCustomerPhone` (RLS เดิมบังคับ) — เดิมได้แค่ลบ
- **Phone OTP login (ปรับ tab เดิม):** tab "เบอร์โทร/รหัสผ่าน" เดิม เพิ่มขั้น OTP ก่อน login — `otp-send` EF (purpose `phone_login` ใหม่ใน VALID_PURPOSES + OtpPurpose type) → `otp-verify` EF ใหม่ (reuse `consumeOtpChallenge` จาก `_shared/otpVerify.ts` — ไม่ duplicate) → `loginByPhone` เดิม — ไม่ได้สร้าง tab/หน้าใหม่
- **EF Deploy:** `otp-send` + `otp-verify` exit=0 (`e2e/_r130_deploy_otp.log`) · probe หลัง deploy = 400 `ERR_OTP_NOT_FOUND` สำหรับโค้ดปลอม = live + สาย verify ทำงาน
- **Tests (gates 4/4):** lint 0 (653 ไฟล์) · vitest **263 files/3,050 tests** 0 fail · tsc+build 0 · PUSHED (`ac32e42`)
- **New files:** `src/lib/phoneProfile.ts` · `supabase/functions/otp-verify/index.ts` · `e2e/_r130DeployOtpFns.cjs` · `e2e/_r130OtpVerifyProbe.cjs`
- **LIVE_TEST_PENDING (Owner):** /profile เพิ่มเบอร์ · /admin/customers แก้เบอร์ · เข้าสู่ระบบแท็บเบอร์โทร ขอ OTP → ใส่ 6 หลัก → เข้าสู่

---

## R129 — 2026-11-27 — DEPLOY EF image-gen (4 kinds incl. studio): แก้ "สร้างไม่สำเร็จ: ERR_INVALID_KIND" บน production + เทสครบ + migration ledger ตรง prod

- **Root Cause (deploy drift):** commit `ee660ea` เพิ่ม kind `studio` พร้อมกันทั้ง frontend + EF แต่ช่องทาง deploy ต่างกัน — frontend (Cloudflare Pages auto จาก main) ขึ้นแล้ว ส่วน Edge Function ต้อง deploy มือ (CI ไม่มี job deploy functions) → production EF ยังเป็นรุ่น 3 หมวด (menu/promo/festival) ขณะ frontend ส่ง `kind:'studio'` = 400 `ERR_INVALID_KIND` (`index.ts:122`) — พิสูจน์ด้วย live probe ก่อน deploy: studio→`ERR_INVALID_KIND` ส่วน promo→`ERR_MISSING_SUBJECT` (sanity ผ่าน = ระบบปกติเฉพาะหมวดใหม่)
- **Deploy:** `supabase functions deploy image-gen` exit=0 — **ไม่แตะ secret ใด ๆ** (IMAGE_GEN_MODELS/IMAGE_GEN_MODEL คงค่าเดิม · สคริปต์ r55 เก่าที่ตั้งลำดับโมเดลย้อนห้ามใช้)
- **Verify 3 ชั้น:** ① version probe หลัง deploy = `NEW_DEPLOYED` (studio ผ่าน kind+style แล้วโดน `ERR_MISSING_SUBJECT` จาก subject ว่างที่ตั้งใจ = 0 cost ไม่เปลืองเครดิต) ② smoke จริงครบโซ่ = เจนภาพ studio สำเร็จ 200 · โมเดลจริง `qwen/qwen-image-2.1-pro [images-api]` · อัปโหลด `bmb-images/ai-generated/studio/` ถูกอัลบั้ม · **ไฟล์ทดสอบลบทิ้งทันที** (HEAD ยืนยัน 404) ③ negative control หมวดปลอมถูกปฏิเสธเหมือนเดิม
- **Tests (gates 4/4):** lint 0 (brandNameGuard OK) · vitest **263 files/3,050 tests** 0 fail · tsc+build 0 · **Migration ledger = MATCH** local 233 ⟷ remote 233 (001–233 · localOnly/remoteOnly = [] · ไม่ต้อง repair) · PUSHED (`ab388db`)
- **New files:** `e2e/_r129DeployImageGen.cjs` · `e2e/_r129ImageGenKindProbe.cjs` · `e2e/_r129ImageGenStudioSmoke.cjs` · `e2e/_r129MigrationLedger.cjs` + evidence `_r129_deploy_imagegen.log` · `_r129_imagegen_probe.json` · `_r129_studio_smoke.json` · `_r129_migration_ledger.json`
- **LIVE_TEST_PENDING (Owner):** `/admin/marketing` → หมวด "ภาพเมนูอาหาร (Studio)" → สร้างภาพ → ต้องสำเร็จ (ปิดอาการในภาพหน้าจอ 22:48 น.)

---

## R128 — 2026-11-27 — THEATER MODE BADGES: ประเภทเมนู + ปฏิทินมุมรูป + "ยังไม่ลงปฏิทิน" (ของแอดมินก็ขึ้นครบ)

- **Root Cause:** การ์ดเธียเตอร์มีของพร้อมใช้อยู่แล้ว (R48 `ScheduleDateBadge` มุมขวาบน + pill "📅 สั่งล่วงหน้า") แต่ **ไม่ทำงานกับของแอดมินเลือก** เพราะ (1) `FoodTheater` ป้อน `scheduledDate = undefined` ตลอด (`_theaterItem ? undefined : schedule[p.id]`) และ (2) synthetic product ไม่สืบทอด `available_preorder/available_same_day/is_preorder` → pill ประเภทไม่ขึ้น · logic "ยังไม่ลงปฏิทิน" มีแค่ใน toast ตอน add() ไม่ได้แสดงบนการ์ด
- **Fix (3 ไฟล์):**
  1. `src/components/theater/FoodTheater.tsx` — picks mapping resolve เมนูจริงจาก `product_id` แล้วสืบทอด `available_preorder/available_same_day/is_preorder` + เก็บ `_realProduct` (title/caption/image ยังเป็นโทนแอดมิน) · render ป้อน `scheduledDate = schedule[_realProduct.id]` (ตัด hack เดิม) — เมนูที่ผูกจริงและลงปฏิทินแล้วจึงได้ปฏิทิน
  2. `src/components/theater/TheaterCards.tsx` — helper ใหม่ `ModeCornerBadge` (export) มุมเดิมของทั้งสองการ์ด: มีวัน → `ScheduleDateBadge` (มาตรฐาน /menu) · พรีออเดอร์ไม่มีวัน → pill "📅 ยังไม่ลงปฏิทิน" (โทนเทา) · เซมเดย์ → pill "⚡ ส่งวันนี้" (เขียว) · mode null → ไม่ป้าย — ใช้ `deriveOrderMode` canonical (OD-3/OD-5) ส่วนปุ่ม R44 คงเดิมทุก assertion
  3. `src/__tests__/r128TheaterModeBadges.test.ts` (ใหม่, 7 tests) — render test ผ่าน `React.createElement` (vitest include ไม่รับ .tsx) + source guards: mapping สืบทอดสิทธิ์, scheduledDate จากปฏิทินจริง, การ์ดทั้งสองใช้ ModeCornerBadge
- **Gates:** tsc 0 · lint OK · vitest 263 files/3,050 tests PASS · build PASS (CSS `index-qVRAxP80.css`) · PUSHED
- **Note:** ของแอดมินที่ไม่ผูก product_id ยังไม่มี badge (โครงสร้างยังไม่รู้ประเภท) · LIVE_TEST_PENDING (Owner visual บน /shop)

---

## R127 — 2026-11-27 — TOGGLE TRACK HEIGHT 14px → 20px (Owner visual tune หลัง R126 ขึ้นจอจริง)

- **Context:** R126 ทำให้ค่า height มีผลจริงครั้งแรก (หลัง exempt 48px touch target) — Owner เห็นของจริงบน production แล้วสั่ง "เตี้ยไป ใช้ 40×20 + จุด 10×10"
- **Fix (2 ไฟล์):**
  1. `src/index.css` — `.bmb-toggle-track` `height: 14px → 20px` (knob 10×10, `translateX(26px)`, มุม 3px/2px, carve-out `min-height:0` คงเดิม)
  2. `src/__tests__/theaterMenuControl.test.ts` — assertion `height: 20px`
- **Gates:** tsc 0 · lint OK · vitest 262 files/3,043 tests PASS · build PASS (CSS `index-C-YvGDxU.css`) · PUSHED
- **LIVE_TEST_PENDING:** Owner visual — console ควรได้ `40px×20px · knob 10px`

---

## R126 — 2026-11-27 — TOGGLE HEIGHT FIX: EXEMPT FROM GLOBAL 48px TOUCH TARGET (root cause ของ "แก้แล้วไม่เปลี่ยน" ตลอดวัน)

- **Root Cause:** `index.css` Phase 3.3 global touch-target rule `button, .btn, [role="button"] { min-height: 48px; min-width: 48px }` (บรรทัด ~2212) clamp ความสูง track ที่เป็น `<button role="switch">` → **height ที่แก้ทุกครั้ง (R122 18px → R124 9px → R125 4.5px) ถูก min-height 48px ทับจนกรอบ render เป็น 40×48 ตลอด** ส่วน knob เป็น `<span>` ไม่ตรง selector จึงเปลี่ยนจริง (14→5→7.5) — อธิบายภาพหน้าจอทั้งหมด (ก้อน 40×48 + จุดเล็ก) และ "hard refresh เท่าไรก็เหมือนเดิม" (CSS ใหม่มาถึงตลอด ปัญหาคือ cascade ไม่ใช่ cache/deploy) · test เดิมอ่าน source ไฟล์ (`index.css?raw`) จึงผ่านทั้งที่ computed ≠ 4.5
- **Fix (2 ไฟล์):**
  1. `src/index.css` — (a) carve-out หลัง block touch-target: `.bmb-toggle-track { min-height: 0; min-width: 0 }` (specificity class ชนะ `button` element; `[role="button"]` ไม่ match เพราะ role="switch") → ค่า height ที่แต่งมีผลจริง (b) ค่าสุดท้าย: track `40×14px`, knob `10×10px` (`top:50%` จัดกึ่งกลาง), `translateX(26px)` = 40−10−2−2
  2. `src/__tests__/theaterMenuControl.test.ts` — อัปเดต assertion: `height: 14px`, knob `10×10px` + เพิ่ม **root-cause lock** `min-height: 0` (กันกฎ 48px กลับมาทับ)
- **Gates:** tsc 0 · lint OK · vitest 262 files/3,043 tests PASS · build PASS (CSS `index-014Ka3If.css`) · PUSHED
- **Note:** diagnostics ยืนยันด้วย console ฝั่ง production: `track 40×48 · knob 7.5` ตรงกับ root cause เป๊ะ · LIVE_TEST_PENDING (Owner visual — toggle 40×14 + knob 10×10 จะขึ้นจอจริงหลัง deploy)

---

## R125 — 2026-11-27 — TOGGLE: KNOB +50% / TRACK HEIGHT −50% (ทุกตัวที่มี)

- **Root Cause:** หลัง R124 ลด toggle เตี้ยลง (track 9px, knob 5px) → knob เล็กเกินไป ต้องการ knob ใหญ่ขึ้น + กรอบ (track) บางลง
- **Fix (2 ไฟล์, ครอบคลุม ToggleSwitch ทุกตัวที่ใช้ `.bmb-toggle` ทั้งแอป):**
  1. `src/index.css` — `.bmb-toggle-knob` `5×5 → 7.5×7.5px` (+50%) · `top: 2px → 50%` + `translateY(-50%)` (จัดกึ่งกลางแนวตั้ง) · `.bmb-toggle-track` `height 9 → 4.5px` (−50%) · `.is-on .bmb-toggle-knob` `translateX(31 → 28.5px)` (40−7.5−2−2) — คงมุม 3px/2px
  2. `src/__tests__/theaterMenuControl.test.ts` — `height: 4.5px` + เพิ่ม assertion knob `7.5px` (width/height)
- **Gates:** tsc 0 · lint OK · vitest 262 files/3,043 tests PASS · build PASS
- **Note:** knob 7.5px > track 4.5px (ตั้งใจ — knob ใหญ่กว่ากรอบบาง) · LIVE_TEST_PENDING (Owner visual)

---

## R124 — 2026-11-27 — THEATER MENU CONTROL: MOVE TO /admin/products + TOGGLE HEIGHT −50%

- **Root Cause:** กล่อง `TheaterMenuControl` ถูกวางไว้บนหน้าแรก `/shop` (`HomePage.tsx`) ทั้งที่เป็นกล่องควบคุมของฝ่ายแอดมิน → เจ้าของร้าน/แอดมินหาไม่เจอและสับสนกับช่อง "🎭 Theater Carousel" ในฟอร์ม `/admin/media-portfolio` (คนละตัวกัน — อันหลัง เป็น `<input type="checkbox">`)
- **Fix (4 ไฟล์):**
  1. `src/pages/HomePage.tsx` — ลบ import `TheaterMenuControl` + ลบ render `<TheaterMenuControl products={products} />` ออกจากหน้า `/shop` (คง `products` ส่วนอื่นไว้ครบ)
  2. `src/pages/admin/AdminProducts.tsx` — เพิ่ม import + render `<TheaterMenuControl products={products} />` **ก่อน** `<HomePopularManager>` (คือเหนือแผง 🔥 เมนูยอดนิยม หน้าแรก) → กล่องอยู่ในหน้า `/admin/products` เท่านั้น
  3. `src/index.css` — `.bmb-toggle-track` `height 18px → 9px` (ลด 50%) · `.bmb-toggle-knob` `14×14 → 5×5` · `translateX(22px) → 31px` (40−5−2−2) · เงา `0 2px 6px → 0 1px 3px` — คงมุม 3px/2px (ไม่ใช่วงกลม/แคปซูล)
  4. `src/__tests__/theaterMenuControl.test.ts` — อัปเดตข้อตกลง: control อยู่ใน `AdminProducts` ก่อน `HomePopularManager` · `HomePage` ไม่มี `<TheaterMenuControl>` แล้ว · `height: 9px`
- **Gates:** tsc 0 · lint OK · vitest 262 files/3,043 tests PASS · build PASS · PUSHED (`1124b2f`)
- **Note:** role gate คงเดิม (admin/owner/manager) — หน้า `/admin/*` มี `AdminPage` gate อยู่แล้ว; `<input type="checkbox">` ปกติไม่ถูกแตะ

---

## R123i — 2026-11-27 — FLOATING AD: CONSOLIDATE TO SINGLE TOGGLE (ตัดสวิตช์ซ้ำซ้อน + ตัด race กระพริบ)

- **Root Cause:** Floating Ad มีสวิตช์เปิด/ปิด **2 ตัวซ้อนกัน** คนละคีย์ใน `business_settings` — ① `floating_ad_enabled` (kill switch ใน AdminSettings, testId `floating-ad-toggle`) และ ② `floating_ad_config.enabled` (master ใน FloatingAdTab) · `FloatingAdBanners` มี `useState(true)` แล้วค่อย fetch `floating_ad_enabled` แบบ async → รอบแรก render ก่อนเสมอ แล้วค่อยหาย = **กระพริบตอนโหลด** · ถ้าตั้งสองตัวไม่ตรงกัน = ปิดแล้วโผล่อีก
- **Fix (single source = `floating_ad_config.enabled`):**
  1. `src/components/home/FloatingAdBanners.tsx` — ลบ `floatAdEnabled` state + kill-switch `useEffect` (async fetch `floating_ad_enabled`/`floating_ad_config`) · เปลี่ยน early-return เป็น `if (config?.enabled === false) return null` (เชื่อม config prop จาก HomePage) → ตัด default-true = หาย flash
  2. `src/pages/admin/AdminSettings.tsx` — ลบคาร์ด "Floating Ad Kill Switch" (`floating-ad-switch`/`floating-ad-toggle`) + ตัด `floating_ad_enabled` ออกจาก `TYPED_FORM_KEYS` → เหลือสวิตช์เดียวใน FloatingAdTab
  3. `src/pages/HomePage.tsx` — คง gate `floatingAdConfig.enabled` (บรรทัด 613) เป็น single source (ไม่เปลี่ยน)
  4. `src/lib/bmbAdminApi_settings.ts` — คง `getFloatingAdConfig` (อ่าน `floating_ad_config` เป็นหลัก, legacy `floating_ad_enabled` เป็น fallback migration ครั้งเดียว)
- **Gates:** tsc 0 · lint OK · vitest 3,029 PASS · build PASS

---

## R120 — 2026-11-27 — SECTION-FLOAT-MASCOT: POSITION:ABSOLUTE + FLOAT AMPLITUDE FIX (มาสคอตลอยพ้นออกจากเฟรมหัวข้อ)

- **Root Cause:** `.section-float-mascot` เป็น `display: inline-block` ใน normal flow ภายในกล่องหัวข้อ `<h2>/<h3 class="flex items-center">` — `animation: float` (`translateY(-10px)`) แกว่งแค่ในบรรทัดหัวข้อ (line-box) → ตอนลอยขึ้นถึงจุดสูงสุดส่วนบนของ badge ชนขอบหัวข้อแล้วถูกตัด ("ขาด" ตอนบน) — มันไม่สามารถ "ลอยออกนอกเฟรม" ได้เพราะถูกกักอยู่ในกล่องหัวข้อ
- **Fix (2 ไฟล์):**
  1. `src/index.css` — `.section-float-mascot`: เพิ่ม `position: absolute; right: 0; top: 50%; transform: translateY(-50%)` → badge ออกจาก normal flow ไม่ถูกจำกัดโดย line-box ของหัวข้อ; `@keyframes float` amplitude `-10px → -22px` ให้เห็นการลอยชัดเจนพ้นขอบหัวข้อ; ลบ duplicate `@keyframes float` (บรรทัด 358)
  2. **8 ไฟล์ heading containers** — เพิ่ม `relative` + `pr-10` (กันข้อความชน badge): `HomePage.tsx` (3 จุด: Popular/SameDay/PreOrder) · `CategorySections.tsx` · `MenuPage.tsx` · `ReviewPage.tsx` (2 จุด) · `PromotionStrip.tsx` · `VerifiedReviewsSection.tsx` · `ReviewCarouselSection.tsx`
- **Gates:** tsc 0 · lint OK · vitest 259 files/3,029 tests PASS · build PASS (PWA v1.3.0)
- **Test:** LIVE_TEST_PENDING (Owner visual test on production)

---

- **Backup gate:** no restorable backup existed (PITR off, backups=[]); created `supabase db dump --linked` → `D:\A PROJECT\backups\backup_pre233_2026-11-26.sql` (708,421 B · SHA-256 36209070…FF736); restore-tested on Docker postgres:16 (77 public tables).
- **Apply:** Owner `db push --include-all` created schema 219–228+233 (verified via fresh remote dump). **Ledger drift** (schema applied, `schema_migrations` blank) → `supabase migration repair --status applied 219 220 221 222 223 224 225 226 227 228 233` → `migration list` = 001–233 all applied, no gaps/dups.
- **Rules:** added UNIVERSAL_MASTER_AI_RULES §18 (Migration Ledger Integrity: prevent/diagnose/fix) + AI_ENTRYPOINT rule 20 + BMB_AI_WORKING_STATE §3.6.
- **Remaining:** live OCR/PO/GRN + regression (Owner). PITR disabled (Owner accepted manual dump).

## R111 — 2026-11-26 — PHASE 2 WP2: PO WORKFLOW RPC (MIGRATION 224) + API + DB INTEGRATION TESTS

## R118 — 2026-11-26 — PRODUCTION-FIRST POLICY ADOPTED + PHASE 2 HONEST STATUS

- **Owner Master Rule (Production-First):** no auto-staging; production = single real system; migration parity mandatory; incremental Expand-Migrate-Contract delivery; production writes/deploy need explicit Owner authorization; testing reported by type (no substitution, no skipped-E2E-as-pass); completion reported as 7 separate levels (never single "COMPLETE"); no endless development.
- **Phase 2 honest status:** Development Complete · Committed&Pushed (HEAD=origin/main=3b4349e) · Migration Ready (219-228, Docker replay 232 OK) · NOT deploy-approved · NOT deployed · NOT prod-smoke · NOT Owner-accepted. E2E (WP3/WP5) NOT proven (no test env by policy).
- **No deploy performed. Production ledger still 218. Tree clean.**

## R117 — 2026-11-26 — PHASE 2 WP9+WP10: FULL REGRESSION + READINESS/HANDOFF

- **WP9 Full regression:** Docker replay 001→228 `migrations=232 OK / 0 FAIL` + Phase 1 (124-213, 214-218) + Phase 2 (219-223, 224, 225, 226, 227/228) contracts ALL GREEN · vitest 256/3,014 · lint 0 · tsc 0 · build PASS
- **WP10 Readiness:** docs/PHASE2_READINESS_WP10.md (scope table, test evidence, security posture, remediations, known limitations, next steps) · WORKING_STATE handoff r14
- **Production:** NOT deployed (ledger 218) — separate Owner approval required
- **Known limitations:** WP3/WP5 E2E specs LIVE_TEST_PENDING (need staging + DB 219-228 + auth)

## R116 — 2026-11-26 — PHASE 2 WP7+WP8: PRICE HISTORY + PO DASHBOARD READ APIs (227/228) + DASHBOARD UI

- **Task:** PHASE2-WP7/WP8 (Owner Master Directive continuous execution)
- **Migrations 227/228 (TEST DB only):** get_purchase_price_history + get_po_dashboard — both SECURITY INVOKER (RLS m223 enforced, branch/tenant scoped). REMEDIATION: wrapped jsonb_agg subqueries (staged nested-aggregate/GROUP BY bug)
- **API + UI:** src/lib/bmbAdminApi_purchaseAnalytics.ts + types PurchasePriceHistory/PODashboard; src/pages/admin/PurchaseDashboardPage.tsx (KPI + action lists, real RPC) as first PurchaseHub tab
- **Tests:** DB e2e/contracts_wp7_wp8_227_228.sql 6 cases ALL PASS (INVOKER + RLS branch isolation price history + dashboard, admin cross-branch, filters) · static 5 + API 3 · wired replay
- **Gates:** replay 001-228 migrations=232 OK/0 FAIL + all contracts ALL GREEN · vitest 3,014 · lint 0 · tsc 0 · build PASS · production untouched (218)
- **Next:** WP9 (Full regression / security / performance)

## R115 — 2026-11-26 — PHASE 2 WP6: WAVG POSTING + REVERSAL (MIGRATION 226) + DB INTEGRATION TESTS

- **Task:** PHASE2-WP6 (Owner Master Directive continuous execution)
- **Scope:** Inventory integration — promote staged wp6 to migration 226 + DB tests (no new UI)
- **Migration 226 (TEST DB only):** calculate_grn_line_landed_cost + compute_grn_payload_hash + post_goods_receipt_line + post_goods_receipt + reverse_grn — FOR UPDATE lock order, WAVG from accepted_qty + landed cost, idempotency (key+payload hash / ERR_IDEMPOTENCY_CONFLICT / ERR_ALREADY_POSTED), line double-post guard, reversal positive-mirror + reversal_of (unique once) + itx type=out + correction entry, PO received/status transitions, audit
- **WP6 REMEDIATION:** removed non-existent has_staff_branch_scope; Asia/Bangkok date (m190 gate)
- **Tests:** DB e2e/contracts_wp6_226.sql 9 cases ALL PASS (post+WAVG stock24/wavg11, idempotent retry no double, hash conflict, already posted, staff role gate, reversal stock0/out/correction/orig reversed, double-reversal reject, line double-post guard) · static 10 · wired replay
- **Gates:** replay 001-226 migrations=230 OK/0 FAIL + phase1+phase2+wp2+wp4+wp6 ALL GREEN · vitest 256/3,006 · lint 0 · tsc 0 · build PASS · production untouched (218)
- **Next:** WP7 (Price History read API)

## R114 — 2026-11-26 — PHASE 2 WP5: GOODS RECEIVING UI + E2E SPEC

- **Task:** PHASE2-WP5 (Owner Master Directive continuous execution)
- **Scope:** GRN UI in existing PurchaseHub (no duplicate hub) — real WP4 API (migration 225), no mock
- **UI:** src/pages/admin/GoodsReceivingPage.tsx — select receivable PO → enter actual qty → auto good/rejected split → save draft → approve (inventory/admin) + detail modal; responsive
- **Nav:** AdminHubs.tsx — new "รับสินค้า (Goods Receiving)" tab
- **Tests:** src/__tests__/goodsReceiptsApi.test.ts 3 API-wiring tests PASS · e2e/goodsReceiving.spec.ts Playwright create→approve — LIVE_TEST_PENDING (staging + DB 225 + auth)
- **Gates:** tsc 0 · lint 0 · vitest 255/2,996 · build PASS · production untouched (218)
- **Next:** WP6 (WAVG posting/reversal + idempotency)

## R113 — 2026-11-26 — PHASE 2 WP4: GRN WORKFLOW RPC (MIGRATION 225) + API + DB INTEGRATION TESTS

- **Task:** PHASE2-WP4 (Owner Master Directive continuous execution)
- **Scope:** GRN Backend — promote staged wp4 to migration 225 + API + DB tests (UI = WP5)
- **Migration 225 (TEST DB only):** generate_grn_number (grn_number_seq + BKK) + create_grn_draft (partial/multi, over-receive guard cumulative committed, accepted+rejected=received, conversion/price/lot snapshot, inherited org, audit) + approve_grn (inventory/admin + draft gate) + has_org_row_scope in-body
- **WP4 REMEDIATION:** removed non-existent has_staff_branch_scope; Asia/Bangkok date (m190); create gate = is_staff OR is_inventory
- **API:** src/lib/bmbAdminApi_goodsReceipts.ts + types GoodsReceipt/Line/Form + GRNStatus
- **Tests:** DB e2e/contracts_wp4_225.sql 8 cases ALL PASS · static 8 · wired replay
- **Gates:** replay 001-225 migrations=229 OK/0 FAIL + phase1+phase2+wp2+wp4 ALL GREEN · vitest 254/2,993 · lint 0 · tsc 0 · build PASS · production untouched (218)
- **Next:** WP5 (GRN UI / E2E)

- **Task:** PHASE2-WP2 (Owner Master Directive 2026-11-26: "WP2 APPROVED TO START AFTER WP1 PUSH VERIFIED" → continuous execution)
- **Scope:** PO Backend จริง — promote staged `wp2_po_workflow_rpc.sql` เป็น migration 224 + TypeScript API + DB integration tests (UI = WP3)
- **Migration 224_purchase_order_rpcs.sql (applied to TEST DB only — production ledger stays 218):**
  - `generate_po_number()` — po_number_seq (m219) + format PO-YYYYMMDD-{seq:04d} + Asia/Bangkok date
  - `create_purchase_order(...)` — draft + lines, supplier active/conversion>0/qty>0 validation, price fallback last_approved_price, branch guard (ERR_FORBIDDEN_BRANCH), audit
  - `update_purchase_order(...)` — optimistic lock (p_version, ERR_VERSION_MISMATCH) + status gate (draft/submitted) + has_org_row_scope + audit
  - `submit_purchase_order(...)` — draft→submitted + line checks + audit
  - `approve_purchase_order(...)` — finance/admin only (ERR_FORBIDDEN_APPROVER) + submitted gate + writes supplier_products.last_committed_price (Owner B4) + audit
  - SECURITY DEFINER ตรวจ role + has_org_row_scope ภายในตัวเองทุก function (Owner C); GRANT EXECUTE authenticated
- **WP2 REMEDIATION:** ลบ `has_staff_branch_scope()` ที่ไม่มีอยู่ใน migration ใด (runtime defect ในตัว staged) — redundant กับ has_org_row_scope (m223); ใช้ Asia/Bangkok date แทน CURRENT_DATE (กัน m190 BKK gate)
- **API:** `src/lib/bmbAdminApi_purchaseOrders.ts` (create/update/submit/approve + reads ผ่าน supabase.rpc/tables จริง ไม่ mock) · types `PurchaseOrderHeader/Line/Form` + `POStatus` (แยกจาก legacy PurchaseOrder เดิม)
- **Tests:**
  - DB integration `e2e/contracts_wp2_224.sql` — 10 cases (number-gen, validation, optimistic lock, duplicate submit, invalid transition, role gate, branch scope, audit) ALL PASS บน real Postgres
  - Static `src/__tests__/contracts_224_po_rpcs.test.ts` — 17 tests PASS
  - Wired เข้า `e2e/ci/w2_fresh_replay_full.sh`
- **Gates (all green):** Docker replay 001→224 `migrations=228 OK / 0 FAIL` + phase1 + phase2(219-223) + wp2(224) contracts ALL GREEN · vitest 252 files/2,980 tests · lint 0 · tsc 0 · build PASS (PWA v1.3.0)
- **Next:** WP3 (PurchaseHub PO UI / E2E) — extend existing PurchaseHub (AdminHubs.tsx), real API, no mock

## R110 — 2026-11-26 — PHASE 2 WP1: SCHEMA MIGRATIONS 219-223 (REMEDIATED + OWNER ACCEPTED + COMMIT)

- **Task:** PHASE2-WP1-SCHEMA (Owner directive 2026-11-26: "WP1 REMEDIATION & SCOPE CORRECTION" → Final Reconciliation → "คอมมิทพุชให้ ผ่านเขียวหมด")
- **Scope:** WP1 = Schema/Constraints/Indexes/RLS/Contract เท่านั้น — Workflow RPCs ย้ายไป `supabase/staged_workflows/` (wp2/w4/w6/w7/w8, ไม่ apply)
- **Migrations 219-223 (additive, idempotent, NOT applied to production):**
  - 219 purchase_orders + purchase_order_lines + po_number_seq (contract PO-YYYYMMDD-{seq})
  - 220 goods_receipts + lines — idempotency_key + payload_hash (uq), reversal_of linkage (uq once, no-idem CHECK, no self-link), grl_acceptance_balance CHECK, ลบ price_variance generated col (DEFECT-1)
  - 221 purchase_price_history append-only (trigger + SELECT/INSERT grants), ลบ package_size (DEFECT-5), landed_cost นิยามใน COMMENT (DEFECT-4), +tenant_id/branch_id
  - 222 inventory_transactions ext (po_id/grn_id/grn_line_id/unit_cost/conversion_snapshot + COMMENT)
  - 223 RLS org/branch isolation — has_org_row_scope (platform/tenant/branch ตาม m065/071/088/090/146) + 17 policies
- **DEFECT-1..5 fixed & proven on real Postgres** (ตาม matrix §15.1 ใน `docs/PHASE2_DESIGN_REPORT.md`)
- **Gates (all green):** Docker replay fresh DB `OK=227 FAIL=0` (ledger 223 versions) + Phase 1 contracts (214-218) + regression 124-213 ALL GREEN · NEW `e2e/contracts_phase2_219_223.sql` 33 test IDs ALL PASS · static 6 files/132 tests (full suite 251 files/2,963 tests) · lint 0 · tsc 0
- **Fix during session:** replay grep extraction (NOTICE prefix) · test-count reconciliation 36→33
- **Blocked/next:** WP2 (ต้องได้ Owner อนุมัติแยก) — ดู `supabase/staged_workflows/README.md`

## R109 — 2026-11-25 r4 — LIVE TEST RESULTS + OWNER DECISIONS (E/F LIVE_VERIFIED, G/H PARTIAL, C-1..C-6 RESOLVED, OMISE RESOLVED)

**Status:** CODE_CLOSED + GATES PASS — All gates green: lint OK, tsc 0, vitest 2830 tests (245 files). Contract suite 67 files ALL GREEN.

### Live Test Results (2026-11-25):

| Group | Tests | Result | Details |
|-------|-------|--------|---------|
| **E** (Rider History + Maps) | 7 | ✅ **LIVE_VERIFIED** | E-1..E-6 PASS. OSM fallback verified. E-7 diagnostic. |
| **F** (Background Music + Mascot + OAuth) | 7 | ✅ **LIVE_VERIFIED** | F-1..F-4, F-7 PASS. F-5, F-6 legacy verified. |
| **G** (Marketing + Studio + Floating Ad) | 7 | â¸ï¸ **PARTIAL** | G-1..G-5 PASS (5 tests). G-6, G-7 pending. |
| **H** (FB Cart Bridge) | 6 | â¸ï¸ **PARTIAL** | H-3..H-6 PASS (4 tests). H-1, H-2 pending. |
| **I** (Server Cart + FB IAB + 1 Reply) | 8 | â¸ï¸ **PAUSED** | Critical path, awaiting Owner test. |

### Owner Decisions — C-1..C-6 RESOLVED (2026-11-25):

| Conflict | Decision | Implementation |
|----------|----------|----------------|
| **C-1** Pre-order cutoff vs Same-day | Same-day = 24h ordering; Pre-order cutoff for delivery only | Logic already supports both |
| **C-2** Multi-branch zone overlap | First-registered branch wins | Deterministic assignment via registration timestamp |
| **C-3** Coupon stacking | Approved — implement min-order/max-discount/per-user limits | Add to promotion schema |
| **C-4** Vote rewards points | **Vote gives points** — update m208 to write points_ledger | Migration needed for points_ledger entry |
| **C-5** CRM consent granularity | **Add granularity** — winback/birthday/channel sub-fields | Schema migration for consent sub-fields |
| **C-6** Floating ad vs Mascot | **Already fixed** in layout | Mascot repositioned; Floating ad z-index managed |

### Omise TEST Card — RESOLVED:
- Not a blocker. Stripe QR = primary payment, Omise = fallback.

### Verification:
- `npx vitest run` — 2830 tests PASS (245 files)
- `npm run lint` — OK
- `npx tsc --noEmit` — 0 errors

### Next Steps (per Owner order):
1. Owner audit review of 67 contract files
2. Complete Live Test Groups G-6, G-7, H-1, H-2, I-1..I-8
3. Owner Gate Phase 1 → Phase 2
4. Phase 1-6 all PAUSED per Owner order

---

### R108 — 2026-11-25 r3 — CONTRACT AUDIT CLOSURE 124-213 COMPLETE (15 FILES, 311 TESTS ALL GREEN)

**Status:** CODE_CLOSED + GATES PASS — 15 new contract test files covering 28 remaining migrations (179, 181-189, 191-207, 211-213) all passing (311 tests). Combined with existing 52 contract files = 67 files ALL GREEN (0 FAIL) on fresh DB.

### Contract Test Files Created (15 files, 311 tests):
1. `contracts_179_notification_hub.test.ts` (24 tests) — channel_identities + notification_outbox + 4 RPCs + feature flags + bmb_notify_http
2. `contracts_181_186_promotions.test.ts` (13 tests) — addon margin rules + promotions BKK date gates
3. `contracts_182_188_messages.test.ts` (40 tests) — order messages + notifications + rider notify + dedup
4. `contracts_189_197_rider_fallback.test.ts` (24 tests) — claim fallback + rider loop fix
5. `contracts_191_kitchen_bkk.test.ts` (13 tests) — kitchen BKK date functions
6. `contracts_192_193_crm.test.ts` (22 tests) — CRM automation + consent
7. `contracts_194_195_payment.test.ts` (10 tests) — payment void enum + close-on-cancel
8. `contracts_196_206_media_buckets.test.ts` (13 tests) — background_music + mascot bucket policies
9. `contracts_198_200_reviews.test.ts` (23 tests) — review moderation + verified rules + anon read behavior
10. `contracts_201_202_theater.test.ts` (14 tests) — theater carousel + approval_id on promotions
11. `contracts_203_204_ai_memory.test.ts` (29 tests) — AI grounding + user_post_context + order memory + review_content sync
12. `contracts_205_social_actions.test.ts` (16 tests) — cancel_order_as_customer + social_timeline_for_web
13. `contracts_207_211_rider_history.test.ts` (21 tests) — my_deliveries v3 dates + v3-fixed RETURN fix
14. `contracts_212_delivery_sync_hop.test.ts` (26 tests) — preparing -> ready_for_dispatch hop + ERR_KITCHEN_NOT_READY guard (3 RPCs)
15. `contracts_213_cart_payload.test.ts` (6 tests) — cart_sessions payload + select_own RLS

### Key Patterns Enforced:
- Every test file = `BEGIN ... ROLLBACK` single transaction, runs on fresh DB, no new shims
- `?raw` import with flexible substring/regex matching (handles truncation)
- Fixture: auth.users → trigger `handle_new_user` (006) creates profile `customer`; role upgrade via `UPDATE profiles` BEFORE setting JWT (guard 014 bootstrap)
- `set_config('request.jwt.claims', ..., true)` persists for entire transaction
- `now()` = transaction timestamp; test trigger updated_at requires separate DO blocks (2 transactions)
- GRANT/REVOKE don't affect superuser; test role permissions via `SET LOCAL ROLE anon/authenticated`
- PRE_ORDER fixtures need `dropoff_detail` + real `delivery_round_id` + `pre_order_cutoff` '23:59'
- Time comparisons via `LIKE 'HH:MM%'` (format 15:00:00)
- 148 supersedes 145 (`same_day_cutoff` = DROPPED); 198/199 supersede 157 (`reviews_anon_read` = DROPPED) — tests pin current state
- NEVER call `bmb_tick_http` real (production EF) — verify function exists only

### Verification:
- `npx vitest run src/__tests__/contracts_*.test.ts` — 15 test files, 311 tests PASS
- All 15 files follow atomic execution (one file at a time), no macro-prompts, no placeholders
- Documentation synchronized per Protocol §0.3: MASTER_STATUS, WORK_QUEUE, AI_WORKING_STATE, CHANGELOG updated

### Next Steps (per Owner order via commit 9221626):
1. Owner audit review of 67 contract files
2. Live Test Groups E, F, G, H, I (35 cases total) — Sprint: F+E week 3-4 → G+H week 5-6 → I week 7-8
3. WAIT for Owner Gate Phase 1 → Phase 2 after I-1/I-2 pass
4. Phase 1-6 all PAUSED per Owner order

---

### R107 r2 - Lint fix (commit 1c2f749 "Edit doc BOM") - CI GREEN AGAIN
- Root cause 1: UTF-8 BOM on BMB_AI_WORKING_STATE / BMB_CHANGELOG / BMB_MASTER_STATUS / BMB_WORK_QUEUE (PowerShell Set-Content -Encoding UTF8 always adds BOM in PS 5.1) - rewritten without BOM via Node fs
- Root cause 2: Admin_User_Manual_TH.md foreign chars 5 spots (Arabic/Chinese/Hebrew/Chinese = การ์ด/ตามเวลา/ยกเลิก/คัดกรอง) - fixed to proper Thai
- Gates after fix: lint OK (languageSanity 2,054 files clean) - tsc 0 - vitest 230 files/2,519 tests PASS
- New rule: never write .md via PowerShell Set-Content (BOM); use Node fs or Write tool - languageSanity rejects BOM/foreign chars

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

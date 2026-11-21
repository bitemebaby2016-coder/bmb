## 🔒 SESSION CLOSE 2026-11-21 (รอบ 58 · R82 — Rider System Completeness Fix: my_deliveries JOIN fix + offline gate + arrived completeness + Thai reasons) · **CODE_CLOSED + BUILD+LINT+TSC+VITEST ALL PASS**

**R82 — ระบบไรเดอร์สมบูรณ์จริง (แก้บั๊กหลัก R48/m207 + เพิ่มกติกาใหม่):**
- **P0-1: my_deliveries v3 JOIN fix (m210)** — แก้ `o.round_id` → `o.delivery_round_id` ทั้ง assignments + offers (m207 bug: column ไม่มีจริง ทำให้ 42703 ทุกครั้ง) · เพิ่ม RUNTIME VERIFICATION จริงใน migration (seed fixture + execute 5-arg) · เพิ่ม SQL contract `e2e/contracts_210_rider_my_deliveries.sql` ใน CI (G1-G6 ครอบ: 5-arg execute, filter, offers, offline gate, arrived auto-close, ambiguity) · รันจริงจับ 42703 ที่ pg_get_functiondef จับไม่ได้
- **P0-2: riderHistory filterAssignments** — งาน active (assigned/accepted/picked_up/in_transit/arrived) เห็นในแท็บวันนี้เสมอ ไม่ขึ้นกับ scheduled_date · scheduled_date NULL fallback ไป assigned_at สำหรับงานประวัติ · getMonthKey ใช้ getFilterDate fallback
- **P1-3: Offline gate + Thai reasons** — driver_accept_assignment + claim_dispatch_offer (รวม fallback m189) + driver_decline_assignment + admin_cancel_assignment + assign_driver reassign: `IF v_drv.status = 'offline' THEN RAISE ERR_DRIVER_OFFLINE` · DRIVER_ERROR_TH เพิ่ม `'ไรเดอร์อยู่ในสถานะออฟไลน์ (พักงาน) — ต้องเปิดสถานะพร้อมรับงานก่อนจึงจะรับงานได้'` · assignDriver คืน DriverActionResult (ไม่ทิ้ง error) · DeliveryManagement handleAssign โชว์เหตุผลไทยจริง + confirm warning เมื่อมอบหมายไรเดอร์ไม่ available (override ได้ แต่แจ้งให้รู้)
- **P1-4: Arrived completeness** — close_assignments_on_order_terminal + busy-lists ทุกฟังก์ชัน (decline/cancel/assign reassign) เพิ่ม 'arrived' (m197 guard ครบแล้ว) → ป้องกันงานผีเมื่อ cancel order ตอน arrived
- **Test updates** — r48RiderHistoryTabs.test.ts: แก้ assertion JOIN ผิด (o.round_id → o.delivery_round_id) + เพิ่มเคส offline gate + arrived + runtime verify · riderHistory.test.ts: เพิ่มเคส active-job-always-visible + NULL scheduled_date fallback · riderFullCycle.test.ts: เพิ่ม offline gate tests (accept/claim → ERR_DRIVER_OFFLINE kind=state) + assignDriver .ok check · supabaseMock: my_deliveries เพิ่ม scheduled_date + offline gate + 5-arg filters · assignDriver mock คืน DriverActionResult
- **Gates:** lint ✅ · tsc ✅ · vitest 228 files / 2439 tests PASS (+8) · build ✅ (tsc + vite + PWA) · contract-tests (CI ephemeral PG) ready

**รอ Owner:** apply m210 ขึ้น prod ตามแพทเทิร์น m209 (prodCheck READ-ONLY → apply → verify รันจริง: SELECT my_deliveries 5-arg ผ่าน 42703) → record ledger → Owner ทดสอบ live: แอดมินมอบหมาย → ไรเดอร์เห็นงาน ≤25 วิ ทั้งเว็บ/PWA · ประกาศงาน → ไรเดอร์ทุกคนเห็น · offline rider กดรับ → เห็นเหตุผลไทย

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

## 🔒 SESSION CLOSE 2026-11-20 (รอบ 55 · R55 · Background Music file-based engine + Mascot badge fix + OAuth/Passkey ALL CONFIGURED:
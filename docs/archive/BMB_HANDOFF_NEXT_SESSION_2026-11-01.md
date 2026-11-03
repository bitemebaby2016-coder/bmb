# BMB — HANDOFF สำหรับแชทใหม่ (ปิดเซสชัน 2026-11-01 · หลัง R49+R50)

> **อ่านไฟล์นี้เป็นไฟล์แรกในแชทใหม่** ต่อจากนั้น: `AI_ENTRYPOINT.md` → `UNIVERSAL_MASTER_AI_RULES.md` → `AI_WORK_STATE.md` (บล็อก R50) → `docs/BMB_PRODUCTION_TEST_PACK.md` (§S = checklist)
> HEAD = `git log --oneline -1` · production ledger = **181** (`r50Apply174_181-result.json` ALL_PASS 6/6 · `r49Apply180-result.json` ALL_PASS 6/6) · EF `notification-dispatcher` deployed

## ทำแล้ว R47-R50 (มีหลักฐาน)
1. AI Studio 5 ข้อ (R47) + Notification Hub E2E m179 (R48) + GPS/Theater (R48)
2. **R49:** DoD แจ้งเตือน 3 ข้อ (idempotency/popup claymation/reminder+abandoned cart จริง m180) + **Add-on Profit Margin** m181 (cap admin-driven แทน hardcode · promo_price server · cross-sell เรียงกำไร · Checkout margin guard · การ์ดกฎ /admin/products · audit ทุก save)
3. **R50:** apply 174-181 ครบ (ALL_PASS 6/6) · Strip copy ใหม่ 3 บรรทัด · ยุบเซ็กชั้นรีวิว → `📸 รีวิวจริงจากลูกค้า` + อัลบั้มรูปจริง · ประกาศล่าสุด → Floating (≤2+ปิด+ลิงก์จริง) + ซ้ายล่างหน้าแรกซ่อน + `/promotions` หัวข้อใหม่ · **Bite ทับศัพท์ทุกจุด** (web+EF) · Home→/shop (ล็อกอิน) + Register→/shop · การ์ด floating 70-80% จอ · **รูป AI = `bmb-images/ai-generated/`**

## งานค้างที่ต้องทำในแชทใหม่ (เรียงลำดับ)
1. **TEST_PACK §S ทั้งหมด (S-1..S-19) บน production** + §R เดิม · ถ้าแดงเก็บภาพ+query
2. **Maps T9 retest** (Owner กด Save Console + 5 นาที → 3 ฝั่ง)
3. **Social AI ตอบเมนู/ออเดอร์เก่า** → เพิ่ม rule ลง `_shared/shopContext.ts`/system prompt "ใช้เฉพาะ MENUS ของโพสต์/บริบทนี้ ห้ามอ้างออเดอร์-เมนูเก่า" + ทำ draft validation strict (รายการต้องอยู่ใน catalog ของโพสต์นั้น) · **ยังไม่ได้แตะรอบนี้**
4. **`/shop?cart=` เคสตะกร้าว่าง** (Owner ยังเจอ) → Layout: re-add ครั้งที่ 2 หลัง 700ms กัน persistence restore ล้าง + ตรวีด FB ตัด/ย่อ query (R43 toast มีแล้ว)
5. **SEO ทุก route ครบ** → ตรวจนับ `path=` vs `SeoHelmet` ใน App.tsx (รอบนี้ findstr Access denied) + เติม entry ที่ขาดด้วย meta จริงจาก seo_settings (ห้ามจำลอง)
6. **รีวิว submit** (m099 verified_reviews RPC) — UI ปัจจุบัน list+อัลบั้มเท่านั้น
7. **ประกาศ list ใน `/promotions`** (นอกเหนือจาก floating) · theater_daily_copy seed ใน DB (ไบ๊) = กด save ใหม่ทับ
8. เดิมค้างต่อ: PSID auto-link · LINE live flag · abandoned-cart copy · Add-on P2 server per-line · D-1..D-3 · §Q · retest T6/T10/ถึงปลายทาง

## DoD Checklist แจ้งเตือน (ย้ายมาจาก TEST_PACK §S.2.1 · S-1..S-9 อยู่ที่ TEST_PACK §S.1)

## สิ่งที่ปิดแล้วรอบ R47-R49 (2026-11-01 · มีหลักฐาน)

1. **AI Studio 5 ข้อ (R47)** + EF image-gen deployed
2. **Notification Hub E2E (R48):** m179 (channel_identities + notification_outbox + RPC 4 + flags LINE=mock + bmb-notify cron) · EF notification-dispatcher (builders transactional/reminder/reengage/points/abandoned + drain web_push→messenger→line-mock) · client notificationManager · apply ALL_PASS + gate 401
3. **GPS → เติมที่อยู่อัตโนมัติ** (Nominatim fallback) · **Theater ปฏิทินมุมขวา** (ScheduleDateBadge)
4. **DoD 3 ข้อรอบนี้ (R49):** idempotency (event_key UNIQUE + key คงที่) · Popup 3D Claymation ขอสิทธิ์ push · reminder ตาม `order_policy.reminder_days` + abandoned cart จริง (`cart_sessions`)
5. **Add-on Profit Margin (R49):** m181 admin-driven cap (แทน hardcode 15% server) · promo_price server-side · cross-sell เรียงกำไร · Checkout margin guard · การ์ดกฎใน /admin/products · audit ทุก save

## งานค้าง/ต้องทำในแชทใหม่ (เรียงลำดับทำ)

1. **รัน TEST_PACK §S ทั้งหมดบน production** (S-1..S-19 = รวม DoD รอบ R49) + §R เดิม · ถ้ามีข้อแดง = เก็บภาพ+query แล้วแจ้ง Owner
2. **Maps T9 retest:** Owner กด Save Console + รอ 5 นาที → `/checkout` 3 ฝั่ง (เดสก์ท็อป/แท็บเล็ต/ไรเดอร์ล้างแคช) · ถ้ายังไม่ขึ้น = ขอภาพบรรทัดแดง F12 Console (probe ฝั่งเรา two-try ครบแล้ว ห้ามยิงซ้ำ)
3. **เทสต์ auto-flow ใหม่ทั้งระบบ** (Owner บอกจะลอง) · retest T6/T10 · ตรวจ "ถึงปลายทาง" (1B2)
4. ** Notification เพิ่มเติมที่ยังไม่ได้ต่อ:** ผูก PSID อัตโนมัติใน channel-webhook/socialOrderIntake (RPC `register_channel_identity` พร้อม · column source='order_link' รองรับ) · LINE = เมื่ออนุมัติตั้ง `lineMode='live'` + เขียน sender
5. **Abandoned cart เงื่อนไขละเอียด:** ปรับ window/ข้อความ copy ตาม Owner · ถ้าอยากได้ guest = ต้องมีช่องทาง (บัญชี/PSID) ตอนนี้ guest = skipped_guest
6. **Add-on P2 (_candidates):** server per-line addon discount allocation ใน create_order (ตอนนี้ = client guard + server total cap) · standalone add-on line type ถ้าอนาคตขายท็อปปิ้งเดี่ยว (flag main_dish_required ปัจจุบัน gate แผง cross-sell)
7. **D-1..D-3 + TEST_PACK §Q (ติดไว้) + §L runtime checks เดิม**
8. **งานค้างอื่น ๆ จากแฮนออฟก่อน** = `docs/BMB_HANDOFF_NEXT_SESSION_2026-10-31.md` (B7 pitch ×4 · B5 ตาม D-4)

- **กติกาทำงาน (ย้ำ)**

## DoD Checklist ย้ายมาจาก TEST_PACK §S.2.1 (anchor แก้ fail — ใช้รายการนี้แทน · S-1..S-9 อยู่ที่ TEST_PACK §S.1)

| # | DoD | ต้องเห็นอะไร | จดอะไร |
|---|---|---|---|
| S-10 | Idempotency 1 event = 1 ครั้ง: `SELECT event_key, count(*) FROM notification_outbox GROUP BY 1 HAVING count(*)>1` | ผล = 0 แถว (event_key UNIQUE + key คงที่ `ntf-/remind-/cart-/reeng-/pts-` + claim ไม่แตะ `sent`) | query |
| S-11 | แจ้งเตือนสถานะ (สลิปผ่าน/กำลังส่ง) | outbox คีย์เดียว · `status='sent'` ครั้งเดียวต่อ event | query |
| S-12 | Popup 3D Claymation: เปิด PWA ใหม่ (permission=default) รอ ~6 วิ | การ์ดส้มน้อง Bite "🔔 รับการแจ้งเตือนสถานะอาหาร" · กดเปิด → toast · "ไว้ทีหลัง" = หาย 7 วัน | ภาพ |
| S-13 | Reminder ตามกฎแอดมิน: `order_policy.reminder_days` (default 1 · แก้ 1-14) | ตั้ง 2 → เตือน 2 วันก่อนรอบส่ง (`remind-<order>-<date>`) | ค่า+query |
| S-14 | Abandoned cart 15-30 นาที: ใส่ของ (login) ไม่สั่ง 15-30 นาที | `cart_sessions.status='notified'` + outbox `cart-*` 1 ครั้ง · guest = `skipped_guest` | query+ภาพ |
| S-15 | การ์ดกฎกำไร `/admin/products` → "⚖️ กฎกำไรแอดออน" | ตั้งเพดาน/กำไรขั้นต่ำ/บังคับเมนูหลัก/cross-sell → บันทึก → toast + audit | ภาพ+audit |
| S-16 | ราคาโปรแอดออน: เพิ่ม "ราคาโปร" ใน Toppings ของฟอร์มเมนู | หน้าร้านโชว์โปร+ขีดฆ่า · server คิดโปรจริงตอนสั่ง | ภาพ 2 จอ |
| S-17 | Cross-sell เรียงกำไร: เปิดตะกร้าที่มีของ | แผง `✨ ทานคู่กันอร่อยกว่า` = กำไรสูงสุดก่อน | ภาพ |
| S-18 | คูปองไม่กัดกำไรแอดออน: ส่วนลดเยอะในบิลที่มีท็อปปิ้ง | แถบ `data-testid=addon-margin-guard` เตือนเกินเพดาน | ภาพ |
| S-19 | ดูผล apply รอบ R49 | `e2e/r49Apply180-result.json` = ALL_PASS (6 checks) · ledger 181 | JSON |

## หมายเหตุความถูกต้องของบันทึกรอบนี้ (สารภาพตรง ๆ)

- **r49AddonMargin = 5 ข้อจริง** (it ที่ 6 checkout/cart asserts edit fail → ย้าย checklist มาที่นี่แทน — งานค้างเล็กในแชทใหม่: เพิ่ม it กลับ)
- **TEST_PACK มี §S.1 (S-1..S-9) จริง · §S.2.1 = ไม่ได้เข้าไฟล์** (anchor ไม่เจอ) → ใช้ตารางด้านบนแทน
- commit ลำดับ: `33e9478` (งาน R49 ทั้งหมดแต่หัวข้อเขียนว่า R48 + tsc import ซ้ำ) → `68f5814` (แก้ import = **CI success×2**) → `c5d5034` (แก้ข้อความ commit ให้ตรง) · ข้อความ `68f5814`/`c5d5034` ยังโฆษณา "§S.2.1/6 ข้อ" เกินจริง — **บรรทัดนี้คือความจริง**
- CI ล่าสุด: `68f5814` CI+Contract = success ✓ · Contract `33e9478` = success ✓ (CI แดง = import ซ้ำที่แก้แล้ว)

- bootstrap 3 ไฟล์ทุกแชท · single-run เทสต์ · ห้าม poll log · lint chain ก่อน commit · two-try rule · ห้าม claim PASS โดยไม่มี evidence · secrets ไม่ลง git
## ➕ ADDENDUM ปิดเซสชัน R51+R52 (2026-11-01 รอบ 2 · Owner สั่ง: งานค้าง/งานใหม่ = ทำในแชทหน้า ทันที)

### สถานะจริง ณ ปิดเซสชัน (มีหลักฐาน — อัปเดตตามจริง)
- **R51 = ปิดแล้ว:** CI SUCCESS (run #709) · full suite 196/196 files · tsc 0 · lint OK · **m182 แชต 3 ฝั่ง APPLIED** (`r51Apply182-result.json` ALL_PASS 7/7 · `order_messages` + RPC `send_order_message` + `OrderChatPanel` ฝัง OrdersPage/RiderPwa/AdminOrders)
- **R52 UI codemod = ปิดแล้ว:** heart→`<MascotBadge pose="greeting">` (Login/Register/Reset) · section mascots ครบ (home 4 ไฟล์ + review/menu) · footer social (`imgClass` + Messenger `/Messenger logo.webp`) · dedup `e2e/r52_dedup.cjs` · **AdminHubs rule 12.3 scroll** (`contentRef`+`scrollIntoView smooth`+`hub-content`) · **MascotSettings testid** (`mascot-refresh`/`mascot-alt-`/`mascot-save-`) · **test lock ใหม่ `r52MascotAdminUiLock` 12/12** · gates: `tsc --noEmit` CLEAN · `eslint` 3 ไฟล์ OK · dependency set 30/30 files = **257/257 tests GREEN** · r51 2 files = 22/22
- **งานใหญ่ T1-T5 (Notice/cutlery · pickup→POS · POS ชนิด+หมวด · stroke ตัวหนา · แชต) = ทำเสร็จรอบก่อน** (ดู `AI_WORK_STATE.md` บล็อก R51) — รอ Owner เทสต์ production ①-⑤ เท่านั้น

### 🔴 งานใหม่ 5 ข้อ (Owner 2026-11-01 · เรียงลำดับทำในแชทหน้า)

**N1. Strip copy ใหม่ (ทับ R50/R52 เดิมทั้งหมด)**
```
บรรทัด 1: 🟢 เปิดรับออเดอร์ จองล่วงหน้า/📅Pre-Order  — 🟢 เปิดรับออเดอร์ ส่งวันนี้/⚡Same-Day
บรรทัด 2: 🛵 จองล่วงหน้า/📅Pre-Order : รอบส่ง 7.00 AM เช้า 03/11/2026 (ปิดรับ 05:00 AM)
บรรทัด 3: 🛵 ส่งวันนี้/⚡Same-Day : จัดส่งทันทีหลังครัวปรุงเสร็จ
           (เซมเดย์ไม่ผูกรอบส่งใด ๆ — ห้ามมีคำในวงเล็บ/วงเล็บเดิม)
```
- ⚠️ **Conflict ต้องทับ:** `r13RiderLoopClose` บรรทัด 43-47 เพิ่งแก้เป็น `toMatch(/^รอบส่งถัดไป /)` + `not.toContain('เช้า')` ↔ spec ใหม่ต้องการ `รอบส่ง … เช้า` → แก้ strip source (`StoreStatusStrip` หาด้วย `strip-status-lights`) **+ ปรับ tests ตาม spec ใหม่** (`r44StatusStrip` 69-71, `storeStatusCopy`, `storeStatusWindow`, `r12LandingUi`, `r13RiderLoopClose`)
- หมายเหตุ: วันที่ `03/11/2026` = รอบถัดไปจริง (dynamic จาก delivery_rounds — ห้าม hardcode), cutoff `ปิดรับ 05:00 AM` = `cutoff_time` ของรอบจริง

**N2. "ไบ๊" → "Bite" ทุกตัว (ทับศัพท์)**
- `normalizeBrandNames` (brandName.ts web+EF) มีอยู่แล้ว — งานนี้ = กวาด **source copy จริง** ที่ยังเป็นไทย: `findstr/s` ใน `src/`+`supabase/` (ไม่รวม backups/docs/tests ที่ assert ค่าเก่า) · DB seed `theater_daily_copy` (แอดมิน save ใหม่ทับได้ = แจ้ง Owner) · ถ้าเจอใน test = แก้ assertion ตามกติกาใหม่

**N3. Footer โลโก้**
- FB = `socialLinks.ts:51` มี `imgClass: 'scale-90'` → **ตัวการที่เล็กกว่า** → ลบ/ปรับให้เท่า `w-6 h-6` เดียวกับข้าง ๆ
- Messenger = ใช้ `/Messenger logo.webp` (ไฟล์จริงใน `public/` ✓) อยู่แล้วรอบ R52 → แค่ verify ขนาดเท่ากันทุกปุ่ม
- gate: `footerLinksReal` + `headingOrderFooter` ต้องยังเขียว

**N4. ยุบรีวิว 2 เซกชั่น (Owner: "รีวิวจริงลูกค้าซ้ำ สองเซกชั่น")**
- HomePage มีหลายเซกชั่นรีวิว (cm_f แตะ `home-reviews-heading`/`verified-reviews-heading`/`ReviewGallerySection`/`ReviewCarouselSection`) → **แชทหน้าอ่าน HomePage render order ก่อน** แล้วทำ ① ย้ายรูปสกรีนช็อตของเซกชั่นล่างเข้า **อัลบั้มของเซกชั่นบน** ② คัด **ข้อความจากสกรีนช็อต** มาแทนรีวิวจำลอง (mock) ที่แสดงอยู่ · ถ้าไม่เห็นภาพสกรีนช็อตใน repo = ขอ Owner ส่ง
- คง testids เดิม (`review-photo-album` ฯลฯ) · `uiTechnicalLabels`/`categorySections` อาจต้องปรับ

**N5. Gates ก่อนปิดงาน** = `npx tsc --noEmit` + `npx eslint` ไฟล์ที่แตะ + vitest chunks (single-run ≤15 ไฟล์/ชุด · เกิน 30s = timeout) + push ดู CI

### กติกาทำงานแชทหน้า (ห้ามละเมิด)
1. **อ่านไฟล์เต็ม 100% ก่อนแก้เสมอ** → แก้แบบ **overwrite ทั้งไฟล์** (old_text/new_text ≤ 6,000 chars · เกิน = rename เป็น `.bak` แล้วสร้างไฟล์ใหม่)
2. **1 tool call ต่อ response เท่านั้น** (กัน loop emit ซ้ำ) · findstr = pattern คำเดียวล้วน
3. single-run เทสต์ · ห้าม poll log · lint chain ก่อน commit · two-try แล้ว HALT · ห้าม claim PASS ไม่มี evidence
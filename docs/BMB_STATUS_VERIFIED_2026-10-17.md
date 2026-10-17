# BMB — สถานะจริง + งานค้าง 2026-10-17 (PROBED — ห้ามเชื่อเอกสารเก่า)

> **กติกาเอกสารนี้:** ทุกบรรทัดมาจากการ probe จริง (DB query / git / โค้ด) วันที่ 17 ต.ค. 2026 ~09:45 ICT เท่านั้น
> รายการที่ไม่ได้ probe เองจะระบุ "ที่มา: แฮนด์ออฟ 16–17 ต.ค. (ยังไม่ได้ probe ซ้ำ)" อย่างเปิดเผย
> **เอกสารสถานะก่อนหน้านี้ทั้งหมด = เก่ากว่านี้** ถ้าจะอ้างสถานะ ให้ probe ใหม่เสมอ (คำสั่ง Owner 17 ต.ค.)

---

## 1. สิ่งที่ยืนยันแล้วจากของจริง (17 ต.ค. 09:45 ICT)

| หัวข้อ | ค่าจริง | วิธีตรวจ |
|---|---|---|
| Git | HEAD `765c1c0` = `origin/main`, worktree สะอาด | `git status/log` |
| ออเดอร์ | ทั้งหมด 208 = ทดสอบยุคก่อน (cancelled 205+delivered 1) · **ออเดอร์ลูกค้าจริง = 0** | `select count(*) from orders` |
| โครงสร้างเมนู (ก่อนซ่อม) | sections 4 แถว (**ซ่อนทั้งหมด**) ชื่อซ้ำกับหมวดหมู่ · `cat-4 เครื่องดื่ม` ผูก section ที่ปิด → **ชาไทย 3 รายการหายจากหน้าลูกค้า/เมนูรวม** + server gate `ERR_SECTION_CLOSED` บล็อกออเดอร์ | DB probe + `055_catalog_menu_sections_archive.sql` |
| โครงสร้างเมนู (หลังซ่อม) | sections = 0 · หมวดหมู่ 6 หัวข้อ (active 5 / archived 1 = "จองล่วงหน้า / พรีออเดอร์") · เครื่องดื่มกลับมาลูกค้าเห็นแล้ว | `backups/data-repair-menu-unify-2026-10-17.json` |
| สินค้า | 20 รายการ = ขายได้ **19** (รวม placeholder "coming soon" ฿1 ×2) · archived **1** (W3C test) — **เนื้อหา/ชื่อเมนูแอดมินจัดการต่อเองได้ตลอด** | DB probe |
| `home_popular_menu` | **ยังไม่เคยเซฟ** (ไม่มีคีย์ใน business_settings) → หน้าแรกใช้ค่า default = สุ่มอัตโนมัติ | DB probe |

## 2. ซ่อมข้อมูลแล้ว (commit นี้ = บันทึกงาน)

1. **ปลด `cat-4 เครื่องดื่ม` ออกจาก section ที่ถูกซ่อน** → ลูกค้าเห็นเครื่องดื่มครบทั้ง /shop และ /menu ทันที + สั่งซื้อได้ (gate ไม่บล็อกอีก)
2. **ลบ `menu_sections` 4 แถวที่ซ้ำซ้อน** (ชื่อเดียวกับหมวดหมู่ทั้งหมด, is_active=false, ไม่มีออเดอร์จริงผูก — Owner สั่ง "ลบได้เลย" 17 ต.ค.)
3. หลักฐาน before/after + FK check → `backups/data-repair-menu-unify-2026-10-17.json` (gitignored)

## 3. กำลังทำ (ชุดถัดไป — ปิดใน commit แยก)

**รวมระบบ "หัวข้อเมนู" เป็นระบบเดียว** (ตามคำสั่ง Owner 17 ต.ค.):
- หน้าแอดมิน: เหลือตัวจัดการ **"หัวข้อเมนู"** รายการเดียว (เพิ่ม/แก้/เรียง/ซ่อน/**ลบถาวร**/ย้ายเมนู) — ยกเลิกปุ่ม "เพิ่มหมวดหมู่"/"+ Section" คู่กัน
- หน้าเว็บ: /shop และ /menu ใช้ตัวจัดกลุ่มเดียวกัน — ครบทุกหัวข้อ/ทุกเมนู ไม่มีชื่อซ้ำ ไม่มีเมนูหายเพราะชั้นซ่อน
- ตัดแถว "จองล่วงหน้า" อัตโนมัติที่ทำให้เมนูซ้ำบนหน้าแรก (เมนูจองล่วงหน้าแสดงในหัวข้อของตน + ปุ่ม 📅 ต่อการ์ด + แท็บ /menu ตามเดิม)
- tests วนจนเขียวทั้งลูป → commit+push อีกชุด

## 4. งานค้างทั้งโปรเจค (ของจริง — กรองแล้ว)

### 4.1 บล็อกก่อนขายจริง (Owner ต้องปิดเอง)
| # | งาน | สถานะจริง |
|---|---|---|
| 1 | **เทสต์รับจริง** same-day 1 ใบ + pre-order 1 ใบ (เพื่อน 085 810 1984, ≤300฿) ผ่านสายจริง: จ่าย → Admin confirm → ครัว → ส่ง → เช็ค `📍dropoff_detail` + tracking | ⬜ ยังไม่มีออเดอร์จริงสักใบ — ระบบพร้อม (runbook §C–E) |
| 2 | **เทสต์ Messenger จริง** — ทักแชทเพจ "สวัสดีครับ มีอะไรน่ากินบ้าง" → น้อง Bite ตอบ ≤ ~1 นาที | ⬜ code+deploy แล้ว (ที่มา: แฮนด์ออฟ 17 ต.ค.) ขาดผู้ใช้จริง |
| 3 | **เปิด `QUICK_LOGIN_REQUIRE_OTP=true`** ใน EF `phone-auto-login` แล้วเทสต์ OTP มือถือจริง | ⬜ default = ปิดอยู่ (โค้ดบรรทัด 50) — ใครรู้เบอร์เข้าบัญชีลูกค้าได้ · เงื่อนไข SMS จริงผ่านแล้ว |
| 4 | **Omise LIVE** (KYC → live keys → webhook → เทสต์ยอดต่ำ+refund) ถ้าจะรับบัตร | ⬜ ยัง test-mode เท่านั้น · PromptPay QR/โอน = ใช้รับเงินจริงได้เลย |
| 5 | เซฟ **`home_popular_menu`** ใน Admin → Settings (ตอนนี้ยังไม่เคยเซฟ — หน้าแรกสุ่มโชว์อยู่) | ⬜ |
| 6 | ตัดสินใจ push notifications (`push_subscriptions=0` — แจ้งเตือนไม่ถึงมือถือ) | ⬜ |
| 7 | ลบ/noindex `bitemebaby-5f7.pages.dev` (build เก่า) | ⬜ |
| 8 | ขั้นตอนคืนเงินในคู่มือ (PromptPay คืนมือนอกระบบ) | ⬜ |

### 4.2 งานเทสต์เสริม (ค้างมานาน ควรปิดก่อน/ระหว่างเปิดร้าน)
- GPS matrix มือถือจริง (เคส 1–4) · ตรวจ Email Confirmation ใน Dashboard + เทสต์กู้คืนรหัสผ่านจริง (OD-9)
- ยืนยันเสียงอ่านแบรนด์ "ไท์มีเบบี้" ด้วยหู (แชต + เสียง)
- Visual QA ป้ายปฏิทินวันจัดส่งบนหน้าจริง (มือถือ) — หลัง menu_schedule publish
- Production smoke หลัง deploy รอบนี้ (Gate 5-style 9 จุด)

### 4.3 หลังเปิดร้าน / ยอมรับความเสี่ยงแล้ว (ไม่บล็อก)
migration `PROPOSED_orders.delivery_address` (DEFERRED) · R9/R13/R15 retention/PII + md5→sha256 (accepted-risk, มติ retention รอ Owner) · staging + R11 pgbouncer (deferred) · RC-5 deploy SHA binding (interim = marker scan) · docs reconcile (README/docs 01–02 บรรทัดเก่า) · cart shim (`useCartStore`) · นโยบาย Stripe fallback · `VITE_FEATURE_BRAND_ROUTING` runtime-under-flag · P2/P3: Guest Checkout (OD-2) · Passkeys · Grab/LINE MAN · Talk-to-Bite E2E · voice ต่อเนื่อง · personalization

## 5. กติกาผูกมัด (คงเดิม)
- **HARD STOP:** ห้ามขายจริง/ตัดเงินจริงนอกขอบเขตเทสต์ จนกว่า Owner สั่ง go · เทสต์ = เพื่อน 085 810 1984 · ≤300฿ · คืนเงินเทสต์เสมอ
- Backups = `backups/local-backup-*.json` (ไม่มี PITR) · W3C archived ห้ามลบ (FK) · `bitemebaby-5f7.pages.dev` = STALE
- โพสยังต้องกด publish จาก Admin (G7) — ยกเว้นคอมเมนต์/แชท = ออโต้แล้ว

---
*จัดทำโดย Cline — 17 ต.ค. 2026 · ทุกบรรทัด probe จริงหรือระบุที่มาชัดเจน ไม่มีก๊อปจากเอกสารเก่าโดยไม่ตรวจ*
# BMB — G10 FINAL REPORT (TRUE PRODUCTION CLOSURE)

**G10 RESULT: NOT CLOSED — รอ Owner sign-off + รายการค้างที่ระบุด้านล่าง (เอกสารนี้ = closure evidence pack ไม่ใช่การประกาศ PASS)**
> กติกา: AI DEV ห้ามประกาศ PASS เอง (G9 contract §10.7 precedent) · Owner เป็นผู้ประกาศแต่เพียงผู้เดียว
**รอบ verification:** 2026-10-07 (เริ่มจาก BMB_HANDOFF_NEXT_SESSION_2026-10-06 §4: "ประกอบ closure checklist · รัน verification ที่ไม่ต้องใช้ Owner input")
**Contract อ้างอิง:** spine ใน `BMB_G9_CONTRACT.md` §2 · acceptance bar ใน `BMB_OPEN_SHOP_ACCEPTANCE_HANDOFF.md` §2

---

## 1. CLOSURE CHECKLIST — สถานะจริง ณ 2026-10-07

### เกณฑ์เปิดร้าน 6 ข้อ (BMB_OPEN_SHOP_ACCEPTANCE_HANDOFF §2)

| # | เกณฑ์ | สถานะ | หลักฐาน / ติดอะไร |
|---|---|---|---|
| 1 | สั่งจริงผ่าน production site | ❌ ยังไม่มีออเดอร์ลูกค้าจริง | orders: delivered 1 + cancelled 30 (test) · active=0 · รอเปิดร้าน |
| 2 | จ่ายจริงผ่าน Stripe LIVE | ❌ BLOCKED (Owner/external) | Stripe = "Paused soon" + 2 tasks In review (ภาพ dashboard 2026-10-07) → W-2.1/W-2.2 ค้าง |
| 3 | กิน (เข้าครัวจริง) | ❌ ตามข้อ 1–2 | — |
| 4 | ได้รับจริง (Bite Drive pilot) | ❌ ตามข้อ 1–3 | — |
| 5 | Admin คุมทุกขั้นตอน | ✅ **CODE DONE + defect ปิดแล้ว (118 APPLIED)** | FC gates (bite_drive/radius/zone/external) บังคับที่ `create_order_with_items` จริง · `fcVerify114` 25/25 |
| 6 | ไม่มี regression (gates + probes) | ✅ gates + probes ผ่านหมด | TSC0/LINT0/VITEST 527/BUILD0 ✓ · `fcProdVerify` 9/9 · `fcVerify114` 25/25 · `intakeDriftProbe` 18-param OK |

### งาน AI DEV ที่ทำได้เอง — ปิดรอบนี้

| รายการ | สถานะ | Evidence |
|---|---|---|
| W-2.3 SMS (THSMS) | ✅ **RUNTIME VERIFIED (ส่งจริง 200)** — เหลือ Owner ยืนยันเข้าเครื่อง | secrets ตั้ง (HTTP 201) · รูปแบบทางการ THSMS ยืนยันจาก gist หน้า docs (`msisdn` นำหน้าด้วย 0) · EF deploy ผ่าน CLI · `w23SmsProbe` **3/3** · **รอบ 8: `094***9269` = HTTP 200 (Owner แจ้งไม่ถึง) → รอบ 8b: `082***8546` ผ่าน EF = HTTP 200 `ok:true provider_status:200 to_masked=082***8546`** + `thsmsDirectProbe` ยิงตรง = HTTP 200 `{success:true,code:200}` หักเครดิตจริง · **รอบ 8c: ข้อความสั้น ≤70 → `credit_usage:1`** (ยืนยัน 1 เครดิต) · **⚠️ THSMS credit หมด 0.00** → EF = HTTP 502 / `provider_status:422` · **ข้อสงสัยปลายเหตุ: `SMS_SENDER_NAME="Direct SMS"` มีเว้นวรรค (Sender ID ห้ามเว้นวรรค) → **รอบ 8d: Owner ยืนยันแล้วว่า `Direct SMS` = สาธารณะ/อนุญาตใช้งาน/ใช้งาน (sender ถูกต้อง) + เติมเครดิต 502.00 + ส่งซ้ำ EF ทั้ง `082***8546`/`094***9269` = HTTP 200 (เหลือ Owner ยืนยันรับ)** · normalize `66…→0…` ทำงานจริง |
| Page token | ✅ **LONG-LIVED (expires_at=0 NEVER)** — exchange สำเร็จ + set EF secret | รอบ 8: `fb_exchange_token` (grant_type) ด้วย page token → token ใหม่ type=PAGE · **expires=NEVER** · app Bite Me Baby · scope มี `pages_messaging` · `/me`+เพจ `862940416913026` = 200 (`metaTokenDiag`) · set secret (201) · `publishWorkerProbe` 5/5 |
| Read-only prod snapshot | ✅ | `e2e/g10-prod-snapshot.json` — web 200/canonical ✓ · EF 15 ตัว · RLS 50 tables · triggers 31 |
| Migration history | ✅ **118/118** | 118 recorded (`migHistoryReconcile --write` → HTTP 201) |
| Gates (ณ commit ปิดรอบนี้) | ✅ **TSC 0 · LINT 0 · VITEST 527/527 · BUILD 0** | รัน 2026-10-07 ทั้ง 4 ตัว |

## 2. DEFECT ที่ค้นพบ (✅ RESOLVED รอบ 8)

**Migration 117 clobber FC gates 112/114 ใน production** — รายละเอียดครบใน `BMB_G10_DEFECT_117_FC_ROLLBACK.md`
- ผล: admin config (bite_drive enable / radius / zone / external methods) **ไม่ถูกบังคับที่ order RPC** (hardcode 5.00 กลับมา)
- Fix = `supabase/migrations/118_restore_fc_gates_after_117.sql` — **APPLIED 2026-10-07 (Owner อนุมัติ) + VERIFIED** (`fcVerify114` 25/25 · `fcProdVerify` 9/9 · intake 18-param OK)

## 3. ยังค้าง / BLOCKED (HARD STOP รอ Owner — ห้ามทำแทน)

| รายการ | รออะไร | เมื่อได้ทำอะไรต่อ |
|---|---|---|
| ✅ **1. Migration 118** | DONE รอบ 8 (Owner อนุมัติแล้ว) | APPLIED → `fcVerify114` 25/25 · `fcProdVerify` 9/9 · intake 18-param OK · history 118/118 |
| ✅ **2. Page token หมดอายุ** | DONE รอบ 8 | exchange → token ใหม่ **LONG-LIVED expires=NEVER** · set secret (201) · `publishWorkerProbe` 5/5 |
| **3. SMS เข้าเครื่องจริง** | Owner ยืนยันรับ `[W-2.3 TEST]` ที่ **`082***8546`** (รอบ 8b — `094***9269` และ `090***1544` ไม่นับ) | ยืนยันแล้วปิด W-2.3 |
| 4. Stripe LIVE | account review ผ่าน (2 tasks In review) | live webhook + acceptance (W-2.1/W-2.2) |
| 5. Push เครื่องจริง | Owner ทดสอบ device | ยืนยัน subscription → ปิด |
| 6. G4 real event (Meta) | Meta ปลดล็อก roles | add Tester → `g4CheckRealEvents` |
| 7. Asset Registry / brand routing / E2E admin session | Owner decision (เดิม) | ตาม handoff เดิม |

## 4. FLAGS (รอบ 8)

```text
LOGIC CHANGED       = NO (รอบ 8 ไม่แตะ logic — apply migration restore + token exchange + SMS test)
DB CHANGED          = YES — create_order_with_items (migration 118 APPLIED)
MIGRATION           = YES — 118 applied + recorded (118/118)
SECURITY CHANGED    = NO
PRODUCTION MUTATION = YES — apply 118 (Owner อนุมัติ) · set secrets (META token long-lived + SMS_*) · ส่ง SMS ทดสอบไปเบอร์ Owner (THSMS)
```

## 5. TESTS / TYPECHECK / LINT (ณ รอบนี้)

- **TSC = 0 errors · LINT = 0 · VITEST = 527/527 (49 files) · BUILD = 0**
- Probes ผ่านทั้งหมด (รอบ 8/8b): `m118Verify` **16/16** → `fcApply118` **APPLY118_OK** · `intakeDriftProbe` **INTAKE SIGNATURE OK (18-param)** · `fcVerify114` **25/25** · `fcProdVerify` **9/9** · `migHistoryReconcile` **118/118** · `w23SmsSendOwner 0826378546` **HTTP 200 / provider_status 200 / to_masked=082***8546** · `thsmsDirectProbe` **HTTP 200 `{success:true,code:200}`** (ทั้ง `082…` และ `668…`) · `metaTokenDiag` **PAGE · expires=NEVER · pages_messaging** · `publishWorkerProbe` **5/5** · `metaTokenScopeCheck` BMB_PAGE 200
- ไม่มี probe ที่ FAIL ในรอบนี้

## 6. HEAD / WORKTREE

```text
HEAD = origin/main = 3094c5d (ก่อน commit รอบนี้) · gates ผ่านทั้ง 4 → commit+push ตามกติกา
WORKTREE = ไฟล์งานรอบ 8 (e2e scripts ใหม่ + migration 118 regenerated + build-script fix + docs) · untracked เดิม 4 ไฟล์ (Dockerfile/docker-compose/.dockerignore/openapi-paths) = ยังไม่ตัดสินใจตามเดิม ไม่ commit
```

## 7. OWNER DECISIONS ระหว่างทาง (รอบ 2026-10-07)

1. THSMS เลือก provider + ใส่ `THSMS_API_KEY`/`THSMS_SENDER_NAME` เอง → สั่งทำ SMS ต่อ
2. Stripe ยังไม่อนุมัติ (ภาพ dashboard: Paused soon / In review) → ค้าง W-2.1/W-2.2 ตามเดิม
3. เปลี่ยน Page access token (pages_messaging) ใน `.env.local` เอง → สั่ง sync เข้า production + **exchange เป็น long-lived**
4. "ทำงานตามกฏเดิม เคลียร์สเตจ เคลียร์ทรี ตรวจสอบทดสอบจนผ่อนถึงอนุญาติอัพเดทเอกสารและคอมมิทพุช" → gates ผ่านแล้วจึง docs+commit+push
5. **รอบ 8:** อนุมัติ apply migration 118 · สั่ง exchange token เป็น long-lived · สั่งส่ง SMS ทดสอบใหม่ไป **`0942649269`** (ไม่นับ `090***1544` เดิม) · ย้ำ G10 ห้ามประกาศ PASS (Stripe + real evidence ยังไม่ครบ)

---
**HARD STOP:** เอกสารนี้คือ evidence pack — **ห้ามตีความเป็น G10 PASS** · การปิด G10 รอ Owner sign-off หลังข้อค้าง 1–3 ข้างบนปิด

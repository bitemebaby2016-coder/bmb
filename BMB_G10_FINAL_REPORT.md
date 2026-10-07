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
| 5 | Admin คุมทุกขั้นตอน | ⚠️ CODE DONE · แต่ **defect ปิดเงียบ** | 118 PENDING — FC gates ไม่บังคับที่ RPC (ดู §3) |
| 6 | ไม่มี regression (gates + probes) | ⚠️ gates ผ่าน · probes 2 ตัว FAIL จริง | TSC0/LINT0/VITEST 527/BUILD0 ✓ · fcProdVerify/fcVerify114 FAIL (§3) |

### งาน AI DEV ที่ทำได้เอง — ปิดรอบนี้

| รายการ | สถานะ | Evidence |
|---|---|---|
| W-2.3 SMS (THSMS) | ✅ **RUNTIME VERIFIED (ส่งจริง 200)** — เหลือ Owner ยืนยันเข้าเครื่อง | secrets ตั้ง (HTTP 201) · THSMS `/api/me` credit=10.00 ✓ · EF deploy ผ่าน CLI (2 ไฟล์) · `w23SmsProbe` **3/3** (unauth 401 · bad token 401 · service send `ok:true provider_status:200 to_masked=090***1544`) · normalize `66…→0…` ทำงานจริง (unit 2 cases ใหม่) |
| Page token ใหม่ (pages_messaging) | ✅ ตั้ง EF secret แล้ว · ⚠️ **หมดอายุ 2026-10-07 01:00 UTC** | `metaTokenScopeCheck`: valid=true · app=1737887467512190 · scopes มี `pages_messaging` · เรียกเพจ BmB `862940416913026` = **200** · (ส่วน `/me` = identity ผู้ใช้ "P Jin Pao" = เจ้าของเพจ ไม่ใช่เพจผิด) |
| Read-only prod snapshot | ✅ | `e2e/g10-prod-snapshot.json` — web 200/canonical ✓ · EF 15 ตัว · secrets 23 (BMB_TEST_* = 0) · tenancy 1/1/1 · active orders 0 · social_events clean (RECEIVED 9 + DUPLICATE 12, ไม่มี FAILED/RETRYABLE/PROCESSING) · RLS 50 tables · triggers 31 · intake 18-param OK |
| Migration history | ✅ 117/117 reconcile แล้ว (ของเดิม) + **118 authored รอ approve** | `m118Verify` 16/16 |
| Gates (ณ commit ปิดรอบนี้) | ✅ **TSC 0 · LINT 0 · VITEST 527/527 · BUILD 0** | รัน 2026-10-07 ทั้ง 4 ตัว |

## 2. DEFECT ที่ค้นพบ (ต้อง Owner ตัดสินใจ)

**Migration 117 clobber FC gates 112/114 ใน production** — รายละเอียดครบใน `BMB_G10_DEFECT_117_FC_ROLLBACK.md`
- ผล: admin config (bite_drive enable / radius / zone / external methods) **ไม่ถูกบังคับที่ order RPC** (hardcode 5.00 กลับมา)
- Fix = `supabase/migrations/118_restore_fc_gates_after_117.sql` — **AUTHORED + 16/16 VERIFIED, PENDING Owner approval**

## 3. ยังค้าง / BLOCKED (HARD STOP รอ Owner — ห้ามทำแทน)

| รายการ | รออะไร | เมื่อได้ทำอะไรต่อ |
|---|---|---|
| **1. Migration 118** | Owner อนุมัติ apply (ลายลักษณ์อักษร) | apply → intakeDriftProbe + fcVerify114 + fcProdVerify ต้อง ALL PASS |
| **2. Page token หมดอายุ 2026-10-07 01:00 UTC** | Owner สร้าง/exchange token ใหม่ (สั้นกว่า — user token มีอายุ ~60 วัน) | `metaTokenExchange exchange` → set secret → scope check ซ้ำ |
| **3. SMS เข้าเครื่องจริง** | Owner ยืนยันรับ SMS ที่ `090***1544` (ข้อความ `[W-2.3 TEST]...`) | ยืนยันแล้วปิด W-2.3 |
| 4. Stripe LIVE | account review ผ่าน (2 tasks In review) | live webhook + acceptance (W-2.1/W-2.2) |
| 5. Push เครื่องจริง | Owner ทดสอบ device | ยืนยัน subscription → ปิด |
| 6. G4 real event (Meta) | Meta ปลดล็อก roles | add Tester → `g4CheckRealEvents` |
| 7. Asset Registry / brand routing / E2E admin session | Owner decision (เดิม) | ตาม handoff เดิม |

## 4. FLAGS

```text
LOGIC CHANGED       = YES (เล็กน้อย — sms-send EF: THSMS body format + import _shared; _shared normalize 66xx→0xx) — Owner สั่ง "เอาไปใช้ทำ sms ด้วย"
DB CHANGED          = NO
MIGRATION           = NO (118 = AUTHORED PENDING ยังไม่ apply)
SECURITY CHANGED    = NO
PRODUCTION MUTATION = YES — set secrets (SMS_* 4 + META_PAGE_ACCESS_TOKEN) · deploy sms-send EF · ส่ง SMS ทดสอบ 1 ข้อความ (THSMS credit 10.00 → 9.50) — ทั้งหมดตามคำสั่ง Owner 2026-10-07
```

## 5. TESTS / TYPECHECK / LINT (ณ รอบนี้)

- **TSC = 0 errors · LINT = 0 · VITEST = 527/527 (49 files) · BUILD = 0**
- Probes: `w23SmsProbe` **3/3** · `m118Verify` **16/16** · `metaTokenScopeCheck` OK · `g10ProdSnapshot` OK · THSMS `/api/me` success
- Probes ที่ FAIL (บันทึกไว้ = defect §2): `fcProdVerify` (rpc_fc1_fc5_live) · `fcVerify114` (create_fc1_branch_scoped_policy)

## 6. HEAD / WORKTREE

```text
HEAD = origin/main = 1fefddc (ก่อน commit รอบนี้) · gates ผ่านทั้ง 4 → commit+push ตามกติกา
WORKTREE = มีไฟล์งานรอบนี้ที่จะ commit (ดู §4) · untracked เดิม 4 ไฟล์ (Dockerfile/docker-compose/.dockerignore/openapi-paths) = ยังไม่ตัดสินใจตามเดิม ไม่ commit
```

## 7. OWNER DECISIONS ระหว่างทาง (รอบ 2026-10-07)

1. THSMS เลือก provider + ใส่ `THSMS_API_KEY`/`THSMS_SENDER_NAME` เอง → สั่งทำ SMS ต่อ
2. Stripe ยังไม่อนุมัติ (ภาพ dashboard: Paused soon / In review) → ค้าง W-2.1/W-2.2 ตามเดิม
3. เปลี่ยน Page access token (pages_messaging) ใน `.env.local` เอง → สั่ง sync เข้า production
4. "ทำงานตามกฏเดิม เคลียร์สเตจ เคลียร์ทรี ตรวจสอบทดสอบจนผ่อนถึงอนุญาติอัพเดทเอกสารและคอมมิทพุช" → gates ผ่านแล้วจึง docs+commit+push

---
**HARD STOP:** เอกสารนี้คือ evidence pack — **ห้ามตีความเป็น G10 PASS** · การปิด G10 รอ Owner sign-off หลังข้อค้าง 1–3 ข้างบนปิด

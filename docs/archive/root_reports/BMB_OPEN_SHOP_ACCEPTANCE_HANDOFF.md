# BMB — OPEN-SHOP ACCEPTANCE CLOSURE · HANDOFF (2026-10-05)

**สถานะเอกสาร:** HANDOFF สำหรับแชทถัดไป — สั่งสร้างโดย Owner ("สร้างแฮนออฟเตรียมไปทำงาน ที่เหลือต่อแชทหน้า")
**Doc of record:** `BMB_PRODUCTION_MASTER_STATUS.md` (§14 exec log · §15 status board · §16 final review) — อัปเดตเอกสารนั้นก่อน push ทุกครั้ง
**HEAD ณ สร้าง:** `b054021` (HEAD == origin/main · WORKTREE CLEAN · gates: TSC0/LINT0/VITEST 497/497/BUILD0 · prod verify: fcVerify114=25, fcProbe6=22, fcProdVerify=9 · migration 114 applied)

---

## 1. OWNER DIRECTIVE (2026-10-05) — เปลี่ยนเกณฑ์เปิดร้าน

> เกณฑ์เดิม "Software ไม่มี blocker" **ใช้ไม่ได้** — เปลี่ยนเป็น:
> **"ลูกค้าสามารถสั่ง จ่าย กิน และได้รับอาหารจริง โดย Admin ควบคุมทุกขั้นตอนได้"**

ดังนั้น **งานถัดไปไม่ใช่การเขียนโค้ด** แต่เป็น **OPEN-SHOP ACCEPTANCE CLOSURE** ตามลำดับ (ห้ามสลับ/ข้าม):

```text
Stage A  Stripe LIVE            → รับเงินจริงได้ (W-2.1 keys → W-2.2 live acceptance)
Stage B  G9 Non-Meta            → AI/social ภายในที่ไม่ต้อง Meta (D-03) — ยื่น Owner review เท่านั้น
Stage C  SMS                    → แจ้งเตือนจริงถึงเครื่องจริง (W-2.3 / D-05)
Stage D  Real Bite Drive Pilot  → order จริงครบทั้งวงจร พร้อม Admin คุมทุกขั้นตอน
Stage E  OPEN SHOP GATE         → ตัดสินโดย Owner เท่านั้น
                                 ("Owner เป็นผู้ประกาศ OPEN SHOP เท่านั้น" — bmb/BMB_PRODUCTION_CLOSURE_MASTER.md §7)
```

**ห้าม** เริ่มเขียนโค้ด/feature ใหม่ระหว่าง acceptance closure — งานที่เหลือ = config + evidence + verification เท่านั้น (เจอ defect จริงจึงแก้ ต้องผ่าน gates + update doc ก่อน push เท่านั้น)

---

## 2. ACCEPTANCE BAR — "เปิดร้านได้" = ผ่านทั้ง 6 ข้อ

| # | ขั้น | นิยามว่า "ผ่าน" | หลักฐานที่ต้องมี |
|---|---|---|---|
| 1 | **สั่ง** | ลูกค้าสั่งจริงผ่าน production site (`biteme-baby.com`) → order จริงใน `orders` (ไม่ใช่ probe/test marker) | order id + timestamp จริง |
| 2 | **จ่าย** | เงินเข้าจริงผ่าน Stripe LIVE ตาม method ที่เลือก | transaction id จริง + order status paid/confirmed |
| 3 | **กิน** | order จริงเข้าครัว → เสร็จ mark ready ผ่าน production UI จริง | kitchen/batch trail + เวลาจริง |
| 4 | **ได้รับ** | อาหารถึงมือจริง (Bite Drive pilot ≤ 5 กม. ตาม capability ปัจจุบัน) | order status delivered + รอบเวลาจริง |
| 5 | **Admin คุมทุกขั้นตอน** | ทุกสถานะ (confirm → kitchen → assign driver → in_transit → delivered) admin เห็น/สั่งได้จริงผ่าน production UI | per-step trail จาก UI/DB |
| 6 | **ไม่มี regression** | gates ผ่านทุกครั้งที่มีการแก้ไข · read-only probes ยัง ALL PASS | TSC0/LINT0/VITEST/BUILD + fcProdVerify |

> ⚠️ **ห้ามโกง acceptance:** ห้ามสร้าง order/transaction ปลอมเองเพื่อผ่าน — pilot ต้องเป็น transaction จริงที่มีเงินจริง/ลูกค้าจริง (probes read-only ใช้ได้เสมอ)

---

## 3. ACCEPTANCE CLOSURE STAGES — รายละเอียด (next chat ทำตามลำดับ ห้ามข้าม)

### Stage A — STRIPE LIVE (blocking ข้อ "จ่าย")
- **INPUT จาก Owner (ต้องมีก่อนเริ่ม):** Stripe **LIVE** keys (publishable + secret) + ยืนยัน webhook endpoint ของ production
- **งานที่ทำได้ (config ไม่ใช่โค้ด):** ใส่ keys เข้า secret/env ของ Pages + Edge functions ที่เกี่ยวกับชำระเงิน → deploy → ตรวจ read-only ว่า mode = live และไม่มี key รั่วใน bundle
- **ACCEPTANCE (W-2.2):** order **จริง 2 รายการ** end-to-end (สั่ง → จ่ายจริง → money in Stripe dashboard) — Owner + ENG เฝ้า trace
- **Evidence:** อัปเดต §15 (Payment = RUNTIME VERIFIED LIVE) + §14 exec log + transaction/order ids
- **HARD STOP:** ยังไม่มี LIVE keys = ถามอย่างเดียว ห้ามทำต่อ

### Stage B — G9 NON-META (ตาม D-03)
- **Scope:** G9 ส่วนที่ไม่ต้องใช้ Meta real event — evidence #3/#4/#5/#7/#10 compile แล้วใน §7.2 (reuse G5/G6/G8 · ห้าม rerun G8-S5)
- **งานที่ทำได้:** จัด evidence + ยื่น Owner review — **ห้ามตัว AI ประกาศ G9 PASS เอง** (`BMB_G9_CONTRACT.md` §10: Owner อนุมัติ report ก่อนปิด G9)
- **ยังคง BLOCKED:** G9 ส่วน Meta journey = รอ G4 (Owner กด Verify & Save) — ห้ามทำ Meta production write ระหว่างนี้ (G9 contract §11/§12)
- **Evidence:** Owner decision จดลง §14/§16 (non-Meta ผ่าน/ไม่ผ่าน/แก้เพิ่ม)

### Stage C — SMS (W-2.3 / D-05)
- **INPUT จาก Owner:** SMS provider credentials
- **งานที่ทำได้:** config provider ใน secret/env → verify path `notification_dispatch` → ทดสอบส่งจริง
- **ACCEPTANCE:** SMS จริงถึงเครื่องจริง จาก **order จริง** อย่างน้อย 1 รายการ (ไม่ใช่ test script ลอย ๆ)
- **HARD STOP:** ไม่มี credentials = ถามอย่างเดียว

### Stage D — REAL BITE DRIVE PILOT (ปิดข้อ "กิน/ได้รับ/Admin คุม")
- **INPUT:** ลูกค้า/Owner ที่จะสั่งจริง · ที่อยู่ส่งจริง **≤ 5 กม.** (external rider ยังไม่พร้อม — Bite Drive เท่านั้น)
- **งานที่ทำได้:** เฝ้าดูตั้งแต่ต้นจนจบ — ไม่เขียนโค้ด (เจอ defect = fix ตามกติกา gates เท่านั้น)
  1. ลูกค้าสั่งจริง (อย่างน้อย 1 โหมด — แนะนำ PRE_ORDER ตาม D-01)
  2. Admin confirm จริง → เห็น order ใน production UI
  3. Kitchen mark ready จริง (AdminKitchen/batch)
  4. Admin assign driver (Bite Drive) → driver accept → in_transit
  5. Delivered จริง → tracking ลูกค้า + notification ทุกขั้นตอน
- **ACCEPTANCE:** order จริง 1 รายการ complete lifecycle + per-step trail (order id, timestamps, status ทุกชั้น, notification records) = evidence ของข้อ 1/3/4/5 ใน §2
- **Evidence:** สรุปต่อ order id ลง §14 exec log + §15 E2E chain (เปลี่ยน NOT YET VERIFIED → RUNTIME VERIFIED ตาม fact จริง)

### Stage E — OPEN SHOP GATE (ตัดสิน)
- **Precondition:** Stage A–D ผ่านครบ + gates green + status doc อัปเดต + HEAD == origin/main + WORKTREE CLEAN
- **งานที่ทำได้:** รวบรวม evidence ทั้งหมด → ยื่น Owner — **Owner เป็นผู้ตัดสิน/ประกาศ OPEN SHOP เท่านั้น**
- **ผลลัพธ์:** ผ่านจริง = Owner สั่งให้เพิ่ม "OPEN SHOP READY" ใน §15 (ใช้คำนี้เฉพาะเมื่อ Owner สั่ง) · ขาด = ระบุรายการที่ขาดเจาะจง
- **HARD STOP หลังตัดสิน:** ห้ามทำอะไรต่อเอง

---

## 4. CURRENT STATE SNAPSHOT (ไว้ไม่ต้องไล่หา)

- **Production:** `https://biteme-baby.com` (Pages project `bitemebaby`, `source=github` → **push = deploy** · wrangler manual = preview เท่านั้น) · Supabase `ivkdfognyiwjcmrhcnwz`
- **Admin-configurable ครบแล้ว** (migration 114 FC-1..FC-5): brand/theme (glass tokens) · branch (service radius override, open/close) · bite-drive enable/disable · radius · methods · fee/zones · markup · free-ship threshold · cutoff · quota — ดู §4.1/§11 W-1.4c
- **Legacy closed:** `delivery_policy.radius_km` = retired (0 consumer) · pre_orders `PO-20260919-430` = cancelled ผ่าน `admin_sync_legacy_pre_order` (admin-gated, idempotent, audit)
- **E2E chain จริง (§15):** REAL ORDER / PAYMENT / KITCHEN / DISPATCH / DELIVERY / TRACKING = ยังไม่เคยมีของจริงทั้งหมด — **นี่คือสิ่งที่ Stage A–D ต้องปิด**
- **Non-blockers (อย่าดันขึ้นมาเป็นงานใหม่):** F-01 demo creds หน้า login · `business_settings.hours` dead-key suspect (F-23) · local zone mirror 3/6 zones (fallback offline เท่านั้น) · ai-proxy ไม่มี rate limiting (W3A) · multi-tenant onboarding / admin page เฉพาะทาง / theme กว้างกว่า glass = DEFERRED
- **G8-S5 = PASS แล้ว ห้าม rerun** (reuse evidence) · **ห้าม reopen G1–G8** · ไม่มี phase ใหม่

## 5. RULES OF ENGAGEMENT (ห้ามละเมิด)

1. **อัปเดต `BMB_PRODUCTION_MASTER_STATUS.md` ก่อน push ทุกครั้ง**
2. Gates ก่อนจบงานทุกครั้ง: `npx tsc --noEmit` · `npx eslint .` · `npx vitest run` (ล่าสุด 497/497) · `npm run build`
3. ห้ามฮาร์ดโค้ด 100% · config ทุกอย่าง admin-จัดการได้
4. Deploy = push `main` · ห้ามพึ่ง wrangler manual สำหรับ production
5. Supabase Management API: **single-statement ต่อ query** (batch = return เฉพาะ statement สุดท้าย) · `pg_get_functiondef` ไม่มี `;` ท้าย function — ต้องเติมเอง
6. หนึ่งคำสั่งต่อ turn — ห้าม spam คำสั่งซ้ำ ๆ (บทเรียนเดิม)
7. ห้าม rerun G8-S5 · ห้าม reopen G1–G8 · ห้ามสร้าง phase/contract ใหม่ · ห้ามซ่อม migration drift 104–111 เอง
8. **ระหว่างรอ Owner input = HARD STOP** — ห้ามเริ่ม stage ถัดไป / เดา requirement
9. **ห้ามสร้าง transaction จริงปลอมเพื่อผ่าน acceptance** — pilot ต้องจริงทุกอย่าง
10. Language cleanup = ห้าม redeploy เอง (แยก workstream)

## 6. KEY FACTS / PATHS

- Project: `D:\A PROJECT\Bite Me Baby` · env keys ใน `.env.local`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `SUPABASE_ACCESS_TOKEN` · ไม่มี `gh` CLI
- Admin UUID: `ae12e10b-0f1f-45ff-b0f0-6dd7a682b064`
- Status doc sections: §4.1 (admin-configurable table) · §11 (active plan D-01..D-06, W-1.x / W-2.x) · §14 (exec log) · §15 (status board) · §16 (final master review)
- G9: `BMB_G9_CONTRACT.md` (§7.2 evidence · §10 exit = Owner approve · §11–12 hard stops / out of scope)
- Reusable read-only probes: `e2e/fcVerify114.cjs`, `e2e/fcProbe6.cjs`, `e2e/fcProdVerify.cjs`, `e2e/w14ContractProbe.cjs`
- อ้างอิงเกณฑ์เปิดร้านเดิม: `bmb/BMB_PRODUCTION_CLOSURE_MASTER.md` (STEP 6–7 · **Owner ประกาศ OPEN SHOP เท่านั้น**)

## 7. FIRST ACTIONS — แชทถัดไปเริ่มตรงนี้

1. อ่านไฟล์นี้ + `BMB_PRODUCTION_MASTER_STATUS.md` §15/§16 + `BMB_G9_CONTRACT.md` §7.2/§10
2. ถาม Owner สำหรับ **Stage A**: ส่ง Stripe LIVE keys (รูปแบบ: Pages env? Edge function secret? ทั้งคู่?) + ยืนยัน webhook — **ถ้ายังไม่มี = HARD STOP ถามอย่างเดียว**
3. มี keys แล้ว = ทำ **Stage A เท่านั้น** (inject → deploy → read-only verify live mode → live acceptance 2 orders → update doc → gates → push)
4. หลัง Stage A ผ่านจริง = Stage B (ยื่น Owner review) → C → D → E ตามลำดับ — **ห้ามข้าม/สลับ** เว้นแต่ Owner สั่งเป็นลายลักษณ์อักษร

---

**HARD STOP:** เอกสารนี้คือแผนรับช่วงทำงานเท่านั้น — **ห้ามเริ่ม implementation ใด ๆ ก่อน Owner สั่งในแชทถัดไป**


# BMB_100_PERCENT_CLOSURE_BOOK.md

> **Version:** 2.0 (Scope Revision 2026-09-20 — Two Milestones + Two Closure Domains + PWA-100-GATE) · **Commit base:** `6be8e30`
> **บทบาท:** master checklist "อะไรที่ยังต้องทำเพื่อไปถึง target" — derive จาก code จริง + Master Product Spec (ไม่ใช่ generic checklist)
> กฎ: ทุก item ต้องมี Evidence + Verification Method + Acceptance Criteria · ห้ามปิด item ด้วยเอกสาร — ปิดด้วย evidence เท่านั้น
> สถานะใช้คำเดียวกับ CURRENT_STATE: LIVE / PARTIAL / SKELETON / MISSING / BROKEN / VERIFIED / DEFERRED

## ⚠️ TWO CLOSURE DOMAINS — ห้ามหลอมรวมเด็ดขาด

| Domain | ชื่อ | ความหมาย | สถานะเมื่อปิดครบ |
|---|---|---|---|
| **DOMAIN A** | **BMB PRODUCTION 100%** (Milestone 1) | Bite Me Baby เดินธุรกิจจริงผ่านแพลตฟอร์มได้น่าเชื่อถือ — item ชุด SEC/PAY/ORD/KIT/INV/PRE/DEL/AI/CI/CNT/ADM/PWA/NOT/QA | **BMB PRODUCTION COMPLETE** — *ไม่ใช่* "platform พร้อมขาย" |
| **DOMAIN B** | **FUTURE SAAS PRODUCTIZATION** (Milestone 2) | ร้านที่สอง onboard ได้จริงโดยไม่แก้ code เฉพาะ BMB — item ชุด COM/RES/THEME/SITE/QR/DINE/CRM/MKT/REV/CAT/LOC/IAM/INV-PRO/ANA/AI-BIZ/AI-FC/WL/SAAS | **BMB SAAS READY** |

> กันความเข้าใจผิดรุ่นหลัง: "100% Domain A" **ต้อง** ถูกอ่านว่า "BMB production complete" เท่านั้น — ห้ามตีความว่า SaaS พร้อมขาย · Domain B ทุก item เริ่มต้น = DEFERRED / TARGET / NOT YET IMPLEMENTED จนกว่า gate ผ่าน

---

## A. Phase Structure v2 (2026-09-20 — แทนที่ phase plan v1)

```text
━━━━━━━━ DOMAIN A — BMB PRODUCTION (Milestone 1) ━━━━━━━━
PHASE 0   TRUTH LOCK                 (read-only verify live DB + docs)
   ↓
PHASE 1   MONEY + ORDER              (pre-order pricing, card loop, refund, vocab)
   ↓
PHASE 2   KITCHEN CORE               (inventory deduct, recipe/BOM, production queue)
   ↓
PHASE 3   BITE DRIVE                 (drivers จริง, zone fee authoritative, rider PWA)
   ↓
PHASE 4   PWA + ADMIN COMPLETION     (perf 90+, NOT-01, ADM-01, ADM-07
   │                                   + AI gate-blocking: SEC-02 proxy, AI-01, AI-02 base, AI-03)
   ↓
[PWA 100% PRODUCTION GATE — PWA-100-GATE]        ← ห้ามผ่านโดยไม่มี evidence
   ↓
REAL-WORLD BMB PILOT                  (ใช้จริงในร้าน 2–4 สัปดาห์ เก็บ evidence)
   ↓
PWA PATCH / HARDENING LOOP            (ทำซ้ำได้ตามที่ต้องใช้)
   ↓
━━━ MILESTONE 1 = BMB PRODUCTION 100% ━━━
   ↓
PHASE 5   AI HARDENING (advanced)    (injection suite เต็ม, memory ปรับจริง)
PHASE 6   INTELLIGENCE               (CI-01 server-side)
PHASE 7   GROWTH                     (CNT-01 approval workflow)
   ↓
[SAAS PRODUCTIZATION GATE]            ← เปิด Domain B ได้เมื่อ: M1 จริง + patch loop เข้าเกณฑ์ (ไม่มี P0/P1 ค้าง ≥ 2 สัปดาห์) + owner อนุมัติ
   ↓
━━━━━━━━ DOMAIN B — FUTURE SAAS (Milestone 2) ━━━━━━━━
PHASE 8   MULTI-TENANT FOUNDATION    (SAAS-001..004, LOC, IAM, WL base, tenant_id + RLS rewrite)
PHASE 9   COMMERCE EXPANSION         (COM generic, SITE builder, THEME engine, QR)
PHASE 10  RESTAURANT EXPERIENCE      (RES, DINE, CAT, INV-PRO-005..010)
PHASE 11  CRM + LOYALTY + MARKETING  (CRM, MKT, REV — publish ผ่าน approval เสมอ)
PHASE 12  AI BUSINESS INTELLIGENCE   (AI-BIZ, AI-FC*, ANA — *เฉพาะเมื่อ production data พอ)
PHASE 13  SAAS BILLING + ENTITLEMENTS(SAAS-005..013, 015..021, 023..025)
PHASE 14  SECOND TENANT PILOT        (SAAS-026 — ร้านจริงร้านที่ 2)
PHASE 15  COMMERCIAL SAAS LAUNCH     (M2 = BMB SAAS READY)
```

**การรวม phase / การเปลี่ยนลำดับที่ justify จาก dependency จริง:**
1. **AI gate-blocking ย้ายเข้า PHASE 4** (SEC-02 proxy, AI-01 fix, AI-02 base suite, AI-03 server memory) — เพราะ PWA-100-GATE มีเกณฑ์ฝั่ง AI (proxy/security/tool safety/context/memory/fallback) แล้ว PHASE 5 เหลือเฉพาะ advanced hardening (หลัง M1) — สอดคล้องหลัก "merge phases when dependency and scope justify it"
2. PHASE 8–15 เก็บลำดับตามคำสั่ง แต่ **แต่ละ phase ต้องผ่าน dependency check ก่อนเริ่ม** และอนุญาตให้ merge ข้าม phase ได้เมื่อ scope/dependency ให้ผลปลอดภัยกว่า
3. **HARD RULE:** ทุก item ใน Domain B (RES/THEME/QR/SITE/CAT/AI-FC ฯลฯ) ห้ามถูกอ้างเป็นข้อติดขัดของ PWA-100-GATE — เว้นแต่ธุรกิจจริงของ BMB ปัจจุบันต้องใช้ (กรณีนั้นต้องย้าย item มา Domain A อย่างเป็นทางการผ่าน PRODUCT PATCH เท่านั้น)
4. Changelog: 2026-09-20 — แทน phase plan v1 (0–8) ด้วย v2; ที่มา: scope revision "PWA 100% PRODUCTION GATE + FUTURE SAAS PATCH PLAN"

## A2. Gates & Loops (กติกาบังคับ)

### A2.1 PWA 100% PRODUCTION GATE (PWA-100-GATE)

> ประเมินหลังจบ PHASE 4 · **ห้ามประกาศ PASS โดยไม่มี evidence** · ผลประเมินต้องบันทึกเป็น gate record ใน CURRENT_STATE (วันที่ + commit + ลิงก์ evidence ทุกข้อ) · FAIL = กลับเข้า PATCH LOOP แล้วประเมินใหม่

| กลุ่ม | เกณฑ์ต้องผ่าน | ปิดด้วย Closure ID (Domain A) |
|---|---|---|
| Customer | Landing / Menu / Product / Cart / Checkout / Payment / Order Confirmation / Tracking / Account / Order History | ORD-01, e2e ครบ flow |
| Order | Create / Validate / Transition / Cancel / Retry / Failure Recovery | ORD-01, ORD-02, PAY-04 |
| Payment | PromptPay / COD / Card / Webhook / Idempotency / Amount Authority / Failure / Refund Evidence | PAY-01..04 |
| Kitchen | Capacity / Cutoff / Rounds / Production State / Inventory Authority | INV-01, INV-02, KIT-01, KIT-02, PRE-01 |
| Delivery | Zone / Distance / Fee / Method / Order Status | DEL-01, DEL-02 |
| AI | AI proxy / Security / Tool safety / Context / Memory / Failure fallback | SEC-02, AI-01, AI-02 (base), AI-03 |
| Admin | Orders / Kitchen / Inventory / Delivery / Customers / Exceptions | ADM-01 + admin core LIVE |
| PWA | Install / Mobile UX / Loading / Error / Offline-recovery / Performance | PWA-01 (≥90), PWA-02 |
| Security | RLS / Auth / Authorization / Secrets / Payment / tenant-readiness | SEC-01..04 |
| QA | Unit / Integration / E2E / Production Smoke / CI / Typecheck / Build | QA-01..04 |

### A2.2 REAL-WORLD BMB PILOT (หลัง GATE ผ่าน — ห้ามข้ามไป SaaS)

- BMB ใช้ PWA เดินร้านจริง 2–4 สัปดาห์ · เก็บ evidence: order success / payment success / kitchen usability / delivery usability / customer usability / admin usability / performance / error rate / operational friction / customer feedback / staff feedback
- บันทึกเป็นหมวด: `BUG · FRICTION · MISSING FEATURE · CONFUSION · PERFORMANCE · BUSINESS NEED` (ไฟล์รายวัน/รายสัปดาห์ใน `docs/pilot/`)

### A2.3 PWA PATCH / HARDENING LOOP (ทำซ้ำจนนิ่ง)

```text
REAL USE → FEEDBACK → BUG/GAP TRIAGE → PATCH → TEST → VERIFY → UPDATE CURRENT_STATE → REPEAT
```

- **PRODUCT PATCH mechanism (บังคับ):** ทุก patch = ไฟล์ใหม่ `docs/patches/PRODUCT_PATCH_NNN_title.md` + อัปเดต changelog ในเอกสารชุดนี้ · patch ทำได้: เพิ่ม/แก้/แยก/ลบ requirement, เปลี่ยน priority/acceptance criteria, **ย้าย item ข้าม Domain** (Domain B → A เฉพาะเมื่อธุรกิจจริงต้องใช้) · ห้ามแก้ประวัติการตัดสินใจเดิมแบบเงียบ ๆ — ต้องมี PATCH record ทุกครั้ง
- ตัวอย่างจากคำสั่ง: PATCH 001 PWA usability findings · PATCH 002 Reservation refinement · PATCH 003 Theme refinement · PATCH 004 Merchant onboarding refinement
- เกณฑ์ออกจาก loop: ไม่มี P0/P1 ค้าง ≥ 2 สัปดาห์ + error rate ต่ำกว่าเกณฑ์ที่ตกลง + owner ยืนยันธุรกิจเดินลื่น

### A2.4 SAAS PRODUCTIZATION GATE (เปิด Domain B)

เงื่อนไขเปิด (ครบทุกข้อ): M1 สำเร็จจริง (gate PASS + pilot + patch loop เข้าเกณฑ์) · ทรัพยากร/ผู้รับผิดชอบพร้อม · owner อนุมัติเป็นลายลักษณ์อักษร · **ข้อห้าม:** ห้ามเริ่ม Phase 8+ โดยที่ Domain A ยังมี P0/P1 ค้าง · เมื่อเปิดแล้ว ทำตาม sequence Phase 8→15 โดยผ่าน dependency check ทุก phase (merge ข้าม phase ได้เมื่อ justify ได้)

<!-- CONT-NEW -->


## B. CLOSURE DOMAIN A — BMB PRODUCTION 100% (Closure Table — เกณฑ์ Milestone 1)

> Legend: **St**=สถานะปัจจุบัน · **P**=Priority · **Ph**=Phase (v2) · Owner = Owner + AI session
> ทุก item ในตารางนี้ = Domain A เท่านั้น — การปิดครบ + PWA-100-GATE PASS + pilot + patch loop = **BMB PRODUCTION 100%** (ไม่ใช่ SaaS ready)

### B1. Security & Money (P0)

| ID | Subsystem | Requirement (target) | St | Evidence (ปัจจุบัน) | Deps | P | Ph | Verification Method | Acceptance Criteria | Closure Condition |
|---|---|---|---|---|---|---|---|---|---|---|
| SEC-01 | RLS live verify | ยืนยัน policy จริงบน production ตรง 006/014 (เฉพาะ S-3: anon read orders) | **REST-VERIFIED 2026-09-21** (Phase 0 truth lock 48/48: anon เห็น 0 rows, service เห็น 2 rows → RLS ปิดจริง) · SQL `pg_policies` dump รอ owner รัน SQL Editor | `e2e/truthLock.cjs` + `e2e/truth-lock-result.json` · owner รัน `e2e/truth-lock.sql` | P0 | 0 | รัน SQL ตรวจ `pg_policies` บน live DB (owner) | policies ตรงตาม design; anon อ่านได้เฉพาะที่กำหนด | REST-verified + SQL policy dump จาก owner ใน CURRENT_STATE |
| SEC-02 | AI key | ไม่มี secret ใน client bundle (AI proxy ผ่าน EF) | MISSING | `aiToolCalling.ts` ใช้ `VITE_OPENROUTER_API_KEY` | EF deploy | P0 | 4 | build + grep dist ไม่มี key; ทดสอบ chat ผ่าน EF | key หาไม่เจอใน bundle; chat ใช้งานได้เหมือนเดิม | S-1 ปิด + test ผ่าน |
| SEC-03 | Audit (server) | audit log ฝั่ง DB ผูก auth.uid + RLS | **CODE-DONE (await deploy 018)** — ตาราง `audit_logs` + RPC `append_audit_log` + เขียน audit ใน transition_order_status/confirm_offline_payment + client `pushAuditLogServer` fire-and-forget | migration 018 + `auditLog.ts` + mock/test | migration ใหม่ | P1 | 1 | deploy 018 → ตรวจตาราง + เขียนจาก RPC สำคัญ | ทุก order/payment transition มี row ฝั่ง DB | **Deploy (owner): `supabase db push`** → S-4 ปิด |
| SEC-04 | Key hygiene | retire legacy `SUPABASE_SERVICE_ROLE_KEY` env ใน EF | **CLOSED (code)** — EF ทั้ง 4 ตัวอ่าน key เดียว `bmb_backend_production_supabase_service_role_key` (fallback ถูกลบ) | EF 4 ไฟล์ + smoke เดิมยังใช้ path เดียว | — | P2 | 0 | deploy EF ใหม่; ยิง smoke ผ่าน | code อ่าน env เดียว; smoke ยังผ่าน | **Deploy (owner): `supabase functions deploy`** → S-5 ปิด |
| PAY-01 | Pre-order price | pre-order ใช้ server-side pricing (เทียบเท่า 007) | **CODE-DONE (await deploy 017)** — RPC `create_pre_order_with_items`/`quote_pre_order` re-derive ราคา + ล็อก capacity, revoke client INSERT/UPDATE | migration 017 + `preOrderService.ts` RPC-based + mocks + test 111/111 | ORD-01 pattern | P0 | 1 | deploy 017 → `node e2e/sqlContracts.cjs --include-new` + e2e pre-order | ทุก pre-order มีราคาจาก DB เท่านั้น; client ส่งราคามาถูกละทิ้ง | **Deploy (owner): `supabase db push`** → S-2 ปิด |
| PAY-02 | Card loop | บิลบัตรจริงครบวงจร 1 รายการบน production | **CODE-READY** (webhook VERIFIED + create-checkout/confirm ทั้ง path) · **REAL-WORLD PROOF = owner action** (จ่ายบัตรจริง 1 บิล) | EF โค้ดครบ + webhook VERIFIED (T1–T6) | Stripe live key | P0 | 1 | สั่งจริง 1 บิล → webhook → paid → DB verify | payment_intents completed + orders paid + receipt | **Owner: ชำระบัตรจริง 1 รายการ** + แนบหลักฐาน |
| PAY-03 | Refund | refund จริง 1 รายการผ่าน EF admin | **CODE-READY** (EF `stripe-refund` admin-only + idempotent + test ผ่าน) · **REAL-WORLD PROOF = owner action** | EF + tests ผ่าน | PAY-02 | P0 | 1 | refund บิลจริง → ตรวจ Stripe + DB | intent refunded + บันทึก idempotent | **Owner: refund จริง 1 รายการ** + แนบหลักฐาน |
| PAY-04 | Order vocab | mapping สถานะชุดเดียว (server↔client↔provider) | **CLOSED (code)** — `src/lib/orderVocabulary.ts` canonical mapping + OrdersPage ใช้เต็ม | table-driven test ใหม่ + 111/111 | ORD-01 | P1 | 1 | table-driven tests mapping ทุกสถานะ | ไม่มีสถานะ orphan; UI แสดงตรง DB | — |

### B2. Order / Kitchen / Inventory (P0–P1)

| ID | Subsystem | Requirement (target) | St | Evidence (ปัจจุบัน) | Deps | P | Ph | Verification Method | Acceptance Criteria | Closure Condition |
|---|---|---|---|---|---|---|---|---|---|---|
| ORD-01 | Order creation | server-authoritative ครบทั้ง 2 โหมด | LIVE (orders) | 007 + e2e จริง | — | P0 | 1 | e2e + negative test (ราคาปลอม/เกิน capacity) | ปฏิเสธทุกกรณีผิดกฎ | — |
| ORD-02 | Transitions | RPC+trigger บังคับ allow-list 100% | LIVE | 008 + tests | — | P0 | 1 | ยิง transition ผิดกฎ → rejected | ไม่มี direct UPDATE ผ่าน | — |
| KIT-01 | Production queue | batch/production queue ต่อ round | MISSING | ไม่มีตาราง batch | ORD-01 | P1 | 2 | e2e: ออเดอร์→batch→ready | ครัวเห็นงานต่อ batch จริง | วงจรครบ |
| KIT-02 | Recipes/BOM | recipe → ingredient requirement | MISSING | ไม่มีตาราง recipe | INV-01 | P1 | 2 | สร้างสูตร→สั่ง→สต็อกลด | availability คิดจากสูตรได้ | — |
| INV-01 | Stock deduct | หักสต็อกเมื่อ order ยืนยัน (server) | MISSING | 007 ไม่แตะ inventory | SEC-03 | P0 | 2 | concurrency test 2 บิลพร้อมกัน | สต็อกถูกต้อง + cancel คืนสต็อก | ขายเกินไม่ได้ |
| INV-02 | Auto sold-out | low stock → ปิดขายเมนูที่เกี่ยว อัตโนมัติ | MISSING | manual toggle เท่านั้น | INV-01 | P1 | 2 | test threshold | เมนูปิดเองเมื่อเกณฑ์ถึง | — |
| PRE-01 | Pre-order rounds | rounds จาก DB เท่านั้น (ลบ hardcoded client) | **CLOSED (code)** — `getPreOrderRounds` อ่าน `delivery_rounds` (active/open/scheduled) | `preOrderService.ts` DB-backed + preserves contract | bmbAdminApi_rounds | P1 | 1 | e2e pre-order ใช้ round จาก DB | ไม่มี hardcode ใน client | — |

### B3. Delivery / Bite Drive (P1–P3)

| ID | Subsystem | Requirement (target) | St | Evidence (ปัจจุบัน) | Deps | P | Ph | Verification Method | Acceptance Criteria | Closure Condition |
|---|---|---|---|---|---|---|---|---|---|---|
| DEL-01 | Zone fee | delivery fee จาก `delivery_zones` ฝั่ง server | PARTIAL | fee คำนวณ client (router) + RPC รับ `p_distance_km` เป็น input | 015 | P1 | 1/3 | ส่ง distance ปลอม → server ใช้ค่าจาก zone | fee ที่เก็บตรง zone table | — |
| DEL-02 | Drivers จริง | rider management + รับงานผ่าน Rider PWA | PARTIAL (MOCK) | `externalProviders.ts` note "MOCK drivers" | ORD-02 | P1 | 3 | e2e rider: รับงาน→สถานะ→ส่งสำเร็จ | tracking ลูกค้าอัปเดตจาก rider จริง | — |
| DEL-03 | Provider live | Grab/LINEMAN live API | PARTIAL (sandbox) | PROVIDER_API_STATUS sandbox | keys จาก call-center | P3 | 3 | sandbox quote → live quote 1 รายการ | provider_orders จริง 1 บิล | DEFERRED ได้ถ้า keys ไม่มา |
| DEL-04 | Route optimization | เส้นทาง/ETA ต่อ round | PARTIAL | heuristic + RouteOptimizationPage | DEL-02 | P2 | 3 | เทียบเวลาจริง vs ประมาณ | คลาดเคลื่อน ≤ 15 นาที/จุด | — |

### B4. AI / Intelligence / Content (P1–P3)

| ID | Subsystem | Requirement (target) | St | Evidence (ปัจจุบัน) | Deps | P | Ph | Verification Method | Acceptance Criteria | Closure Condition |
|---|---|---|---|---|---|---|---|---|---|---|
| AI-01 | get_order bug | แก้ missing await ใน aiToolCalling | BROKEN | `aiToolCalling.ts` L92 | — | P2 | 4 | unit test tool get_order | คืนข้อมูล/ไม่พบ ถูกต้อง | — |
| AI-02 | Guardrails | AI ห้ามละเมิดกฎ (ราคา/stock/สั่งซื้อ) — ทดสอบได้ | PARTIAL | tools read-only อยู่แล้ว | SEC-02 | P1 | 4 (base) · 5 (adv) | prompt-injection test suite | ทุก injection → ปฏิเสธ/ใช้ RPC เท่านั้น | — |
| AI-03 | Memory server | บทสนทนา+ความจำต่อลูกค้าฝั่ง DB | PARTIAL | ai_conversations + aiMemory heuristic | SEC-01 | P2 | 4 | คุยข้ามอุปกรณ์ → บริบทตรงกัน | context กลับมาถูกต้อง | — |
| CI-01 | Segmentation server | profile/frequency/AOV ฝั่ง server | PARTIAL | heuristic client | orders จริงสะสม | P3 | 6 | ตรวจ view/job vs orders จริง | ตัวเลขตรงกับ DB | — |
| CNT-01 | Content approval | AI content ต้องผ่าน approve ก่อน publish | MISSING | contentAutomation heuristic | — | P2 | 7 | ลอง publish ไม่ผ่าน approve → blocked | ไม่มี auto-publish | กฎ governance ครบ |

### B5. Admin / PWA / QA (P1–P3)

| ID | Subsystem | Requirement (target) | St | Evidence (ปัจจุบัน) | Deps | P | Ph | Verification Method | Acceptance Criteria | Closure Condition |
|---|---|---|---|---|---|---|---|---|---|---|
| ADM-01 | Errors feed | admin เห็น errors/exceptions (EF/webhook/client) | MISSING | ไม่มี error pipeline | SEC-03 | P1 | 4 | จำลอง fail → เห็นใน admin | error ปรากฏ < 5 นาที | — |
| ADM-07 | Mascot self-service | แอดมินเปลี่ยนรูปมาสคอตต่อบทบาทเอง (bucket `bmb-images` + override table) | MISSING | MascotBadge default set (23 poses + 14 3D) | 011 policy | P2 | 4 | อัปโหลด→หน้าเว็บใช้รูปใหม่ทันที | แอดมินทำเองได้โดยไม่แก้ code | owner อนุมัติ 2026-09-20 |
| PWA-01 | Perf | Lighthouse Perf ≥ 90 (mobile) | OPEN (29) | Lighthouse 2026-09-17 | — | P2 | 4 | Lighthouse รันใหม่ | ≥ 90 + ไม่ regression A11y/SEO | — |
| PWA-02 | Offline/error states | retry/error UI ครบ flow หลัก | PARTIAL | ErrorBoundary มี | — | P2 | 4 | จำลอง offline ตอน checkout | ผู้ใช้เข้าใจสถานะ+ไม่หลุดตะกร้า | — |
| NOT-01 | Notification center | แยก Transactional/Marketing/Bite/Operational | MISSING | notificationStore เดิม | ORD-02 | P2 | 4 | สั่งจริง → milestone notification ถูกช่อง | ช่องถูกประเภท + ปิดได้ต่อช่อง | — |
| QA-01 | CI | GitHub Actions: test+build ทุก push | **CLOSED (workflow file)** — `.github/workflows/ci.yml` (npm ci → lint → test → build) · **ยืนยันจริง = wait first green run หลัง push** | `.github/workflows/ci.yml` | — | P1 | 0/1 | push → workflow ผ่าน | 111 tests + build ใน CI | หลัง commit/push นี้ → ดู GitHub Actions green |
| QA-02 | Lint | ติดตั้ง ESLint + script + ผ่าน 0 error | **CLOSED (baseline 0 errors)** — ESLint 9 flat config + `npm run lint` = 0 errors (วัดจริง 2026-09-21) | `eslint.config.js` + `npm run lint` | QA-01 | P2 | 0/1 | npm run lint ผ่าน | 0 error baseline | — |
| QA-03 | SQL contract tests | ทดสอบ RPC/trigger กับ Postgres จริง (กัน mock drift) | **PARTIAL→CLOSED (pre-deploy 8/8)** — runner ต่อ live DB (read-only) `e2e/sqlContracts.cjs` ผ่าน 8/8 · SQL suite 017/018 `e2e/contracts_017_018.sql` (transactional rollback) รอ owner รันหลัง deploy | `e2e/sql-contract-result.json` 8/8 | Supabase test project | P1 | 1 | รัน SQL tests กับ DB ที่ migrate 001→016 | ผลตรง mock ทุกข้อ | **Owner: deploy 017-018 แล้วรัน `--include-new` + SQL suite** → drift risk ปิด |
| QA-04 | e2e reproducible | ย้าย playwright เข้า repo devDeps + CI job | **CLOSED (code)** — `playwright` ใน devDeps + e2e scripts require โลคัล (ไม่พึ่ง `D:/selfprint-v3-react` อีก) | `package.json` + `e2e/runE2E.cjs`/`prodSmoke.cjs` | QA-01 | P3 | 1 | clone ใหม่ + npm i + e2e ผ่าน | ไม่พึ่ง path ภายนอก | — |

## B+. CLOSURE DOMAIN B — FUTURE SAAS PRODUCTIZATION (ทั้งหมด DEFERRED — ห้ามเริ่มก่อน SAAS PRODUCTIZATION GATE)

> รายการ ID ฉบับเต็ม + นิยาม = `docs/BMB_MASTER_PRODUCT_SPEC.md` §20 (215 requirements, 18 pillars) — ไฟล์นี้เป็น **มุมมอง closure tracking**
> **สถานะเริ่มต้นของทุก item: `DEFERRED · TARGET · NOT YET IMPLEMENTED`** — ห้ามเปลี่ยนเป็น LIVE/COMPLETE จนกว่า: SAAS PRODUCTIZATION GATE เปิด + phase นั้นเสร็จ + มี evidence + ผ่าน production verification ของ phase นั้น
> **HARD RULE:** Domain B ห้ามเป็นข้อติดขัดของ PWA-100-GATE · การย้าย item ข้าม Domain ทำได้ทางเดียว = PRODUCT PATCH record

| Pillar | Items | Phase (v2) | สถานะเริ่มต้น | หมายเหตุ |
|---|---|---|---|---|
| COM Commerce | COM-001..010 (10) | 9 (COM-009/010 → 10) | DEFERRED · TARGET · NOT IMPLEMENTED | พื้นฐาน BMB มีจริงใน Domain A แต่ generic tenant = ยังไม่มี |
| RES Reservation | RES-001..025 (25) | 10 | DEFERRED · TARGET | ต้อง integrate Customer/Order/Capacity/Forecast/Analytics ภายหลัง |
| THEME Theme Engine | THEME-001..024 (24) | 9 | DEFERRED · TARGET | Design Tokens ห้ามแก้ raw CSS · Preset→Customize→Preview→Publish |
| SITE Storefront Builder | SITE-001..014 (14) | 9 | DEFERRED · TARGET | SITE-012 domain ผูก WL-002/003 |
| QR Menu/Ordering | QR-001..007 (7) | 9–10 | DEFERRED · TARGET | ต้องระบุ tenant→location→table |
| DINE Dine-in Desk | DINE-001..009 (9) | 10 | DEFERRED · TARGET | lightweight order desk — ไม่ทำ hardware POS |
| CRM / Loyalty | CRM-001..010 (10) | 11 | DEFERRED · TARGET | CRM-001/002/009/010 = REQUIRED FOR SAAS |
| MKT Marketing | MKT-001..008 (8) | 11 | DEFERRED · TARGET | publish ต้องผ่าน approval เสมอ |
| REV Feedback/Review | REV-001..009 (9) | 11 | DEFERRED · TARGET | REV-002 มีพื้นฐาน (reviews) |
| CAT Catering/Events | CAT-001..009 (9) | 10 | DEFERRED · TARGET | ผูก KIT/DEL เมื่อ implement |
| LOC Multi-location | LOC-001..010 (10) | 8 | DEFERRED · TARGET | Platform→Tenant→Brand→Location (ปัจจุบันไม่มีใน code) |
| IAM Staff/Roles | IAM-001..008 (8) | 8 | DEFERRED · TARGET | ต้องออกแบบ permission matrix ก่อน |
| INV-PRO Procurement | INV-PRO-001..010 (10) | 2 (พื้นฐาน 001..004) · 10 (005..010) | DEFERRED · TARGET | วงจร Order→Recipe→Ingredient→Stock→Purchase |
| ANA Analytics | ANA-001..014 (14) | 12 | DEFERRED · TARGET | ผูก RES/LOC/INV-PRO ตาม ID |
| AI-BIZ Copilot | AI-BIZ-001..008 (8) | 12 | DEFERRED · TARGET | AI อ่าน canonical เท่านั้น — ห้ามเป็น authority |
| AI-FC Forecasting | AI-FC-001..006 (6) | 12 | DEFERRED · TARGET | ห้ามทำก่อนมี production data พอ |
| WL White-label | WL-001..008 (8) | 8/15 | DEFERRED · TARGET | branding/domain/email identity |
| SAAS Platform | SAAS-001..026 (26) | 8 / 13 / 14 | DEFERRED · TARGET | SAAS-026 = Second Tenant Pilot (gate ของ M2) |

**เงื่อนไขปิด Domain B (M2 = BMB SAAS READY):** Phase 8–15 ปิดตาม dependency + **SAAS-026 ผ่านจริง** (ร้านที่ 2 ทำวงจร SaaS-Ready definition ครบ — ดู Master Spec §20.19 — โดยไม่มี developer แทรกแซงการใช้งานปกติ) + multi-tenant production verification ผ่าน



## C. Token Planning v2 (ranges — ห้าม fake precision)

> หลักการ: Audit → Plan → Small batch → Test → Verify → Commit → Update docs → Handoff · ห้ามทำงานยาวไม่มี checkpoint · ทุก phase ต้องมี Rollback Strategy ก่อนเริ่ม

### C1. Domain A + Gates

| Phase | Goal | Token Range | Files Likely Affected | DB Impact | API Impact | Security Risk | Migration Risk | Testing Requirement | Production Verification | Rollback Strategy | Exit Criteria |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 | Truth lock | 40–70k | docs/* + read-only SQL checks | อ่านอย่างเดียว | ไม่มี | ต่ำ | ไม่มี | ไม่รันใหม่ (เก็บผลเดิม) | dump policies/tables จริง | ไม่จำเป็น (read-only) | CURRENT_STATE §17 อัปเดต + เอกสาร commit |
| 1 | Money + Order | 120–180k | preOrderService, paymentGateway, orderStateMachine, migration ใหม่ (pre-order pricing RPC), EF refs | migration ใหม่ (idempotent) | RPC ใหม่ (pattern 007) | **สูง (เงิน)** | กลาง | unit + SQL contract tests (QA-03) + e2e | 1 บิลบัตรจริง + 1 refund จริง | revert migration + redeploy EF | PAY-01..04, QA-03, SEC-03 ปิดด้วย evidence |
| 2 | Kitchen Core | 120–180k | migration (recipes/batches/stock_moves), 007-pattern, InventoryPage | ตารางใหม่ 3–4 | RPC deduct | กลาง (ข้อมูล) | กลาง | concurrency tests + unit | ซ้อม sold-out drill จริง 1 รอบ | ตารางใหม่ปล่อยว่างได้ / flag ปิด | INV-01/02, KIT-01/02 ปิด |
| 3 | Bite Drive | 80–140k | RiderPwaPage, externalProviders, migration (drivers) | ตาราง drivers/assignments | ไม่มี EF ใหม่ | กลาง | ต่ำ–กลาง | e2e rider flow | ส่งจริง 1 ทริป ผ่าน Rider PWA | กลับ manual dispatch | DEL-01, DEL-02 ปิด (DEL-03 DEFERRED ได้) |
| 4 | PWA+Admin Completion (+AI gate) | 120–200k | perf bundling, ADM-01 feed, ADM-07 mascot admin, EF ai-proxy ใหม่, aiToolCalling | ตาราง mascot_settings (+error feed) | EF ai-proxy | สูง (ถอน key ออกจาก bundle) | ต่ำ–กลาง | perf budget test + injection base + e2e | Lighthouse ≥90 + grep dist ไม่มี key + admin UX จริง | revert EF + env + flag | ทุก ID ใน A2.1 เขียว → พร้อมประเมิน GATE |
| GATE | PWA-100-GATE eval | 20–40k | docs (gate record) | ไม่มี | ไม่มี | ต่ำ | ไม่มี | รันชุดเต็ม (test+build+e2e+smoke) | evidence pack ทุกกลุ่มใน A2.1 | ไม่จำเป็น | PASS = เข้า PILOT / FAIL = PATCH LOOP |
| PILOT | Real-world use | 40–80k (ต่อ 2–4 สัปดาห์) | docs/pilot/*, patches | ไม่มี (log ใหม่ถ้าจำเป็น) | ไม่มี | ต่ำ | ไม่มี | smoke ต่อเนื่อง | evidence 11 หมวดตาม A2.2 | ไม่จำเป็น | pilot report + patch backlog ครบ |
| PATCH | Hardening loop | 40–120k ต่อ loop | ตาม triage | ต่ำ–กลาง | ต่ำ | ต่ำ–กลาง | ต่ำ | regression suite ก่อนปล่อย | smoke หลังแต่ละ patch | revert ราย patch | ไม่มี P0/P1 ค้าง ≥2 สัปดาห์ → M1 |

### C2. Post-M1 + Domain B

| Phase | Goal | Token Range | Files Likely Affected | DB Impact | API Impact | Security Risk | Migration Risk | Testing Requirement | Production Verification | Rollback Strategy | Exit Criteria |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 5 | AI Hardening (advanced) | 60–120k | aiToolCalling, EF, injection tests | อาจเพิ่ม memory tables | EF เดิมขยาย | กลาง | ต่ำ | injection suite เต็ม | chat e2e + cross-device | revert EF | AI-02 (adv) ปิด |
| 6 | Intelligence | 60–100k | SQL views/jobs, customerIntelligence | views/materialized | ไม่มี | ต่ำ | ต่ำ | unit เทียบ DB จริง | dashboard ตรง DB | drop views | CI-01 ปิด |
| 7 | Growth | 60–100k | content governance UI | approval table | ไม่มี | ต่ำ | ต่ำ | workflow tests | publish-block ทดสอบจริง | flag ปิด | CNT-01 ปิด |
| SAAS GATE | เปิด Domain B | 20–40k | docs + approval | ไม่มี | ไม่มี | ต่ำ | ไม่มี | ไม่มี | M1 evidence review | ไม่จำเป็น | owner อนุมัติเป็นลายลักษณ์อักษร |
| 8 | Multi-tenant Foundation | 200–350k | tenants + tenant_id + RLS rewrite ทุกตาราง, IAM, LOC, WL base | **สูงสุด** (schema ใหญ่) | JWT claims | **CRITICAL** (isolation) | **สูง** | isolation suite บังคับ | tenant A/B isolation จริง | single-tenant fallback flag | SAAS-001..004, LOC, IAM |
| 9 | Commerce Expansion | 150–300k | SITE/THEME/QR, COM generic | theme/pages tables | public site EF | กลาง | กลาง | builder e2e | staging tenant สร้างหน้าเอง | feature flags ราย pillar | COM/THEME/SITE/QR core |
| 10 | Restaurant Experience | 200–350k | RES/DINE/CAT/INV-PRO-005..010 | reservations/tables/event orders | booking RPC | สูง (เงิน/กำหนดการ) | สูง | booking concurrency + void/split tests | pilot reservation จริง | ปิด module รายตัว | RES core, DINE desk, CAT |
| 11 | CRM+Loyalty+Marketing | 120–250k | CRM/MKT/REV modules | loyalty/campaigns tables | ไม่มี EF ใหม่ | กลาง (สิทธิ์ลูกค้า) | กลาง | rules + approval tests | pilot campaign (ผ่าน approval) | flags รายโมดูล | CRM/MKT/REV core |
| 12 | AI Business Intelligence | 100–200k | AI-BIZ/AI-FC/ANA | views + forecast cache | EF ai-biz | กลาง (read-only บังคับ) | ต่ำ | read-only guardrails | brief เทียบ DB truth | revert EF | ANA core + AI-BIZ |
| 13 | SaaS Billing | 150–250k | billing EF, plans, entitlements | subscriptions/usage | billing webhooks | **สูง (เงิน)** | สูง | billing tests (fail/retry/dunning) | sandbox→live billing จริง | pause-billing flag | SAAS-005..025 |
| 14 | Second Tenant Pilot | 80–150k (+ops) | onboarding UX | ไม่มีโครงสร้างใหม่ | ไม่มี | ต่ำ–กลาง | ต่ำ | onboarding e2e | **ร้านจริงร้านที่ 2 เดินครบวงจร** | n/a | SAAS-026 PASS |
| 15 | Commercial Launch | 60–120k | เว็บขาย, legal, pricing | ไม่มี | ไม่มี | กลาง | ต่ำ | full QA | launch checklist | n/a | **M2 = BMB SAAS READY** |

> Phase 8–15 ต้อง re-plan ราย phase ก่อนเริ่มเสมอ (ตัวเลขเป็นค่าประมาณวางแผน ณ วันนี้ — ปรับได้ผ่าน PRODUCT PATCH)

## D. Session Continuity (บังคับใช้)

เปิด session ใหม่ด้วยไฟล์ 4 ตัวนี้เท่านั้น:

1. `README.md` — ภาพรวม + วิธีรัน + index
2. `docs/BMB_CURRENT_STATE_2026-09-20.md` — ความจริงล่าสุด (ต้อง update ทุก phase)
3. `docs/BMB_MASTER_PRODUCT_SPEC.md` — target ที่ต้องเป็น
4. `docs/BMB_100_PERCENT_CLOSURE_BOOK.md` — สิ่งที่ยังต้องปิด (ID คือภาษากลางระหว่าง session)

เอกสารอื่นทั้งหมด = **historical evidence** เท่านั้น (ห้ามใช้ประกาศสถานะ)

## E. Exact Next Task (เมื่อ owner สั่งเริ่ม PHASE 0)

```text
PHASE 0 — TRUTH LOCK (ไม่แก้ code)
1. ตรวจ live DB (Supabase SQL Editor):
   - SELECT ทุก policy บน orders/pre_orders/payment_intents → ยืนยัน S-3
   - ยืนยัน migration chain 001→016 applied (เช่น SELECT จากตารางที่แต่ละไฟล์สร้าง)
   - ทดสอบ RPC: create_order_with_items / transition_order_status (negative test)
2. อัปเดต CURRENT_STATE §17 + ปิด/เปิด item ใน Closure Book ตามผลจริง
3. เตรียม PHASE 1 task list (PAY-01 ก่อนเป็นอันดับแรก)
Exit: รายงานผลตรวจ live DB อยู่ใน CURRENT_STATE + Closure Book อัปเดตสถานะ
```

## F. Stop Condition

ห้าม implement นอก phase ที่ owner สั่ง · เมื่อ item ใดปิด → ต้อง update CURRENT_STATE + Closure Book พร้อม evidence link ก่อนไปตัวถัดไป

---

**End of 100% Closure Book**

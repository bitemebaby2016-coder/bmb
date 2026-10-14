# BMB — GATE 1 PREFLIGHT + GATE 3 RELEASE REVIEW EVIDENCE (2026-10-14)

> หลักฐานประกอบ `docs/BMB_OPENING_READINESS_MASTER.md` (เอกสารสถานะหลักฉบับเดียว — ห้ามมีรายงานแข่ง)
> ทุกตัวเลข = ผลลัพธ์จากการรันจริงในรอบนี้ (Production read = GET เท่านั้น) · ไม่มีการเดาหรืออ้างลอย

## 1. Gate 1 — Production read-only preflight (ฐานะ admin ที่อนุญาต)

- ช่องทาง: GoTrue password grant กับ **Dedicated Test Admin** (`BMB_TEST_ADMIN_EMAIL` ใน `supabase/secrets.local.env` — operator-controlled channel) → JWT `role=authenticated` (`qa-admin@bmb.co.th`) — **ไม่ได้ใช้ service_role key** (ตามกติกา)
- ทุก query = GET ผ่าน PostgREST เท่านั้น · project `ivkdfognyiwjcmrhcnwz.supabase.co` · ไม่มี mutation ใด ๆ ใน phase นี้

### 1.1 หมวด cat-1 / cat-2 — ค่าจริง ณ 2026-10-14 (admin read)

| id | name (ค่าจริง) | slug | sort | is_active | archived | menu_section_id | tenant_id |
|---|---|---|---|---|---|---|---|
| cat-1 | ส่งวันนี้ / Same Day | dish | 1 | **false** | false | null | tenant-bmb-001 |
| cat-2 | จองล่วงหน้า / พรีออเดอร์ | rice | 1 | false | **false** | null | tenant-bmb-001 |

- ตรง hard pre-check ของ script (master §3): cat-1 `is_active=false` ✓ · cat-2 `archived=false` ✓ · แถวมีจริงทั้งคู่ ✓
- **DRIFT-A (ค่าจริงต่างจากแผน — ต้องรายงานตามกติกา):** ชื่อหมวดจริง ≠ ชื่อในแผน/seed — seed `001_initial_schema.sql:545-546` / `004:554-555` = 'จานเดียว' (dish) / 'ข้าว' (rice) แต่แถวจริงถูกเปลี่ยนชื่อเป็น 'ส่งวันนี้ / Same Day' / 'จองล่วงหน้า / พรีออเดอร์' (เปลี่ยนผ่าน admin UI ยุคก่อน — ไม่มีหลักฐานใน migration) → เหตุผลเดิมของ Option A ("จานเดียว vs ข้าว ทับซ้อน") อิงชื่อ seed ไม่ใช่ชื่อปัจจุบัน — ผลของแผนกับชื่อจริง: เหลือหมวด visible ชื่อ "ส่งวันนี้ / Same Day" (6 สินค้า) + archive "จองล่วงหน้า / พรีออเดอร์"

### 1.2 สินค้า 6 ตัวตามแผน (ใช้ ID จริงรวม suffix)

| product_id | name | category_id ปัจจุบัน | is_available | same_day | preorder |
|---|---|---|---|---|---|
| prod-1 | ผัดไทยกุ้งสด | cat-1 | true | true | false |
| prod-2 | เมี่ยงแซลม่อน | cat-1 | true | true | false |
| prod-6 | เมนูใหม่: ข้าวกุ้งกระเทียม | cat-1 | true | true | true |
| prod-1789607383214-t8rm95 | สปาเกตตี้ผัดพริกแห้งกุ้ง | cat-1 | true | true | false |
| prod-1789610117076-2p5e8u | ข้าวลาบอกไก่+ไข่ต้ม | cat-1 | true | true | false |
| prod-3 | ปลาต้มผักกาดดอง (ซวนช่ายหยุย) | **cat-2** | true | true | false |

- ตรงแผน: 5 ตัวแรก = cat-1 · prod-3 = cat-2 · ครบ 6 แถวเป๊ะ ✓
- `count(*) FROM products WHERE category_id='cat-2'` = **1** ✓ (ตรงแผน)
- **DRIFT-B (นอกแผน):** พบสินค้าที่ 7 ใน cat-1 = `prod-w3c-test-pre` ("W3C Test Preorder Product", `is_available=false`) — ไม่อยู่ในแผน เมื่อเปิด cat-1: แอดมินเห็นใต้ cat-1 / **ลูกค้าไม่เห็น** (RLS `products_public_read USING (is_available=true)` + `getProducts()` กรอง) → ตัวเลขหลังรัน "cat-1 = 6" ตามแผน จะเป็น **7** ตามจริง (6 ขายได้ + 1 test ปิดขาย)

### 1.3 order_items baseline (ประวัติออเดอร์ — บันทึกก่อนเสมอ)

| product_id | order_items rows |
|---|---|
| prod-1 | 9 |
| prod-2 | 2 |
| prod-6 | 0 |
| prod-1789607383214-t8rm95 | 129 |
| prod-1789610117076-2p5e8u | 0 |
| prod-3 | 1 |
| **รวม 6 สินค้า** | **141** |

- distinct orders ที่อ้าง 6 สินค้า = **141** · `orders` ทั้งตาราง = **206** · `order_items` ทั้งตาราง = **203**
- FK จริง: `order_items.product_id REFERENCES products(id) ON DELETE RESTRICT` (001_initial_schema.sql) — Option A ไม่ลบ/ไม่เปลี่ยน product id → ประวัติไม่กระทบตามโครงสร้าง (ยืนยันตัวเลขนี้ซ้ำหลัง execute ถ้าได้รับอนุมัติ)

### 1.4 ภาพรวมหมวดทั้งระบบ (admin read)

| id | name | sort | is_active | archived |
|---|---|---|---|---|
| cat-1 | ส่งวันนี้ / Same Day | 1 | false | false |
| cat-2 | จองล่วงหน้า / พรีออเดอร์ | 1 | false | false |
| cat-4 | เครื่องดื่ม | 1 | true | false |
| cat-3 | เมนูสุขภาพ | 3 | true | false |
| cat-5 | ของทานเล่น/ผลไม้ | 5 | true | false |
| cat-1790830853978 | สินค้าสำเร็จรูป | 6 | true | false |

## 2. Gate 2 — Category Option A: สถานะ BLOCKED (ยังไม่ execute — 0 rows เปลี่ยน)

- hard pre-check ทั้ง 4 ข้อของ script ตรง ✓ แต่พบ **DRIFT-A/B** → ตามกติกา "ค่าจริงต่างจากแผน = หยุด/รายงาน ห้ามเดา" และ "การ Execute Production SQL ต้องได้รับการยืนยันแยกจากการเตรียมแผน"
- ดังนั้น **ยังไม่รัน 3 UPDATE** (เปลี่ยนข้อมูล production = 0 rows จนถึงตอนนี้) — script + rollback 100% เตรียมไว้แล้วที่ master §3
- สิ่งที่ต้อง Owner ยืนยันก่อน execute: (1) ยืนยัน Option A กับชื่อหมวดปัจจุบัน (DRIFT-A) (2) แนวทางจัดการ `prod-w3c-test-pre` (DRIFT-B — ข้อเสนอ: ปล่อยไว้ ไม่กระทบลูกค้า / หรือแยก archive) (3) สั่ง execution gate

## 3. Gate 3 — Release review ของ 4 commits (diff จริง)

### 3.1 Commit inventory (`4e0453e..8075f5d`, 23 ไฟล์)

| commit | scope | ไฟล์ |
|---|---|---|
| `06a697b` W5C R1/R2/R3 | 6 ไฟล์ | `supabase/migrations/124_order_submit_idempotency.sql` (โค้ด — **ไม่ apply**), `e2e/contracts_124_idempotency.sql`, `e2e/ci/concurrency_124.sh`, docs W5C ×3 |
| `7f808ce` admin catalog | 4 ไฟล์ | `AdminProducts.tsx`, `catalogStructure.ts`, tests ×2 |
| `34385c7` cart/menu | 10 ไฟล์ | `cartStore.ts`, `CartPage/MenuPage/HomePage/TalkToBite`, tests ×5 |
| `8075f5d` docs | 3 ไฟล์ | master + P0 evidence + session handoff |

- ตรงขอบเขตอนุมัติทุก commit · ไม่มีไฟล์นอก scope · HEAD = `8075f5d` (local) · origin/main = `4e0453e` (เดิม — ไม่มี commit ใหม่จาก session อื่น)

### 3.2 สแกนความปลอดภัย (ผ่านทุกข้อ)

- **Protected paths** (`e2e/screenshots/*.png`, `*.webp`, `public/images/pre-order/`, `public/images/same day/`, SVG drinks/snacks ที่ session อื่นลบ, stash `local-edits-before-sync-2026-09-21`) = **ไม่มีใน release** ✓ (การแก้ `docs/...PRE_ORDER...md` = เอกสาร W5C ใน scope — ไม่ใช่ protected asset)
- ไม่มี `.env*` / workflow / `vite.config` / `package.json` / Dockerfile เปลี่ยน ✓
- secret-scan ทั้ง diff: ไม่มี secret จริง — ที่จับได้ = ข้อความกติกาในเอกสาร + `set_config('request.jwt.claims', '{"role":"service_role"}')` ใน 124 (test-helper pattern ตามแบบ contracts เดิม) + คำสั่ง REVOKE ✓
- SQL ในชุด = migration **124 (ไม่ถูก apply — ห้าม apply)** + fixture เทสต์ · `ci.yml` = lint/test/build ไม่มี deploy/migration job · `contract-tests.yml` apply 124 เฉพาะ ephemeral PG ("isolated only, NOT production") → **push ไม่แตะ production schema** ✓
- working tree ปัจจุบัน: SVG 10 ไฟล์ถูก session อื่นลบ (unstaged — ไม่อยู่ใน commit, ไม่เข้า release, ห้ามกู้คืน/commit) + untracked protected assets — ค้างไว้ตามคำสั่ง Owner ✓

### 3.3 CI re-run จริงบนเครื่อง dev (tree = commit ที่จะ release, 2026-10-14)

| คำสั่ง | ผล |
|---|---|
| `npm test` | **972/972 (94 files) exit 0** |
| `npx tsc --noEmit` | **exit 0** |
| `npm run lint` | **exit 0** — 0 errors, 1 warning เดิม (`homeSectionModeCta.test.ts`) + brandNameGuard OK (356 ไฟล์) |
| `npm run build` | **exit 0** — PWA precache 144 entries → `dist/assets/index-B7d67ygF.js` |

ข้อจำกัด: build รันบน worktree ที่มี SVG 10 ไฟล์ถูก session อื่นลบ (ไม่ committed — ไฟล์เหล่านั้นยังอยู่ใน commit/release ที่ Cloudflare build) · W5C harness ×2 = หลักฐานรอบก่อน (handoff) — ไม่ได้รันซ้ำรอบนี้ · live browser E2E = NOT RUN (ไม่มี staging)

### 3.4 Deploy impact + rollback

- push → `main` = **Cloudflare auto-deploy `biteme-baby.com`** (production) — ยืนยันจาก `ci.yml` ไม่มี deploy job = deploy ขับโดย Cloudflare Git integration
- deployed baseline ก่อน push (GET): `assets/index-Cp4VvREX.js` + `assets/index-BRC9VQ30.css`
- ชุดนี้ไม่มี schema/data change → **rollback โค้ด = `git revert` 100%** · rollback ข้อมูล Gate 2 (ถ้าได้รับอนุมัติ) = reverse UPDATE 3 ตัว (master §3)

## 4. Blockers คงเดิม (ไม่เปลี่ยนในรอบนี้)

Payment Live/KYC · SMS/Meta runtime verify · staging env · W5C R9/R10/R11/R12 · migration 124 prod apply = NOT AUTHORIZED · Open Shop = ห้ามประกาศ จนกว่า Acceptance Journey ผ่านจริง

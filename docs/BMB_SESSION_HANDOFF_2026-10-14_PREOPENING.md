# BMB SESSION HANDOFF — 2026-10-14 PRE-OPENING (ไปแชตใหม่)

**อ่าน 2 เอกสารนี้ก่อนเสมอ:** `docs/BMB_OPENING_READINESS_MASTER.md` (สถานะหลัก) + `docs/BMB_P0_ADMIN_MENU_CART_EVIDENCE_2026-10-14.md` (หลักฐาน root cause)

## 1. สถานะ ณ ปิดเซสชั่นนี้
- Repo `D:/A PROJECT/Bite Me Baby` · branch `main` · baseline เดิม `4e0453e` → **มี 3 commits ใหม่บน local (ยังไม่ push):**
  - `06a697b` W5C migration-124 remediation (6 ไฟล์) — **ห้าม apply 124 กับ production**
  - `7f808ce` admin catalog save truth + visibility + move/merge
  - `34385c7` cart line identity + honest AddToCartResult + refetch (10 ไฟล์)
- CI บน tree ที่ commit จริง (2026-10-14): `vitest` **972/972 exit 0** · `tsc` 0 · `lint` 0 (warning เดิม 1) · `build` 0 · W5C harness `HARNESS_EXIT=0 ALL_GREEN` ×2 (docker postgres:16 isolated)
- **Production runtime = NOT VERIFIED** · **Open Shop = ห้ามประกาศ**

## 2. สิ่งที่ค้าง (ลำดับถัดไป — ทุกข้อมี gate)
1. **Option A category data change (Owner อนุมัติแผนแล้ว ยังไม่อนุมัติรันอัตโนมัติ):**
   - Preflight ฝั่ง products ทำแล้ว = ตรงแผน **ยกเว้น ID จริง 2 ตัวมี suffix** (`prod-1789607383214-t8rm95`, `prod-1789610117076-2p5e8u`) — ใช้ตาราง/script ใน master §3 เท่านั้น
   - ยังต้อง preflight (ฐานะ admin): ค่า `is_active/archived` จริงของ cat-1/cat-2 + `count(order_items)` ของ 6 สินค้า
   - จำนวนแถวจริง = **3 UPDATE rows** (ไม่ใช่ 2) · ลบ 0 · ถ้า pre-check ไม่ตรง = **ROLLBACK/หยุด ห้ามเดา**
2. **Push = Production deploy (Cloudflare auto-deploy จาก main):** ต้องให้ Owner ตรวจ impact report + สั่งก่อน — หลัง push: ตรวจ build identity (`biteme-baby.com/assets/index-*.js` เทียบ `dist/assets/`) + smoke (แอดมินบันทึก→ลูกค้าเห็น / เพิ่มของ→ตะกร้า / reload→revalidate / checkout validation — **ห้ามสร้างออเดอร์จริง/จ่ายจริง** จนกว่าจะมี test plan ที่ Owner ยืนยัน)
3. **W5C ค้าง:** R9/R12 (Owner), R10 (BLOCKED prod access), R11 (ops) · `unique_violation` = ไม่มี runtime coverage · **ห้าม wire `_i` / เริ่ม W5C-3 / apply migration 124**
4. **Payment/SMS/Meta live keys + runtime** = ภายนอก (master §6) · staging env ยังไม่มี
5. **รูปภาพ:** `public/images/drinks|snacks/*.svg` ถูก session อื่นลบ + เพิ่ม `public/images/same day/` — ห้ามกู้คืน/ลบ/commit ตามคำสั่ง Owner

## 3. กติกาที่ต้องคงไว้ (สำคัญ)
- ห้าม `git add -A` / `git clean` / `git reset` / force push / rewrite history
- Protected: stash `local-edits-before-sync-2026-09-21`, screenshots (`e2e/screenshots/*.png`), webp, `public/images/pre-order/`
- `VITE_FEATURE_BRAND_ROUTING` = OFF ทุก env (ห้ามเปิดก่อน deploy ชุดนี้ + verify)
- Supabase URL จริง = `ivkdfognyiwjcmrhcnwz.supabase.co` (ค่า `atbcszjokvibctgfifyp` ใน note เก่า = ผิด/เก่า อย่าใช้) · ใช้ได้เฉพาะ anon/publishable key — **ห้ามอ่าน/ใช้ service_role key**
- Production read = GET เท่านั้น; mutation ใด ๆ = gate แยก; ห้ามใช้ production เป็น test env
- ทุกคำสั่งที่อ้างผล = ต้องรันจริงและเห็น output (ห้ามอ้างลอย)

## 4. พิกัดเร็ว
- โค้ดตะกร้า/identity: `src/store/cartStore.ts` (`lineKeyFor`) · persistence/revalidate: `src/lib/cartPersistence.ts` · checkout plan/submit: `src/lib/m1CheckoutPlan.ts`, `m1Submit.ts` (submit lock)
- Admin catalog: `src/pages/admin/AdminProducts.tsx` (save guard + move/merge + visibility labels) · `src/lib/catalogStructure.ts` (`customerVisibilityIssue`)
- Customer reads: `src/lib/bmbAdminApi_products.ts` (`getProducts/getCategories` = active only) · RLS: `supabase/migrations/005_secure_rls_policies.sql`
- Tests ใหม่ 7 ไฟล์ใน `src/__tests__/` (adminCustomerVisibility, menuCartResultGuard, cartContextIsolation, cartLineIdentity, submitLockGuard, adminCategoryLifecycle, cartEntryPoints)
- W5C: `supabase/migrations/124_order_submit_idempotency.sql`, `e2e/contracts_124_idempotency.sql`, `e2e/ci/concurrency_124.sh`, `e2e/ci/local_stack_replica.sh` (harness — รันด้วย docker postgres:16 + mount repo)
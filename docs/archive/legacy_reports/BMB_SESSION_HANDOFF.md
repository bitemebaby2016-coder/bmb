# BMB — SESSION HANDOFF (สำหรับเซสชันถัดไป)

**สร้าง:** 2026-09-29 หลังจบ gate TEN-01 AUDIT + STORAGE PLATFORM BLOCKER
**HEAD ปัจจุบัน:** `d451464fab8c61310d0a14ebf9e0d4d7c9f2b7b3` (= origin/main, WORKTREE CLEAN)
**Project:** `D:\A PROJECT\Bite Me Baby\` · prod Supabase ref `ivkdfognyiwjcmrhcnwz` (ยืนยันจาก `.env` VITE_SUPABASE_URL — ห้ามใช้ ref จาก process env ซึ่งเป็นโปรเจกต์เก่า `vkjwqrj…`)

---

## 1. อ่านไฟล์นี้ก่อนอื่น (อยู่ที่ repo root)

- `BMB_TEN01_AUDIT.md` — ownership matrix + TEN-D01..D06 + staged migration plan + RLS contract (proposal, รอ Owner อนุมัติ)
- `BMB_STORAGE_PLATFORM_BLOCKER.md` — root cause 403 + Owner action + support ticket content
- `BMB_CAT03A_IMPLEMENT_REPORT.md`, `BMB_REVIEW_CLOSURE_REPORT.md` — gate ก่อนหน้า
- `AI_WORK_STATE.md` หัวไฟล์ — handoff block ย่อ + rulebook pointer

## 2. สถานะ gate ทั้งหมด (ล่าสุด)

```text
CLOSED (deployed + verified): STEP 2, 3A, 3B-1..2E, CAT-01 (055), CAT-02 (056), CAT-03 (057),
  CAT-03A IMPLEMENT (media migration 9/9 → bmb-images/products/{id}/image.webp + media_assets + products.image_url),
  RE-D1 (migration 058 — preorder_votes anon INSERT ถูกปิด)
CLOSED (code): RE-D2 (reviews=canonical, ลบ fake write path, testimonials reworded "เสียงชมจากผู้ชม (Marketing Testimonials)"),
  RE-D3 (seed products.rating/review_count ซ่อนจาก PWA — legacy)
AUDIT COMPLETE: TEN-01 (ไม่มี tenants/brands/tenant_id ใน prod จริง — ทุกตาราง global)
PLATFORM BLOCKED: Admin UI storage upload (403) — workaround = svc-key server-side upload only
DEFERRED: RE-D4 (moderation UI) · CAT-03B (ห้ามก่อน 2026-10-13) · CAT-04 · TEN-02..09 · Catalog Runtime Verify · Physical Pilot · Open-Shop
```

**Tests ล่าสุด:** vitest 331/331 (36 files) · tsc 0 · eslint 0 · build PASS · secret scan 0

## 3. Prod facts ที่ต้องจำ (read-only probes 2026-09-29)

- ~38 tables ทั้งหมด global; `is_admin()` = `profiles.role='admin'` ครอบทุก table (FOR ALL ~30+ policies); 15 anon-ALL policies ส่วนใหญ่ = deny pattern (qual=false, ปลอดภัย)
- `order_number` = `BMB-YYYYMMDD-NNN` global (orders 202 / order_items 199 — order_items.product_id FK RESTRICT → products)
- `drivers` 5 rows, `user_id` ไม่มี FK; rider authority ผ่าน JWT+RLS (`assignments_scoped_read`)
- `business_settings` 5 keys — TENANT_OPERATIONAL ทั้งหมด (delivery_policy, hours, kitchen_location, operating_hours, order_policy[preorder_max_days=50])
- **Dependency ใหม่ที่ค้นพบ:** `products.delivery_round_id` FK → delivery_rounds → ทำ TEN-04-lite (ops tenant_id) **ก่อน** TEN-03 (catalog tenant_id)

## 4. Root cause Storage 403 (แก้ต้นเหตุที่ platform)

- user JWT ใหม่ sign **ES256/kid** (JWT signing keys) — PostgREST/DB verify ได้ปกติ
- storage-api **ไม่ verify ES256** → admin upload โดน RLS 403 ทุก variant; เฉพาะ legacy HS256 service key ผ่าน
- **Owner ต้องเลือก:** แก้ Dashboard → Authentication → JWT Keys / เปิด Support ticket (template อยู่ใน blocker report) / ยอมรับ svc-key operational path
- ห้าม: rotate secret เอง · เปิด anon upload · WITH CHECK(true) · grant กว้าง

## 5. Awaiting Owner decisions (รอบหน้า)

1. TEN-01 ownership matrix + staged migration plan (TEN-02 → TEN-04-lite → TEN-03 → TEN-05 → TEN-06 RLS → TEN-07 routing → TEN-08 backfill → TEN-09 E2E) อนุมัติ/แก้
2. RLS isolation contract (platform_admin/tenant_admin/customer/driver/service_role)
3. Storage platform action (จาก §4)
4. อนุมัติ CAT-03B ได้เมื่อ ≥ 2026-10-13 เท่านั้น + gate ใหม่ + fresh verification

## 6. กฎปฏิบัติที่ตามมาทุก gate (ไม่เปลี่ยน)

AUDIT → CONTRACT → IMPLEMENT → TEST → RUNTIME VERIFY → EVIDENCE → COMMIT → PUSH → HEAD==origin/main → CLEAN → HARD STOP · Owner ตัดสิน business rule เองเสมอ · migrations ผ่าน Supabase management API (`SUPABASE_ACCESS_TOKEN` จาก process env) · media migration artifacts (`e2e/artifacts/*backups+manifests*`, gitignored) = rollback evidence เก็บ 14 วัน · ห้ามคำว่า 100%/open-shop ready โดยไม่มี evidence ตรง

## 7. เริ่มเซสชันหน้ายังไง

1. `git rev-parse HEAD` ต้องเท่ากับ origin/main + worktree clean
2. อ่าน §1 ทั้ง 4 ไฟล์
3. รอ Owner command ระบุ gate ถัดไป (TEN-02 ต้องมี decision #1 ก่อน) — ห้ามเริ่มเอง

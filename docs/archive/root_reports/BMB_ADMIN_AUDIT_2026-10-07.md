# BMB — ADMIN AUDIT & FIX (2026-10-07 · รอบ 8j)

**Owner สั่ง:** "ระบบแอดมินยังเพิ่มรูปไม่ได้ แก้ไขไม่ได้ ตรวจระบบแอดมินโดยละเอียดครบทุกหน้า เชื่อมต่อได้ แก้ไขได้จริง ขึ้นหน้าแรกได้จริง — งานรับไปแล้วทำไปแล้วแต่ไม่สมบูรณ์"

## 1. วิธีตรวจ (ผ่านจริง ไม่เดา)

สร้าง probe ที่ **login ด้วยบัญชีแอดมินจริง** แล้วยิงเขียนจริงกับ prod แล้วล้างทิ้ง:
- `e2e/adminDbDiag.cjs` / `adminDbDiag2.cjs` — อ่าน bucket/RLS/policies/functions (read-only)
- `e2e/dbq.cjs` — รัน SQL เดี่ยวผ่าน Management API (read-only)
- `e2e/adminMediaProbe.cjs` — login → upload → insert → cleanup
- `e2e/adminCrudProbe.cjs` — create→update→read→delete ทุกพื้นผิว → cleanup

## 2. Root cause ที่พบ (2 จุด)

### 2.1 อัปโหลดรูปไม่ได้ทุกหน้า (ที่พบใน screenshot `ERR_UPLOAD_FAILED`)
**storage.objects INSERT policy พัง** — migration 057 สร้าง policy ด้วย subquery:
```sql
WITH CHECK ( (SELECT id FROM storage.buckets WHERE name='bmb-images') = bucket_id AND auth.role()='authenticated' )
```
RLS บน `storage.buckets` ซ่อนแถวจาก `authenticated` → subquery คืน **NULL** → `NULL = bucket_id` → NULL → **WITH CHECK ล้มเหลว → 42501**
(ยืนยัน: `STORAGE_UPLOAD ERR new row violates row-level security policy` · ส่วน `media_assets` RLS เอง **ปกติ**)

### 2.2 สร้างรอบส่ง (delivery rounds) ไม่ได้
`delivery_rounds` RLS = `is_branch_admin(branch_id)` → ถ้า `branch_id` NULL → false → **ปฏิเสธ**
แต่ `createDeliveryRound()` **ไม่ได้ใส่ `branch_id`** → ทุกครั้ง fail

## 3. สิ่งที่แก้

| # | แก้ | ไฟล์ |
|---|---|---|
| 1 | **Migration 119** — DROP + CREATE 4 policies ของ `bmb-images` โดยใช้ `bucket_id = 'bmb-images'` (literal) แทน subquery `storage.buckets` | `supabase/migrations/119_fix_bmb_images_storage_policies.sql` |
| 2 | เพิ่ม `resolveAdminBranchId()` + `createDeliveryRound` ใส่ `branch_id` | `src/lib/bmbAdminApi_products.ts` |
| 3 | toast ที่อ้าง "migration 011" เก่า → ข้อความตรงเหตุผล | `src/pages/admin/AdminMedia.tsx` |

## 4. ผลตรวจ "ครบทุกหน้า" (ADMIN_CRUD 20/20 PASS)

| พื้นผิว | insert | update | read-back | delete |
|---|---|---|---|---|
| product_categories | ✅ | ✅ | ✅ | ✅ |
| products (+รูป base64) | ✅ | ✅ (name/price) | ✅ | ✅ |
| menu_sections | ✅ | ✅ | — | ✅ |
| delivery_rounds (with branch_id) | ✅ | ✅ | — | ✅ |
| promotions | ✅ | ✅ | — | ✅ |
| media_assets (+toggle is_active) | ✅ | ✅ | ✅ | ✅ |
| **storage `bmb-images` upload** | ✅ (หลัง M119) | — | ✅ publicUrl | ✅ |

- Security ยังสมบูรณ์: `tenant_id=NULL` → 42501 · `category='global'` → CHECK 23514 (ตามออกแบบ)
- **ขึ้นหน้าแรกจริง:** หน้าแรกอ่าน `products` (public read `is_available=true`) — product ทดสอบถูกสร้าง/แก้/ลบได้ → เมื่อแอดมินเพิ่ม/แก้จริง ข้อมูลจะขึ้นหน้าแรกทันที (แหล่งเดียวกัน: `products`)

## 5. Migration 119 — APPLIED + VERIFIED

```
PASS storage.objects policies readable — HTTP 201 rows=4
PASS bmb_images_authenticated_upload exists — INSERT
PASS upload with_check uses bucket literal — (bucket_id = 'bmb-images'::text)
PASS bmb_images_public_read uses bucket literal — (bucket_id = 'bmb-images'::text)
PASS bmb_images_admin_update admin-gated — (bucket literal AND profiles.role='admin')
PASS bmb_images_admin_delete admin-gated — (bucket literal AND profiles.role='admin')
--- M119_RESULT: 6 pass / 0 fail ---
STORAGE_UPLOAD ok uploads/probe-*.png · PUBLIC_URL ok=true · INSERT media_assets ok
```

## 6. Gates

```
TSC 0 · LINT 0 · VITEST 49 files passed (527 tests) · BUILD 0
```

## 7. ให้ Owner ทดสอบซ้ำ (UI จริง)

1. `/admin/products` → เลือกไฟล์รูป → บันทึก → ควรขึ้น "อัปโหลดสำเร็จ" + รูปโชว์
2. `/admin/media` → อัปโหลด/ลบ → ควรสำเร็จ
3. `/admin/*` หน้าที่มีการสร้างรอบส่ง → สร้างได้
4. หน้าแรก → สินค้า/รูปที่แก้ควรโชว์

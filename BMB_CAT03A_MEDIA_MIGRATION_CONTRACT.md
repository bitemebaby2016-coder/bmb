# BMB — CAT-03A: Base64 Media Migration Contract (AUDIT ONLY — NOT IMPLEMENTED)

**สถานะ:** AUDIT + CONTRACT ONLY · ไม่มี implementation · ไม่แตะ production data · commit เอกสารเท่านั้น
**Baseline:** CAT-03 CLOSED (`c03c5e9f`) · bucket `bmb-images` + `media_assets` canonical พร้อมใช้ (057 live) · media_assets = 0 rows, bucket ว่าง

---

## A1. INVENTORY — Base64 product images (production facts, read-only 2026-09-29)

9/10 products = Base64 `data:image/webp;base64,...` (ทั้งหมด WebP):

| Product ID | ชื่อ | category | sort | price | ขนาด (chars) | MIME |
|---|---|---|---|---|---|---|
| prod-1 | ผัดไทยกุ้งสด | cat-1 | 1 | 69.00 | 112,339 | webp |
| prod-2 | เมี่ยงแซลม่อน | cat-1 | 2 | 79.00 | 121,131 | webp |
| prod-3 | ปลาต้มผักกาดดอง (ซวนช่ายหยุย) | cat-2 | 3 | 99.00 | 121,051 | webp |
| prod-4 | เมี่ยงหมู+กุ้ง | cat-3 | 4 | 99.00 | 104,731 | webp |
| prod-5 | ลุยสวนหมู+กุ้ง | cat-3 | 5 | 85.00 | 126,843 | webp |
| prod-6 | เมนูใหม่: ข้าวกุ้งกระเทียม | cat-1 | 6 | 95.00 | 117,015 | webp |
| prod-1789607383214-t8rm95 | สปาเกตตี้ผัดพริกแห้งกุ้ง | cat-1 | 7 | 99.00 | 103,399 | webp |
| prod-1789610117076-2p5e8u | ข้าวลาบอกไก่+ไข่ต้ม | cat-1 | 8 | 69.00 | 113,791 | webp |
| prod-1789952342087-ian4a1 | ลุยสวนหมูสับเห็ดหอม | cat-3 | 0 | 69.00 | 78,367 | webp |

- รวม ~999 KB Base64 text (≈740 KB binary) — เล็กพอสำหรับ single-batch migration
- 1 product ไม่มีรูป (`prod-w3c-test-pre`, image_url = '') — ไม่ต้อง migrate
- อ้างอิงโดย Customer PWA ทุกจุดที่อ่าน `products.image_url` (FoodMenuCard/Showcase/OrderBuilder/Cart/Vote) — migrate แล้วทุกจุดได้ประโยชน์ทันที (field เดียว)
- อ้างอิงอื่น: `archived` flag, `menu_schedule`, order history **ไม่จับ image_url ใน order_items snapshot** (ตรวจแล้วไม่พบ image snapshot) — จึงไม่มี historical reference ที่จะพัง

## A2. TARGET MAPPING (deterministic — ห้ามสร้าง object ใน gate นี้)

```
products.image_url (Base64)
  ↓ decode data-URL → binary .webp
storage object: bmb-images/products/{product_id}/image.webp
  ↓ upload (authenticated admin via uploadMediaAsset path หรือ script แบบ admin session)
media_assets row: { id: 'media-{ts}-{rand}', url: publicUrl, alt: product.name, kind: 'image', created_by: adminUid }
  ↓
products.image_url = publicUrl (UPDATE by product id เท่านั้น)
```

- Path deterministic, 1 product = 1 object = 1 media_assets row
- MIME บังคับ `image/webp` (ทั้ง 9 rows) — ผ่าน whitelist ที่ CAT-03 วางไว้

## A3. DUPLICATE / COLLISION AUDIT

- `media_assets` = **0 rows** · bucket `bmb-images` = **ว่าง** (runtime verified ใน CAT-03) → ไม่มี object ซ้ำ
- Repo: `src/lib/socialProofReviews.ts` เป็น review text ไม่ใช่รูปสินค้า · `public/images/drinks/*.svg` เป็น placeholder เครื่องดื่ม (DrinksSection) — ไม่เกี่ยวกับ product image_url
- สรุป: **ไม่มี collision** — อัปโหลด 9 objects ไม่ชนอะไร

## A4. DATA INTEGRITY CONTRACT (invariants)

Migration ต้องไม่เปลี่ยน: id · name · description · price · category_id · sort_order · is_available · is_featured · is_preorder · prep_minutes · stock · rating · review_count · addons · available_same_day · available_preorder · archived · delivery_round_id · scheduled_date · created_at/updated_at (updated_at ยอมรับได้ถ้าเปลี่ยนเพราะ image_url)
+ orders / order_items / snapshots / menu_schedule / reviews / preorder_votes — ห้ามแตะ
**Verify หลัง update:** ทุก column อื่นต้อง identical (เทียบก่อน-หลังจาก backup row)

## A5. ROLLBACK CONTRACT (sequence — ยังไม่ implement)

```
AUDIT (doc นี้)
→ BACKUP: เก็บ original image_url (Base64 เต็ม) ต่อ product id ใน local artifact (ไม่ใช่ production table ใหม่)
→ UPLOAD object → media_assets row → VERIFY object (HEAD 200) → VERIFY public read (anon GET 200)
→ UPDATE products.image_url (1 product/step) → VERIFY PWA render
→ คง backup ไว้ ≥ rollback window (แนะนำ 14 วัน) ก่อนพิจารณา cleanup
```
Rollback = `UPDATE products SET image_url = <backup base64> WHERE id = ...` — ไม่แตะ orders ทุกกรณี

## A6. FAILURE MATRIX

| Failure | Behavior |
|---|---|
| upload fail | หยุด product นั้น, image_url ยังเป็น Base64 เดิม, ลองใหม่ได้ (idempotent ต่อ product) |
| duplicate object | upload with `upsert:false` — ถ้า path มีอยู่ → reuse media_assets row เดิม (หา) ก่อนสร้างใหม่ |
| media_assets insert fail | rollback storage object (`remove`) — mirror CAT-03 uploadMediaAsset behavior |
| URL generation fail | ถือเป็น insert-fail path |
| products update fail | asset ค้างใน media_assets ได้ (reusable) — ไม่ถือว่า migrated |
| partial migration | ยอมรับได้ต่อ product (ทีละ row) — status ต่อ product: base64/storage |
| broken public read | verify step จับ → ห้าม update image_url จนกว่า read จะ 200 |
| invalid MIME / oversized / corrupted | decode+inspect ก่อน upload — skip + รายงาน product นั้น |
| concurrent admin edit | update ต่อ product id ล่าสุดชนะ — ทำนองเดียวกับ updateProduct ปกติ; แนะนำ migrate นอกเวลา admin แก้สินค้า |
| **No automatic destructive cleanup** | บังคับทุก failure path |

## A7. MIGRATION SCOPE

**9 rows ทั้งหมดใน batch เดียวทำได้ปลอดภัย** (ขนาดรวม ~1 MB, ต่อ row เป็น independent UPDATE, rollback ต่อ row) แต่แนะนำรันเป็น 2 batches: prod-1..prod-6 (seed เดิม) ก่อน → verify → 3 products ที่สร้างผ่าน Admin ภายหลัง (id ยาว) → verify. **ไม่ execute ใน gate นี้**

## A8. CLEANUP DECISION

ห้ามลบ Base64 อัตโนมัติ → **CAT-03B — Legacy Media Cleanup** (แยก gate) หลัง: runtime verified · rollback window ผ่าน · ทุก reference verified · ไม่มี broken image · Owner อนุมัติ

## OWNER DECISIONS REQUIRED (Part D)

| ID | Decision | A | B | Recommended | Risk |
|---|---|---|---|---|---|
| CAT-03A-D1 | อนุมัติ migration plan (A2–A7) | อนุมัติ + execute ใน gate ถัดไป | รอ | **A** | ต่ำ (per-row rollback, backup ครบ) |
| CAT-03A-D2 | Backup retention | 14 วัน | 30 วัน | **A** | Base64 backup ~1 MB artifact |
| CAT-03A-D3 | CAT-03B timing | ทันทีหลัง rollback window | รวมกับ gate อื่น | **A** | cleanup ช้าไปไม่มีผล business |

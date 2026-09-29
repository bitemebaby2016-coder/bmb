# BMB — CAT-03 REPORT: Canonical Media / Storage

**Gate:** CAT-03 (1 gate = 1 commit) · **CAT-D03=B** — Supabase Storage `bmb-images` + `media_assets` · TEN-D01=A (ไม่มี tenant implementation) · Base: CAT-02 CLOSED (`9214d658`)

## AUDIT RESULT (Production facts, read-only)
| หัวข้อ | สถานะก่อน gate |
|---|---|
| bucket `bmb-images` | มีอยู่ (public, ไม่จำกัด MIME/size) — **ไม่สร้าง bucket ใหม่** |
| storage policies | 🔴 **public "Allow Full Access uvi74e_0..3" = anon INSERT/UPDATE/DELETE ได้ทุก bucket** (dashboard default) |
| `media_assets` | 6 cols (id/url/alt/kind/created_by/created_at) · RLS admin-manage + public-read · **0 rows** |
| upload code | `bmbAdminApi_media.ts` (Phase D) มี upload→storage→metadata→rollback แล้ว · **ไม่มี product attachment + ไม่มี validation** |
| product images | **9/10 = Base64 data-URL**, 0 = storage · PWA อ่าน `products.image_url` ตรง (FoodMenuCard/Showcase/Vote) |
| mascot | `mascot_overrides.media_url` (URL string) — ไม่แตะ, preserve ครบ |
| duplicate registry | ไม่พบ mock image catalog / static mapping (image mock svg = broken-fallback asset เท่านั้น) |

## CANONICAL CONTRACT (ไม่มี duplicate architecture)
```
Binary: storage.objects @ bmb-images (bucket เดียวที่มีอยู่)
Metadata: media_assets (id/url/alt/kind/created_by/created_at — ไม่เพิ่ม column, ห้ามเดา schema)
Reference: products.image_url = Storage public URL (field เดิม)
Admin: upload → validate → media_assets row → attach product (updateProduct) → preview/replace
Customer: อ่าน products.image_url / media_assets ผ่าน public URL เดียวกัน
Base64: คงอยู่สำหรับ rows เดิม (rollback-safe) — ห้ามสร้างเป็นมาตรฐานใหม่
```

## SECURITY (migration 057 — DEPLOYED TO PROD)
- ลบ public "Allow Full Access" ×4 · ใส่ canonical ตาม 011: **public SELECT** · **authenticated INSERT** · **admin-only UPDATE/DELETE** (profiles.role='admin')
- media_assets RLS ไม่แตะ · ไม่มี anon write · policy-only (data ไม่ถูกแตะ: products 10, media_assets 0, bucket intact)
- **Runtime evidence (prod):** anon STORAGE WRITE = **403 RLS denied** · anon LIST/read = **200** (bucket ว่าง)

## IMPLEMENTED / CONNECTED / DEPLOYED
- **IMPLEMENTED:** `validateImageFile` (MIME whitelist jpeg/png/webp/gif · ≤5MB) · `uploadProductImage` (validate→storage→metadata→URL) · AdminProducts `handleImageUpload` ใช้ canonical flow (ไม่สร้าง Base64 ใหม่ — invalid input ปฏิเสธ, storage fail แจ้ง error ไม่ fallback เงียบ) · mock storage surface (upload/getPublicUrl/remove/list + anon-denied)
- **CONNECTED:** Admin upload UI ↔ bmb-images ↔ media_assets ↔ products.image_url ↔ PWA (FoodMenuCard/Showcase/OrderBuilder/Cart/Vote อ่าน field เดียวกัน) · broken-image fallback มีอยู่แล้ว
- **DEPLOYED:** migration **057** (storage policies) → prod

## Product image flow (§6) — สถานะ
Upload ✅ · validate ✅ · store bmb-images ✅ · metadata ✅ · attach ✅ (updateProduct image_url) · preview ✅ · replace ✅ (asset ใหม่เพิ่ม row, เก่าคงอยู่จนกว่าลบ) · preserve valid reference ✅ · PWA display ✅ (field เดียว — ไม่มี dual source)

## Base64 (§7) — **DEFERRED → CAT-03A (HARD STOP)**
- สถานะ: **retained** — 9/10 rows ยังเป็น Base64 ตามเดิม, ไม่แตะเลย (zero loss risk)
- เหตุผล: mass migration (upload 9 assets + แทน image_url) ต้องมี rollback path ที่ชัด (backup เดิม) — แตะ schema/ข้อมูล production → ตาม §7 ต้องแยกเป็น **CAT-03A migration contract แล้ว HARD STOP**
- ข้อบังคับที่ทำแล้ว: **image ใหม่/replace ทุกตัว = storage canonical** (ไม่มี Base64 ใหม่เกิดขึ้น)

## Mascot / Brand (§8-9)
- mascot_overrides ไม่ถูกแตะ (รอ CAT-04/WL gate) · Brand media รองรับผ่าน media_assets.kind (logo/hero/mascot) + infra เดิม — ไม่ implement WL-01/WL-03

## TESTS
Vitest **323/323 (36 files, +9: mediaFlow)** · tsc 0 · eslint 0 · build PASS · secret scan ผ่าน (deploy scripts อ่าน env เท่านั้น)

## สถานะรวม
- **IMPLEMENTED:** validation + canonical upload flow + Admin wiring + mock + tests
- **CONNECTED:** Storage↔media_assets↔products↔PWA (canonical เดียว)
- **DEPLOYED:** 057 → prod
- **RUNTIME VERIFIED:** policies live · anon write 403 · public read 200 · data intact
- **DOCUMENTED:** report + ADMIN_GUIDE_TH
- **MISSING:** —
- **BLOCKED:** —
- **DEFERRED:** Base64 migration (9 rows) → **CAT-03A ต้องมี Owner contract ก่อน** · width/height/size columns บน media_assets (ไม่มี evidence ให้เพิ่ม)

## GIT
HEAD = origin/main = (post-commit) · WORKTREE = CLEAN

## 🔴 HARD STOP — รอ Owner review CAT-03 (+ ตัดสินใจ CAT-03A Base64 migration contract)
# BMB — STORAGE PLATFORM BLOCKER (Admin UI upload → 403)

**Date:** 2026-09-29 · Project: `ivkdfognyiwjcmrhcnwz` (production) · Investigation only — **ไม่มีการแก้ auth config / ไม่มีการ rotate secret / ไม่มี secret ปรากฏในรายงานนี้**

## Exact symptom
Admin (authenticated user, role='admin' ใน profiles, is_admin() = true ผ่าน PostgREST) upload file ไป bucket `bmb-images` ผ่าน Storage REST (`POST /storage/v1/object/bmb-images/...`) → **HTTP 400 wrapping `403 AccessDenied: new row violates row-level security policy`** ทุกครั้ง

## Reproducibility
100% reproducible (ทดสอบซ้ำหลายรอบ, JWT ออกใหม่ทุกครั้ง — issue reproduce กับ freshly issued user JWT)

## Tested auth variants (evidence)
| variant | result |
|---|---|
| apikey = user JWT + Bearer = user JWT (ES256/kid, iss=project auth URL, role=authenticated) | 403 RLS |
| apikey = publishable key + Bearer = user JWT | 403 RLS |
| apikey = legacy anon (HS256, iss=supabase) + Bearer = user JWT | 403 RLS |
| Bearer = user JWT เท่านั้น (ไม่มี apikey) | 403 RLS |
| apikey + Bearer = **service_role key** (legacy HS256) | **200 OK** (bypass RLS by design) |

## Root-cause evidence (บ่งชี้, ไม่ตัดสิน)
- **User JWT ปัจจุบัน sign ด้วย ES256 + kid** (Supabase new JWT signing keys; iss = `https://{ref}.supabase.co/auth/v1`, aud = authenticated, role = authenticated — claims ถูกต้องครบ)
- **Legacy anon/service keys = HS256, iss = `supabase`**
- **PostgREST/DB ปกติ:** user JWT ผ่าน RLS ทุกตาราง (is_admin(), auth.uid() ทำงานจริง — ยืนยันจาก media_assets/products PATCH 201/204 ด้วย admin JWT เดียวกันใน gate CAT-03A)
- **Storage-api ล้มเหลวเฉพาะ user JWT** ทั้งที่ policy (`bmb_images_authenticated_upload`, with_check = bucket='bmb-images' AND auth.role()='authenticated') มีอยู่และ grant INSERT ให้ authenticated มีแล้ว
- ข้อสรุปที่ evidence ชี้: **storage-api ไม่ resolve/verify ES256 JWKS-signed user token** (จำกัดที่ legacy HS256 secret) → request ตกไป role ที่ไม่ใช่ authenticated → INSERT policy ไม่ match → 403 RLS

## Expected vs actual
- Expected: authenticated user (admin) เข้าเงื่อนไข `bmb_images_authenticated_upload` → upload สำเร็จ
- Actual: 403 RLS AccessDenied ทุก variant ของ user JWT; เฉพาะ service key ผ่าน

## Security-preserving workaround (ACTIVE)
ใช้ service key **เฉพาะ storage upload จาก trusted server-side script** ตาม CAT-03 contract §4 — DB writes ทั้งหมดยังเป็น admin authenticated path ผ่าน RLS จริง — **ไม่ได้/จะไม่** เปิด public/anon upload, ไม่เพิ่ม WITH CHECK(true), ไม่ grant กว้างขึ้น

## Runtime verification status
- Migration ที่เกิดขึ้นแล้ว (CAT-03A): **RUNTIME VERIFIED** (objects + URLs + DB ยืนยันครบ)
- **Admin UI upload flow: ยังไม่ RUNTIME VERIFIED** → ตาม master command: Catalog Runtime Verify ยังถือว่า BLOCKED จนกว่าจะแก้ที่ต้นเหตุ หรือ Owner รับ operational path อื่นอย่างชัดเจน

## Exact Owner action required (เลือก)
1. เปิด Supabase Dashboard → **Authentication → JWT Keys**: ตรวจว่า legacy JWT secret ยัง enabled/verify ได้ และ new signing keys (ES256) ตั้งค่าครบ; หากแก้ config ได้เอง ให้ทดสอบซ้ำด้วย probe `e2e/ct-ten01-storage-probe.cjs` (upload variant)
2. หาก config ปกติแต่ยังพัง → **Supabase Support ticket** (โค้งปัจจุบันเป็นแพลตฟอร์ม) — แนบข้อมูลตาม §ด้านล่าง
3. Alternative (ถ้า Support ล่าช้า): Owner ยอมรับ operational path "upload ผ่าน trusted server-side script จนกว่า platform จะแก้" — ต้องระบุเป็น decision ชัดเจน

## Information needed from Supabase Support (ไม่มี secret)
- Project ref `ivkdfognyiwjcmrhcnwz` + วันเวลาทดสอบ (2026-09-29)
- Symptom: storage-api INSERT RLS 403 แม้ valid authenticated JWT (ES256/kid) ผ่าน PostgREST ได้ปกติ
- คำถาม: storage-api ของโปรเจกต์นี้ verify ES256 JWKS tokens หรือไม่; ต้องเปิดอะไรเพิ่ม; มี config drift หลัง JWT signing keys migration หรือไม่

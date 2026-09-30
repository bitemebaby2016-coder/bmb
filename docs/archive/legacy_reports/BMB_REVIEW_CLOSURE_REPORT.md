# BMB — REVIEW CLOSURE REPORT (RE-D1..D4 — EXECUTED)

**Gate:** Review Duplication / Security Closure · Date: 2026-09-29 · Baseline `74ba824c`

## RE-D1 = PASS (RUNTIME VERIFIED)
- **Migration 058** — DROP `preorder_votes_anon` (INSERT TO anon,authenticated, qual=NULL) — **DEPLOYED TO PROD**
- Pre-check: ไม่มี RPC ใดอ้าง preorder_votes · ไม่มี frontend caller (มีแค่ type def) → ตาม contract: ปิด direct anon write, feature safely unavailable — **ไม่สร้าง RPC ใหม่**
- Evidence: anon INSERT = **401/42501 RLS denied** · authenticated regular user = no INSERT policy (deny) · admin = is_admin() ALL policy (intact) · public read คงเดิม (200) · rows = 0 (ไม่มีข้อมูลสูญหาย)
- Future voting feature = ต้องมี server-authoritative RPC + anti-abuse contract แยก (ไม่ใช่ gate นี้)

## RE-D2 = PASS (reviews = canonical; static = Marketing)
- `reviews` ยืนยันเป็น canonical customer reviews (ไม่สร้าง table ซ้ำ · ไม่ merge · ไม่แตะ schema/RLS)
- **Fake write path ลบแล้ว:** `ReviewPage.tsx` ตัด mock useState reviews + "ส่งรีวิวสำเร็จ +10 แต้ม" ออกทั้งหมด — ตอนนี้แสดง notice "ระบบรีวิวยังไม่เปิดใช้" + testimonial classification (ไม่มี UI อ้างว่าบันทึกจริง)
- **Static testimonials reworded:** `ReviewCarouselSection` heading "รีวิวจากลูกค้าจริง" → **"⭐ เสียงชมจากผู้ชม (Marketing Testimonials)"** + link "ดูทั้งหมด"; `socialProofReviews.ts` มี classification header (ห้าม insert เข้า reviews / ห้ามใช้คำนวณ rating)
- เพิ่ม route `/reviews` (ลิงก์เดิมชี้ route ที่ไม่มีจริง — pre-existing broken link, แก้เป็นส่วน closure)
- ห้าม/ไม่ได้: insert static เข้า `reviews` · สร้าง fake relationship · สร้าง fake backend

## RE-D3 = PASS (aggregate ต้อง derive จาก reviews)
- `products.rating / review_count` = **LEGACY SEED VALUES (migration 012)** — ไม่ canonical, ไม่ตั้งเป็น truth
- **Customer-facing use หยุดแล้ว:** `homeProviders.toHomeProduct()` ไม่ expose rating/reviewCount อีก → `HomeProductCard` ไม่แสดงดาว/จำนวนจนกว่าจะมี canonical aggregate (hide-until-real ตาม contract)
- fields ยังอยู่ใน DB (no destructive migration, no DROP) — documented เป็น legacy/non-canonical
- Future aggregate contract (เมื่อเปิดใช้ reviews): คำนวณจาก `reviews` (verified rows) ผ่าน trigger/RPC — แยก gate

## RE-D4 = DEFERRED
Admin moderation UI = gate แยก ตาม Owner decision (ระบบ is_verified พร้อมใน RLS/schema แล้ว)

## TESTS (+8)
- parser: valid webp · reject non-image/malformed · magic check
- RE-D3: getHomeProducts omits rating/reviewCount
- RE-D2: ReviewPage ไม่มี fake write (+10 แต้ม/ส่งสำเร็จ/from('reviews')) · socialProof ไม่ insert reviews + classification มี
- RE-D1: migration 058 committed

Vitest **331/331** · tsc 0 · eslint 0 · build PASS

## Production verification
reviews = 0 rows · RLS intact (anon INSERT 401/42501, verified-only read 200) · preorder_votes anon INSERT denied (401/42501) · **ไม่มี fake review/order ถูกสร้าง** · ไม่มี real-money mutation

## สถานะ
IMPLEMENTED: 058 + ReviewPage rewrite + testimonial reword + homeProviders rating hide · CONNECTED: canonical=reviews (รอเปิดใช้) · DEPLOYED: 058 · RUNTIME VERIFIED: RLS probes · DOCUMENTED: นี้ + CAT03A report + audit docs · MISSING: Admin moderation UI (RE-D4 deferred) · BLOCKED: — · DEFERRED: RE-D4 · เปิดใช้ reviews (เมื่อมีรีวิวจริง)
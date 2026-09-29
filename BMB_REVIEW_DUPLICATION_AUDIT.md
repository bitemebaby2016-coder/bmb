# BMB — REVIEW / SECTION DUPLICATION AUDIT (AUDIT ONLY — NOT IMPLEMENTED)

> **STATUS UPDATE (2026-09-29):** Closure EXECUTED ตาม Owner decisions (RE-D1 ปิด anon INSERT = migration 058 · RE-D2 reviews=canonical + testimonial reword + ลบ fake write path · RE-D3 seed aggregates ซ่อน) — ดู `BMB_REVIEW_CLOSURE_REPORT.md` · RE-D4 DEFERRED

**สถานะ:** discovery/contract work · ไม่แก้ schema · ไม่แก้ RLS · ไม่แกะ business rule · 2026-09-29

## B1. พบ "Section" กี่แบบ — แยก concept ชัด

| Concept | แหล่งจริง | ประเภท |
|---|---|---|
| **Catalog Section** (`menu_sections`) | prod table (migration 055) + Admin UI (CAT-01) | merchandising: Menu → Section → Category → Product |
| **Home review section** | `ReviewCarouselSection.tsx` + `ReviewGallerySection.tsx` (HomePage) | UI placement เท่านั้น |
| **Product review page** | `/reviews/:productId` → `ReviewPage.tsx` | UI + mock state |
| **Admin review API** | `src/lib/bmbAdminApi_reviews.ts` → table `reviews` | write/read path (ดู B3) |
| **Preorder votes** | table `preorder_votes` + `VotePage` | แยก concept (vote ≠ review) |
| **Review gallery images** | static `/assets/reviews/small/` | static assets — ไม่ใช่ review records |
| **AI feedback memory** | `aiMemory.ts` (localStorage `*_feedback`) | AI feature-local, ไม่ใช่ customer review |
| **Products rating/review_count** | prod columns (migration 012) | display aggregates |

Catalog Section ≠ review sections — **ไม่มี collision** (B5 satisfied, ไม่ rename อะไร)

## B2. CANONICAL CONCEPT MATRIX

| Concept | Table | RPC/API | Admin UI | Customer UI | Write Path | Read Path | Authority |
|---|---|---|---|---|---|---|---|
| Catalog section | `menu_sections` | — | AdminSections (CAT-01) | MenuPage grouping | Admin UI | products.category join | ✅ เดียว |
| Product review records | `reviews` | bmbAdminApi_reviews (CRUD) | ❌ **ไม่มีหน้า import API นี้** | ❌ **ไม่อ่าน** | authenticated own-insert / admin | admin API only | table = canonical แต่ orphan |
| Home review carousel | ❌ ไม่มี | — | ❌ | HomePage | — | **`socialProofReviews.ts` (hardcoded static)** | static file |
| Product review page | ❌ ไม่มี | — | ❌ | `/reviews/:id` | **in-memory useState เท่านั้น** | in-memory mock | mock |
| Rating aggregates | `products.rating/review_count` | — | — | FoodMenuCard/Home | ❌ **ไม่มี code อัปเดต** | products table | seeded values (012) |
| Preorder votes | `preorder_votes` | — | — | VotePage | — | — | แยกต่างหาก |

## B3. TRUE DUPLICATION FOUND

**พบ 3 ข้อ (ตามนิยาม B3) — ห้าม merge เอง รายงานแล้ว STOP:**

1. **Read duplication (รุนแรงสุด):** ลูกค้าเห็นรีวิวจาก `SOCIAL_PROOF_REVIEWS` (hardcoded static list, rating≥4) — ขณะที่ table `reviews` = canonical แต่ **0 rows และไม่มี customer UI อ่าน** → สอง source อ้างเป็น "รีวิวลูกค้า" พร้อมกัน
2. **Data duplication:** `products.rating/review_count` (seed 42/31/18/… รีวิว จาก migration 012) ไม่ตรงกับ `reviews` = 0 rows — aggregates ไม่มี sync path จาก canonical source (ไม่มี trigger/ไม่มี code คำนวณ)
3. **Write duplication (mock):** `/reviews/:id` กรอก "ส่งรีวิวสำเร็จ +10 แต้ม" แต่เขียนลง useState เท่านั้น — fake write path ที่ UX อ้างว่าสำเร็จ

ไม่พบ: schema duplication (มี table `reviews` เดียว) · Authority duplication ระหว่าง table สองตัว (แค่ table จริง vs static/mock)

## B4. REVIEW CANONICAL MODEL

- Canonical table มีอยู่แล้ว: `reviews` (product_id FK ON DELETE CASCADE, customer_id, customer_name, rating, comment, is_verified, created_at)
- สถานะจริง: **0 rows** — ระบบ canonical ยังไม่ถูกใช้
- RLS: public read **เฉพาะ is_verified=true** · own insert (authenticated) · own update (customer_id=auth.uid() OR admin) · admin ALL (is_admin())
- **ไม่ merge อะไร** — static social proof ไม่ควรย้ายเข้า `reviews` โดยอัตโนมัติ (เป็น marketing content ไม่ใช่ข้อมูลจริงของลูกค้า; migration มีความเสี่ยง identity/moderation ตาม B4)

## B5. CATALOG SECTION RULE

`menu_sections` ยังเป็น canonical merchandising (CAT-01) — ไม่มี evidence ชนกับ review concept → ไม่แตะ

## B6. CUSTOMER REVIEW / VOTE SECURITY AUDIT

| รายการ | ผล |
|---|---|
| reviews: anonymous write | ❌ ปฏิเสธ (INSERT ต้อง authenticated) ✅ |
| reviews: read | anon อ่านได้เฉพาะ `is_verified=true` ✅ (moderation state ก่อน public) |
| reviews: moderation | is_verified flag มีใน schema + admin ALL — แต่ไม่มี Admin UI เปิดใช้ |
| preorder_votes: anonymous INSERT | ⚠️ policy `preorder_votes_anon` = INSERT โดยมี qual = **NULL (ไม่มีเงื่อนไข)** → **anon โหวตได้ไม่จำกัด ไม่มี rate limit / ไม่ผูก customer_id จริง** |
| rating aggregation canonical | ❌ ไม่ canonical — seeded จาก migration 012, ไม่มี aggregation logic |

**Security finding:** preorder_votes anon-unlimited INSERT — รายงานเป็น **FINDING (BLOCKER-LEVEL FOR OPEN-SHOP)** ตาม §B6 ห้ามแก้ policy ใน gate นี้ → Owner decision RE-D1

## C. CROSS-IMPACT

- `reviews.product_id` + `preorder_votes.product_id` = FK **ON DELETE CASCADE** → การ **ลบ** product จะลบรีวิว/โหวตตาม — แต่ product ใช้ `archived` flag (soft delete) จึงไม่ trigger; **กฎที่ต้องเขียนไว้: ห้าม hard-DELETE products ตอน archive**
- Archived products (0 rows มี review/vote อยู่ ณ วันตรวจ) — หาก archived: reviews ยังอยู่ใน table (เงา data) — กฎการแสดงผลเป็น business decision ภายหลัง
- ไม่พบ dependency กับ media / loyalty / promotions / audit logs

## D. OWNER DECISION TABLE

| ID | Decision | Option A | Option B | Recommended | Risk |
|---|---|---|---|---|---|
| RE-D1 | preorder_votes anon INSERT | บังคับ signed-in/one-vote-per-customer (migration ภายหลัง) | คงเดิม (vote = marketing, ยอมรับ spam) | **A ก่อน Open-Shop** | ปิด spam ช่องโหว่ |
| RE-D2 | Review canonical ตัวเดียว | เปิดใช้ `reviews` + ผูก ReviewPage/Admin UI + aggregates sync | คง static social proof เป็น marketing, ปิด mock ReviewPage | **B ช่วงแรก** (reviews = 0 rows, ยังไม่มี traffic จริง) — เปิด A หลังมีรีวิวจริง | B ต้องลบ mock write path |
| RE-D3 | products.rating/review_count | sync จาก reviews (trigger) | คงเป็น manual display values | **B ตอนนี้ + A เมื่อเปิดใช้ reviews** | values เป็น seed mock อยู่แล้ว |
| RE-D4 | Admin review moderation UI | สร้าง (approve/is_verified) | รอจนมีรีวิวจริง | **B** | — |

## สรุป

REVIEW DUPLICATION AUDIT = **PASS (findings documented, no changes)** — canonical source = `reviews` table (ยังไม่ถูกใช้) · true duplication 3 ข้อ · security finding 1 ข้อ (RE-D1) · **STOP รอ Owner decisions ก่อน implementation gate ใดๆ**

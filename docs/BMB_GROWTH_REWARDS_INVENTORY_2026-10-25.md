# BMB — Growth & Rewards: Inventory ระบบเดิม + แผนเชื่อมต่อ (เอกสารเท่านั้น · ไม่แตะโค้ด)
# วันที่: 2026-10-25 · คู่กับ `BMB_GROWTH_REWARDS_REQUIREMENTS_2026-10-25.md`
# สถานะ: PROPOSAL ONLY — **ยังไม่มี implementation** (ห้ามสร้าง migrations/tables/services/routes/UI ตามคำสั่ง §4.4)

> วิธีเก็บ: probe ไฟล์จริงใน repo (สคริปต์ค้นคำสำคัญ + อ่านไฟล์จริง) ทุกบรรทัดอ้างไฟล์จริง ·
> ช่องที่ยังไม่ได้เปิดอ่านระบุ `ต้อง inspect` ไว้ ห้ามถือเป็นข้อเท็จจริง

## 1. Inventory — ระบบที่มีอยู่แล้วและนำกลับมาใช้ได้

### 1.1 Promotions & Coupon (server-authoritative — ใช้ได้เลย)
| ของ | ที่อยู่ | หลักฐาน/หมายเหตุ |
|---|---|---|
| ตาราง `promotions` + กติกาส่วนลด | migrations 114 (`create_order_with_items` block) · 124 (idempotency) | server คำนวณส่วนลดเองเสมอ — client 仅 preview |
| Client mirror | `src/lib/promotionClient.ts` | `normalizePromoCode` · `computeServerDiscount` (percentage/fixed, cap ที่ subtotal) · `CouponRejectReason` |
| UI คูปอง จุดเดียว | `src/components/CouponBox.tsx` | ONE component = Cart + Checkout (A1) · `src/lib/cartPersistence.ts` เก็บโค้ด |
| แอดมิน | `/admin/promotions` → `src/pages/admin/AdminPromotions.tsx` | ตาราง `promotions` จริง |
| หน้าลูกค้า | `src/pages/PromotionsPage.tsx` | รายการจริง + ปุ่ม "ใช้เลย" = `applyCouponCode` |
| เทสต์ | `promotionDiscountEvaluation*.test.ts` · `checkoutMixedSplit` (coupon+points exclusive) · below-min · `cartPersistenceCouponCode` | negative + legacy ครบ |
| ข้อจำกัด §4.1 | — | **โค้ด = ส่วนลดเท่านั้น ไม่ใช่เงินสด** ✓ ไม่มี cash payout ในระบบ |

### 1.2 AI Marketing Center (ศูนย์กลางตาม §4.1 — มีแล้ว ห้ามสร้างใหม่)
- `src/pages/admin/AdminMarketing.tsx` — 8 แท็บ: Overview · Planner · AI Studio · แคปชัน AI · กล่องอนุมัติ · ปฏิทิน · กติกา · รายงาน (อ่าน/เขียนของจริง · `AdminAiStudio` = แท็บ `ai`)
- `src/lib/adminMarketing.ts` — `listMarketingPosts/createMarketingPost/scheduleMarketingPost/getMarketingRules/saveMarketingRules/bestSellerProducts`
- `src/lib/contentApproval.ts` — `listContentApprovals/reviewContent` (อนุมัติ ≠ ตั้งเวลา ≠ เผยแพร่)
- Server: migration 147 ครอบ `marketing_posts` + `marketing_rules` + RPC guards · role `marketing` (146)

### 1.3 Loyalty & Points (มีเฉพาะ client preview — ช่องว่างหลัก)
- `src/store/rewardsStore.ts` — `loyaltyPoints/pointsHistory/redemptions/activityProgress/badges/streakDays` · actions `addPoints/redeemPoints/updateActivityProgress/completeActivity/addBadge/updateStreak`
- `src/pages/RewardsPage.tsx` — **ZERO-FAKE**: "พรีวิว · ยังไม่มีการออกคูปอง/ตัดแต้มจริง" · แคตตาล็อก Rewards **hardcode 4 รายการในไฟล์** (แอดมินแก้ไม่ได้)
- `src/pages/ProfilePage.tsx` — แสดง `loyaltyPoints` จาก store เดียวกัน
- **ยังไม่มี:** points ledger server · RPC ให้/หัก/คืนแต้ม · อายุแต้ม · audit trail · tiers = GAP ต้องออกแบบเมื่ออนุมัติ (ห้ามแสร้งว่ามีอยู่)

### 1.4 Engagement & Play (มีกิจกรรม standalone — ต้อง inspect ก่อนออกแบบ)
| ไฟล์ | สิ่งที่เห็นจาก probe | ต้อง inspect เพิ่ม |
|---|---|---|
| `src/pages/RandomMenuPage.tsx` | Spin wheel **สุ่มเลือกเมนู** (client-side ล้วน ไม่มีรางวัล/แต้ม) | ขอบเขตปัจจุบันจริง |
| `src/pages/VotePage.tsx` | มีไฟล์จริง (Vote the Next Menu?) | เนื้อหา + data source |
| `src/pages/ViralPage.tsx`, `src/pages/SharePage.tsx` | มีไฟล์จริง · `ViralActivityProgress` type มีใน `src/types` | เชื่อมลิงก์ "ชวนเพื่อน รับคูปอง ฿30" ที่หน้าแรก (`/share`) หรือไม่ |
| `src/pages/NotificationCenterPage.tsx` + push | ช่องทางแจ้งรางวัลในอนาคต | — |
| streak/activity | `rewardsStore.streakDays/activityProgress` (client) | ยังไม่มี server authority |

### 1.5 ระบบสั่งซื้อ/จ่ายเงิน/ลูกค้า (ฐาน earning rules §4.1 ข้อ 9)
- Order spine: `create_order_with_items` (114→141→142) · allow-list transitions (030) · idempotency `order_submissions` (124) · cancel คืนสต็อก/idempotent (028 T13) · **refund = operations การเงินแยก** (028 T18 คง payment_status=paid)
- นี่คือ event source ของ "ออเดอร์ผ่านสถานะที่กำหนด" (§4.2) — **ยังไม่มี hook ในโค้ด ต้องออกแบบ**
- `customers`/`profiles`/role 13 ค่า (146/147) · `business_settings` · `audit_logs` = แบบแผน audit ที่มี

### 1.6 AI/แอดมิน
- `src/lib/aiService.ts` (Model A/B fallback) · AdminAiStudio ใน AdminMarketing · business_settings แอดมินตั้งเอง → แบบแผน "AI ในกรอบงบ + kill switch" มีที่ให้ต่อยอด (marketing rules tab = ตัวอย่าง rules engine)

## 2. จุดซ้ำซ้อน / ความเสี่ยง (ต้องไม่ปล่อยให้เกิดซ้ำ)
1. **แคตตาล็อก Rewards สองชุด** — hardcoded ใน `RewardsPage` vs ตาราง `promotions` → ถ้าต่อยอดโดยไม่รวม จะมี 2 ระบบรางวัล · ทิศทาง: แอดมิน-control ผ่านระบบเดิม
2. **rewardsStore = client-only** — แต้มปลอมในเครื่องลูกค้า · ห้ามโปรโมตว่าเป็นแต้มจริงก่อนมี server ledger (ZERO-FAKE ต้องคงไว้)
3. **Mini-features แยกชิ้น** (RandomMenu/Vote/Viral/Share) จะกลายเป็นระบบอิสระถ้าไม่ดันเข้ากรอบ Growth + AI Marketing Center
4. ห้ามเพิ่ม cash commission/เงินสด (§4.1 ข้อ 4-5) — ตอนนี้ไม่มีอยู่แล้ว ✓ ต้องรักษาไว้
5. Role/permissions: การตลาด = role `marketing` + admin gates (146/147) — campaign management ต้องอยู่ใน matrix เดิม

## 3. ช่องว่าง (GAP)
- [ ] Points ledger server-side + audit trail + expiry (ยังไม่มี)
- [ ] Referral identity/anti-self-referral (ยังไม่เห็น fields — ต้อง inspect `customers`/`profiles`)
- [ ] Campaign engine 4 กลุ่ม + budget caps + kill switch สำหรับ AI (มีแค่ marketing_rules อย่างง่าย)
- [ ] แคตตาล็อก/ตั้งค่ารางวัลแลกแต้ม = ของแอดมิน (ตอนนี้ hardcoded)
- [ ] Unit economics / ต้นทุนต่อหน่วย = ไม่มีข้อมูล → **อัตราแต้ม/ส่วนลดยังห้ามกำหนด** (§4.3)
- [ ] order status → points event hook (ยังไม่มี)
- [ ] หน้าจอบริหาร Growth (ยืนบน AI Marketing Center แท็บ Rules/Analytics — เพิ่มส่วนในระบบเดิมเมื่ออนุมัติ ห้ามสร้าง center ใหม่)

## 4. แผนเชื่อมต่อ (ข้อเสนอ — ไม่แก้โค้ดในรอบนี้)
1. **ศูนย์กลาง:** ทุกกิจกรรมบริหารผ่าน AI Marketing Center ที่มีอยู่ (เพิ่มแท็บ/ส่วนในอนาคตเมื่ออนุมัติ)
2. **Promotions:** ใช้ `promotions` + `promotionClient` + `CouponBox` เป็นรางวัลส่วนลด — แคมเปญส่วนลดใน §4.3 เดินบนรางเดิม
3. **Loyalty:** ออกแบบ `points_ledger` (append-only + audit_logs pattern) + RPC give/revoke/expire ตาม §4.2 · แปลง `rewardsStore`/`RewardsPage` ให้อ่านของจริง (ไม่สร้างหน้าใหม่)
4. **Order hook:** points earn/adjust ผ่าน observer ของ order lifecycle เดิม (ยืนยันสถานะ → ให้ · cancel/refund → ปรับตามต้นทาง ป้องกันหักซ้ำแบบ idempotency 124)
5. **Engagement:** รวม RandomMenu/Vote/Share เข้ากรอบ §4.3 (ของเดิม = base UI · เพิ่มกติกา/รางวัลเมื่ออนุมัติ)
6. **Anti-fraud:** อ้าง idempotency + role gates + audit_logs ที่มีอยู่เป็นพื้นฐาน

## 5. รายการคำถามที่ต้องตัดสินใจ (ก่อนเริ่มพัฒนา)
1. อัตราแต้ม/เพดาน/อายุแต้ม — **รอ unit economics** (ยังห้ามกำหนด §4.3)
2. โครงสร้าง Loyalty Tiers — กี่ระดับ · เกณฑ์อะไร
3. Referral identity — ผูกด้วยอะไร (phone/auth) · กัน self-referral ระดับไหน
4. Spin & Win — ของเดิมสุ่มเมนูล้วน: ต้องการรางวัล/แต้มด้วยไหม
5. Creator Affiliate — ยืนยันขอบเขต "ไม่มีเงินสด" → แต้ม/คูปอง อย่างเดียว
6. งบ AI/เพดานส่วนลด/kill switch — ค่าเริ่มต้นที่ Owner อนุมัติ
7. แคตตาล็อก Rewards แลกแต้ม — ย้าย hardcode → ตาราง admin ตั้งเอง
8. ลำดับ Rollout — กลุ่มไหนนำ (Promotions แข็งที่สุด / Loyalty ต้องการ server ใหม่)

## 6. ยืนยันขอบเขต (§4.4)
- ✅ เอกสาร requirements + inventory ฉบับนี้ = งานที่อนุญาต
- ✅ **ไม่มี** migrations · tables · services · routes · UI · business logic ที่เปลี่ยนเพื่อ Growth & Rewards
- ⛔ Implementation ทั้งหมด = รอ Owner อนุมัติคำสั่งพัฒนาแยกต่างหาก
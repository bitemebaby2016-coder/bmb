# BMB — Growth & Rewards: Inventory ระบบเดิม + แผนเชื่อมต่อ (เอกสารเท่านั้น · ไม่แตะโค้ด)
# วันที่: 2026-10-25 · คู่กับ `BMB_GROWTH_REWARDS_REQUIREMENTS_2026-10-25.md`
# สถานะอัปเดต 2026-10-25 (หลัง Owner สั่ง "เริ่มพัฒนา G&R ตามกฏ"):
#   ✅ STAGE 1 (Promotions) = IMPLEMENTED + GATES GREEN — ดูหลักฐาน = `e2e/g153-gates-evidence.txt`
#      (migration 153 + contract 153 + client mirror + ฟอร์มแอดมิน + แผงงบใน Marketing Center + เทสต์ 22 ข้อ)
#   ⏳ STAGE 2-4 (Referral → Loyalty Tiers → Engagement) = ยังไม่เริ่ม — ข้ามขั้นไม่ได้ (§5.8 ⑧)
#   ข้อความเดิมด้านล่าง (PROPOSAL ONLY / ห้าม implement) = บันทึกก่อนคำสั่ง start — คงไว้เป็น history
#   ส่วน §1/§5 ยังคงเป็นกติกาที่ถูกต้องทุกประการ (ไม่มีการตีความเพิ่ม)

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
 : ถูกต้องโอเคอนุมัติ
### 1.2 AI Marketing Center (ศูนย์กลางตาม §4.1 — มีแล้ว ห้ามสร้างใหม่)
- `src/pages/admin/AdminMarketing.tsx` — 8 แท็บ: Overview · Planner · AI Studio · แคปชัน AI · กล่องอนุมัติ · ปฏิทิน · กติกา · รายงาน (อ่าน/เขียนของจริง · `AdminAiStudio` = แท็บ `ai`)
- `src/lib/adminMarketing.ts` — `listMarketingPosts/createMarketingPost/scheduleMarketingPost/getMarketingRules/saveMarketingRules/bestSellerProducts`
- `src/lib/contentApproval.ts` — `listContentApprovals/reviewContent` (อนุมัติ ≠ ตั้งเวลา ≠ เผยแพร่)
- Server: migration 147 ครอบ `marketing_posts` + `marketing_rules` + RPC guards · role `marketing` (146)
: ถูกต้องโอเคอนุมัติ
### 1.3 Loyalty & Points (มีเฉพาะ client preview — ช่องว่างหลัก)
- `src/store/rewardsStore.ts` — `loyaltyPoints/pointsHistory/redemptions/activityProgress/badges/streakDays` · actions `addPoints/redeemPoints/updateActivityProgress/completeActivity/addBadge/updateStreak`
- `src/pages/RewardsPage.tsx` — **ZERO-FAKE**: "พรีวิว · ยังไม่มีการออกคูปอง/ตัดแต้มจริง" · แคตตาล็อก Rewards **hardcode 4 รายการในไฟล์** (แอดมินแก้ไม่ได้)
- `src/pages/ProfilePage.tsx` — แสดง `loyaltyPoints` จาก store เดียวกัน
- **ยังไม่มี:** points ledger server · RPC ให้/หัก/คืนแต้ม · อายุแต้ม · audit trail · tiers = GAP ต้องออกแบบเมื่ออนุมัติ (ห้ามแสร้งว่ามีอยู่)
: ถูกต้องโอเคอนุมัติลบฮาร์ดโค้ดปิดช่องว่าง
### 1.4 Engagement & Play (มีกิจกรรม standalone — ต้อง inspect ก่อนออกแบบ)
| ไฟล์ | สิ่งที่เห็นจาก probe | ต้อง inspect เพิ่ม | :
|---|---|---|
| `src/pages/RandomMenuPage.tsx` | Spin wheel **สุ่มเลือกเมนู** (client-side ล้วน ไม่มีรางวัล/แต้ม) | ขอบเขตปัจจุบันจริง |
| `src/pages/VotePage.tsx` | มีไฟล์จริง (Vote the Next Menu?) | เนื้อหา + data source | คิดเองได้เลยจากเมนูที่มี
| `src/pages/ViralPage.tsx`, `src/pages/SharePage.tsx` | มีไฟล์จริง · `ViralActivityProgress` type มีใน `src/types` | เชื่อมลิงก์ "ชวนเพื่อน รับคูปอง ฿30" ที่หน้าแรก (`/share`) หรือไม่ | เชื่อมด้วยจากลิ้งค์จริงที่แอดมินตั้งแล้วต้องปรับได้ตลอด
| `src/pages/NotificationCenterPage.tsx` + push | ช่องทางแจ้งรางวัลในอนาคต | — |แจกทางnoticeและเก็บไว้ในโปนไฟล์
| streak/activity | `rewardsStore.streakDays/activityProgress` (client) | ยังไม่มี server authority | ทำด้วย
 ถูกต้องโอเคอนุมัติ inspect เพิ่ม
### 1.5 ระบบสั่งซื้อ/จ่ายเงิน/ลูกค้า (ฐาน earning rules §4.1 ข้อ 9)
- Order spine: `create_order_with_items` (114→141→142) · allow-list transitions (030) · idempotency `order_submissions` (124) · cancel คืนสต็อก/idempotent (028 T13) · **refund = operations การเงินแยก** (028 T18 คง payment_status=paid)
- นี่คือ event source ของ "ออเดอร์ผ่านสถานะที่กำหนด" (§4.2) — **ยังไม่มี hook ในโค้ด ต้องออกแบบ**
- `customers`/`profiles`/role 13 ค่า (146/147) · `business_settings` · `audit_logs` = แบบแผน audit ที่มี
 ถูกต้องโอเคอนุมัติ
### 1.6 AI/แอดมิน
- `src/lib/aiService.ts` (Model A/B fallback) · AdminAiStudio ใน AdminMarketing · business_settings แอดมินตั้งเอง → แบบแผน "AI ในกรอบงบ + kill switch" มีที่ให้ต่อยอด (marketing rules tab = ตัวอย่าง rules engine)
 ถูกต้องโอเคอนุมัติ
## 2. จุดซ้ำซ้อน / ความเสี่ยง (ต้องไม่ปล่อยให้เกิดซ้ำ)
1. **แคตตาล็อก Rewards สองชุด** — hardcoded ใน `RewardsPage` vs ตาราง `promotions` → ถ้าต่อยอดโดยไม่รวม จะมี 2 ระบบรางวัล · ทิศทาง: แอดมิน-control ผ่านระบบเดิม  ถูกต้องโอเคอนุมัติ
2. **rewardsStore = client-only** — แต้มปลอมในเครื่องลูกค้า · ห้ามโปรโมตว่าเป็นแต้มจริงก่อนมี server ledger (ZERO-FAKE ต้องคงไว้)  ถูกต้องโอเคอนุมัติ
3. **Mini-features แยกชิ้น** (RandomMenu/Vote/Viral/Share) จะกลายเป็นระบบอิสระถ้าไม่ดันเข้ากรอบ Growth + AI Marketing Center  ถูกต้องโอเคอนุมัติ
4. ห้ามเพิ่ม cash commission/เงินสด (§4.1 ข้อ 4-5) — ตอนนี้ไม่มีอยู่แล้ว ✓ ต้องรักษาไว้ ถูกต้องโอเคอนุมัติ
5. Role/permissions: การตลาด = role `marketing` + admin gates (146/147) — campaign management ต้องอยู่ใน matrix เดิม  ถูกต้องโอเคอนุมัติ

## 3. ช่องว่าง (GAP)
- [ ] Points ledger server-side + audit trail + expiry (ยังไม่มี) : เติมปิดทำด้วย
- [ ] Referral identity/anti-self-referral (ยังไม่เห็น fields — ต้อง inspect `customers`/`profiles`) เติมปิดทำด้วย
- [ ] Campaign engine 4 กลุ่ม + budget caps + kill switch สำหรับ AI (มีแค่ marketing_rules อย่างง่าย) เติมปิดทำด้วยให้ละเอียดดีพร้อม
- [ ] แคตตาล็อก/ตั้งค่ารางวัลแลกแต้ม = ของแอดมิน (ตอนนี้ hardcoded) ทำให้ใช้จริงผูกจริงตั้งเองได้
- [ ] Unit economics / ต้นทุนต่อหน่วย = ไม่มีข้อมูล → **อัตราแต้ม/ส่วนลดยังห้ามกำหนด** (§4.3) : ทำสูตรไว้แอดมินจะตามไปใส่รายละเอียดเพิ่มให้ทีหลัง เมนูยังไม่ครบ
- [ ] order status → points event hook (ยังไม่มี) ทำ  points event hook
- [ ] หน้าจอบริหาร Growth (ยืนบน AI Marketing Center แท็บ Rules/Analytics — เพิ่มส่วนในระบบเดิมเมื่ออนุมัติ ห้ามสร้าง center ใหม่) ใช่

## 4. แผนเชื่อมต่อ (ข้อเสนอ — ไม่แก้โค้ดในรอบนี้)
1. **ศูนย์กลาง:** ทุกกิจกรรมบริหารผ่าน AI Marketing Center ที่มีอยู่ (เพิ่มแท็บ/ส่วนในอนาคตเมื่ออนุมัติ) ถูกต้องโอเคอนุมัติ
2. **Promotions:** ใช้ `promotions` + `promotionClient` + `CouponBox` เป็นรางวัลส่วนลด — แคมเปญส่วนลดใน §4.3 เดินบนรางเดิม ถูกต้องโอเคอนุมัติ
3. **Loyalty:** ออกแบบ `points_ledger` (append-only + audit_logs pattern) + RPC give/revoke/expire ตาม §4.2 · แปลง `rewardsStore`/`RewardsPage` ให้อ่านของจริง (ไม่สร้างหน้าใหม่) ถูกต้องโอเคอนุมัติ
4. **Order hook:** points earn/adjust ผ่าน observer ของ order lifecycle เดิม (ยืนยันสถานะ → ให้ · cancel/refund → ปรับตามต้นทาง ป้องกันหักซ้ำแบบ idempotency 124) ถูกต้องโอเคอนุมัติ
5. **Engagement:** รวม RandomMenu/Vote/Share เข้ากรอบ §4.3 (ของเดิม = base UI · เพิ่มกติกา/รางวัลเมื่ออนุมัติ) ถูกต้องโอเคอนุมัติ
6. **Anti-fraud:** อ้าง idempotency + role gates + audit_logs ที่มีอยู่เป็นพื้นฐาน ถูกต้องโอเคอนุมัติ

## 5. รายการคำถามที่ต้องตัดสินใจ (ก่อนเริ่มพัฒนา)
1. อัตราแต้ม/เพดาน/อายุแต้ม — **รอ unit economics** (ยังห้ามกำหนด §4.3) : ใช่ ทำสูตรเตรียมไว้แอดมินปรับใส่เพิ่มอก้ไขเองได้
2. โครงสร้าง Loyalty Tiers — กี่ระดับ · เกณฑ์อะไร :ใช้ 4 ระดับ โดยวัดจากยอดซื้อสุทธิที่เข้าเงื่อนไขในรอบ 12 เดือน ไม่ใช้จำนวนครั้งที่กดเข้าเว็บ แชร์ หรือร่วมกิจกรรมเป็นเกณฑ์เลื่อนระดับ
ระดับ	เกณฑ์ยอดซื้อสุทธิสะสมใน 12 เดือน	สิทธิประโยชน์แนวทาง
Member	เริ่มต้น	สะสมแต้มและรับคูปองตามแคมเปญ
Silver	≥ 1,500 บาท	ภารกิจและข้อเสนอเฉพาะระดับ
Gold	≥ 4,000 บาท	สิทธิ์ทดลองเมนูใหม่และรางวัลสมาชิก
Platinum	≥ 8,000 บาท	สิทธิพิเศษก่อนใครและรางวัลระดับสูง

ตัวเลขนี้เป็นเกณฑ์เริ่มต้นเพื่อออกแบบ ไม่ใช่ตัวเลขที่ผ่านการคำนวณต้นทุนแล้ว ควรปรับให้เหมาะกับยอดสั่งซื้อเฉลี่ย กำไรต่อออเดอร์ และความถี่ในการซื้อจริงก่อนเปิดใช้งาน

กติกาที่แนะนำ:
- คำนวณจากยอดสินค้าที่ชำระสำเร็จ หักส่วนลดและรายการคืนเงินตามนโยบายที่กำหนด ไม่รวมค่าส่งและยอดที่ยกเลิก
- ใช้ rolling 12 months เพื่อให้ระดับสะท้อนพฤติกรรมการซื้อปัจจุบัน
- แจ้งเกณฑ์และวันประเมินระดับให้ลูกค้าเห็นอย่างโปร่งใส
- ไม่ลดระดับทันทีเมื่อมีคืนเงินหนึ่งรายการ ให้ประเมินตามยอดสุทธิที่แก้ไขแล้ว
- สิทธิประโยชน์หลักควรเป็นสิทธิ์ที่ต้นทุนต่ำ เช่น ทดลองเมนูใหม่ สิทธิ์เข้าถึงก่อน หรือภารกิจพิเศษ ไม่ใช่แจกส่วนลดหนักทุกระดับ
- หากระบบเดิมยังไม่รองรับการคำนวณและบันทึกยอดสุทธิสะสมอย่างเชื่อถือได้ ให้ตรวจสอบก่อน ยังไม่สร้างระบบใหม่ทันที
3. Referral identity — ผูกด้วยอะไร (phone/auth) · กัน self-referral ระดับไหน: Referral Identity — ผูกตัวตนและป้องกันการแนะนำตัวเอง
ข้อสรุป: ใช้บัญชีผู้ใช้ที่ผ่านการยืนยันตัวตนเป็นหลัก และใช้เบอร์โทรศัพท์ที่ยืนยัน OTP เป็นหลักฐานเพิ่มเติมเมื่อมีการสั่งซื้อ ไม่ใช้ IP หรืออุปกรณ์เพียงอย่างเดียวเป็นเหตุปฏิเสธรางวัล
กรณี	กติกาที่แนะนำ
ผู้แนะนำ	ต้องมีบัญชีที่ระบุตัวตนได้ และมี referral ID เฉพาะ
เพื่อนใหม่	ต้องเป็นลูกค้าใหม่ตามนิยามที่ระบบตรวจสอบได้
ยืนยันเบอร์	ใช้ OTP ตอนที่จำเป็น เช่น การยืนยันบัญชีหรือการสั่งซื้อ
Self-referral	ห้ามบัญชีเดียวกันแนะนำตัวเอง และตรวจสอบความเชื่อมโยงของบัญชีที่ใช้เบอร์เดียวกัน
รางวัล	ให้เมื่อออเดอร์ผ่านสถานะที่กำหนด เช่น ชำระเงินและดำเนินการสำเร็จ
ออเดอร์ยกเลิก/คืนเงิน	ไม่ให้รางวัล หรือปรับรายการรางวัลกลับตาม ledger โดยไม่หักซ้ำ
พฤติกรรมน่าสงสัย	พักรางวัลเพื่อให้ตรวจสอบ ไม่แบนทันทีจากสัญญาณเดียว

มาตรการป้องกันควรแบ่งเป็น 3 ระดับ:
1. Hard block: บัญชีเดียวกันเป็นทั้งผู้แนะนำและผู้ถูกแนะนำ หรือ referral event ซ้ำรายการเดิม
2. Review: ใช้เบอร์เดียวกันหลายบัญชี มีรูปแบบการสั่งซื้อผิดปกติ หรือมีสัญญาณหลายอย่างประกอบกัน
3. Soft signal: IP เดียวกัน อุปกรณ์เดียวกัน หรือเครือข่ายเดียวกัน ใช้ประกอบการประเมินเท่านั้น เพราะครอบครัวหรือคนในออฟฟิศอาจใช้เครือข่ายเดียวกันจริง
ควรใช้ referral attribution ที่ตรวจสอบย้อนหลังได้ กำหนดช่วงเวลาการระบุผู้แนะนำให้ชัด และห้ามเปลี่ยนผู้แนะนำย้อนหลังโดยไม่มีเหตุผลและประวัติการแก้ไข

ข้อสำคัญทางเทคนิค: ก่อนตัดสินใจว่าจะใช้ phone หรือ auth เป็น unique identity หลัก ต้องตรวจระบบ authentication, guest checkout และการยืนยัน OTP ที่มีอยู่จริง เพื่อไม่ให้สร้างข้อกำหนดขัดกับระบบเดิม และไม่บังคับลูกค้าสมัครบัญชีเต็มรูปแบบโดยไม่จำเป็น
4. Spin & Win — ของเดิมสุ่มเมนูล้วน: ต้องการรางวัล/แต้มด้วยไหม : ใช่
5. Creator Affiliate — ยืนยันขอบเขต "ไม่มีเงินสด" → แต้ม/คูปอง อย่างเดียว : ใช่
6. งบ AI/เพดานส่วนลด/kill switch — ค่าเริ่มต้นที่ Owner อนุมัติ : 15%ของยอดขาย แอดมินปรับเองได้
7. แคตตาล็อก Rewards แลกแต้ม — ย้าย hardcode → ตาราง admin ตั้งเอง ย้ายย้าย hardcode 
8. ลำดับ Rollout — กลุ่มไหนนำ (Promotions แข็งที่สุด / Loyalty ต้องการ server ใหม่) ลำดับ Rollout — เริ่มจากอะไร
ข้อสรุป: Promotions → Referral → Loyalty Tiers → Engagement & Play โดยแยกการเตรียมข้อกำหนดออกจากการเริ่มพัฒนา
1

Promotions — เริ่มก่อน
ลำดับแรก
ต่อยอดคูปองและส่วนลดเดิม ควบคุมงบ ยอดขั้นต่ำ สินค้าที่ร่วม ช่วงเวลา และการใช้สิทธิ์ซ้อน เป็นฐานให้แคมเปญอื่นใช้กติกาเดียวกัน



2

Referral — ตามมาเป็นลำดับถัดไป

ใช้ลิงก์/โค้ดแนะนำเพื่อน เชื่อมบัญชีและออเดอร์เดิม ให้รางวัลหลังยืนยันการซื้อจริง ต้องตรวจ identity และ anti-fraud ก่อนเปิดจริง



3

Loyalty — พัฒนาเมื่อฐานข้อมูลพร้อม

ตรวจความพร้อมของ server-side points ledger, idempotency, refund reversal และประวัติการปรับแต้มก่อน จากนั้นจึงเพิ่มระดับสมาชิกและการแลกรางวัล



4

Engagement & Play — ตามหลัง

ใช้ระบบสุ่มรางวัล โหวต และกิจกรรมเดิมก่อน เพิ่มภารกิจใหม่เมื่อกติกาแต้ม การป้องกันการโกง และการวัดต้นทุนพร้อมแล้ว



เงื่อนไขก่อนเลื่อนแต่ละระยะ
- ไม่เลื่อนเพียงเพราะ UI เสร็จ ต้องผ่าน business rules, server-side validation, tests และการตรวจสอบสิทธิ์
- Promotions ต้องพิสูจน์ได้ว่าส่วนลดไม่ซ้อนผิดกติกาและคำนวณยอดสุทธิถูกต้อง
- Referral ต้องป้องกัน self-referral และไม่ให้รางวัลซ้ำ
- Loyalty ต้องมี ledger ฝั่งเซิร์ฟเวอร์ที่ตรวจสอบย้อนหลังได้ ไม่เชื่อแต้มที่ client ส่งมาเอง
- Engagement ต้องมีข้อจำกัดความถี่ เพดานต้นทุน และระบบตรวจสอบกิจกรรมซ้ำ

## 6. ยืนยันขอบเขต — สถานะล่าสุด (อัปเดต 2026-10-25 หลังคำสั่ง "เริ่มพัฒนา G&R ตามกฏ")
- ✅ คำสั่ง start ได้รับแล้ว (2026-10-25) → เริ่มตามลำดับ Rollout ข้อ ⑧ = **Promotions ก่อน** (ข้ามขั้นไม่ได้)
- ✅ **STAGE 1 · Promotions = IMPLEMENTED + GATES GREEN** — หลักฐานครบ = `e2e/g153-gates-evidence.txt`
  - SQL: `supabase/migrations/153_promotion_campaign_controls.sql`
    (คอลัมน์แคมเปญ 5 ตัว + `promotion_products` + `promotion_policy` (kill switch + งบ 15%)
     + `promotion_apply_rules` จุดตัดสินส่วนลดเดียว + re-emit `create_order_with_items` จาก 148)
  - Contract: `e2e/contracts_153_promotion_campaign_controls.sql` (G1–G8 PASS · ROLLBACK) + CI step ใน contract-tests.yml
  - Client: `promotionClient` (mirror ครบ + เหตุผลปฏิเสธใหม่ 4 แบบ) · `cartStore` (ฐาน scope) · `CouponBox` (ส่ง lines)
  - Admin: `AdminPromotions` (ฟอร์มแคมเปญ + scope picker + badges + auto-scroll §12.3) ·
           `AdminMarketing` แท็บ Rules = แผงงบ/kill switch (ยืนบน Marketing Center ตาม §3 GAP)
  - เทสต์: `promotionCampaignControls.test.ts` 22 ข้อ + realign couponBox (เปิดเผยใน evidence)
- ✅ **PRODUCTION APPLY 153 = เสร็จ + RECORD แล้ว (Owner อนุมัติ 2026-10-25)** — staged แบบ r8/r12 ผ่านครบทุก stage:
  precheck 9/9 (top=152 · backup ใหม่ 8 · 153 ยังไม่มี) → apply+idempotent-rerun 201 → verify 11/11 →
  contract153 บนโปรดักชั่น PASS (status 201 ไม่มี error · ROLLBACK = zero persisted data) → contractRegr 148 PASS →
  record: history top = **153** — evidence = `e2e/r13Apply153-{precheck,apply153,verify153,contract153,contractRegr,record}.json`
- ✅ **PRODUCTION APPLY 154 = เสร็จ + RECORD แล้ว (Owner คำสั่ง "apply 154" 2026-10-25)** — staged
  `e2e/r14Apply154.cjs` ผ่านครบทุก stage: **precheck 12/12** (top=153 · backup 8 · ของใหม่ยังไม่มี
  ทุกตัว · fixture phones clash=0) → **apply+idempotent-rerun 201** → **verify 13/13** (คอลัมน์ 2 ·
  2 ตาราง RLS=true/policies 0 · policy seed 9 keys · fns 13 · trigger ติด · normalizers ตรง ·
  anon ถูกกัน · backfill ครบ · promo/orders ไม่แตะ) → **contract154 บนโปรดักชั่น PASS**
  (201 ไม่มี ERROR = G1–G9 · ROLLBACK zero data) → **contractRegr 153+148 PASS** →
  **record: history top = 154** — evidence = `e2e/r14Apply154-{precheck,apply154,verify154,contract154,contractRegr,record}.json`
- ✅ **STAGE 2 (Referral) = IMPLEMENTED + contract 154 PASS** (2026-10-25 — Owner: "อนุมัติตามนายแนะนำ"
  + ยืนยันรายการทดสอบ OTP ผ่านแล้ว → ลงมือ inspect-first ครบแล้ว ไม่ต้องถามซ้ำ)
  - **inspect จริงก่อนเขียน (ไม่เดา):** auth = OTP `quick_login`/`guest_checkout` (mirror
    `normalizeOtpPhone` ตัวเลขล้วน 14 หลัก) → `customers` (id=uid · user_id · phone) + guest =
    phone-keyed account (`cust-<digits>` merge) → **identity = auth uid เป็นหลัก + เบอร์ OTP เป็นหลักฐาน** ✓
  - **SQL: `supabase/migrations/154_referral_program.sql`**
    · `customers.referral_code` (UNIQUE + backfill) + `referred_by` · ตาราง `referral_attributions`
    (PK=order_id · status held/qualified/blocked/reversed/void) + ledger `referral_rewards`
    (UNIQUE order+role · สถานะ issued/reversed) — RLS deny-all อ่านผ่าน definer ·
    `referral_policy` ใน business_settings (**฿30/฿30 · qualify=delivered · อายุคูปอง 30 วัน ·
    เพดาน 20/เดือน · หน้าต่าง claim 72 ชม. · share_base_url — แอดมินปรับได้ทั้งหมด**)
    · RPC: `referral_my_code` (สร้าง/ดึงโค้ด BMB-XXXXXXXX) · `referral_preview` (anon) ·
    **`referral_claim`** (จุดเดียวฝั่งลูกค้า — validate ทุกกฎ + idempotent + เจ้าของออเดอร์เท่านั้น) ·
    `referral_issue_rewards`/`referral_reverse_rewards` (idempotent) · `referral_my_status` ·
    `referral_admin_stats`/`referral_resolve_attribution` (gate is_admin) ·
    **trigger `trg_referral_order_status`** (ครอบทุกเส้นทางเปลี่ยนสถานะ: ผ่าน qualify → ออก
    คูปอง 2 ใบ = `promotions` row จริง + ledger + notice · ยกเลิก/คืนเงิน → ปรับกลับตาม ledger
    ไม่หักซ้ำ · ยังไม่ออก = void) · **ไม่แตะ signature `create_order_with_items`/_i/pickup** (คง overload pin 124/127)
  - **3 ระดับกันโกง (§5.3):** Hard block = บัญชีเดียวกัน/เบอร์เดียวกัน/เพื่อนไม่ใหม่/เคยถูกแนะนำแล้ว/
    เกินหน้าต่างเวลา (บันทึก audit ไม่ทำออเดอร์ล้มเหลว) · Review = เกินเพดาน/เดือน → risk='review'
    = พักรางวัลจนแอดมิน approve/reject · Soft signal = IP/อุปกรณ์ **ไม่เก็บ ไม่เดา ไม่ใช้เป็นเกณฑ์เดียว**
  - **Contract: `e2e/contracts_154_referral_program.sql` G1–G9 PASS (ROLLBACK)** + CI step แล้ว
    (fixture เบอร์ใช้ช่วง 09915400xx เฉพาะ — ห้ามชนข้อมูลตกค้าง บทเรียน 153 G4)
  - **Client:** `referralClient.ts` (mirror+ข้อความไทยครบทุก reason) · `ReferralBox` ที่ Checkout
    (apply/revalidate gate แบบ coupon) · `?ref=` deep-link ใน Layout · `cartStore.referralCode` +
    cartPersistence (optional field — cart เก่าไม่พัง) · Checkout claim ทันทีหลัง order สร้าง ·
    **SharePage เลิกของปลอม** (โค้ดจริงจากเซิร์ฟเวอร์ + ลิงก์ base แอดมิน + ledger รางวัลจริง + ไม่แกล้งให้แต้ม)
  - **Admin:** แผง `ReferralSettingsPanel` ใน AI Marketing Center แท็บ Rules (policy + สถิติจริง +
    ปุ่มอนุมัติ/ปฏิเสธ รายการพักรางวัล) — ยืนบนศูนย์กลางเดิมตาม §3 ไม่สร้างใหม่
  - **เทสต์:** `referralProgram.test.ts` (mirror/gate/claim payload/persistence) +
    evidence รอบปิดเซสชัน = `e2e/g154-gates-evidence.txt`
- ⏳ **STAGE 3 (Loyalty Tiers) → STAGE 4 (Engagement & Play)** = ยังไม่เริ่ม (ตามลำดับ Rollout ข้อ ⑧ — ข้ามไม่ได้)
- ✅ **migration 154 = APPLIED + RECORDED บน production แล้ว (2026-10-25)** — ดูหลักฐาน = หัวข้อ
  PRODUCTION APPLY 154 ด้านบน + `e2e/r14Apply154-*.json` · migration ถัดไป (155+) = **รอคำสั่ง apply แยก**
- ⛔ เงื่อนไขเลื่อนขั้น (§5.8) ยังคงอยู่: business rules + server validation + tests + สิทธิ์ ต้องผ่านก่อนทุกครั้ง
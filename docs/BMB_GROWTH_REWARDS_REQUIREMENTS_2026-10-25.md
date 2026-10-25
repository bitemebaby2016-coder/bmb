# BMB — Growth & Rewards: Product Requirements (บันทึกกติกาที่อนุมัติ)
# วันที่: 2026-10-25 · สถานะ: **CONCEPT + RULES APPROVED · IMPLEMENTATION NOT STARTED**

> เอกสารนี้ = การบันทึกคำสั่ง/กติกาธุรกิจเบื้องต้นที่ Owner อนุมัติแล้ว (คำสั่งต่อเนื่อง 2026-10-25 §4)
> **ยังไม่มีการเริ่ม implementation** — ห้ามสร้าง migrations/tables/services/routes/UI หรือแก้
> business logic เพื่อ Growth & Rewards จนกว่า Owner จะอนุมัติคำสั่งพัฒนาแยกต่างหาก
> (ดู inventory ระบบเดิม + แผนเชื่อมต่อ + รายการคำถาม = `docs/BMB_GROWTH_REWARDS_INVENTORY_2026-10-25.md`)

---

## 1. หลักการที่ยืนยันแล้ว (4.1)

1. ใช้ **AI Marketing Center ที่มีอยู่** เป็นศูนย์กลางบริหารการตลาด — ไม่สร้างซ้ำ
2. **Growth & Rewards = กรอบกลาง** ของ 4 กลุ่ม: Promotions · Referral & Affiliate · Loyalty & Points · Engagement & Play
3. แต้ม + คูปอง = รางวัลหลักสำหรับลูกค้าทั่วไป
4. โค้ดโปรโมชั่น = **ให้ส่วนลดเท่านั้น** ไม่ใช่ระบบจ่ายเงินสดให้ลูกค้า
5. **ไม่มี cash commission** ให้ลูกค้า/ผู้แนะนำในขอบเขตนี้
6. เป้าหมายหลัก = กำไรส่วนเพิ่ม + การเติบโตยั่งยืน (ไม่ใช่ยอดขายอย่างเดียว)
7. แต้มได้จากการซื้อ/แนะนำ/กิจกรรมที่เข้าเงื่อนไข — อัตรา เพดาน ข้อจำกัด แยกตามประเภท
8. อายุแต้มตั้งค่าได้โปร่งใส — ไม่ย้อนเปลี่ยนสิทธิ์ที่ลูกค้าได้รับแล้วโดยพลการ
9. ใช้ระบบเดิม (checkout, payment, customer, coupon, points, admin, AI) ให้มากที่สุด
10. ต้องตรวจ repository/schema จริงก่อนกำหนดวิธีเชื่อมต่อ — ห้ามสมมติว่าระบบไม่มี

## 2. กติกาอัตโนมัติที่ยืนยันแล้ว (4.2)

- **การซ้อนสิทธิ์:** เลือกข้อเสนอที่ดีที่สุดเป็นค่าเริ่มต้น · ซ้อนได้เฉพาะเมื่อแคมเปญกำหนดชัดเจน
- **AI อัตโนมัติ** ได้ภายในงบประมาณ/กติกาที่ Owner อนุมัติล่วงหน้า · เพิ่มงบ/เปลี่ยนภาระการเงิน/เปลี่ยนกติกาสำคัญ = ต้องขออนุมัติ
- ให้รางวัลเมื่อเหตุการณ์**ผ่านเงื่อนไขที่ตรวจสอบได้** (ออเดอร์ผ่านสถานะที่กำหนด, กิจกรรมสำเร็จจริง)
- ยกเลิก/คืนเงิน = ปรับแต้มและสิทธิ์**ตามต้นทาง** พร้อมป้องกันการหักซ้ำ
- ป้องกัน: บัญชีซ้ำ · อ้างอิงตัวเอง · ใช้คูปองซ้ำ · ปั่นกิจกรรม · รางวัลจากออเดอร์ที่ไม่ใช่การซื้อจริง
- **Audit trail ครบ** ทุกการได้รับ/ใช้/คืน/ปรับแต้ม
- AI ต้องมี: เพดานงบ · เพดานส่วนลด · เพดานรางวัล · เงื่อนไขหยุด · kill switch
- ห้าม AI แก้ประวัติย้อนหลัง/ลบ audit trail/เปลี่ยนสิทธิ์ที่ได้รับแล้ว โดยไม่มีขั้นตอนควบคุม

## 3. กิจกรรม 4 กลุ่มที่ออกแบบให้ครบก่อนพัฒนา (4.3)

**Promotions:** Welcome Offer · Bundle & Upsell · Smart Threshold · Off-Peak Campaign · Menu Discovery · Comeback Offer · Seasonal & Event Campaign · Targeted Offer

**Referral & Affiliate:** Share & Earn · Friend Welcome · Referral Milestones · Community Ambassador · Creator Affiliate (แต้ม/คูปองเป็นหลัก — ไม่สร้าง cash commission) · Group Order Partner (ต่อยอด checkout/order flow เดิม)

**Loyalty & Points:** Purchase Points · Redeem Rewards · Loyalty Tiers · Streaks & Missions · Birthday & Milestone Rewards · Personalized Rewards

**Engagement & Play:** Spin & Win (ใช้กิจกรรมสุ่มเดิมถ้ามี) · Vote the Next Menu · Menu Discovery Quest · Community Challenge · Seasonal Missions · Feedback & Co-Creation · Shareable Moments

### 3.1 อย่างน้อยต้องระบุต่อทุกกิจกรรม (checklist บังคับ)

- [ ] เป้าหมายและ stakeholder ที่ได้ประโยชน์
- [ ] เงื่อนไขเข้าร่วมและการได้รับสิทธิ์
- [ ] reward type และอัตรารางวัล
- [ ] เพดานความถี่ / งบ / จำนวนสิทธิ์
- [ ] การซ้อนสิทธิ์และลำดับความสำคัญ
- [ ] การยกเลิก คืนเงิน และการปรับแต้ม
- [ ] การป้องกัน fraud และข้อผิดพลาด
- [ ] ข้อมูลที่ AI ต้องใช้และขอบเขตการตัดสินใจ
- [ ] KPI, ต้นทุน, เกณฑ์หยุดแคมเปญ
- [ ] Admin controls และข้อความที่ลูกค้าต้องเห็น
- [ ] Acceptance Criteria และ negative tests

> **ยังไม่กำหนด** อัตราแต้ม / จำนวนเงินบาท / อัตราส่วนลดจริง จนกว่าจะมีข้อมูลต้นทุนและ
> unit economics ที่ตรวจสอบได้ (รายการคำถามเปิด = inventory doc ด้านบน)

## 4. ขอบเขตงานที่อนุญาตในรอบนี้ (4.4) — ทำได้เฉพาะนี้

1. บันทึกกติกาลงเอกสาร requirements (ไฟล์นี้) ✅
2. Inventory ระบบเดิมที่เกี่ยวข้อง (ตาราง/ services / Admin screens / AI workflows ที่นำกลับมาใช้ได้)
3. ระบุจุดซ้ำซ้อน · ความเสี่ยง · ช่องว่าง
4. เสนอแผนเชื่อมระบบเดิม **โดยไม่เปลี่ยนโค้ด**
5. รายการคำถามที่ต้องตัดสินใจเพิ่ม

**ห้าม:** migrations · tables · services · routes · UI · เปลี่ยน business logic — ทั้งหมดรอ
Owner อนุมัติคำสั่งพัฒนาแยกต่างหาก
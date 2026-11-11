# R92 Step 0 — พิสูจน์ก่อนแก้ (READ-ONLY probe production)

วันเวลา probe: 2026-11-11 ~23:20 UTC · เครื่องมือ: `e2e/_r92_step0.cjs` (Supabase Management API SQL — SELECT เท่านั้น · log ดิบ `e2e/_r92_step0_raw.log`)

## ① ต้นตอสะกดเพี้ยน ("เมี่ยงจาได้", "ลากลุลต้อง", "ซองวันนี้") → **โมเดล ไม่ใช่แคตตาล็อก**

- แคตตาล็อกจริง 34 รายการ — สะกดถูกหมด: `เมี่ยงอกไก่`, `เมี่ยงแซลม่อน`, `เมี่ยงหมู+กุ้ง`, `ข้าวลาบอกไก่+ไข่ต้ม`, `ข้าวหมูผัดกิมจิ` ฯลฯ
- คำเพี้ยนจากภาพ owner ไม่มีในแคตตาล็อกเลย: `ลากลุล` = NO_MATCH, `ซองวัน` = NO_MATCH, `ยำวัน` = NO_MATCH
- ทุก event ล่าสุดใช้โมเดล `deepseek/deepseek-v4-flash` → ตัวโมเดลเขียนไทยเพี้ยนเอง (AI คัดลอกชื่อจากแคตตาล็อกไม่เพี้ยน — เคส 14:14/14:45 สะกดถูกต้องทุกตัว)
- **ตัดสิน:** เป็น task แยก (aiPolicy — สลับโมเดล/เพิ่ม guard) ตามแผน "เปิดค้าง" — **ไม่แตะในรอบนี้**

## ② reply ไม่มี `?cart=` → **ยืนยันตรง branch `unmatched>0` + เคส review ที่ matched=0**

หลักฐานจาก `social_events` ล่าสุด 15 แถว (ทุกแถว reply_status=sent):

| เวลา (UTC) | ช่องทาง | ข้อความ | ผล | ?cart= |
|---|---|---|---|---|
| 15:27 | Messenger | "เอา**เมี่ยงอบไก่**กับเมี่ยงแซลมอน" | unmatched>0 (พิมพ์ "อบ" แทน "อก") → AI ตอบให้ไป /shop เปล่า | ❌ ไม่มี |
| 16:39 | Messenger | "ทบทวน order" | unmatched>0 ("เมนูนี้ระบบยังจับคู่ไม่ได้") → /shop เปล่า | ❌ ไม่มี |
| 16:40 | Comment | "ทบทวนออเดอร์ผม" | สรุปรายการเก่าแบบจำได้ → ไม่แนบลิงก์เลย | ❌ ไม่มี |
| 14:14 / 14:45×2 / 16:11 | Messenger/Comment | สั่งเมนูตรงชื่อ | matched ครบ → buildCartSummaryFooter | ✅ มี |
| 09:54 | Messenger | สั่ง 2 เมนู (footer เดิม ระบบเขียน) | matched ครบ | ✅ มี |

- ตรงกับโค้ด `social-ai-worker/index.ts:479-486` — branch `m.unmatched.length > 0` คืน `footer: ''` = ลูกค้าได้ลิงก์ตายไม่มีตะกร้า → แก้ด้วย `cartFooterForMatch` (R92 Step 2) พอดีจุด
- เคส "ทบทวน" (review) ที่ matched=0 = wants_order=false → footer='' เดิม (ไม่ใช่งาน R92 — การทบทวนไม่ใช่การสั่งซื้อ)

## ③ ข้อสังเกตเสริมจาก reply จริง

- reply ของ AI มักพ่น `https://biteme-baby.com/shop` เปล่า ๆ กลางข้อความ (ลิงก์ไม่มีตะกร้า) — ฝั่ง footer ระบบเขียนคือตัวแบบ ?cart= จริง → การทำ Step 2/3 ให้ footer ติดทุก reply + มีบริบท ?s= ช่วยตรงจุด
- 15:27 แสดงว่า AI ถามชื่อเมนูที่เหลือแล้วเอง แต่ระบบตัด footer → หลังแก้ จะได้ทั้ง "ถามเมนูที่เหลือ" + "ลิงก์ตะกร้าของรายการที่จับคู่ได้"

## การเดินงานต่อ (ตามแผน)

- Step 1: ลบ `intent://` ออกจาก `InAppBrowserBanner.tsx` (ปุ่มหลักเดียว = คัดลอกลิงก์ + guide)
- Step 2: `cartFooterForMatch` ใน `_shared/socialOrderIntake.ts` + worker ทุก branch → deploy + log
- Step 3: `?s=` บริบทในลิงก์ (server เขียน · web อ่าน)
- Step 4: ห้าม register SW ใน in-app browser + unregister/clear caches
- Step 5: เทสต์ + gates 4/4 + docs

# BMB — REMAINING TESTS ON LIVE (รายการที่ "ยังปิดไม่ได้" ณ 2026-11-10)

> **อัปเดต 2026-11-10 16:37 (Owner verified):** D2 ✅, D5 ✅, R92-S ✅ — **เหลือ §T-A เท่านั้น** ต้อง retest ต่อ
> · **HEAD = `2263b67`** (docs update) · **Latest Bundle = `assets/index-Bh_24aFF.js`** (มี Floating Ad Multiple · Sources Filter · Badge · AiStudioTab→ContentTab merge)
> · **Migration 201 APPLIED PROD** · **Edge Functions `social-ai-worker` DEPLOYED exit=0** · gates 4/4 (tsc/lint/vitest/build = 0)
> · **ของปิดแล้ว/มีหลักฐานผ่าน = ไม่อยู่ในนี้** (รายชื่อปิดรอบนี้ = `AI_WORK_STATE.md` บล็อก "✅ ปิดแล้วในเซสชั่นนี้")

## ❌ BLOCKED — ปิดไม่ได้จนกว่า Owner ทำเอง (1 ข้อ)

| ข้อ | สถานะ | ต้องทำอะไรถึงปิดได้ |
|---|---|---|
| **OMNI-5** Meta Test User ทักเพจจริง | **BLOCKED** = รอคนใหม่ลงทะเบียนผู้พัฒนา (คำสั่ง Owner 7 พ.ย.) | ลงทะเบียนเสร็จ → รัน pack §R74-OMNI ขั้น 8 |

---

## ✅ ปิดแล้วรอบนี้ (Owner verified 2026-11-10 16:37)

| ข้อ | สิ่งที่ทดสอบ/ผล | Evidence |
|---|---|---|
| **IMG-GEN** | เครดิต OpenRouter เติมแล้ว → เจนรูปได้ปกติ (qwen/qwen-image-2.1-pro + seedream-5-0-flash) | Owner confirm |
| **D4** | ปุ่ม `intent://` ใหม่ — จาก DM/คอมเมนต์เปิดแอปแชทตรง + guide ใหม่ | Owner confirm |
| **R91** | hard reload `/shop` — การ์ดรีวิวสเกลเท่ากันทุกใบ + mobile-first | Owner confirm |
| **R92-G** | guide ในแอป FB/IG เห็น "เปิดผ่าน Chrome หรือ Safari เพื่อการใช้งานที่สมบูรณ์ที่สุด" | Owner confirm |
| **D2** | prompt SAME_DAY — "ขอคิดก่อนนะ" = draft · ยืนยัน = เลขจริง (RT-5.1/5.4) | Owner confirm |
| **D5** | รอบ hardcode หายจริงในการสนทนา — ไม่มี "รอบที่ 1/2" แบบตายตัว | Owner confirm |
| **R92-S** | อัปโหลดรูปใหญ่ (>300px/>100KB) → ลดเหลือ ≤300px / ≤100KB อัตโนมัติ (marketing, products, AI Album) | Owner confirm |

---

## ⏳ รอ retest บน live — โค้ด deploy แล้วหมด + Migration 201 APPLIED + EF DEPLOYED (hard reload ก่อนรันทุกข้อ)

| ข้อ | รีเทสต์อะไร | หลักฐาน deploy | วิธีทดสอบละเอียด |
|---|---|---|---|
| **§T-A** | ลิงก์ `?cart=` จาก FB → retry ชั้น 2 (2.5s) — Android กระโดด Chrome มีของครบ | `c9f77aa` | **ดูขั้นตอนด้านล่าง §T-A** |

---

## 🕓 ยังไม่รันตามเดิม (ของเดิมค้างจาก 2026-11-08 — ห้ามตัด)

- **RT-4** ชุด ก · **RT-HOURS** (หลัง 20:30) · **RT-6.2** (บทแอดมิน 12 คีย์) · **RT-6.1** (ยกเว้น E1 = Owner waived "ไม่ต้องทำ") · **RT-6.4B2** (~11:00 แถบสถานะ)
- **CAP-14** SMS จริง + **CAP แถว 7·8·13·16·17·19** (รอ Owner ยืนยันเลขข้อ §2 MASTER_STATUS แล้วรัน)
- **RT-8 = ยังห้ามปิด** (pack §RG·16 · นับเมื่อ RT-1..7 จบ)

---

## ✅ ปิดแล้วรอบก่อน (2026-11-09/10) — ไม่ต้องรัน

R89b/c ยุบ+เรียงรีวิว `/shop` (Owner เห็น Verified Purchase) · R90 งาน 1 ลิงก์รีวิว + งาน 2 promo หมดอายุ ("หายแล้ว"/"ลิงก์ถูกต้อง") · two-try Attempt 1 = D2/D5/§T-A code+deploy (เหลือ retest ด้านบน) · D4 วิธีใหม่ code+deploy · R92 งาน 2 วลี guide (bundle proof) · งาน 3 บังคับ 300×300/100KB (gates+test+deploy) · งาน 1 image-gen = สืบจบ → เปลี่ยนเป็น BLOCKED เติมเครดิต (ด้านบน) · Floating Ad + Promotion Banner Settings (Kill Switch + max 3 + real links + image upload/browse + CNT-01 approve/reject) · Migration 201 APPLIED PROD · Edge Functions `social-ai-worker` DEPLOYED exit=0 · Test expectations fixed (3 pre-existing failures) · Food Theater Carousel (Admin-Curated Auto-Play) code complete · Theater Carousel Simplification (2026-11-10): 2 modes (Admin Curated / Daily Random), removed editorial/daily_copy/autoplay settings, filters pre-order expired

---

## 📋 สรุปสถานะรวม ณ 2026-11-10 16:37 (หลัง Owner verified)

| หมวด | สถานะ | รายละเอียด |
|---|---|---|
| **BLOCKED (รอ Owner)** | ⏸️ 1 ข้อ | OMNI-5 (ลงทะเบียน Meta Test User) |
| **รอ Live Retest (โค้ด Deploy แล้ว)** | 🔄 1 ข้อ | **§T-A** (Cart retry 2.5s) |
| **✅ ปิดแล้วรอบนี้ (Owner verified)** | ✅ 7 ข้อ | IMG-GEN, D4, R91, R92-G, D2, D5, R92-S |
| **✅ ปิดแล้วรอบนี้ (Deploy + Gates ผ่าน)** | ✅ 5 กลุ่ม | Floating Ad Multiple, Sources Filter, Badge, AiStudioTab Merge, Viewport Fix |
| **ยังไม่รัน/ค้างจากเดิม** | ⏳ หลายข้อ | RT-4, RT-HOURS, RT-6.x, CAP-x, RT-8 |

---

## 🎯 ขั้นตอนถัดไป (Owner Action)

1. **Hard reload (Ctrl+Shift+R) ที่ `https://biteme-baby.com`** (ถ้ายังไม่ได้ทำครั้งนี้)
2. **Run Live Retest ต่อ:** **§T-A เท่านั้น**
3. **จดผล:** `§T-A · [เวลา] · [อุปกรณ์] · PASS/FAIL · สนับสนุนภาพหน้าจอ Chrome`
4. **FAIL = ทักแชท AI ทันที** → จด `AI_WORK_STATE.md` + แจ้งแก้แบบ two-try

---

## 📖 วิธีทดสอบที่เหลือ (Step-by-Step)

### §T-A — Cart Retry 2.5s (Layout.tsx)
**เป้าหมาย:** ลิงก์ `?cart=` จาก FB In-App → กระโดด Chrome → retry ชั้น 2 (2.5s) → มีของในตะกร้าครบ

| ขั้นตอน | รายละเอียด |
|---|---|
| 1 | เตรียม URL: `https://biteme-baby.com/?cart=<cart_id>` (cart_id จาก order จริง หรือสร้าง test cart) |
| 2 | เปิดใน **FB In-App Browser** (ส่ง DM ให้ตัวเองใน FB Messenger แล้วกดลิงก์) |
| 3 | ควรเห็นหน้า "กำลังเปิดใน Chrome..." + ปุ่ม `intent://` → กด → กระโดด Chrome |
| 4 | ใน Chrome: รอ ~2.5 วินาที (retry ชั้น 2) → ต้องโหลดหน้าเช็คเอาท์ **มีของในตะกร้าครบ** |
| 5 | จดผล: `§T-A · [เวลา] · [อุปกรณ์] · PASS/FAIL · สนับสนุนภาพหน้าจอ Chrome` |

---

## 📋 บันทึกผล (เทมเพลตต่อข้อ)
`ข้อ ID · เวลา · อุปกรณ์ · PASS/FAIL/BLOCKED · Evidence (width×height/size KB / copy response / screenshot) · toast ถ้าพลาด`

> FAIL ข้อใด = ทักแชท AI ทันที → จด `AI_WORK_STATE.md` + แจ้งแก้แบบ two-try · **ห้ามแก้เอกสารให้ดูผ่าน** · SKIPPED ≠ PASS · ห้ามตัดข้อทิ้ง

---

## กติกา (คงเดิม)

1. ใช้ **`https://biteme-baby.com`** เท่านั้น · **hard reload (Ctrl+Shift+R) 1 ครั้ง** ก่อนเริ่ม · เปิด F12 Console ทิ้งไว้
2. บันทึกทุกข้อ: `ข้อ ID · เวลา · อุปกรณ์ · PASS/FAIL · evidence (ภาพ/copy ข้อความ toast สีแดง verbatim)`
3. **FAIL = จด defect ใหม่ลง `AI_WORK_STATE.md`** (แจ้งแชทถัดไป · two-try) · **SKIPPED ≠ PASS** · **ห้ามตัดข้อทิ้ง**
4. ห้ามใช้ข้อมูลลูกค้าจริงทดสอบ · ออเดอร์ทดสอบ = **cancel เมื่อจบ**
5. เสร็จแต่ละกลุ่ม → ทักแชทบอก AI ให้สรุปเข้า work state + test pack
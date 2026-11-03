# BMB — One-Pager: ระบบ "รอบ" (round model) ✅ ได้คำสั่ง Owner แล้ว (2026-10-24)

> **P1-A · ROUND-14** — เอกสารนี้ตอบคำถาม "รอบรายวันคืออะไร งงไปหมด" โดยสรุป
> ของที่มีอยู่จริงในโค้ด/DB (ไม่ได้เดา) · **Owner ตอบ Q1–Q4 ครบแล้ว** (กล่อง "คำสั่ง" ด้านล่าง)
> · การ implement Q1/Q3 = **งานแชทหน้า** (ทำหลัง audit ตามคำสั่งใหม่ · domains: `biteme-baby.com`)

## 1. คำศัพท์ "รอบ" ที่ใช้อยู่จริงตอนนี้

| คำ | ความหมายจริง (ที่มา) | อยู่ตรงไหน |
|---|---|---|
| **แพทเทิร์นรอบ 3 รอบ/วัน** | template `order_pattern` (morning/midday/evening) = ต้นแบบสร้างรอบของทุกวัน | `business_settings.order_pattern` · หน้า AdminRounds ช่อง "แพทเทิร์น" |
| **รอบรายวัน** | แถว `delivery_rounds` รายวัน (id `round-YYYYMMDD-key`) สร้างอัตโนมัติจากแพทเทิร์น · **ไม่ใช่คนละระบบ** — เป็น "instance ของแพทเทิร์นในวันนั้น" | `delivery_rounds` · หน้า AdminRounds หัวข้อ "📅 รอบรายวัน" (จัดกลุ่มตามวัน) |
| **รอบ/ช่องจัดส่ง (slot)** | แถวรอบเดียวกัน = ความจุก้อนเดียว ทั้งเซมเดย์และพรีออเดอร์นับร่วมกัน (shared bucket) | `create_order_with_items` (row lock) |
| **สถานะรอบ** | `active` = เปิดรับ · `closed` = ปิดรับ · `archived` (ใหม่, 149) = เก็บไว้ ไม่แสดงในรายการหลัก | คอลัมน์ `status` + `archived` |

## 2. กติกาหลังคำสั่ง 2026-10-24 (ทำแล้ว — migration 148/149)

1. **เซมเดย์ = เปิดร้านถึงปิดร้าน ไม่มีคัทออฟใด ๆ** — ไม่มี `same_day_cutoff`, ไม่มี
   `ERR_CUTOFF_PASSED` ฝั่งเซมเดย์, auto-close ไม่ปิดรอบวันนี้ด้วยเวลาอีกต่อไป (ปิดเฉพาะวันที่ผ่านไปแล้ว)
2. **คัทออฟมีเฉพาะพรีออเดอร์** — `pre_order_cutoff` ตั้งตรงต่อรอบ หรือว่าง = กฎ
   `cutoff_hours` ชม. ก่อนเวลาส่ง (`delivery_start`)
3. **รอบที่มีออเดอร์อ้างอิง = ลบถาวรไม่ได้** (FK จริง พิสูจน์แล้ว) → ใช้ **เก็บ (archive)**
   แทน · รอบเก่าที่ไม่มีใครอ้างอิง = ลบอัตโนมัติได้

## 3. ✅ คำสั่ง Owner ต่อ Q1–Q4 (ตอบแล้ว 2026-10-24 — ใช้เป็น requirements ของงานแชทหน้า)

| # | คำถาม | **คำสั่ง Owner** | ผลต่อโค้ด (ยังไม่ได้ทำ — งานแชทหน้า) |
|---|---|---|---|
| **Q1** | หน้าต่างส่ง (`delivery_end`) ยังปิดป้ายฝั่ง UI | **(ข) เอาออก = สั่งได้ทุกเวลาในวันนั้น** | `roundBookability`: เอา `window_passed` ออกจากฝั่ง SAME_DAY (คงไว้เฉพาะ PRE_ORDER) · ป้าย "หมดเวลาจัดส่งแล้ว" หายไปฝั่งเซมเดย์ · auto-select ใน CheckoutPage ต้องเลือกรอบได้ทุกเวลาของวันนั้น · **คงเหลือแค่ ความจุ (`full`) + สถานะรอบ (`closed`)** |
| **Q2** | รอบที่ถูกปิดไว้จะให้ระบบเปิดเองไหม | **เปิด/ปิดโดยแอดมินได้** (ระบบไม่เปิดกลับเอง) | **ไม่แก้โค้ด** — พฤติกรรมปัจจุบันถูกต้องแล้ว · แถว `closed` ที่ค้าง (วันนี้ 3 + 26 อีเวนนิง) = เจ้าของ/แอดมินกดเปิดเองจากหน้า AdminRounds |
| **Q3** | รวม "แพทเทิร์น + รอบรายวัน" เป็นแท็บเดียว | **(ก) อนุมัติให้รวมเป็นแท็บเดียว** | งาน UI ล้วนใน AdminRounds (แท็บเดียว) — **ทำหลัง audit + approve** ตามคำสั่งใหม่ |
| **Q4** | มีงาน/เมนูซ้ำซ้อนกับ setting แอดมิน | **"มีการทำงานซ้ำซ้อนและเมนูซ้ำซ้อนกับใน setting แอดมิน ตรวจและแก้ตามคำสั่งใหม่"** | → **คำสั่งใหม่: BMB ADMIN LEGACY DUPLICATION AUDIT** (READ-ONLY) · `docs/BMB_ADMIN_LEGACY_DUPLICATION_AUDIT_2026-10-24.md` · **ห้าม implement จนกว่า Owner approve รายงาน** |

## 4. สิ่งที่ "ยังไม่" เปลี่ยน (รอขั้นตอนถัดไปตามลำดับ)

- โครงหน้า AdminRounds (2 บล็อก) — **ยังไม่รวม** (Q3 อนุมัติแล้ว แต่ทำ **หลัง** audit + approve)
- Q1 (เอาหน้าต่างส่งออกจากฝั่งเซมเดย์) — **ยังไม่ได้ implement** (คิวงานแชทหน้า)
- ไม่มีการลบ/ย้ายคอลัมน์ใด ๆ เพิ่มนอกจาก `same_day_cutoff` (คำสั่ง 148 — ทำแล้ว)

## 5. หลักฐานที่รองรับเอกสารนี้

- Migration `148_same_day_no_cutoff.sql` + `149_round_archive_cleanup.sql` (production: ledger 149,148)
- Contracts `contracts_148_same_day_no_cutoff.sql` (G1–G6) · `contracts_149_round_archive.sql` (G1–G6) — PASS ทั้ง ephemeral PG และ production
- Probe จริง: `e2e/p14ProbeRounds.cjs` → `e2e/p14ProbeRounds.json` (FK NO ACTION + 4 รอบเก่ามีออเดอร์)
- เทสต์ฝั่ง client: `roundsSameDayNoCutoff.test.ts` (13) · `roundArchiveAdmin.test.ts` (5) · `deliveryRoundStatus.test.ts`

---
**สถานะ: ✅ DECIDED (Owner ตอบ Q1–Q4 ครบ 2026-10-24)** — งานถัดไป =
**AUDIT (READ-ONLY) → ส่งรายงาน → Owner approve → implement Q1 + Q3 + แผนรวมหน้า**
· ลำดับ/เฟสทั้งหมดอยู่ที่ `docs/BMB_HANDOFF_NEXT_SESSION_2026-10-24.md` §19
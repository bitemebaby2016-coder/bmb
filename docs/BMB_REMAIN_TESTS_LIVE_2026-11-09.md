# BMB — REMAINING TESTS ON LIVE (รายการที่ "ยังปิดไม่ได้" ณ 2026-11-10)

> **สร้างตามคำสั่ง Owner 2026-11-09 (ปิดเซสชั่น R92):** "อัพเดทเอกสาร BMB_REMAIN_TESTS_LIVE_2026-11-09 ตามสถานะจริง (คงเหลือไว้เฉพาะที่ยังปิดไม่ได้เท่านั้น) แล้วไปทดสอบต่อแชทหน้า"
> · **เอกสารนี้แทนที่ ฉบับ 2026-11-08 แล้ว** = รายการเดียวที่ต้องรันต่อ · **ของปิดแล้ว/มีหลักฐานผ่าน = ไม่อยู่ในนี้** (รายชื่อปิดรอบนี้ = `AI_WORK_STATE.md` บล็อก "✅ ปิดแล้วในเซสชั่นนี้")
> · เกณฑ์ผ่านรายข้อ/วิธีทำละเอียด = `docs/BMB_PRODUCTION_TEST_PACK.md` (§RG · §T · §R74) · สถานะโค้ด = `docs/BMB_MASTER_STATUS.md`
> · **HEAD = `e65f6bf`** (R92) · **Migration 201 APPLIED PROD** · **Edge Functions `social-ai-worker` DEPLOYED exit=0** · gates 4/4 (tsc/lint/vitest/build = 0) · live bundle = `assets/index-UE2i45rJ.js` (มี R90_SEE_ALL + R92_GUIDE_NEW · ไม่มีวลี guide เดิม)

### กติกา (คงเดิมทุกข้อ)
1. ใช้ **`https://biteme-baby.com`** เท่านั้น · **hard reload (Ctrl+Shift+R) 1 ครั้ง** ก่อนเริ่ม · เปิด F12 Console ทิ้งไว้
2. บันทึกทุกข้อ: `ข้อ ID · เวลา · อุปกรณ์ · PASS/FAIL · evidence (ภาพ/copy ข้อความ toast สีแดง verbatim)`
3. **FAIL = จด defect ใหม่ลง `AI_WORK_STATE.md`** (แจ้งแชทถัดไป · two-try) · **SKIPPED ≠ PASS** · **ห้ามตัดข้อทิ้ง**
4. ห้ามใช้ข้อมูลลูกค้าจริงทดสอบ · ออเดอร์ทดสอบ = **cancel เมื่อจบ**
5. เสร็จแต่ละกลุ่ม → ทักแชทบอก AI ให้สรุปเข้า work state + test pack

---

## ❌ BLOCKED — ปิดไม่ได้จนกว่า Owner ทำเอง (2 ข้อ)

| ข้อ | สถานะ | ต้องทำอะไรถึงปิดได้ |
|---|---|---|
| **IMG-GEN** เจนรูปไม่ได้ | **BLOCKED = เครดิต OpenRouter หมด** · error จริงจากหน้า `/admin/marketing` 18:36 น. (9 พ.ย.): `ERR_IMAGE_GEN_FAILED qwen/qwen-image-2.1-pro:images402 Insufficient credits · bytedance-seed/seedream-5-0-flash:images402 Insufficient credits` (+ `chat404` ที่ตามมา = fallback ไม่ใช่ต้นตอ) | **เติมเครดิต** ที่ https://openrouter.ai/settings/credits → ลองเจนใหม่ → ผ่าน = ปิด · **โค้ด/secrets ถูกแล้ว** (พิสูจน์: bucket `bmb-images` อยู่ชื่อเดิม · EF boot ปกติ · `IMAGE_GEN_MODELS` รีเซ็ตแล้ว = error ไล่ครบทั้ง 2 โมเดล + modality image) · เติมแล้วยัง FAIL = ทักแชทพร้อม **ข้อความ error สีแดงเต็ม verbatim** (อย่าเดา) |
| **OMNI-5** Meta Test User ทักเพจจริง | **BLOCKED** = รอคนใหม่ลงทะเบียนผู้พัฒนา (คำสั่ง Owner 7 พ.ย.) | ลงทะเบียนเสร็จ → รัน pack §R74-OMNI ขั้น 8 |

---

## ⏳ รอ retest บน live — โค้ด deploy แล้วหมด + Migration 201 APPLIED + EF DEPLOYED (hard reload ก่อนรันทุกข้อ)

| ข้อ | รีเทสต์อะไร | หลักฐาน deploy |
|---|---|---|
| **D2** | prompt SAME_DAY — สั่ง "ขอคิดก่อนนะ" = draft ไม่มีรอบผิด · ยืนยัน = เลขจริง (RT-5.1/5.4) | EF `c9f77aa` deployed |
| **D5** | รอบ hardcode หายจริงในการสนทนา — ⚠️ marker ใน bundle **ฟันธงไม่ได้** (`D5_NEW_COPY=false` · copy อาจอยู่ฝั่ง EF) → **ดูจากคำตอบแชทจริงเท่านั้น** | `c9f77aa`/`d9e975d` |
| **§T-A** | ลิงก์ `?cart=` จาก FB → retry ชั้น 2 (2.5s) — Android กระโดด Chrome มีของครบ | `c9f77aa` |
| **D4** | ปุ่ม `intent://` ใหม่ — จาก DM/คอมเมนต์เปิดแอปแชทตรง + guide ใหม่ | `d9e975d` |
| **R91** | hard reload `/shop` — การ์ดรีวิวสเกลเท่ากันทุกใบ + mobile-first | `a62877c` · CSS proof `CARD_FULL=true` |
| **R92-G** | guide ในแอป FB/IG เห็น "เปิดผ่าน Chrome หรือ Safari เพื่อการใช้งานที่สมบูรณ์ที่สุด" (bundle มีแล้ว `R92_GUIDE_NEW=true` · วลีเดิมหาย `R92_GUIDE_OLD_GONE=true`) | `e65f6bf` |
| **R92-S** | อัปโหลดรูปใหญ่ (>300px/>100KB) ที่หน้า marketing/สินค้า → **ถูกลดเหลือ 300×300/≤100KB อัตโนมัติ** (โค้ด+test ผ่านแล้ว · **พฤติกรรมบน live ยังไม่ได้ลอง**) | `e65f6bf` · `compressToWebLimits` 4 จุด |

---

## 🕓 ยังไม่รันตามเดิม (ของเดิมค้างจาก 2026-11-08 — ห้ามตัด)

- **RT-4** ชุด ก · **RT-HOURS** (หลัง 20:30) · **RT-6.2** (บทแอดมิน 12 คีย์) · **RT-6.1** (ยกเว้น E1 = Owner waived "ไม่ต้องทำ") · **RT-6.4B2** (~11:00 แถบสถานะ)
- **CAP-14** SMS จริง + **CAP แถว 7·8·13·16·17·19** (รอ Owner ยืนยันเลขข้อ §2 MASTER_STATUS แล้วรัน)
- **RT-8 = ยังห้ามปิด** (pack §RG·16 · นับเมื่อ RT-1..7 จบ)

---

## ✅ ปิดแล้วรอบ 2026-11-09/10 — ไม่ต้องรัน (รายละเอียด = `AI_WORK_STATE.md` บล็อก ✅)

R89b/c ยุบ+เรียงรีวิว `/shop` (Owner เห็น Verified Purchase) · R90 งาน 1 ลิงก์รีวิว + งาน 2 promo หมดอายุ ("หายแล้ว"/"ลิงก์ถูกต้อง") · two-try Attempt 1 = D2/D5/§T-A code+deploy (เหลือ retest ด้านบน) · D4 วิธีใหม่ code+deploy · R92 งาน 2 วลี guide (bundle proof) · งาน 3 บังคับ 300×300/100KB (gates+test+deploy) · งาน 1 image-gen = สืบจบ → เปลี่ยนเป็น BLOCKED เติมเครดิต (ด้านบน) · ของเดิม: D1 · D3 · D6–D9 · RT-1.4 · RT-5.5–5.7 + CAP-11 · RT-87b CI · promo หมดอายุ · **Migration 201 APPLIED PROD** · **Edge Functions `social-ai-worker` DEPLOYED exit=0** · Test expectations fixed (3 pre-existing failures) · Food Theater Carousel (Admin-Curated Auto-Play) code complete · **Theater Carousel Simplification (2026-11-10): 2 modes (Admin Curated / Daily Random), removed editorial/daily_copy/autoplay settings, filters pre-order expired**

---

### บันทึกผล (เทมเพลตต่อข้อ)
`ข้อ ID · เวลา · อุปกรณ์ · PASS/FAIL/BLOCKED · Order/Ref · Evidence (ภาพ/log/query) · toast ถ้าพลาด`

> FAIL ข้อใด = ทักแชท AI ทันที → จด `AI_WORK_STATE.md` + แจ้งแก้แบบ two-try · **ห้ามแก้เอกสารให้ดูผ่าน** · SKIPPED ≠ PASS · ห้ามตัดข้อทิ้ง

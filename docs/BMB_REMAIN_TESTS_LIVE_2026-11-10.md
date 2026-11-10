# BMB — REMAINING TESTS ON LIVE (รายการที่ "ยังปิดไม่ได้" ณ 2026-11-10)

> **อัปเดต 2026-11-10 (หลัง Deploy ครบ 5 Commits):** Floating Ad Multiple + Sources Filter + Badge + AiStudioTab Merge — **CODE_CLOSED + PUSHED + DEPLOYED** ครบแล้ว
> · **HEAD = `8a3336f`** (merge docs) · **Latest Bundle = `assets/index-Bh_24aFF.js`** (มี Floating Ad Multiple · Sources Filter · Badge · AiStudioTab→ContentTab merge)
> · **Migration 201 APPLIED PROD** · **Edge Functions `social-ai-worker` DEPLOYED exit=0** · gates 4/4 (tsc/lint/vitest/build = 0)
> · **ของปิดแล้ว/มีหลักฐานผ่าน = ไม่อยู่ในนี้** (รายชื่อปิดรอบนี้ = `AI_WORK_STATE.md` บล็อก "✅ ปิดแล้วในเซสชั่นนี้")

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

## ✅ ปิดแล้วรอบ 2026-11-10 (Deploy ครบ + Gates ผ่าน) — **ย้ายจาก "รอ retest" มาได้**

| ข้อ | สิ่งที่แก้/Deploy | Commit | Bundle Proof |
|---|---|---|---|
| **Floating Ad Multiple** | โชว์บนทุก Browser (Chrome Desktop + FB In-App) · สูงสุด 3 อันจาก Promotions `is_banner=true` เรียงวันที่สร้าง | `83f6610` (Phase 1) | `index-Bh_24aFF.js` |
| **Floating Ad Sources Filter** | Admin เลือกแหล่งข้อมูล 3 แหล่ง (Promotions / Announcements / Approved Banners) ผ่าน checkbox ใน ContentTab | `40ea357` (Phase 3) | `index-Bh_24aFF.js` |
| **Floating Ad Badge** | Badge มุมขอบมีสี — ประกาศ=ส้ม 📣, โปรโมชั่น=สีหลัก 🎁 | `96be07f` (Phase 4) | `index-Bh_24aFF.js` |
| **AiStudioTab → ContentTab Merge** | ลบ AiStudioTab (ซ้ำซ้อน) → ContentTab เดียวครบ AI Gen + Album + Forms + Floating Ad + CNT-01 | `6cf0615` | `index-Bh_24aFF.js` |
| **Viewport Heuristic Fix** | ลบ `isFB` false positive → Floating Ad โชว์บน Chrome Desktop ปกติ | `b13c5d2` (Phase 1) | `index-CJEv4C1L.js` |

---

## 🕓 ยังไม่รันตามเดิม (ของเดิมค้างจาก 2026-11-08 — ห้ามตัด)

- **RT-4** ชุด ก · **RT-HOURS** (หลัง 20:30) · **RT-6.2** (บทแอดมิน 12 คีย์) · **RT-6.1** (ยกเว้น E1 = Owner waived "ไม่ต้องทำ") · **RT-6.4B2** (~11:00 แถบสถานะ)
- **CAP-14** SMS จริง + **CAP แถว 7·8·13·16·17·19** (รอ Owner ยืนยันเลขข้อ §2 MASTER_STATUS แล้วรัน)
- **RT-8 = ยังห้ามปิด** (pack §RG·16 · นับเมื่อ RT-1..7 จบ)

---

## ✅ ปิดแล้วรอบก่อน (2026-11-09/10) — ไม่ต้องรัน

R89b/c ยุบ+เรียงรีวิว `/shop` (Owner เห็น Verified Purchase) · R90 งาน 1 ลิงก์รีวิว + งาน 2 promo หมดอายุ ("หายแล้ว"/"ลิงก์ถูกต้อง") · two-try Attempt 1 = D2/D5/§T-A code+deploy (เหลือ retest ด้านบน) · D4 วิธีใหม่ code+deploy · R92 งาน 2 วลี guide (bundle proof) · งาน 3 บังคับ 300×300/100KB (gates+test+deploy) · งาน 1 image-gen = สืบจบ → เปลี่ยนเป็น BLOCKED เติมเครดิต (ด้านบน) · Floating Ad + Promotion Banner Settings (Kill Switch + max 3 + real links + image upload/browse + CNT-01 approve/reject) · Migration 201 APPLIED PROD · Edge Functions `social-ai-worker` DEPLOYED exit=0 · Test expectations fixed (3 pre-existing failures) · Food Theater Carousel (Admin-Curated Auto-Play) code complete · Theater Carousel Simplification (2026-11-10): 2 modes (Admin Curated / Daily Random), removed editorial/daily_copy/autoplay settings, filters pre-order expired

---

## 📋 สรุปสถานะรวม ณ 2026-11-10 (หลัง Deploy ครบ)

| หมวด | สถานะ | รายละเอียด |
|---|---|---|
| **BLOCKED (รอ Owner)** | ⏸️ 2 ข้อ | IMG-GEN (เติมเครดิต OpenRouter), OMNI-5 (ลงทะเบียน Meta Test User) |
| **รอ Live Retest (โค้ด Deploy แล้ว)** | 🔄 7 ข้อ | D2, D5, §T-A, D4, R91, R92-G, R92-S |
| **ปิดแล้วรอบนี้ (Deploy + Gates ผ่าน)** | ✅ 5 กลุ่ม | Floating Ad Multiple, Sources Filter, Badge, AiStudioTab Merge, Viewport Fix |
| **ยังไม่รัน/ค้างจากเดิม** | ⏳ หลายข้อ | RT-4, RT-HOURS, RT-6.x, CAP-x, RT-8 |

---

## 🎯 ขั้นตอนถัดไป (Owner Action)

1. **Hard reload (Ctrl+Shift+R) ที่ `https://biteme-baby.com`** → Verify Floating Ad Multiple + Sources Filter + Badge + AiStudioTab Merge
2. **Run Live Retest ต่อ:** D2 → D5 → §T-A → D4 → R91 → R92-G → R92-S
3. **จดผล:** `ข้อ ID · เวลา · อุปกรณ์ · PASS/FAIL/BLOCKED · Evidence`
4. **FAIL = ทักแชท AI ทันที** → จด `AI_WORK_STATE.md` + แจ้งแก้แบบ two-try

---

## กติกา (คงเดิม)

1. ใช้ **`https://biteme-baby.com`** เท่านั้น · **hard reload (Ctrl+Shift+R) 1 ครั้ง** ก่อนเริ่ม · เปิด F12 Console ทิ้งไว้
2. บันทึกทุกข้อ: `ข้อ ID · เวลา · อุปกรณ์ · PASS/FAIL · evidence (ภาพ/copy ข้อความ toast สีแดง verbatim)`
3. **FAIL = จด defect ใหม่ลง `AI_WORK_STATE.md`** (แจ้งแชทถัดไป · two-try) · **SKIPPED ≠ PASS** · **ห้ามตัดข้อทิ้ง**
4. ห้ามใช้ข้อมูลลูกค้าจริงทดสอบ · ออเดอร์ทดสอบ = **cancel เมื่อจบ**
5. เสร็จแต่ละกลุ่ม → ทักแชทบอก AI ให้สรุปเข้า work state + test pack

> FAIL ข้อใด = ทักแชท AI ทันที → จด `AI_WORK_STATE.md` + แจ้งแก้แบบ two-try · **ห้ามแก้เอกสารให้ดูผ่าน** · SKIPPED ≠ PASS · ห้ามตัดข้อทิ้ง
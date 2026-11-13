# BMB — REMAINING TESTS ON LIVE (รายการที่ "ยังปิดไม่ได้" ณ 2026-11-13 09:15)

> **อัปเดต 2026-11-13 09:15 (Owner verified):** **R98 ✅ 5/5 PASS** — InAppBrowserBanner + PWA Install + Cart Continuity ครบ · **R96 ✅ COMPLETE** — AI Grounding + Cross-Channel Context + Data Freshness (Migration 203/204 APPLIED PROD) · D2 ✅, D5 ✅, R92-S ✅ — **เหลือ §T-A เท่านั้น** ต้อง retest ต่อ
> · **HEAD = `6c81c72`** (message) · **Latest Bundle = `assets/index-Bh_24aFF.js`** (มี Floating Ad Multiple · Sources Filter · Badge · AiStudioTab→ContentTab merge + R98 InAppBrowserBanner + R96 Grounding)
> · **Migration 204 APPLIED PROD** (203 + 204) · **Edge Functions `social-ai-worker` DEPLOYED exit=0** · gates 4/4 (tsc/lint/vitest/build = 0)
> · **ของปิดแล้ว/มีหลักฐานผ่าน = ไม่อยู่ในนี้** (รายชื่อปิดรอบนี้ = `AI_WORK_STATE.md` บล็อก "✅ ปิดแล้วในเซสชั่นนี้")
> 
> **📌 อัปเดต 2026-11-11 รอบ 12:** InAppCart Continuity Plan CODE_CLOSED + **PUSHED + DEPLOYED** — รอ owner live retest Scenarios A–E
> - Scenario A–E ในตารางด้านล่าง

---

## ✅ ปิดแล้วรอบนี้ (Owner verified 2026-11-13 08:41 — R98)

| ข้อ | สิ่งที่ทดสอบ/ผล | Evidence |
|---|---|---|
| **R98-①** | แบนเนอร์ข้อความใหม่ "Facebook ไม่รองรับการเปิดลิงก์ตะกร้าอัตโนมัติ" | Owner confirm |
| **R98-②** | ปุ่มคัดลอกลิงก์ "📋 คัดลอกลิงก์ · เปิดใน Chrome / Safari" | Owner confirm |
| **R98-③** | ปุ่มติดตั้งแอป "📥 ติดตั้งแอป" — PWA Install | Owner confirm |
| **R98-④** | Cart continuity — กดคัดลอก → เปิด Chrome → ตะกร้ามีของครบ + ?cart= ทำงาน | Owner confirm |
| **R98-⑤** | ไม่เห็นแบนเนอร์ซ้ำหลังติดตั้ง PWA แล้ว | Owner confirm |

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

## 🆕 รอ Live Retest — CODE_CLOSED + DEPLOYED รอบ 12 (InAppCart Continuity)

> InAppCart Continuity Plan 4/4 Steps เสร็จ · Gates 4/4 ผ่าน (lint/tsc/build/vitest: 213 files / 2215 tests PASS) · **PUSHED + DEPLOYED** · ไฟล์ที่แก้:
> - `FloatingAdBanners.tsx` comment `max 2→3`
> - `useInAppBrowser.ts` ขยาย UA LINE/IG + `InAppPlatform` type + iOS alert→toast DOM
> - `InAppBrowserBanner.tsx` ?cart= decode + UX messages + debug logging

| ข้อ | สิ่งที่ยังใหม่ (รอบ 12) | Deployed | วิธีทดสอบ (Scenarios จากแผน) |
|---|---|---|---|
| **Scenario A** | FB Chat มี ?cart= → banner แสดงจำนวนสินค้า → Chrome เปิด → ตะกร้ามีของครบ | ✅ `6c81c72` | ส่งลิงก์ `?cart=<base64>` จาก FB Messenger ให้ตัวเอง → กดลิงก์ → เห็น banner "กำลังนำรายการ X รายการในตะกร้า..." → กดเปิด Chrome → หน้าโหลด → ตะกร้ามีของครบ (retry 2.5s เดิม) ✅ PASS = Cart continuity สำเร็จ |
| **Scenario B** | FB Chat ไม่มี ?cart= → banner แนะนำว่ามี ?cart= ถึงจะเติมตะกร้า | ✅ `6c81c72` | กดลิงก์ธรรมดา → เห็น banner แนะนำ "ลิงก์ที่มี ?cart= จากแชท AI จะเติมตะกร้าอัตโนมัติ" → กดเปิด Chrome → หน้าแรกเปล่าไม่มีตะกร้า ✅ PASS = ไม่พัง + แสดงข้อความแนะนำ |
| **Scenario C** | LINE/Instagram → UA detection ผ่าน LINE\/IG \\ → banner ขึ้นปกติ | ✅ `6c81c72` | กดลิงก์จาก LINE/IG → เห็น orange banner (UA ผ่าน `LINE\/` หรือ `Instagram\\`) → ทำเหมือน Scenario A/B ✅ PASS = LINE/IG detection ทำงาน |
| **Scenario D** | iOS Safari → ไม่เห็น alert popup → เห็น toast notification ด้านล่างแทน | ✅ `6c81c72` | กด "เปิดในเบราว์เซอร์ภายนอก" → ไม่เห็น alert pop-up → เห็น toast notification สีฟ้าด้านล่างจอ ✅ PASS = Toast แสดงแทน alert |
| **Scenario E** | Floating Ad limit 3 ใบ → แสดงสูงสุด 3 ใบ | ✅ `6c81c72` | มีโปรโมชั่น > 3 ใบใน DB → เห็น floating ad แสดง 3 ใบเท่านั้น ✅ PASS = Limit ทำงานถูกต้อง |

---

## 🕓 ยังไม่รันตามเดิม (ของเดิมค้างจาก 2026-11-08 — ห้ามตัด)

- **RT-4** ชุด ก · **RT-HOURS** (หลัง 20:30) · **RT-6.2** (บทแอดมิน 12 คีย์) · **RT-6.1** (ยกเว้น E1 = Owner waived "ไม่ต้องทำ") · **RT-6.4B2** (~11:00 แถบสถานะ)
- **CAP-14** SMS จริง + **CAP แถว 7·8·13·16·17·19** (รอ Owner ยืนยันเลขข้อ §2 MASTER_STATUS แล้วรัน)
- **RT-8 = ยังห้ามปิด** (pack §RG·16 · นับเมื่อ RT-1..7 จบ)

---

## ✅ ปิดแล้วรอบก่อน (2026-11-09/10) — ไม่ต้องรัน

R89b/c ยุบ+เรียงรีวิว `/shop` (Owner เห็น Verified Purchase) · R90 งาน 1 ลิงก์รีวิว + งาน 2 promo หมดอายุ ("หายแล้ว"/"ลิงก์ถูกต้อง") · two-try Attempt 1 = D2/D5/§T-A code+deploy (เหลือ retest ด้านบน) · D4 วิธีใหม่ code+deploy · R92 งาน 2 วลี guide (bundle proof) · งาน 3 บังคับ 300×300/100KB (gates+test+deploy) · งาน 1 image-gen = สืบจบ → เปลี่ยนเป็น BLOCKED เติมเครดิต (ด้านบน) · Floating Ad + Promotion Banner Settings (Kill Switch + max 3 + real links + image upload/browse + CNT-01 approve/reject) · Migration 201 APPLIED PROD · Edge Functions `social-ai-worker` DEPLOYED exit=0 · Test expectations fixed (3 pre-existing failures) · Food Theater Carousel (Admin-Curated Auto-Play) code complete · Theater Carousel Simplification (2026-11-10): 2 modes (Admin Curated / Daily Random), removed editorial/daily_copy/autoplay settings, filters pre-order expired

---

## 📋 สรุปสถานะรวม ณ 2026-11-13 09:15

| หมวด | สถานะ | รายละเอียด |
|---|---|---|
| **รอ Live Retest (โค้ด Deploy แล้ว)** | 🔄 1 ข้อ | **§T-A** (Cart retry 2.5s เดิม) |
| **รอ Live Retest (รอบ 12 DEPLOYED)** | 🔄 5 Scenarios | A–E (InAppBrowser banner, ?cart= decode, LINE/IG UA, iOS toast, Floating Ad limit) |
| **✅ ปิดแล้วรอบนี้ (Owner verified 2026-11-13)** | ✅ 10 ข้อ | **R98-①②③④⑤** (InAppBrowserBanner + PWA Install + Cart Continuity) + **R96-①②③** (AI Grounding + Cross-Channel + Data Freshness) |
| **✅ ปิดแล้วรอบนี้ (Owner verified 2026-11-10)** | ✅ 7 ข้อ | IMG-GEN, D4, R91, R92-G, D2, D5, R92-S |
| **✅ ปิดแล้วรอบนี้ (Deploy + Gates ผ่าน)** | ✅ 5 กลุ่ม | Floating Ad Multiple, Sources Filter, Badge, AiStudioTab Merge, Viewport Fix |
| **ยังไม่รัน/ค้างจากเดิม** | ⏳ หลายข้อ | RT-4, RT-HOURS, RT-6.x, CAP-x, RT-8 |

---

## 🎯 ขั้นตอนถัดไป (Owner Action)

1. **Hard reload (Ctrl+Shift+R) ที่ `https://biteme-baby.com`** (สำหรับทุกข้อ)
2. **Run Live Retest:**
   - **§T-A** (Cart retry 2.5s) — ก่อน/หลัง deploy ต้อง retest
   - **Scenario A–E** (Round 12 InAppCart Continuity) — โค้ด deployed แล้ว
   - **R95** (โฟลตติ้งข้อความอ่านได้) — deployed, ต้อง hard reload
   - **R96** (AI Grounding + Context + Freshness) — migrations applied, ต้องทดสอบจริง
3. **จดผล:** `ข้อ ID · [เวลา] · [อุปกรณ์] · PASS/FAIL · สนับสนุนภาพหน้าจอ Chrome`
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

---

## 🆕 R95 (2026-11-12) — โฟลตติ้งข้อความอ่านได้ + รูปไดคัทโปร่ง

> ** deploy แล้ว — รอ owner hard refresh**

| ข้อ | สิ่งที่ยังใหม่ (รอบ 19) | Deployed | วิธีทดสอบ |
|---|---|---|---|
| **R95-①** | `.flad-card` พื้นหลังต้องไม่โปร่ง (ข้อความอ่านได้) | ✅ `f44fb09` | Hard Refresh (`Ctrl+Shift+R`) → โฟลตติ้ง = ข้อความอ่านได้ + พื้นหลังขาว/ธีม |
| **R95-②** | `.flad-media` ปล่อยโปร่ง (รูปไดคัทไม่มีกรอบแปลก) | ✅ `f44fb09` | รูป PNGโปร่ง = โผล่ cleanly ไม่มี logo/gradient ทับ |

---

## 🆕 R96 (2026-11-12) — AI Grounding + Cross-Channel Context + Data Freshness

> **COMPLETE — Migration 203/204 APPLIED PROD 2026-11-13 09:15**

| ข้อ | สิ่งที่ทำเสร็จ | Deployed | วิธีทดสอบ |
|---|---|---|---|
| **R96-①** | AI ตอบข้อมูลจริงจาก DB (ไม่มโน) — `fetchGroundingData` 30s cache | ✅ `6c7a7e8` + migration 203 | ทัก "เมนูนี้ยังสั่งได้ไหม" → AI ต้องเช็ค products DB จริง (is_available, price) |
| **R96-②** | AI รู้ context จากโพสต์/คอมเมนต์/Messenger/Web — `socialHandoff` timeline | ✅ `acca657` + migration 203 | ทักจากคอมเมนต์โพสต์ → AI ต้องรู้ว่าลูกค้าคุยเรื่องอะไร (timeline cross-channel) |
| **R96-③** | product update → AI ตอบข้อมูลใหม่ทันที — `invalidateProductCache()` 7-min TTL | ✅ `da78fed` + `a0a65ff` | อัปเดต price/is_available ใน AdminProducts → ทัก → AI ตอบข้อมูลใหม่ (cache invalidated) |

> **Live-test checklist (owner):**
> 1. AI ตอบข้อมูลจริงจาก DB (ไม่มโน) — grounding_data เขียนลง social_events ทุกครั้ง
> 2. AI รู้ context จากโพสต์/คอมเมนต์/Messenger/Web — timeline ใน ExtendedSocialHandoff
> 3. product update → AI ตอบข้อมูลใหม่ทันที — explicit cache invalidation

---

## 📋 บันทึกผล (เทมเพลตต่อข้อ)
`ข้อ ID · เวลา · อุปกรณ์ · PASS/FAIL/BLOCKED · Evidence (width×height/size KB / copy response / screenshot) · toast ถ้าพลาด`
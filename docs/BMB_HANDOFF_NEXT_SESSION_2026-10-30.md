# Bite Me Baby — HANDOFF + SESSION CLOSURE (ปิดเซสชัน 2026-10-29 · R20)

> ฉบับนี้ = **รายงานปิดงานเซสชัน 2026-10-29 (รอบ R20) + แฮนด์ออฟส่งต่อแชทหน้า** (ต่อจาก `docs/BMB_HANDOFF_NEXT_SESSION_2026-10-29.md`)
> canonical state = `AI_WORK_STATE.md` + `docs/BMB_MASTER_STATUS.md` (ขัดกันให้ถือ 2 ไฟล์นั้น + โค้ดจริง)
> รอบนี้เริ่มจากคำสั่ง Owner **`__apply 169__`** + "ทำงานที่เหลือต่อตามแฮนออฟทั้งหมดตามกฏ"

---

## §1. รายงานรอบนี้ (R20 · 2026-10-29)

| งาน | เนื้อหา | evidence |
|---|---|---|
| ✅ **apply 169 บน production (Owner สั่ง `__apply 169__`)** | script ใหม่ `e2e/r19Apply169.cjs` (แบบ `r*Apply*.cjs` เดิม · Management API `/database/query` · token จาก `.env.local`) 4 stage = **precheck** (ledger top **168** · def เดิมของ 166 = ยังไม่ decode `%XX` · behavior probe `space_eq=false`) → **apply** `supabase/migrations/169_pod_path_percent_encoding.sql` → **verify** = probe พฤติกรรมจริง `driver_path_folder('drv-%20c139-60bc') = driver_path_folder('drv- c139-60bc')` → **true** (ก่อน apply = false) · `%23`↔`#` true · mixed true · def ใหม่มี `(%[0-9A-Fa-f]{2})+` ตัดก่อน strip · `pod_path_is_driver` ยัง **SECURITY DEFINER + STABLE + เรียก driver_path_folder** → **record ledger top = 169** · ยืนยันซ้ำด้วย `e2e/r19Verify169.cjs` (กรอง def ด้วย identity args ที่ถูกต้อง) | `e2e/r19Apply169-result.json` · `e2e/r19Verify169-result.json` |
| 🔐 **N3 (P1 · QA review ข้อ 1.6): listener auth กลาง** | `onAuthStateChange` ใน `src/` เดิม = **0 จุด** → สร้าง `src/lib/authSessionSync.ts` (**pure decision** `resolveAuthSyncAction` — test ได้โดยไม่ยุ่ง Supabase) + `src/components/AuthSessionSync.tsx` (mount ครั้งเดียวใน `App.tsx` ใต้ BrowserRouter → navigate แบบ SPA) + actions ใหม่ใน `authStore`: `clearSession()` / `syncFromAuthUser()` · **กติกา:** `SIGNED_OUT` → clear store + เด้ง `/login` เก็บ `state.from` **เฉพาะตอนเคยล็อกอินจริงและยังไม่ได้อยู่ `/login`** (กัน boot loop ตอนเปิดแท็บใหม่) · `TOKEN_REFRESHED` → `refreshRole()` (เฉพาะ authenticated) · `USER_UPDATED`/`SIGNED_IN` → re-map customer · **ห้าม await supabase ใน callback** (ถือ lock) → ทุกคำสั่ง defer ด้วย `setTimeout(0)` | `src/__tests__/authSessionSync.test.ts` (9 ข้อ) · tsc 0 |
| 📣 **N1 (Owner สั่งจาก 4-2): แอดมินแก้ copy แถบสถานะเอง** | คีย์ **`business_settings.store_status_copy`** = 4 บรรทัด (เซมเดย์เปิด · วันนี้ปิดรับแต่ยังจองล่วงหน้าได้ · ไม่มีรอบเปิดรับ · พรีออเดอร์ปิดรับแล้ว) — **ไฟ 🟢/🔴 (`sameDayOpen`/`preOrderOpen`) ยังคำนวจากรอบจริงเสมอ = ห้าม override** (กติกา Owner) · **บรรทัดเปิดรับ "เปิดรับ พรีออเดอร์ : … (ปิดรอบ …)" = ข้อมูลสด R18 ไม่รับ override** · `src/lib/storeStatusCopy.ts` (mirror `seoSettings`: live store + subscribe + cache 7 นาที + merge กันค่าว่าง) · `StoreStatusStrip` ใช้ `useSyncExternalStore` + โหลดตอน mount · ฟอร์มใน `AdminSettings` (`data-testid="store-status-copy-config"`) + ใส่ `TYPED_FORM_KEYS` (ทางบันทึกเดียว — generic editor ห้ามเขียน) · **ไม่มี migration** (default ฝั่ง client = ค่าจริง · key ถูกสร้างตอนแอดมินกดบันทึกครั้งแรก) | `src/lib/storeStatusCopy.ts` · `src/__tests__/storeStatusCopy.test.ts` (10 ข้อ) |
| 📄 **N2 (checklist ข้อ 2-8 "รอปรับปรุงเพิ่ม"): `docs/BMB_BACKEND_AI_PART_1.md`** | ไล่ตรวจทุก § เทียบโค้ดจริงแล้วแก้/เติม: **§F** เส้นทางสั่งซื้อจริง (เดิมบอกว่าผ่าน `runOrderBuilder` ตรง ๆ → จริง = เพิ่มตะกร้า `FoodTheater.add()` → `deriveOrderMode` → `useCartStore.addItem` · ปุ่มปรับแต่ง/จอง → `HomePage.tsx:343` → `runOrderBuilder`) + gate L-8 toast · **§G** เพิ่ม **P1: คีย์ Google Maps ฝั่ง client ต้องจำกัด HTTP referrer ใน Google Cloud** + สถานะ external providers (mock · `external_methods_enabled=[]`) · **§H** ไฟล์ AI ครบ (`aiMemory`/`aiServerMemory`/`aiModels`) + proxy = EF **`ai-proxy`** (`aiService.ts:176/435` · timeout race `:173`) + เทสต์ 7 ไฟล์ · **§I** ขยายเป็น copy **ทั้งเว็บ** (ตาม role guide §14) + `BANNED_KICKERS` + guards อัตโนมัติ · **L-10** ฯลฯ (evidence `e2e/w7Apply159-record.json`) · **L-11** ยังไม่มีนิยาม | `docs/BMB_BACKEND_AI_PART_1.md` |
| 🧹 **cosmetic (QA 3.9)** | `PromotionsPage` ปุ่ม "ลองใหม่" = **refetch** (`reloadKey`) แทน `window.location.reload` — เหลือจุดเดียวใน `ErrorBoundary` (ซึ่งถูกแล้ว) | `src/pages/PromotionsPage.tsx` |
| 🧪 **gates ท้องถิ่น** | tsc exit 0 · eslint + **brandNameGuard 454 ไฟล์** + **languageSanity 1,267** OK · vitest = `e2e/gates_r19b_vitest.log` · build = `e2e/gates_r19b_build.log` · **CI ผลจริง = ดู `BMB_MASTER_STATUS.md` §9.0 แถว 45** | `e2e/gates_r19b_*.log` |

**Production state:** ledger top = **169** (migrations 163–169 APPLIED · 169 = รอบนี้) · Pages = auto-deploy จาก main · git HEAD ให้ตรวจจริงด้วย `git log --oneline -1` เสมอ · รอบก่อน (R19) = Contract #200 · CI #626 · Pages ✓ บน `e8831c2`

---

## §2. บทเรียนรอบนี้ (ห้ามลืม)

1. **`pg_get_function_identity_arguments()` คืน "ชื่อ parameter" ด้วย** (`p_id text` ไม่ใช่ `text`) — query กรอง `= 'text'` เงียบ ๆ คืน `[]` แล้ว assertion ของ script **ไม่มี error แค่ค่า false** → รู้ได้จาก behavior probe เท่านั้น (บทเรียนเดียวกับ §9.8 เรื่อง `to_regprocedure`) · script ที่แก้แล้ว = `e2e/r19Verify169.cjs` (กรองด้วย `proname IN (...)` + แสดง args จริง)
2. **`supabase.auth.onAuthStateChange` callback ถือ lock ของ supabase-js** → ห้าม `await` คำสั่ง supabase อื่นในนั้น (deadlock) — ทุกอย่างต้อง `setTimeout(..., 0)` ออกมาก่อน (`AuthSessionSync.tsx` ทำไว้แล้ว)
3. **เทสต์ที่ assert "ข้อความ/โค้ดดิบ" (`?raw`) จะพังเมื่อแก้สเปก** — รอบนี้ข้อดี = จับให้เห็นทันที 3 ไฟล์ตอนเพิ่ม key เข้า `TYPED_FORM_KEYS`: `adminSettingsTypedKeys.test.ts` · `socialAiContinuity.test.ts` · `r12SeoAdminCopy.test.ts` → **ถ้าแก้集合/ข้อความใน `AdminSettings`/strip ต้องไล่ 3 ไฟล์นี้ด้วย** (อัปเดตแล้ว — เหตุผล = spec เปลี่ยนโดย Owner = N1)
4. **guards สองตัว (`brandNameGuard`/`languageSanity`) อยู่ใน `npm run lint`** และกวาดทั้ง `src/` + `e2e/` (454 / 1,267 ไฟล์) — **ห้ามมีอักขระชุดอื่น (จีน/ญี่ปุ่น/BOM/U+FFFD) ใน comment** (รอบนี้โดนเอง 1 จุดที่ `e2e/r19Verify169.cjs:2` → แก้แล้ว)
5. **Pattern apply production ยังใช้เดิม:** `e2e/r*Apply*.cjs` → Management API `/database/query` + insert ledger ด้วย `ON CONFLICT DO NOTHING` + evidence JSON ชื่อ `r*Apply*-result.json` — ห้าม apply โดยไม่มี precheck/verify

---

## §3. งานที่ต้องทำต่อ (เรียงลำดับความสำคัญ)

1. **🆕 CI ทั้ง 3 workflows ของ commit รอบนี้** — ตรวจ GitHub Actions (Contract Tests · CI · Cloudflare Pages) ให้เขียวทุกตัว แล้วกรอก **`BMB_MASTER_STATUS.md` §9.0 แถว 45** ให้เป็นเลขรันจริง (ตอนนี้ยังเขียน "ตรวจรอบถัดไป" — ห้ามอ้างเลขโดยไม่ได้ดู API) · HEAD เช็คจริงด้วย `git log --oneline -1`
2. **🆕 retest สิ่งที่ทำรอบนี้ (ส่ง Owner):** **N1** = หน้า `/admin/settings` การ์ด "📣 แถบสถานะหน้าแรก (ข้อความ)" → แก้+บันทึก → หน้าแรกเปลี่ยน (เครื่องอื่น ≤7 นาที/reload) · **ไฟ 🟢/🔴 ต้องยังเปลี่ยนตามรอบจริง** (ลองปิด/เปิดรอบดู) · **N3** = ล็อกอินค้างไว้ แล้ว logout จากเครื่องอื่น/รอ session หมดอายุ → หน้าต้องเด้ง `/login` ทันที + ล็อกอินใหม่กลับหน้าเดิม (from) · **N2** = อ่าน `docs/BMB_BACKEND_AI_PART_1.md` แล้วยืนยัน/ส่งต้นฉบับเดิมเทียบ
3. **P1 (Owner ทำใน Google Cloud):** จำกัด **HTTP referrer** ของคีย์ Google Maps (`src/lib/googleMaps.ts` ยิงจาก client 5 จุด) — ทำในคอนโซล ไม่ใช่โค้ด
4. cosmetic (ค้างเดิม): รวม `to_char` id ~40 จุด · รวม haversine 2 ฉบับ · รวม `confirmOfflinePayment` wrappers
5. external providers (Grab/Lineman/Foodpanda) = รอ Owner ตัดสินใจ credentials หรือปิด module
6. ของค้างเดิม: **B2** (~11:00) · **C7/C8 ขั้นรัน** · **RL-DEFECT 4+1** · **Part 5/6/7** · L-11 (LED) รอนิยาม · Backend+AI รอเทียบต้นฉบับ · ดู §5

---

## §4. รายการทดสอบทั้งหมด (ส่งให้แชทหน้า)

**เริ่มจาก `docs/BMB_MASTER_TEST_CHECKLIST_2026-10-28.md`** — hard reload ก่อนเสมอ · `biteme-baby.com` เท่านั้น

### A. retest เดิมที่ยังค้าง (เท่ากับแฮนออฟ 2026-10-29 §4A — ยังไม่เปลี่ยน)
- **1I ทั้ง 6 ข้อ** · 2-1/2-2/2-4/2-5/2-6/2-7 · 3-3 · 3-4 · 3-5 · 3-9
- 4-3 (C7) · 4-4 (C8) · 4-5 (RL-DEFECT) — **มีหน้าต่างเวลา**
- Part 5 = settings-sync 14 คีย์ · Part 6 = role guide · 7-1/7-2/7-3/7-5/7-6 · Part 8 · Part 9 (เกณฑ์ปิด)
- แถบสถานะ stripe 2 (R18 copy): ต้องขึ้น `🟢 เปิดรับ พรีออเดอร์ : จองล่วงหน้า รอบ <ชื่อรอบ> <วันที่> (ปิดรอบ HH:MM)`
- copy หน้าเช็คเอาท์ 7 จุด (R19) + หัวข้อที่คงเดิม + placeholder.svg (R17) + ไม่มี log console (R17) + QA checklist (empty state / responsive)

### B. ทดสอบสิ่งที่ทำรอบนี้ (R20) — ใหม่
- **N1:** `/admin/settings` → การ์ด **"📣 แถบสถานะหน้าแรก (ข้อความ)"** → เห็นช่อง 4 บรรทัด · แก้ → บันทึก → toast สำเร็จ · หน้าแรกแถบสถานะเปลี่ยนตาม · **กลับค่า default ได้โดยล้างช่อง (ไม่บันทึกค่าว่างลง DB)** · **ไฟ 🟢/🔴 สองบรรทัดต้องยังเปิด/ปิดจากรอบจริง** (ปิดรอบ → 🔴 ทันที ไม่ต้องรอ reload) · ป้าย `เปิดรับ พรีออเดอร์ : … (ปิดรอบ …)` **ไม่เปลี่ยน** ตามช่องเหล่านี้ (ข้อมูลสด)
- **N3:** (ก) ล็อกอินค้างไว้ แล้ว signOut จากเครื่องอื่น → เครื่องนี้เด้ง `/login` ทันที (ไม่ค้างหน้าเก่า) · (ข) อยู่หน้า `/orders` แล้ว session หมด → เด้ง `/login` และล็อกอินใหม่ต้องกลับ `/orders` · (ค) เปิดแท็บใหม่ตอนไม่มี session → **ห้ามถูกเด้งวน** (เข้าหน้าแรกได้ปกติ)
- **N2:** อ่าน `docs/BMB_BACKEND_AI_PART_1.md` แล้วยืนยัน §F/§G/§H/§I/L-10 (หรือส่งต้นฉบับเดิมมาเทียบ)
- **CI:** ทั้ง 3 workflows เขียวบน commit รอบนี้ (ดู §9.0 แถว 45)

### C. งานที่สั่งค้าง (ทำก่อนส่ง test รอบหน้า)
- P1 คีย์ Google Maps = จำกัด referrer ใน Google Cloud (Owner) · cosmetic 3 ชุด · external providers = รอ Owner

---

## §5. เกณฑ์ปิดงาน (ยังห้ามประกาศ "ปิดครบทุกลูป")

ยังขาด: **C7/C8 ขั้นรัน** · **B2 หลักฐาน** · **RL-DEFECT 4+1** · **Part 5/6/7 ส่วนที่ค้าง** · **test pack ทั้งหมดไม่มี FAIL ค้าง** · **CI ทุก workflow เขียวบน HEAD ใหม่ของรอบนี้** (ต้องตรวจหลัง push) → ยังห้ามพูด "ปิดครบทุกลูป / เหลือ Owner อย่างเดียว"

---

*จัดทำ 2026-10-29 (R20) · Owner สั่ง `__apply 169__` → production ledger = 169 · N1/N2/N3 = ปิดงานค้างจากแฮนออฟ 2026-10-29 · CI ของรอบนี้ดู `BMB_MASTER_STATUS.md` §9.0 แถว 45*

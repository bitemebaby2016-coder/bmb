# BMB-FB-CART-BRIDGE-LIVE-2026-11-23 — สะพาน "ตะกร้าสด" ข้ามช่องทาง Facebook → เบราว์เซอร์จริง

**ปัญหาที่ Owner ชี้ (พิสูจน์จากรูป 08:48–08:52 + โค้ดจริงแล้ว):**
ใน Facebook WebView ตะกร้ามี **4 บรรทัด / 17 ชิ้น / ฿1,313** แต่กด "คัดลอกลิงก์ → วางใน Chrome" แล้วได้เพียง **1 รายการ ฿79** (= payload ของลิงก์ AI สรุปรอบคุยล่าสุด) — ข้อมูลไม่ตรงกันทุกช่องทาง

**Root cause 4 ชั้น (ที่ตรวจจาก Actual Code):**
1. AI สร้าง `?cart=` จาก **รายการ matched ของรอบคุยเท่านั้น** — `supabase/functions/_shared/socialOrderIntake.ts:555-561` (`cartFooterForMatch`) — server ไม่มีตะกร้าฝั่งลูกค้าให้อ่าน
2. ปุ่มคัดลอกส่งต่อ **สแนปชอต mount ครั้งเดียว / `bmb:cart-resume` ที่ไม่มี TTL** — `src/components/InAppBrowserBanner.tsx:62-70, 131-159` — ไม่มีโค้ดใด serialize ตะกร้าสดลงลิงก์
3. `Layout.tsx:136-141` strip `?cart=`/`?s=` หลัง restore (§T-A) → ลิงก์ที่คัดลอกพา payload เก่าเสมอ
4. Restore ทั้งสอง path **hardcode `addItem(p, q, {}, 'SAME_DAY')`** → ทิ้ง add-ons + line_mode — `Layout.tsx:125, 199`

**ข้อเท็จจริงที่เปิดทางแก้:** `customizations = { addOns: [{ addonId, selections, note }] }` — เก็บแค่ id/ตัวเลือก/โน้ต **ไม่มีราคา ไม่มี PII** (ราคา server re-derive) → ฝังลงลิงก์ได้ปลอดภัย (`src/lib/addonDisplay.ts:66-79`, `src/types/index.ts:822-825`)

---

## เป้าหมาย (Acceptance)
- กดคัดลอกใน WebView เมื่อตะกร้ามีของ → ลิงก์พา **ตะกร้าเต็ม ณ วินาทีที่กด** (บรรทัด+จำนวน+add-ons+โหมด) แล้ว Chrome restore ตรงชนิดทุกตัวเลข
- ตะกร้าว่าง → fallback สายเดิม (ลิงก์ mount / bmb:cart-resume ที่มี TTL 30 นาที)
- ข้อความ AI ทุกช่องทางพูดความจริงว่า "ลิงก์นี้พาเฉพาะรายการรอบนี้ ไม่รวมของที่เพิ่มเองบนเว็บ" (scope disclosure)
- เทสต์คุมพฤติกรรมทั้งหมด + เกตผ่านจริง (tsc/lint/vitest/build/CI)

## ขอบเขตที่ยกเว้นชัดเจน (Out of scope)
- Server-side/account cart (ซิงก์ข้ามเครื่องแบบแท้) — สถาปัตยกรรมใหญ่ แนะเป็นงานอนาคตแยก
- คูปอง/referral/ค่าส่งในลิงก์ (server เป็น authority ตอน submit อยู่แล้ว)
- LINE/IG เฉพาะทาง (hook รองรับแล้ว ไม่แตะ)

---

## Task list (atomic — แก้จบทีละชุด, พยายาม ≤ 2 attempt/หัวข้อ)

### Phase 1 — `cartDeepLink.ts` payload v2 (pure lib, ฝั่งเว็บ)
1. เพิ่ม `encodeLiveCartParam(lines: CartLine[]): { encoded: string; droppedMods: boolean; truncated: boolean }`
   - payload `{v:2, items:[{id, q, mods?, lm?}]}` — `mods` = customizations เดิม (addOns), `lm: 1` เฉพาะ PRE_ORDER (SAME_DAY = ละไว้ให้สั้น)
   - caps: 30 บรรทัด, 50 ชิ้น/บรรทัด, payload หลัง b64url **≤ 1800 chars**; เกิน → ตัด `mods` ก่อน (droppedMods=true) แล้วจึงตัดบรรทัด (truncated=true)
   - **v1 `encodeCartParam` เดิมไม่แตะ** (server mirror `socialOrderIntake.encodeCartParam` + round-trip test เดิมคงอยู่)
2. `decodeCartParam` / `normalizeCartParam` รองรับ v1 + v2 (validate: mods = object รูป addOns, lm ∈ {0,1}, v ≥ 1) — พร้อมกัน double-encode ชั้นเดิม

### Phase 2 — ปุ่มคัดลอกพาตะกร้าสด (`InAppBrowserBanner.tsx` + `Layout.tsx`)
3. `copyHandoff` (testid `inapp-copy-link`) สร้าง URL ณ เวลากด:
   - แหล่งข้อมูลลำดับ 1: `encodeLiveCartParam(useCartStore.getState().items)` — ตะกร้าสด
   - ลำดับ 2: `cartHandoff.raw` (mount snapshot เดิม) · ลำดับ 3: `readCartResume` (**เติม TTL 30 นาที** + ตัวนับของ)
   - `?s=` (บริบทแชท) คงติดจาก URL/mount เดิมเสมอ
   - บรรทัดสถานะ "พบรายการ N รายการ" ใช้ **จำนวนตะกร้าสด** เมื่อมีของ (ไม่เชิด payload เก่า) + แจ้ง truncated/droppedMods ตามจริง
   - คง testids ทั้งหมด (r101/r46 contract), hooks อยู่ก่อน early-return (R90), **ห้ามกลับไป intent:// (R92 ถาวร)**
4. strip `fbclid` จาก handoffUrl (สะอาดลง ไม่กระทบ decode)
5. `Layout.tsx` restore ทั้งสอง path ส่งของจริงเข้า `addItem(p, q, it.mods ?? {}, it.lm === 1 ? 'PRE_ORDER' : 'SAME_DAY')` — เลิก hardcode; addOns ที่ addonId ไม่พบใน `product.addons` = ตัดรายการนั้นออก (fail-safe, ไม่เดา)
   - คง one-shot/30-min ของ `bmb:cart-from-link`; เคลียร์ `bmb:cart-resume` หลัง restore สำเร็จ

### Phase 3 — ความจริงทุกช่องทาง (shared server lib)
6. `socialOrderIntake.ts` `buildCartSummaryFooter`: เติมบรรทัด scope หลังลิงก์ —
   "ℹ️ ลิงก์นี้พาเฉพาะรายการที่คุยกันในรอบนี้ — ของที่เพิ่มเองบนเว็บยังอยู่กับเว็บของคุณ (ในหน้าเว็บกดคัดลอกลิงก์ = พาตะกร้าเต็มไปด้วย)"
   (`cartFooterForMatch` R92 คงพฤติกรรม; `?s=` unchanged)
7. **Deploy `social-ai-worker` เท่านั้น** (importer เดียวของ intake footer — channel-webhook ใช้ `resolveKitchenPoint` อย่างเดียว) → เป็น mutating deploy, ต้องขอ owner approve ตอนรันจริง (Management API ตาม pattern เดิม)

### Phase 4 — เทสต์ + เกต + ปิดงานตามกฎ
8. อัปเดต/เพิ่มเทสต์:
   - `cartDeepLink.test.ts` — v2 round-trip, caps/downgrade, back-compat v1, double-encode
   - `r101CartHandoffFix.test.ts` — banner contract ใหม่ (live-cart at click + fallback chain + TTL + testids ครบ)
   - `socialOrderIntake.test.ts` + `socialAiContinuity.test.ts` — scope line ใน footer
   - ใหม่ `__tests__/fbCartBridgeLive.test.ts` — เคส owner: cartStore 4 บรรทัด/17 ชิ้น → encode v2 → decode → addItem ครบ mods/lm → จำนวน/ราคาตรง; เคสตะกร้าว่าง → fallback
9. เกต (ห้าม claim PASS โดยไม่เห็นผลจริง — เรียนจากรอบ 62): `npx tsc --noEmit` 0 error · `npm run lint` · `npm run test` (เห็น summary จบ) · `npm run build` · CI เขียว
10. ปิดตามกฎ: อัปเดต `AI_WORK_STATE.md` + `BMB_MASTER_STATUS.md` (ถ้ามีการเปลี่ยนสถานะ), commit เดียวต่อ phase, push เมื่อ owner อนุมัติ, ไม่แตะ docs อื่น

## กฎที่ห้ามละเมิด (จาก UNIVERSAL_MASTER_AI_RULES/AI_ENTRYPOINT)
- SOURCE OF TRUTH = Actual Code · No Evidence = Not Done · ห้าม doc-only PASS · 2 attempts/หัวข้อ
- ไม่แตะ intent:// ซ้ำ (R92) · ไม่ลบรายการ·เทสต์ที่ pin เดิมโดยไม่มีเหตุผลจากโค้ดจริง

## Validation plan (ต้องทดสอบจริงก่อนปิด — เคส 2 เครื่องของ owner)
1. เครื่อง A เปิดลิงก์ในแอปเฟซ → เพิ่มเมนูเองจน 4 บรรทัด/17 ชิ้น (รวม add-on) → กดคัดลอก → วางใน Chrome เครื่องเดียวกัน → `/cart` = 4 บรรทัด/17 ชิ้น/฿1,313 พร้อม add-ons ครบ
2. คอมเมนต์สั่ง 1 เมนู → ลิงก์ AI = รายการรอบนั้น + scope line → เปิดใน WebView → ตะกร้าเดิม + รายการใหม่
3. ลิงก์ v1 เก่า → decode ได้ปกติ · dismiss "เข้าใจแล้ว" คง TTL 24 ชม. + `?cart=` ใหม่ override
4. เกตข้อ 9 ผ่านครบพร้อม evidence แนบในผลงาน

## การตัดสินใจที่ยึดแล้ว (Owner เห็นแล้วแก้ได้ก่อนอนุมัติ)
- payload v2 ฝัง addOns ในลิงก์ (แนะนำ — เพราะ "ถูกต้องทุกแง่มุม") แทนการพา id+q อย่างเดียว
- server/account cart = ออกขอบเขต (สะพานนี้พอต่อกรณีเครื่องเดียวกัน เฟซ → เบราว์เซอร์)
- ปุ่มเดียว (คัดลอกลิงก์) รับหลัก live cart; ไม่เพิ่มปุ่มใหม่กันสับสน

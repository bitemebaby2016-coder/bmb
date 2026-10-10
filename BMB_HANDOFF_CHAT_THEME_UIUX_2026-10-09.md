# BMB — HANDOFF: ปรับปรุงธีม + UI/UX หน้าแชท (2026-10-09)

**ประเภท:** HANDOFF / WORK ORDER — ส่งต่อให้ AI/ทีมรอบถัดไปทำต่อ
**สั่งโดย:** Owner (คำสั่งแชท 2026-10-09: *"ค้างเรื่องที่ยังไม่เสร็จไว้ทั้งหมด สร้างแฮนด์ออฟไปปรับปรุงเรื่อง ธีม UI UX ใหม่ที่แชทหน้า"*)
**Repo:** `D:\A PROJECT\Bite Me Baby` (branch `main`) · HEAD ณ สั่งงาน = `f725ae4` (= origin/main, worktree clean, เหลือ worktree เดียว)
**อ่านก่อนเริ่ม:** `docs/BMB_STATUS_CLOSURE_2026-10-09.md` (สถานะรวม + §7 checklist งาน "ค้างไว้ทั้งหมด") · `BMB_HANDOFF_UXUI_2026-10-08.md` (แฮนด์ออฟ UX เดิม — **§0 ชื่อแบรนด์ถูกยกเลิก ใช้ §0 แถวนี้แทน**) · `.clinerules` §15.2 (gates + commit แยก feature/docs)

---

## 0. ขอบเขตและหลัก

- **งานนี้ = ธีม/UI/UX ของ "หน้าแชท" เท่านั้น** — ไฟล์หลัก: `src/components/ai/TalkToBite.tsx` (953 บรรทัด) · `src/index.css` (ส่วน chat/theater/theme) · `src/lib/theme.ts` (ถ้าจำเป็น) · คอมโพเนนต์ที่ mount: `App.tsx:165`, `TalkToBitePage.tsx:13`, `TalkToBiteHomePage.tsx:15`, `BiteMascot.tsx:307` (Floating Bite overlay)
- **งานอื่นที่ยังไม่เสร็จ = "ค้างไว้ทั้งหมด" ตามคำสั่ง Owner** — P0-1..4, P1-1..8, UX-1..5, tunnel/Omise/baseline/Meta ทั้งหลายใน closure doc §7 **ห้ามหยิบมาทำในรอบนี้** ถ้าขับไปเจอบั๊กนอกรายการ §3 → **รายงานก่อนแก้**
- **ชื่อแบรนด์ (กฎใหม่ — ยกเลิกแฮนด์ออฟ 10-08 §0 ที่เขียนว่า "ไท์มีเบบี้"):**
  - หน้าจอ = **"ไบ๊ท์"** / **"ไบ๊ท์มีเบบี้"** · เสียง TTS = **"ไบท"** (normalize ทุกรูปสะกดผ่าน `speakable()` TalkToBite.tsx:939-953 + `speakableText()` aiVoice.ts)
  - persona = "ครับ" เสมอ ไม่ใช่ "ค่ะ" · ที่มา: commit `70dea0e` + `src/lib/bitePersona.ts`
  - ห้ามมี "บิท" / "ไท์ (ไม่มี บ.)" / "บั๊บ" ใน UI string, label, aria, หรือ prompt ใด ๆ
- ภาษา UI = **ไทยเต็มรูปแบบ** (น้ำเสียงชุดเดิมกับ Login/Register) · ทุกไฟล์ UTF-8 ไม่มี mojibake (สแกนด้วย node script รอบก่อน)
- ทดสอบมือถือผ่าน **tunnel**: `npm run dev` + `ngrok http 3000` (หรือ `npx localtunnel --port 3000` — vite config ตั้งแล้ว)

## 1. หน้าแชทปัจจุบัน — แผนที่ (ณ `f725ae4`)

TalkToBite = component เดียว 2 phase × 3 mode: `mode="overlay|hero|home"` · phase `landing` (brand row + mascot + CTA 🎙) กับ `conversation` (header + messages + quick actions + voice bar)

| ส่วน | ไฟล์/บรรทัด | สถานะธีม 3 ชุด (ส้ม=ดีฟอลต์ไม่มี attribute / เทา / ดำ) |
|---|---|---|
| สลับธีมในแชท 2 จุด (emoji 🔴⚪🌙 + aria ไทย + `ttb-theme-toggle`) | TalkToBite 579-582 (landing), 683-684 (header บทสนทนา) | var-based ✓ · label = ส้ม/เทา/ดำ (`theme.ts:15-19`) |
| Backdrop `.ttb-backdrop` | index.css 1894-1916 | **ดีฟอลต์ (ธีมส้ม) = ไลลาเดอร์ม่วง** `#FFF→#A78BFA` + tint ขาว 0.55 · gray override 2028-2036 ✓ · dark 2037-2045 ✓ |
| ภาพลงทะเบียน `ai.chat_background` | `.ttb-backdrop__img` 1905-1911 (blur 22px) + tint ซ้อน | ภาพเดียวกันทุกธีม — tint แยกธีมแล้ว ✓ |
| ฟองข้อความ user / Bite | TalkToBite 726-729: user `bg-brand-primary text-white` · Bite `bg-brand-bg border-brand-border text-brand-text` | var-based ✓ ทั้ง 3 ธีม (ค่า gray: bg `#737373`, text `#FFFFFF`) |
| การ์ดออเดอร์ (draft) | 773+ `card bg-brand-surface` | var-based ✓ **แต่ 790 `text-amber-700` hardcode → ไม่รอดธีมเทา/ดำ** |
| typing chip "Bite กำลังพิมพ์…" | 806-808 `card bg-brand-bg border` | var-based ✓ |
| แถว Quick actions ในแชท | 817-833 `bg-brand-bg text-brand-accent hover:bg-brand-secondary` | var-based ✓ **แต่ hover ไปลง `#FBBF24` — ตัวหนังสือ accent ขาวบนเหลือง ≈1.7:1 (ธีมเทา/ดำ)** |
| แถบ input + ปุ่มส่ง | 837 `bg-white` + `.input` | `.bg-white` override: gray 1953 / dark 2001 ✓ |
| Voice bar (mic/⌨️/🔊🔇) | 864-909 `bg-brand-bg text-brand-accent` + `btn-primary` ตอนกำลังฟัง | var-based ✓ |
| Header gradient บทสนทนา / landing | 661 `to-white`, 699 `from-brand-bg/80 to-white` | `.to-white` override: gray 2022 / dark 2024 ✓ |
| Theater stage `/shop` (ทางเข้าแชท) + `.theater-strip` ในแชท | index.css tokens 1620-1642 (ส้มคืนแล้ว) | ตั้งใจเป็น "เวทีมืด" คงเดิมทุกธีม — ตรวจให้เข้าชุดกับ backdrop |
| ธีม gray/ดำ ทั้งระบบ | index.css 1932-1978 (gray) · 1980-2026 (dark) | ตัวแปร + override hardcode `bg-white`/`neutral-*`/`text-black`/gradient บางส่วน |

## 2. จุดเสี่ยงที่พบจากสแกน (evidence — ไม่ต้องหากใหม่)

| # | หลักฐาน | ปัญหา |
|---|---|---|
| F1 | TalkToBite **790** `text-amber-700` (#B45309) บน `card bg-brand-surface` (gray `#5E5E61`) | contrast ≈ **1.3:1** (แทบมองไม่เห็น) · dark ≈ 3.3:1 — ข้อความ "หมด/มีเฉพาะออเดอร์เก่า" อ่านไม่ออกในธีมเทา/ดำ |
| F2 | TalkToBite **829** `hover:bg-brand-secondary` (#FBBF24) + `text-brand-accent` (ขาวในธีมเทา/ดำ) | ตอน hover/chip ถูก activate → ขาวบนเหลือง ≈ **1.7:1** |
| F3 | bubble user **727** `bg-brand-primary text-white` (#F97316) | ขาวบนส้ม ≈ **2.9:1 < 4.5** — **เหมือนกันทุกธีมและเหมือน `btn-primary` ทั้งแอป** → ระดับแบรนด์ → **รายงาน Owner ห้ามแก้เอง** (นอกขอบเขต §0) |
| F4 | `.ttb-backdrop` base **1894-1916** = ม่วงไลลาเดอร์ | ค่าดีฟลอต (ธีมส้ม) ไม่เข้าโทนส้ม-ครีมของแบรนด์ — **ตั้งใจหรือไม่ → Owner ตัดสิน** (gray/dark มี override ส้มแล้ว 2028-2045) |
| F5 | กล่องข้อความ **719** ไม่มี `bg` ของตัวเอง | ฟองข้อความ/การ์ด นั่งบน backdrop (gradient/ภาพ `ai.chat_background`) โดยตรง — ต้องตรวจ separation อ่านออกทุกธีม × มี/ไม่มีภาพ |
| F6 | index.css gray มีแค่ `.to-white` 2022 + `.from-orange-50` 2023 | **gray ไม่มี `.from-white`/`.via-white`** (dark มี 2025-2026) — gradient utility ที่ยังไม่ถูก override พื้นที่อื่นจะหลุดในธีมเทา |
| F7 | แถว quick actions **817-833** `px-3 py-1.5 text-xs` | ความสูง ≈ 30px **< 44px** touch target มาตรฐานมือถือ |
| F8 | กล่องข้อความ **719** ไม่มี `aria-live` · typing/listening (806, 713, 905) เป็น visual ล้วน | screen reader ไม่ announce ข้อความ/สถานะใหม่ |
| F9 | `.quick-action` index.css **778-797** hardcode `rgba(255,255,255,0.85)` | **ไม่มี `.tsx` ไฟล์ไหนใช้ class นี้แล้ว** (BiteHero เดิม) = dead CSS — ล้างได้เฉพาะไฟล์ที่แตะอยู่ดี |
| F10 | auto-scroll ผ่าน `endRef` (719/810) · mascot `animate-float` 607 · listening `animate-pulse` 713 | ตรวจนโยกตอนคีย์บอร์ด iOS (visualViewport) + `prefers-reduced-motion` ต้องไม่ทำให้ตาม scroll ไม่ได้ |

## 3. งานที่สั่ง (เรียงลำดับทำ)

### CHAT-1 — เก็บกวาดสี hardcode ในหน้าแชทให้เข้าธีมครบ (P0)
- แก้ F1: `text-amber-700` (790) → ใช้ token/คลาสที่อ่านออกทุกธีม (เช่น สี warning ที่ไล่ตามธีม หรือ `text-brand-secondary` + ไอคอน) — **แตะเฉพาะสี ไม่แตะข้อความ/logic**
- แก้ F2: hover ของ quick chips (829) ห้ามเอา accent-ขาวไปลงบน `#FBBF24` — ปรับเป็น `bg-brand-bg`/ขอบส้ม หรือสลับข้อความเป็นสีเข้มเฉพาะตอน hover
- แก้ F6: เพิ่ม `.from-white`/`.via-white` override ให้ธีม gray (เทียบ dark 2025-2026)
- sweep `TalkToBite.tsx` + `.ttb-*`/chat sections ของ `index.css` หาค่าสี literal ที่เหลือทั้งหมด แล้วไล่เป็น var/token
- **Acceptance:** grep สี hardcode ในไฟล์เป้าหมาย = เหลือเฉพาะรายการที่มีหมายเหตุ "รอ Owner" (F3/F4) เท่านั้น

### CHAT-2 — Contrast pass 3 ธีม × หน้าแชท (P0)
- เช็คจริงทุก state: landing (brand row/greeting/CTA/quick actions/order-again) · conversation (header/ฟองข้อความ/สินค้า `theater-strip`/การ์ดออเดอร์/typing/แถวแอคชั่น/input/mic bar/listening hint)
- เกณฑ์: ข้อความปกติ ≥ 4.5:1 · large/UI ≥ 3:1 — จดค่าที่วัดได้ลงรายงาน
- F3 (ขาว-บน-ส้ม ระดับแบรนด์) → **บันทึกรายงาน ห้ามแก้ในงานนี้**
- **Acceptance:** ตาราง ธีม × จอ × ผ่าน/ไม่ผ่าน + ไฟล์:บรรทัดของทุกจุดที่แก้

### CHAT-3 — Backdrop + ภาพ `ai.chat_background` (P1)
- แก้/ยืนยัน F4 (ม่วงดีฟลอต): ถ้า Owner ไม่สั่งเปลี่ยน ให้แค่บันทึกเป็นข้อเสนอ
- F5: ตรวจ separation ของฟองข้อความบน backdrop ทุกธีม × (มีภาพ/ไม่มีภาพ) — ถ้าไม่พอ เสริม scrim/`backdrop-blur` บางเฉียบ **เฉพาะในโซนข้อความ** โดยไม่เปลี่ยน layout
- tint gray (2034-2036) / dark (2043-2045) กับภาพสว่าง → ยังอ่านออกไหม
- **Acceptance:** screenshot 6 ใบ (3 ธีม × มี/ไม่มีภาพ) + ค่า contrast ฟองข้อความ

### CHAT-4 — Mobile polish ของหน้าแชท (P1)
- F7: แถว quick actions + ปุ่ม mic/⌨️/🔊 ใน voice bar ≥ 44px จริงบนจอเล็ก
- safe-area ของแถบ input (837) เทียบกับ `.sticky-cart-bar` (index.css 1463) — กันขอบล่าง iPhone กลืนปุ่ม
- คีย์บอร์ด: input ถูกบังไหมตอนพิมพ์ (visualViewport / scroll กล่องข้อความ 719) · F10 stick-to-bottom เมื่อพิมพ์ยาว
- **Acceptance:** ทดสอบผ่าน tunnel จากมือถือจริง — รายงานจุดที่แก้ + screenshot ≥ 3 จอ (landing/พิมพ์/ฟัง)

### CHAT-5 — UX ตัวสลับธีมในแชท (P1)
- 2 จุด (579, 683) ทำหน้าที่เดียวกัน — ให้สัมผัส/ตำแหน่ง/label สอดคล้องกันทั้ง 2 phase; focus-visible + aria ครบ (ตอนนี้ aria ไทยดีอยู่แล้ว)
- Header หลักโดนทับบน `/` → ปุ่มในแชทเป็นที่พึ่งเดียว — **ห้ามลบออก** จนกว่าจะมีทางเข้าถึงธีมที่ดีกว่า
- ถ้าจะย้ายตำแหน่ง/เปลี่ยนเป็น segmented control → **เสนอ Owner ก่อน** (layout เปลี่ยน)
- **Acceptance:** สลับธีมจากทั้ง 2 จุดแล้วค่า `data-theme`/localStorage `bmb-theme` + meta `theme-color` ตรงกันทุกจุด

### CHAT-6 — States ครบชุดใน 3 ธีม (P2)
- typing chip (806) · listening ●●● (713, 904-907) · mic ปิด/เปิด (866-877) · 🔊/🔇 (891-901) · ปุ่มส่ง disabled (856) · hint "AI ยังตอบไม่ได้…" / empty state — เดิน checklist ว่าทุก state อ่านออกในส้ม/เทา/ดำ
- ไอคอนธีมเป็น emoji (🔴⚪🌙) — ใช้ได้ แต่ถ้าจะทำเป็น SVG/สวิตช์ที่สวยขึ้น → **เสนอ Owner**
- **Acceptance:** checklist state × 3 ธีม ครบ + ไม่มี state ใด hardcode สี

### CHAT-7 — Accessibility หน้าแชท (P2)
- F8: `aria-live="polite"` ที่กล่องข้อความ (719) · announce typing/listening
- focus order: theme toggle → CTA → quick actions → input → mic/🔊 · focus-visible ทุกปุ่ม
- `prefers-reduced-motion`: `animate-float`/`animate-pulse`/`theater-strip` สไลด์ — ปิดได้โดย state ยังใช้งานครบ
- **Acceptance:** ลองด้วย keyboard ล้วนบนหน้าแชทได้ครบเส้นทาง + screen reader อ่านข้อความใหม่ออก

### ข้อเสนอเสริม — **รอ Owner สั่ง ห้ามลุยเอง**
 redesign ฟองข้อความ / bubble สีใหม่ (ชน F3) · เปลี่ยน backdrop ดีฟลอต (F4) · couple ธีมกับ theater stage · เพิ่มสีธีมที่ 4 · ล้าง dead CSS `.quick-action` (F9) · speaking indicator ตอน TTS เล่า (แตะ state ใหม่)

## 4. เกตปิดงาน (ห้าม commit ก่อนผ่านครบ)

```
npx tsc --noEmit        → 0 error
npm run lint            → 0 error
npm test                → ทุกไฟล์ PASS (base ณ 2026-10-09 = 57 files / 609 tests — ห้ามลบ/ลด test เดิม;
                          test หน้าแชทอยู่ใน src/__tests__ ถ้าแก้ behavior ให้เพิ่ม test ใหม่ตามจุด)
npm run build           → PASS
node moji scan          → 0 bad lines (ทุก .ts/.tsx/.md ที่แตะ)
```
แล้ว commit **feature + docs แยก** → `git push origin main` → ยืนยัน `HEAD == origin/main` + worktree clean
(ค่า base ณ วันสั่งงาน: TSC=0 · LINT=0 · VITEST 57/609 · BUILD=0 รันครบ 2026-10-09 — ถ้าเลขเปลี่ยนเพราะงานอื่นแทรก ให้ report ไว้ก่อนไม่ใช่ของตัวเอง)

## 5. รายงานปิดงาน (เทมเพลต)

สรุปเป็นตาราง: **CHAT-1 … CHAT-7** → ทำอะไรบ้าง / ไฟล์+บรรทัด / acceptance ผ่าน? (มีหลักฐาน: ค่า contrast / screenshot / grep) / สิ่งที่พบเพิ่ม
- รายการใหม่นอกขอบเขต §0 (โดยเฉพาะ F3/F4 + บั๊กที่เจอระหว่างทาง) → แยกหัว **"ใหม่ — รอ Owner สั่ง"** ห้ามลุยเอง
- งานค้างอื่น ๆ (closure doc §7) ต้องยังคงสภาพ "ยังไม่ได้แตะ" — ห้ามแอบทำ/ปิดในรอบนี้

---
*สั่งงานโดย Owner 2026-10-09 · งานค้างทั้งหมดคงเดิมตาม `docs/BMB_STATUS_CLOSURE_2026-10-09.md` §7 · handoff นี้อ่านเข้าใจได้คนเดียวโดยไม่ต้องเปิดแชท*
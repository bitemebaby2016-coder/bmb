# BMB HANDOFF — AI Model Swap + Voice AI (AI-06) + DB Context Injection
**วันที่สร้าง:** 2026-10-01
**สถานะปัจจุบันที่ตรวจจริงแล้ว (verified จากโค้ด ไม่ใช่จากเอกสารเก่า):** §1
**เป้าหมาย:** ทำให้ครบ 3 งานที่ owner สั่ง — (1) เปลี่ยนโมเดล (2) Voice AI ต้องทำ ไม่ใช่ CANCELLED (3) Inject Context จาก DB — ให้ session ถัดไปทำต่อได้ทันทีโดยไม่ต้องสืบค้นใหม่
**กติกา:** ทุก item ต้อง VERIFY จริงก่อนปิด (tsc / vitest / build / ทดสอบในเบราว์เซอร์) — ห้ามเขียนว่าเสร็จโดยไม่มีหลักฐาน

---

## 1. สถานะปัจจุบันจริง (ตรวจจากโค้ดแล้ว)

### 1.1 โมเดล AI — ✅ อัปเดต 2026-10-01 (WS-1 ทำแล้ว): primary `qwen/qwen3.7-flash`, fallback `z-ai/glm-5.3-flash` ทุกจุด (aiModels.ts / ai-proxy DEFAULT_MODEL / .env / .env.local / .env.example); grep nemotron ใน config ใช้จริง = 0; tsc/vitest(331)/build ผ่าน. ค้าง: owner deploy ai-proxy + ทดสอบแชทจริง (WS-1 ข้อ 6-7)
- `src/lib/aiModels.ts`
  - บรรทัด 13: `MODEL_A_PRIMARY = 'nvidia/nemotron-3-ultra-550b-a55b:free'`
  - บรรทัด 14: `MODEL_A_FALLBACK = 'qwen/qwen3.7-flash'`
  - บรรทัด 21–23: `resolveModelA()` — `VITE_OPENROUTER_MODEL` เป็น override ถ้ามีค่า
- `src/lib/aiService.ts`
  - บรรทัด 11: `OPENROUTER_MODEL = resolveModelA(import.meta.env.VITE_OPENROUTER_MODEL)`
  - มี primary→fallback retry 1 ครั้งอยู่แล้ว (~บรรทัด 200)
- `supabase/functions/ai-proxy/index.ts`
  - บรรทัด 61: `DEFAULT_MODEL = 'nvidia/nemotron-3-ultra-550b-a55b:free'` (ใช้เมื่อ payload ไม่ส่ง model)
- Env จริง:
  - `.env` บรรทัด 7: `VITE_OPENROUTER_MODEL=openrouter/free` (commit ขึ้น git — ชนะทุกไฟล์อื่นตอน build บน Cloudflare Pages)
  - `.env.local`: ตั้งเป็น nemotron (ไม่ commit)
- **หมายเหตุสำคัญ:** env override ชนะ `MODEL_A_PRIMARY` — ตอนเปลี่ยนโมเดลต้องแก้ 3 จุดพร้อมกัน (aiModels.ts / .env* / ai-proxy DEFAULT_MODEL) ไม่งั้นแต่ละไฟล์ชี้คนละโมเดล

### 1.2 Voice (AI-06)
- **ไม่มีโค้ดเลยใน repo** — grep `speech|tts|voice|SpeechSynthesis|SpeechRecognition` ใน src/ = 0 ผลลัพธ์
- เอกสารเก่า (REALITY_MAP / AI_WORK_STATE) ระบุ CANCELLED — **owner แจ้งแล้วว่าไม่ยกเลิก ต้องทำให้ครบ** เอกสารเหล่านี้ต้องแก้สถานะใหม่หลังทำเสร็จ
- master plan (`bmb/docs/BMB_MASTER_EXECUTION_PLAN_2026-09-24.md`) กำหนดสถาปัตยกรรมไว้แล้ว: Voice → STT → AI → Authorized tools → TTS (Web Speech API + OpenRouter)
- `BiteMascot.tsx` โหลด `BiteAIChat` แบบ React.lazy (แตะ mascot ค่อยโหลด) — ปุ่มไมค์/ลำโพงควรอยู่ใน chat UI นี้ ไม่ใช่ mascot
- มี `src/pages/ai/AiChatPage.tsx` (หน้าแชทเต็มแบบมี AiAvatar) — เป็นจุดที่ 2 ที่ควรรองรับเสียง

### 1.3 Context / System Prompt
- `src/lib/aiService.ts` บรรทัด 13–36: `SYSTEM_PROMPT` คงที่ (บทบาทพนักงานเสิร์ฟ) — **ไม่ inject ข้อมูลจริงจาก DB เลย**
- มี UI-context pipe แล้ว: `useBiteAIStore.fullContext` ครอบ `[Context: ...]` หน้าข้อความผู้ใช้ (BiteAIChat.tsx บรรทัด 64) — เป็น context ระดับ session ไม่ใช่ข้อมูลเมนูจาก DB
- ai-proxy inject `GUARDRAIL_SEGMENT` server-side (บรรทัด ~168–170, read-only, กัน prompt injection) — ต้องรักษาไว้เสมอ
- มี tool calling แล้ว: `src/lib/aiToolCalling.ts` (`get_menu`, `get_order`, `get_product`, `get_reviews`, `get_categories`) — ใช้เป็นฐานต่อกับ context injection
- DB: Supabase + RLS (migration 077/078/100 เกี่ยว anon read mascots/brands) — การอ่านต้องผ่าน anon key + RLS เท่านั้น

### 1.4 สิ่งแวดล้อม
- Vite + React + TS + Tailwind; test: vitest (358 PASS ล่าสุด); tsc 0 errors
- Deploy: Cloudflare Pages; Edge Function: ai-proxy (Supabase, secrets: OPENROUTER_API_KEY)
- คำสั่งตรวจ: `npx tsc --noEmit`, `npx vitest run`, `npm run build`

---

## 2. งานที่ต้องทำ (Workstreams)

## WS-1: เปลี่ยนโมเดล — Primary = Qwen 3.7 Flash, Fallback = Z-AI GLM Flash ✅ DONE (2026-10-01)
**คำสั่ง owner:** โมเดลแรก `qwen/qwen3.7-flash`, โมเดลสำรอง z-ai / glm flash
**ผลยืนยัน id จริงบน openrouter.ai/api/v1/models (2026-10-01):** primary `qwen/qwen3.7-flash` ✅ มีจริง / fallback `z-ai/glm-5.3-flash` ✅ มีจริง (owner เขียน "glm 5.3 flash" ตรง id จริง — ยังมี `z-ai/glm-4.7-flash` เป็นเวอร์ชันเก่าถ้าจะอ้างอิง)
**ระวัง:** id บน OpenRouter ต้องยืนยันจริงก่อนใส่ (owner เขียน "glm 5.3 flash" — เช็ค openrouter.ai/models ก่อนแก้; ถ้าไม่มี 5.3 ให้ใช้ id ตระกูล `z-ai/glm-*-flash` ที่มีจริง และบันทึกเหตุผลไว้)

1. [x] ยืนยัน id โมเดล GLM บน openrouter.ai — DONE: `z-ai/glm-5.3-flash` (มีจริง, verified 2026-10-01)
2. [x] แก้ `src/lib/aiModels.ts`: primary → `qwen/qwen3.7-flash`, fallback → `z-ai/glm-5.3-flash`; คอมเมนต์ policy อัปเดต (2026-10-01) + เตือน keep-in-sync
3. [x] แก้ `supabase/functions/ai-proxy/index.ts` บรรทัด 61 `DEFAULT_MODEL` → `qwen/qwen3.7-flash`
4. [x] แก้ `.env`, `.env.local`, `.env.example`: `VITE_OPENROUTER_MODEL=qwen/qwen3.7-flash` (ลบ `openrouter/free` ทิ้งแล้วทุกไฟล์)
5. [x] grep `nemotron` ทั้ง repo (config ใช้จริง: src/, ai-proxy, .env*) = **0 hits**; แก้เพิ่มที่พบ: `aiVoice.ts` (default+fallback), `VoiceDemoPage.tsx` (UI copy), `api.test.ts:429-434` (assert โมเดลใหม่), `aiToolCalling.ts` (คอมเมนต์)
6. [x] deploy ai-proxy — DONE (owner deploy จริง 2026-10-01: "Deployed Functions on project ivkdfognyiwjcmrhcnwz: ai-proxy", script 6.0 kB)
7. [x] ทดสอบจริง — DONE (owner ยืนยันผลทดสอบ production 2026-10-01: "ok")
8. [x] verification 2026-10-01: `npx tsc --noEmit` = 0 errors ✅ / `npx vitest run` = 36 files, 331 tests passed ✅ / `npm run build` = PASS ✅
9. [x] อัปเดตเอกสาร: aiModels.ts header ✅, `.env.example` policy ✅, handoff นี้ ✅ — README ไม่มี mention โมเดลเก่า (grep = 0); AI_WORK_STATE/STATUS_TRACKER อยู่ใน docs/archive (ไม่ใช่ config ใช้จริง)

**Acceptance:** แชทจริงใช้ qwen เป็นหลัก, fail-over ไป GLM ทำงานจริง, tsc/vitest/build ผ่าน, ไม่มี nemotron หลงเหลือใน config ที่ใช้จริง

## WS-2: Voice AI (AI-06) — ✅ DONE (2026-10-01 code-level + owner ทดสอบจริงบน production แล้ว)
**ผลลัพธ์จริง (2026-10-01):**
- **2a โมเดลเสียง:** ใช้แผน B ตามกำหนด — STT/TTS ในเบราว์เซอร์ล้วน (Web Speech API) + AI ข้อความผ่าน ai-proxy (key server-side เท่านั้น) — OpenRouter ยังไม่มีโมเดลเสียง cloud ที่เหมาะ จึงบันทึก decision ไว้ (ไม่มี key รั่วฝั่ง client)
- **2b STT:** `aiVoice.ts` หุ้ม SpeechRecognition (th-TH, continuous, interim) + `isSpeechRecognitionSupported()` — เบราว์เซอร์ไม่รองรับ = ซ่อนปุ่มไมค์ พิมพ์ต่อได้ (BiteAIChat + AiChatPage)
- **2c TTS:** speechSynthesis + `speakableText()` ตัด markdown/emoji ก่อนพูด + barge-in (เริ่มพูดใหม่ = หยุดเสียง AI ทันที) + จำการตั้งค่า `bmb_voice_reply_enabled` (localStorage)
- **2d UX:** ปุ่มไมค์ (กดพูด/กดหยุด) + ปุ่มลำโพงเปิด/ปิดเสียงตอบ + สถานะ ฟัง/คิด/พูด ใน `BiteAIChat.tsx` และ `AiChatPage.tsx` (VoiceDemoPage มีอยู่ก่อนแล้ว)
- **2e prompt เสียง:** voice mode ส่ง `VOICE_MODE_DIRECTIVE` (ตอบสั้น 1-3 ประโยค ไม่มี markdown) — ประวัติเสียงเดิน `conversationHistory` ของ aiService ระบบเดียว (aiVoice.sendTextMessage → chatWithAI) ไม่คู่ขนาน; guardrail AI-02 ถูก ai-proxy inject server-side ครอบเสียงด้วยเสมอ
- **2f ทดสอบ:** `src/__tests__/aiVoice.test.ts` 10/10 PASS (mock Web Speech API: support fallback, speakableText, barge-in, pipeline เดียวกับ chat, error shape) — tsc 0 errors / vitest 38 files 351 tests / build PASS
- **ทดสอบจริง:** owner ทดสอบบน production แล้ว (2026-10-01: "ok") — STT/TTS/barge-in ผ่าน ai-proxy เวอร์ชัน deploy ล่าสุด

**WS-2a: โมเดลเสียงผ่าน OpenRouter**
- [ ] ค้นหา/ยืนยันโมเดลเสียงที่ OpenRouter มีจริง — ถ้ายังไม่มีตามต้อง ใช้แผน B: Web Speech API ล้วน (STT ในเบราว์เซอร์ + speechSynthesis ในเครื่อง) ฟรี ไม่เพิ่ม key; บันทึก decision พร้อมเหตุผล
- [ ] ถ้าใช้เสียง cloud: ห้ามเปิด key ฝั่ง client — ผ่าน Edge Function ใหม่/route ใน ai-proxy เท่านั้น (ตาม SEC-02)

**WS-2b: STT (เบราว์เซอร์)**
- [ ] สร้าง service layer ใหม่ใน src/lib (เช่น aiVoice.ts) หุ้ม `SpeechRecognition`/`webkitSpeechRecognition`: ภาษาไทย `th-TH` เริ่มต้น, รองรับต่อเนื่อง/หยุด/ผลลัพธ์กลาง
- [ ] กรณีไม่รองรับ (Firefox/บาง mobile): ซ่อนปุ่มไมค์ + ใช้พิมพ์ต่อได้ — ห้ามพัง UX เดิม
- [ ] ขอสิทธิ์ไมค์ถูกต้อง + สถานะ "กำลังฟัง..." ชัดเจน

**WS-2c: TTS (เบราว์เซอร์)**
- [ ] หุ้ม `speechSynthesis` ใน service เดียวกัน: เลือกเสียงไทยถ้ามี, ปุ่มเปิด/ปิดเสียงตอบ, หยุดพูดเมื่อผู้ใช้เริ่มพูดใหม่ (barge-in), จำการตั้งค่าไว้ (aiMemory/localStorage)
- [ ] กรองข้อความก่อนพูด: ตัด markdown/emoji/สัญลักษณ์ที่อ่านไม่ได้

**WS-2d: UX ใน chat**
- [ ] ผูกเข้า `BiteAIChat.tsx` (+ `AiChatPage.tsx` ถ้าต้องการ): ปุ่มไมค์ (กดพูด/หยุด), ปุ่มเปิด-ปิดเสียงตอบ, ตัวบอกสถานะ (ฟัง/คิด/พูด)
- [ ] โฟลว์เสียง: STT → ข้อความผู้ใช้ปกติ → chatWithAI → ตอบทั้งข้อความ + เสียง

**WS-2e: System prompt โหมดเสียง + context management**
- [ ] เมื่อโหมดเสียงเปิด: เพิ่มชั้น prompt ให้ตอบสั้น กระชับ เป็นประโยคพูด (ไม่มี markdown/ลิสต์ยาว) — guardrail เดิมครบถ้วน
- [ ] ประวัติเสียงเดินระบบเดียวกับ `conversationHistory` ของ aiService (จำกัด 10–11 ข้อความล่าสุดอยู่แล้ว) — ห้ามแยกระบบคู่ขนาน
- [ ] GUARDRAIL_SEGMENT ฝั่ง ai-proxy ต้องครอบเสียงด้วย: ห้ามพูดสัญญา ราคา/สต็อก/การชำระเงิน เหมือนโหมดข้อความ

**WS-2f: ทดสอบ + เอกสาร**
- [ ] vitest ครอบ: voice service (mock Web Speech API), fallback เมื่อไม่รองรับ, การกรองข้อความก่อนพูด
- [ ] ทดสอบจริงบน Chrome อย่างน้อย 1 รอบ: พูด → ตอบด้วยเสียง → barge-in ได้ (บันทึกอุปกรณ์ที่ทดสอบ)
- [ ] แก้สถานะเอกสาร: REALITY_MAP AI-06 → DONE, AI_WORK_STATE session ใหม่, master plan #25 → DONE
- [ ] tsc / vitest / build ผ่านทั้งหมด

**Acceptance:** แตะไมค์พูดได้จริงบนเบราว์เซอร์ที่รองรับ, ตอบด้วยเสียงได้จริง, ปิดเสียง/ไม่รองรับแล้วยังพิมพ์ได้ปกติ, ไม่มี key รั่วฝั่ง client

### WS-3: Inject Context จาก DB — ✅ DONE (2026-10-01 code-level + owner ทดสอบจริงบน production แล้ว)
**ผลลัพธ์จริง:**
- `src/lib/aiDbContext.ts` (NEW): ดึง products / product_categories / promotions / business_settings ผ่าน public client (anon + RLS, migration 097/100 grants ครบ) — ตารางไหน fail ข้ามได้โดยไม่พัง; ย่อเป็น context ≤3,500 chars + คำสั่งกันมโน "ตอบจาก context เท่านั้น ห้ามปรับราคาเอง"; cache TTL 7 นาที + `invalidateDbContext()`
- Inject ใน system message เดียว: `chatWithAI` / `chatWithAIStream` (aiService) รวม SYSTEM_PROMPT + LIVE STORE CONTEXT (UI) + DB CONTEXT — ค่าเริ่มรัน `chatWithAI(text)` ก็ได้ DB context อัตโนมัติ (BiteAIChat/AiChatPage ไม่ต้องแก้ caller)
- **แก้กับดัก slice ตามที่เตือนไว้:** client `trimForProxy()` คง system ไว้เสมอ + ai-proxy แยก filter system/non-system (`slice(-10)` ใหม่ไม่ตัด system message อีก); maxTokens 500 → 700 รองรับ context ยาว
- ทดสอบ: `src/__tests__/aiDbContext.test.ts` 10/10 PASS (mock supabase: กลุ่มเมนู, หมดวันนี้, โปรโมชัน, settings, cache/invalidate, fail-per-table, ทั้งหมดล้ม → '' กันมโน, cap ขนาด)
- **ทดสอบจริง:** owner ทดสอบบน production หลัง deploy ai-proxy (2026-10-01: "ok")

1. [ ] สร้าง context builder ใหม่ใน src/lib (เช่น aiDbContext.ts):
   - ดึงผ่าน client Supabase เดิม (anon key + RLS) — ตาราง: products (เฉพาะ is_available), categories, โปรโมชัน, business_settings (เวลาร้าน/โซนส่ง/วิธีชำระ), reviews ล่าสุดถ้าจำเป็น
   - ย่อเป็น context กระชับ (ชื่อ/ราคา/หมวด/สถานะ — ไม่ dump ทั้งตาราง) ในรูปแบบที่ model อ่านง่าย
2. [ ] วางใน system message — ทางเลือก A: client ส่งเป็น system ข้อความที่สอง (หลัง SYSTEM_PROMPT) ตอนเรียก chatWithAI; ทางเลือก B: ai-proxy ดึงเองด้วย service role — เริ่มด้วย A (ใช้ RLS เดิมได้) เก็บ B ไว้ถ้าต้องอ่านตารางที่ไม่เปิด RLS สาธารณะ
   - **ข้อจำกัด:** ai-proxy ตัด `messages.slice(-10)` — system message ที่สองต้องไม่โดนตัดทิ้ง (ตรวจตำแหน่ง index ก่อน merge)
3. [ ] Cache/ความสด: ดึงเมนู 1 ครั้งต่อการเปิดแชท/session (ไม่ query ทุกข้อความ), invalidate เมื่อเปลี่ยนหน้าเมนู/หมดอายุ ~5–10 นาที
4. [ ] ต่อยอด `aiToolCalling.ts`: tools ให้ชี้ข้อมูลชุดเดียวกับ context — กันคำตอบขัดกันเอง
5. [ ] กันมโนซ้ำ: prompt ต้องบอก model ว่า "ตอบจาก context เท่านั้น ถ้าไม่มีข้อมูลให้บอกตามจริง/แนะนำถามทางร้าน"
6. [ ] Token/งบ: จำกัดขนาด context (~≤1500 tokens) — maxTokens 500 เดิมอาจต้องขยับถ้า context ยาว
7. [ ] ทดสอบ: vitest (builder + mock supabase) + ทดสอบจริงถาม "มีอะไรขายวันนี้ / ราคา X เท่าไหร่" → คำตอบตรง DB
8. [ ] RLS: ยืนยันตารางที่อ่านเปิด anon read แล้ว (migration 100 ล่าสุด) — ถ้าขาด เขียน migration ใหม่ + deploy

**Acceptance:** คำตอบอ้างเมนู/ราคา/เวลาร้านจาก DB จริง, ไม่ query ถี่เกิน, RLS ไม่ถูกข้าม, tsc/vitest/build ผ่าน

---

## 3. ลำดับการทำ (แนะนำ)
1. WS-1 เปลี่ยนโมเดล (เล็ก เสร็จไว ลดความเสี่ยงชนกับงานอื่น)
2. WS-3 DB context (ปรับ aiService/ai-proxy ก่อน เพราะ WS-2 ขึ้นบนระบบเดียวกัน)
3. WS-2 Voice (ใหญ่สุด — ทำเมื่อระบบ model+context นิ่งแล้ว)
4. ปิดท้าย: อัปเดตเอกสารทุกฉบับให้สถานะเป็นจริง + เก็บหลักฐาน verification ใน AI_WORK_STATE.md

## 4. Checklist ก่อนปิด session ถัดไป
- [x] grep `nemotron` = 0 ใน config ที่ใช้จริง (2026-10-01 verified; เอกสาร archive เก่ายังมี — ไม่กระทบ runtime)
- [x] แชทจริงผ่าน qwen + fallback ไป GLM ทดสอบสำเร็จ (owner ยืนยัน 2026-10-01)
- [x] STT/TTS ทดสอบจริงในเบราว์เซอร์ผ่าน (owner ยืนยัน 2026-10-01: "ok")
- [x] คำถามที่ต้องใช้ข้อมูล DB ได้คำตอบตรงจริง (owner ยืนยัน 2026-10-01)
- [x] `npx tsc --noEmit` = 0 errors; `npx vitest run` = 38 files / 351 tests ผ่าน; `npm run build` = exit 0 (re-verify หลัง deploy 2026-10-01)
- [x] ai-proxy deploy แล้ว (owner, 2026-10-01); เอกสาร AI-06 เปลี่ยน CANCELLED → DONE พร้อมหลักฐาน

## 5. ความเสี่ยง / ข้อควรระวัง
**Bugfix เพิ่มเติม (owner report 2026-10-01 — เซคชั่นแอดมินใหม่):**
- อาการ: เซคชั่นใหม่ที่แอดมินเพิ่มไม่มีปุ่มเพิ่มลงตะกร้า + มีไอเทมหลุดเข้าเซคชั่น "จองล่วงหน้า — สั่งอาหารจันทบุรี"
- สาเหตุ 1: การ์ด showcase บนหน้าแรก (`CategorySections.ShowcaseCard`) ไม่เคยมีปุ่มตะกร้ามาตั้งแต่ออกแบบ → แก้: เพิ่มปุ่ม 🛒 เพิ่มลงตะกร้า / 📅 จองล่วงหน้า ผูกกับ flow เดิม (ผ่าน `onSameDay`/`onPreOrder` ของ HomePage) + ธง `isAvailable/sameDay/preorder` จาก `homeShowcase.ts`
- สาเหตุ 2: production probe ด้วย anon key พบ "permission denied for table menu_sections" (ACL drift — 097 ประกาศแต่ prod ไม่มี grant) → แก้ด้วย migration `101_menu_sections_anon_read.sql` (**ต้อง owner `supabase db push` ด้วย!**) ไม่งั้น guest เห็นเมนูไม่ครบตามเซคชั่นที่แอดมินสร้าง
- สาเหตุ 3: `getHomeProducts` (homeProviders.ts) สาย pre-order ไม่กรอง `is_available/archived` → สินค้า/โปรโมชั่น placeholder ที่ปิดขายแต่ติดธง pre-order หลุดขึ้น carousel จองล่วงหน้า → แก้: ทั้ง 2 โหมดต้อง `is_available && !archived`
- ทดสอบ: homeShowcase.test.ts เพิ่ม 2 case (ธง CTA + กัน leak) — รวม 38 ไฟล์ / 353 tests; tsc 0 errors; build exit 0
- id โมเดล GLM บน OpenRouter ต้องยืนยันจริงก่อนใช้ (ชื่อในคำสั่ง owner อาจไม่ตรง id จริง)
- Web Speech API รองรับเต็มบน Chrome/Edge — Firefox/iOS บางส่วนไม่รองรับ ต้องมี graceful fallback
- ถ้า OpenRouter ไม่มีโมเดลเสียงตามต้อง ให้ยึดแผน B (browser-only) และบันทึก decision ไว้
- `.env` ที่ commit ชนะ build บน Cloudflare Pages — แก้ไฟล์ + build env ให้สอดคล้องกัน
- ห้ามแตะระบบ auth/การเงิน: เสียงและ context เป็น read-only เท่านั้น (guardrail เดิมคงไว้)

## 6. วิธีเริ่ม session ถัดไป
บอก AI ว่า: "เปิดไฟล์ bmb/docs/BMB_HANDOFF_AI_VOICE_MODEL_CONTEXT_2026-10-01.md แล้วทำ WS-1 ต่อ โดยยึดสถานะใน §1"



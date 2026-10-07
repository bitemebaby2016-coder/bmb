# BMB — TALK TO BITE CONTEXT (ภาษาไทย)

> เอกสาร context/compression สำหรับ AI Dev เซสชันถัดไป — อ่านก่อนทำงานต่อเสมอ
> คู่กับ `BMB_TALK_TO_BITE_STATUS.md` + `BMB_PRODUCTION_MASTER_STATUS.md §14` + `BMB_HANDOFF_NEXT_SESSION_2026-10-07.md`

## 1. Project state / HEAD
- Repo: `D:\A PROJECT\Bite Me Baby` (branch `main`) — **search_codebase สแกน workspace copy เก่า `chat\bmb` ไม่ใช่ repo จริง** → ใช้ `run_commands`+`Get-Content` กับ D: เสมอ
- **HEAD (รอบนี้) = `ffdef88`** · `main == origin/main` · pushed ✅ · worktree clean
- baseline gates: TSC 0 / LINT 0 / VITEST 50 files 539 / BUILD 0
- Environment: Windows / React 19 + Vite 8 + Tailwind 4 + Zustand 5 + Supabase; node_modules พร้อม

## 2. Architecture decisions (รอบ Talk to Bite)
- **"Talk to Bite" = ประสบการณ์เดียว** แชร์คอมโพเนนต์ `TalkToBite.tsx` ตัวเดียวที่ 3 ทางเข้า: Homepage (`BiteHero`), Floating Bite (`BiteMascot`), หน้า `/talk-to-bite`
- ไม่สร้าง engine chat/voice/memory ใหม่ — reuse อันเดิม (`aiService`/`aiVoice`/`aiMemory`/`aiDbContext`/`cartStore`/`getProducts`/`getOrdersByCustomer`)
- `useBiteAIStore` เพิ่ม `biteState` (WELCOME/IDLE/LISTENING/THINKING/SPEAKING/RECOMMENDING/ORDER_DRAFT/ORDER_CONFIRM/SUCCESS/ERROR/GOODBYE) + `setBiteState`/`resetBite` — ระบบ state เดียว
- BottomNav เหลือ `Home | Menu | Orders | Account` (ถอด Bite ออก) — Floating เปิด TalkToBite
- `/ai-chat` ถูกแทนด้วย `/talk-to-bite` (public; guest ใช้ส่วนปลอดภัย, งานส่วนตัวขอ auth ในแชท); `/ai-chat` → redirect
- Floating Bite: ลากได้จริง + snap ขอบจอ + `SAFE_BOTTOM=96` (ไม่ทับ BottomNav) + จำตำแหน่ง key `bmb_talk_to_bite_pos`
- **หลักความจริง (authority):** ราคา/เมนู/availability = `getProducts`; order = `getOrdersByCustomer` (RLS-own); เพิ่มตะกร้า = `cartStore.addItem` เท่านั้น; ไม่ fake; ไม่ bypass security; `aiToolCalling` ยัง getter เท่านั้น

## 3. Files changed (รอบนี้)
- NEW: `src/lib/talkToBite.ts`, `src/components/ai/ProductCard.tsx`, `src/components/ai/TalkToBite.tsx`, `src/pages/TalkToBitePage.tsx`, `src/__tests__/talkToBite.test.ts`
- EDIT: `src/stores/useBiteAIStore.ts`, `src/components/home/BiteHero.tsx`, `src/components/ai/BiteMascot.tsx`, `src/components/layout/BottomNav.tsx`, `src/App.tsx`, `src/lib/homeProviders.ts`
- DELETE: `src/components/ai/BiteAIChat.tsx`, `src/pages/ai/AiChatPage.tsx`

## 4. Completed work (evidence)
- Gates ผ่าน: TSC 0 · LINT 0 · VITEST 50 files/539 · BUILD PASS
- TalkToBite: quick actions execute จริง (สั่งเหมือนเดิม/ช่วยเลือก/เช็กออเดอร์/ดูเมนู); menu card → cartStore; order draft + confirm; voice reuse; mind guest vs auth
- ลบ architecture chat ซ้ำ (BiteAIChat/AiChatPage)
- Homepage = Talk-to-Bite home; Floating drag/snap/safe-area/remember

## 5. Remaining / TODO / next step
- Owner ตรวจจริงบนเบราว์เซอร์/มือถือ (ลาก snap, voice autoplay, guest flow) — ยังไม่ยืนยันโดย Owner
- ต่อ memory: เรียก `hydrateMemoryFromServer(customer.id)` ใน `TalkToBite` ตอนเปิด เพื่อให้ Bite ทักชื่อ/ความชอบจาก verified data (ยังไม่ทำในรอบนี้)
- ส่วน `/admin/ai-studio` ยังแยก; ยังไม่รวม แต่ไม่กระทบรอบนี้
- `BiteAIChat.tsx`/`AiChatPage.tsx` ถูกลบ — ลิงก์เก่า `/ai-chat` redirect

## 6. Important constraints / gotchas
- ห้ามใช้ `Set-Content -Encoding utf8` ใน PowerShell กับไฟล์ .tsx/.ts ที่มีภาษาไทย (double-encode) → ใช้ editor tool หรือ `Set-Content` ที่ encoding ถูกต้องเท่านั้น
- ห้ามวาง React hooks ใต้นิยามฟังก์ชัน/ภายใน handler (Rules of Hooks) — `biteState`+drag hooks อยู่ที่ top-level ของ component
- อย่าแก้ `aiToolCalling.ts` ให้มี mutation tool (T-G5-16 ตรวจ source-level)
- `chatWithAI(text, undefined, { voiceMode })` — signature 2 args + options
- `pickTopAvailable` จัดเรียง deterministic (featured → name `localeCompare 'th'`)

## 7. Next exact step
เปิด `npm run dev` → ตรวจ 3 ทางเข้าประสบการณ์ Talk to Bite + voice/ลาก snap → รัน gates ซ้ำ → (ถ้าผ่าน) อัปเดต docs → commit → push → ยืนยัน `local HEAD == remote HEAD` แล้วบันทึก hash ใน status/context

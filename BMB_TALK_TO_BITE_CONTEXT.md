# BMB — TALK TO BITE CONTEXT (ภาษาไทย)

> เอกสาร context/compression สำหรับ AI Dev เซสชันถัดไป — อ่านก่อนทำงานต่อเสมอ
> คู่กับ `BMB_TALK_TO_BITE_STATUS.md` + `BMB_PRODUCTION_MASTER_STATUS.md §14` + `BMB_HANDOFF_NEXT_SESSION_2026-10-07.md`

## 1. Project state / HEAD
- Repo: `D:\A PROJECT\Bite Me Baby` (branch `main`) — **search_codebase สแกน workspace copy เก่า `chat\bmb` ไม่ใช่ repo จริง** → ใช้ `run_commands`+`Get-Content` กับ D: เสมอ
- **HEAD (รอบล่าสุด) = `4b3cc7b`** (`/` Landing เต็มจอ + Voice Bar) · `main == origin/main` · pushed ✅ · worktree clean
- baseline gates: TSC 0 / LINT 0 / VITEST 50 files **545** / BUILD 0
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
- **Round 9.1:** `talkToBite.ts` + (`getGreetingIndex`, `buildBiteGreeting` — 7-day rotation) · `TalkToBite.tsx` boot: `hydrateMemoryFromServer` → personalized greeting · `talkToBite.test.ts` +6 tests
- **Round 10:** `TalkToBite.tsx` เป็นเต็มจอ 2 เฟส (Landing → Conversation) ชุดเดียว; `mode=hero` (Home) / `overlay` (Floating `/talk-to-bite`); ลบ `BiteHero.tsx`; **ใหม่** `src/pages/admin/AdminAssetAudit.tsx` (read-only สินค้าขาดรูป + manifest มาสคอต) + nav item + route `/admin/asset-audit`

## 4. Completed work (evidence)
- Gates ผ่าน: TSC 0 · LINT 0 · VITEST 50 files/**545** · BUILD PASS
- TalkToBite: quick actions execute จริง (สั่งเหมือนเดิม/ช่วยเลือก/เช็กออเดอร์/ดูเมนู); menu card → cartStore; order draft + confirm; voice reuse; mind guest vs auth
- ลบ architecture chat ซ้ำ (BiteAIChat/AiChatPage)
- Homepage = Talk-to-Bite home; Floating drag/snap/safe-area/remember
- **Round 9.1:** ทักทายหมุน 7 วัน + ต่อ verified server memory (ชื่อ + หมวดที่ชอบ); guest = กรุ๊ปไม่มีชื่อ; กันอีเมลเป็นชื่อ; รูป = ใช้จริงเท่านั้น (ห้ามเจน) + placeholder `img-fallback`

## 5. Remaining / TODO / next step
- Owner ตรวจจริงบนเบราว์เซอร์/มือถือ (ลาก snap, voice autoplay, guest flow, ทักทาย 7 วัน) — ยังไม่ยืนยันโดย Owner
- ~~ต่อ memory → hydrate ในการทักทาย~~ ✅ **เสร็จแล้ว round 9.1** (อัปเดตจากเดิม)
- รูปสินค้าขาด → admin ใส่ใน Admin → สินค้า (เขียน `image_url`) ตาม STATUS §5 ชี้เป้า
- ส่วน `/admin/ai-studio` ยังแยก; ยังไม่รวม แต่ไม่กระทบรอบนี้
- `BiteAIChat.tsx`/`AiChatPage.tsx` ถูกลบ — ลิงก์เก่า `/ai-chat` redirect

## 6. Important constraints / gotchas
- **ห้าม AI เจนรูปเด็ดขาด** (owner ย้ำ) — ใช้รูปจริงจาก catalog `image_url` เท่านั้น; ไม่มีโค้ดเจนรูปใน src; placeholder = `img-fallback` (🍽️) ไม่ fake
- ห้ามใช้ `Set-Content -Encoding utf8` ใน PowerShell กับไฟล์ .tsx/.ts ที่มีภาษาไทย (double-encode) → ใช้ editor tool หรือ `Set-Content` ที่ encoding ถูกต้องเท่านั้น
- ห้ามวาง React hooks ใต้นิยามฟังก์ชัน/ภายใน handler (Rules of Hooks) — `biteState`+drag hooks อยู่ที่ top-level ของ component
- อย่าแก้ `aiToolCalling.ts` ให้มี mutation tool (T-G5-16 ตรวจ source-level)
- `chatWithAI(text, undefined, { voiceMode })` — signature 2 args + options
- `pickTopAvailable` จัดเรียง deterministic (featured → name `localeCompare 'th'`)
- `buildBiteGreeting` ใช้ `let base: string` (index จาก `as const` union) — อย่าถอด annotation กัน TS2332
- `getGreetingIndex` ใช้ `floor(getTime()/86400000)%7` — บวก +24h/+7d แน่ชัดทุก TZ; อย่าเขียน test ด้วย +12h (อาจข้าม midnight UTC)

## 7. Next exact step
เปิด `npm run dev` → ตรวจ 3 ทางเข้าประสบการณ์ Talk to Bite + voice/ลาก snap + ทักทาย 7 วัน (เปิดวันถัดไปเห็นข้อความเปลี่ยน) → รัน gates ซ้ำ → (ถ้าผ่าน) อัปเดต docs → commit → push → ยืนยัน `local HEAD == remote HEAD` แล้วบันทึก hash ใน status/context
## 8. Round 11 — เต็มจอ Landing `/` + Voice Bar + quick actions dynamic + memory
- `/` = `TalkToBiteHomePage` (full-screen Landing, ไม่มี store) · `HomePage` (store) ย้ายไป `/shop` · `เข้าสู่ร้าน →` → `/shop`
- `TalkToBite`: mode `'home'` + `landingClose`; Landing มาสคอต live + bubble; Conversation = **Voice Bar** (ปุ่มใหญ่ + `⌨️` สลับโหมดพิมพ์); quick actions + 🔥 ขายดี / ❤️ ของโปรด; สรุปออเดอร์ recap + "ดูออเดอร์ →"
- `talkToBite.ts`: `buildBiteGreeting.returning` (กลับมาแล้ว) + `pickFavoriteProducts`

## 9. DUPLICATION / งานซ้ำซ้อนทั่วโปรเจกต์ (audit ภาษาไทย — สรุป)
1. **Cart store คู่** — `src/store/cartStore.ts` (canonical, 9 importers) + `src/stores/useCartStore.ts` (100 บรรทัด, 3 importers: `BiteMascot`, `CartIsolationModal`, `cartIsolationStore.test`) — **เป็น delegating shim ที่ mirror canonical (ไม่มี state machine ซ้ำ)** → แนะนำค่อย ๆ migrate 3 ที่ไปใช้ `@/store/cartStore` แล้วลบ shim
2. **Dead exports** — `getBiteMessage`/`getBitePose` ใน `homeProviders.ts` ไม่มีใคร import แล้ว (หลังรอบ 10 เปลี่ยน Home เป็น TalkToBite) → dead code ควรลบ
3. **Hard-coded bubble กระจัดกระจาย** — default bubble "สวัสดีค่ะ น้อง Bite..." ใน `useBiteAIStore` ต่างจาก greeting ของ Talk to Bite (ครับ) → ควรให้ bubbling มาจากชุดเดียว
4. **AI chat** — ตอนนี้ **รวมเป็นหนึ่งแล้ว** (`TalkToBite` ใช้ที่ Home + /talk-to-bite + Floating) — `AiChatPage`/`BiteAIChat` ถูกลบ; ที่เหลือแยกเป็นเจตนา: `VoiceDemoPage` (Edge voice demo) + `/admin/ai-studio` (admin content) → ไม่ใช่ซ้ำ
5. **Voice/chat lib** — `chatWithAI` (31 refs) + `getAIVoiceService` (4 refs) เป็นโมดูลเดียว (canonical) → ถูกต้อง ไม่ซ้ำ
6. **Mascot** — `MascotBadge` (avatar reusable) vs `BiteMascot` (floating interactive) → คนละบทบาท ไม่ซ้ำ
> ข้อ 1–3 = improvement backlog (ไม่ด่วนทำในรอบนี้เพื่อความเสถียรของ gates)

## 10. Next exact step
เปิด `npm run dev` → ดู `/` (Landing เต็มจอ) → กด 🎙 คุยกับ Bite / quick actions → ดู Voice Bar + สรุปออเดอร์ + "ดูออเดอร์" → `/shop` เข้าร้าน → รัน gates → commit→push→verify
## 11. Round 12 — NL order + chat layout
- NL: `parseOrderIntent` + `applyOrderModify` ใน `talkToBite.ts` (pure, tested) · wire ใน `handleSend` (fallback `chatWithAI` ถ้าไม่ใช่ order intent)
- Layout: Bite Hero Area (mascot per state) + conversation scroll area + unified voice-first input; reuse เดิมทั้งหมด
- Gates: TSC 0 · LINT 0 · VITEST 50/553 · BUILD 0

## 12. Next exact step
`npm run dev` → `/` Landing → 🎙/พิมพ์ "เอาของเมื่อวาน แต่เปลี่ยนน้ำเป็นชาเขียว" → ดู draft เปลี่ยนจริง → [เพิ่มทั้งหมด] · เช็ค Bite Hero + scroll + keyboard

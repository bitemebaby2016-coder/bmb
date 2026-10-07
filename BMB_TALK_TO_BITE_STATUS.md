# BMB — TALK TO BITE STATUS (ภาษาไทย)

**ประเภทเอกสาร:** STATUS / TODO — สะท้อนสถานะโค้ดจริงหลัง Implementation Round "Talk to Bite"
**วันที่:** 2026-10-07 · **Repo:** `D:\A PROJECT\Bite Me Baby` (branch `main`)
**หมายเหตุ:** เอกสารภาษาไทย — code/identifier ตามมาตรฐาน project เดิม

---

## 1. Current HEAD / สถานะ

> อัปเดตค่าจริงหลัง commit ในตอนท้ายของรอบ (เดิม): HEAD = `56a43dc` (`main` = `origin/main`)

- Gates ปิดรอบ (หลังแก้) — **ผ่านจริง:**
  - `npx tsc --noEmit` = **0 error**
  - `npm run lint` = **0 error**
  - `npm test` (vitest) = **50 files / 539 tests PASS** (เดิม 527 + ใหม่ 12)
  - `npm run build` = **PASS** (client + PWA `injectManifest`)

---

## 2. งานที่ตรวจแล้ว (CHECKPOINT A — AUDIT ของจริง)

ของเดิมที่พบและนำมา reuse (ไม่สร้างระบบซ้ำ):

| ระบบเดิม | สถานะก่อน | การใช้ใน Talk to Bite |
|---|---|---|
| `src/lib/aiService.ts` — `chatWithAI(...)` | ใช้ได้แล้ว (ai-proxy, key server-side + DB context) | ใช้ต่อใน free-text |
| `src/lib/aiVoice.ts` — STT/TTS + autoplay-safe fallback | ใช้ได้แล้ว (Web Speech + ai-proxy transcribe + server TTS) | reuse ใน TalkToBite |
| `src/lib/aiMemory.ts` + `aiServerMemory.ts` (verified RPC `get_ai_memory`) | ใช้ได้แล้ว | backend ของหน่วยความจำ (ไม่ได้เขียนใหม่) |
| `src/lib/aiDbContext.ts` | menu/price/โปรโมชันจาก DB จริง + cache | ต่อกับ `chatWithAI` (ไม่แตะ) |
| `src/lib/bmbAdminApi_products.ts` — `getProducts()` | DB catalog จริง | แหล่งของเมนูการ์ด/แนะนำ |
| `src/lib/bmbAdminApi_orders.ts` — `getOrdersByCustomer()` | RLS-own order history จริง | แหล่งของ "สั่งเหมือนเดิม" / "เช็กออเดอร์" |
| `src/store/cartStore.ts` — `addItem()` | canonical cart (mode + isolation) | ทุกการเพิ่มลงตะกร้า |
| `src/components/MascotBadge.tsx` + `public/assets/mascot/*` | 24 pose | แสดงสถานะ Bite ผ่าน pose |
| `src/stores/useBiteAIStore.ts` | 4-Stage mascot | ขยายด้วย `biteState` (ไม่สร้าง store ใหม่) |

ของที่ซ้ำ/กระจัดกระจาย แล้วจัดการ:

- `AiChatPage.tsx` (`/ai-chat`, ProtectedRoute — guest ถูกบล็อก) — **ลบ** แล้ว แทนที่ด้วยหน้า `/talk-to-bite` (public)
- `BiteAIChat.tsx` (เปิดได้ส่วนบุคคล แยกจากร้าน) — **ลบ** (ไม่มี import อ้างอิงเหลือ)
- Bite ยังอยู่ใน BottomNav — **ถอดออก** → เหลือ `Home | Menu | Orders | Account`

---

## 3. สิ่งที่ทำแล้ว (CHECKPOINT B/C)

- **`src/lib/talkToBite.ts`** (ใหม่) — helper บริสุทธิ์: `BITE_STATES`/`isBiteState`/`chatStatusLabel`/`bitePoseForState`, `pickTopAvailable` (เลือกเมนูขายได้จาก DB จริง), `resolveOrderAgainFromOrder` (แปลออเดอร์จริง → draft จากราคา/availability ปัจจุบัน), `sumDraftTotal`
- **`src/components/ai/ProductCard.tsx`** (ใหม่) — การ์ดเมนูในบทสนทนา (ราคาจริง + เพิ่มลงตะกร้า)
- **`src/components/ai/TalkToBite.tsx`** (ใหม่) — **UI เชิงพาณิชย์บทสนทนาเดียว** ที่ใช้ร่วมกันทุกจุดเข้า:
  - Header: identity Bite + status state + จำนวนตะกร้า
  - ข้อความ Bite/ลูกค้า + typing
  - Quick actions ที่ execute จริง (ไม่ใช่แค่ใส่ input): สั่งเหมือนเดิม / ช่วยเลือก / ดูเมนู / เช็กออเดอร์ / เข้าสู่ระบบ
  - Menu card → `cartStore.addItem` (canonical)
  - Order draft → ยืนยันก่อนเพิ่ม → `cartStore.addItem`
  - Voice (STT/TTS) reuse `aiVoice`, autoplay-safe (แสดงข้อความเสมอ, พูดหลัง interaction)
  - Guest = เข้าได้ (ปลอดภัย), งานส่วนตัว (ออเดอร์เดิม/เช็กออเดอร์) = ขอ auth ภายในแชท
- **`src/stores/useBiteAIStore.ts`** — เพิ่ม `biteState` + `setBiteState`/`resetBite`; `closeChat` reset state (ระบบเดียว ไม่สร้าง state ซ้ำ)
- **`src/components/home/BiteHero.tsx`** — Homepage = Talk-to-Bite home: ปุ่มเปิด TalkToBite (auto recommend) แทน modal แชทเก่า; ดูเมนู/สั่งตรง ยังเข้าถึงได้ (Shop fallback)
- **`src/components/ai/BiteMascot.tsx`** — Floating Bite เปิด TalkToBite; **ลากได้จริง** + **snap ขอบจอ** + **ไม่มีทับ BottomNav/Cart (SAFE_BOTTOM)** + **จำตำแหน่ง** (`bmb_talk_to_bite_pos`) + safe area
- **`src/components/layout/BottomNav.tsx`** — เอา `/ai-chat` ออก → 4 items
- **`src/pages/TalkToBitePage.tsx`** + route `/talk-to-bite` (ใหม่, **public**) + `/ai-chat` → redirect ไป `/talk-to-bite`
- **`src/lib/homeProviders.ts`** — quick action `home-bite` ชี้ `/talk-to-bite`
- **ลบ** `BiteAIChat.tsx`, `AiChatPage.tsx` (ตัด architecture ซ้ำ)

---

## 4. Security / ไม่ fake

- เพิ่มตะกร้าทุกจุดผ่าน `cartStore.addItem` (canonical + mode isolation + `CartIsolationModal` ยืนยัน) — AI ไม่ bypass
- ราคา/เมนู/availability จาก `getProducts` (DB จริง) — ไม่ hard-code
- Order history อ่านผ่าน `getOrdersByCustomer` (RLS-own) — อ่านออเดอร์คนอื่นไม่ได้
- แนะนำ/สั่งซ้ำ ไม่สร้างจาก memory/fake — ตรวจ inventory กับ catalog จริง แล้ว report "หมด/ไม่มี" แยกจากรายการที่สั่งได้
- `aiToolCalling` ยังเป็น **อ่าน-เท่านั้น** (T-G5-16 ยังผ่าน) — ไม่เพิ่ม mutation tool
- ไม่ fake audio: voice ผ่าน `aiVoice` จริง, autoplay block → แสดงข้อความ/รอ interaction

---

## 5. ยังเหลือ / Known issues / Blockers

- ⏳ Owner ต้อง verify บนเครื่องจริง/เบราว์เซอร์จริง (UX runtime: ลาก snap, voice autoplay, guest flow) —**ยังไม่ถูกยืนยันโดย Owner** (AI ห้ามประกาศ PASS เอง)
- ⏳ `/admin/ai-studio` และหน้า AI อื่นของ admin ยังแยกจาก Talk to Bite (ไม่ได้รวมในรอบนี้)
- ℹ️ Memory ใช้ bridge เดิม (`aiServerMemory`); หน้าบทสนทนาใหม่ยังไม่ hydrate server memory ให้ "ทักชื่อได้" ทันที — เป็น next step ที่ชัดเจน
- ℹ️ `BiteAIChat.tsx`/`AiChatPage.tsx` ถูกลบแล้ว — ถ้ามีลิงก์/bookmark เก่า `/ai-chat` จะ redirect ไป `/talk-to-bite` อัตโนมัติ

---

## 6. Next action

1. Owner เปิด `npm run dev` → ตรวจ `/` (Talk-to-Bite home), Floating Bite (ลาก/snap), `/talk-to-bite` (guest), voice
2. ต่อเชื่อม memory: ใน `TalkToBite` เรียก `hydrateMemoryFromServer(customer.id)` เมื่อเปิดเพื่อให้ Bite ทักชื่อ/ความชอบจาก verified data
3. รัน verification ซ้ำ (gates เดิม) แล้วปิดรอบ/commit (ตาม Git Rule ในคำสั่ง)

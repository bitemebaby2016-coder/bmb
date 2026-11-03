# BMB — TALK TO BITE STATUS (ภาษาไทย)

**ประเภทเอกสาร:** STATUS / TODO — สะท้อนสถานะโค้ดจริงหลัง Implementation Round "Talk to Bite"
**วันที่:** 2026-10-07 · **Repo:** `D:\A PROJECT\Bite Me Baby` (branch `main`)
**หมายเหตุ:** เอกสารภาษาไทย — code/identifier ตามมาตรฐาน project เดิม

---

## 1. Current HEAD / สถานะ

- **HEAD (รอบล่าสุด) = `df4a621`** (`main` = `origin/main` — แก้ภาษา + ราก Omise)
- **Push:** ✅ `origin/main` แล้ว · `local == remote == df4a621` · worktree clean
- Gates ปิดรอบ (หลังแก้) — **ผ่านจริง:**
  - `npx tsc --noEmit` = **0 error**
  - `npm run lint` = **0 error**
  - `npm test` (vitest) = **50 files / 545 tests PASS** (เดิม 527 + ใหม่ 18)
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

## 5. รูปภาพ — ห้าม AI เจนรูปเด็ดขาด (ชี้เป้าให้แอดมิน)

- **กฎเหล็ก:** AI **ห้ามเจนรูปเองเด็ดขาด** — scan `src` ทั้งหมดแล้ว **ไม่มี**โค้ดเจนรูป (0 hits: `imagegen`/`replicate`/`stable-diffusion`/`dall-e`/`/v1/images` ฯลฯ) ทุกภาพที่โชว์เป็น **ของจริงเท่านั้น**
- **เมนูสินค้า:** `ProductCard` ใช้ `product.image_url` จาก admin catalog จริงเท่านั้น; สินค้าไหนยังไม่มีรูป → แสดง placeholder `img-fallback` (gradient + 🍽️) เป็นสัญลักษณ์ว่า "ยังไม่มีรูป" — **ไม่ fake / ไม่เจน**
- **ชี้เป้าให้แอดมิน (ของที่ขาด):** รูปสินค้าอยู่ที่ **Admin → สินค้า (inventory/products) → เพิ่มภาพ → save** (เขียน `image_url`) แล้ว Talk-to-Bite ฯลฯ จะดึงรูปจริงมาเอง; สินค้าที่ `image_url` ว่าง/ว่างหลัง จะโชว์ placeholder จนกว่าแอดมินจะใส่
- **มาสคอต Bite:** ตรวจแล้ว asset **ครบ** — `public/assets/mascot/*` มี 24 pose + `Bite_Main` + `bite_hero_greeting` ครบ (ใช้ผ่าน MascotBadge) → ไม่ต้องเจนเพิ่ม
- วิธีหา "สินค้าขาดรูป": ดูหน้า Admin สินค้า (ช่องรูปว่าง) หรือ query ตาราง `products` ที่ `image_url IS NULL`/'' แล้ว admin ตามไปใส่

## 5.1 การทักทาย — verified memory + หมุน 7 วัน (ใหม่รอบนี้)

- `getGreetingIndex()` = 0..6 **หมุนสลับทุกวัน** (7 แบบ ต่างกันในแต่ละวัน)
- `buildBiteGreeting({ index, name, favoriteCategory })` = รวม 7 ฐาน + ใส่**ชื่อ** (verified จาก server memory) + **หมวดที่ชอบ**; guest = แบบกรุ๊ปไม่มีชื่อ; **กันอีเมลเป็นชื่อ** (ไม่ทักด้วยอีเมล)
- **ต่อเชื่อม verified memory แล้ว:** `TalkToBite` ตอนเปิด → `hydrateMemoryFromServer(customer.id)` (ถ้า authed) → ทักทาย personalized ชุดเดียวทุกทางเข้า (Homepage / Floating / `/talk-to-bite`)
- `autoRecommend` ถูกเลื่อนให้รันหลังทักทายเสมอ และไม่รันซ้ำ (guard `autoRanRef`) — ลำดับข้อความถูกต้อง


## 6. ยังเหลือ / Known issues / Blockers

- ⏳ Owner ต้อง verify บนเครื่องจริง/เบราว์เซอร์จริง (UX runtime: ลาก snap, voice autoplay, guest flow, ทักทาย 7 วัน) —**ยังไม่ถูกยืนยันโดย Owner** (AI ห้ามประกาศ PASS เอง)
- ⏳ `/admin/ai-studio` และหน้า AI อื่นของ admin ยังแยกจาก Talk to Bite (ไม่ได้รวมในรอบนี้)
- ✅ Memory bridge (`aiServerMemory`) ถูกต่อเข้ากับทักทายแล้ว (round 9.1) — อัปเดตจากเดิม
- ℹ️ `BiteAIChat.tsx`/`AiChatPage.tsx` ถูกลบแล้ว — ถ้ามีลิงก์/bookmark เก่า `/ai-chat` จะ redirect ไป `/talk-to-bite` อัตโนมัติ

---

## 7. Next action

1. Owner เปิด `npm run dev` → ตรวจ `/` (Talk-to-Bite home), Floating Bite (ลาก/snap), `/talk-to-bite` (guest), voice, + ทักทาย 7 วัน (เปิดใหม่ทุกวันเจอข้อความต่างกัน)
2. รูปสินค้าขาด → admin ใส่ใน Admin → สินค้า (ตาม §5 ชี้เป้า)
3. รัน verification ซ้ำ (gates เดิม) แล้วปิดรอบ/commit (ตาม Git Rule ในคำสั่ง)
---

## 8. Round 10 — talk to bite เต็มจอ 2 เฟส + Admin Asset Audit (ล่าสุด)

### Talk to Bite → เต็มจอ (experience เดียว ไม่ใช่ 2 โปรเจกต์)
- `TalkToBite.tsx` redesign เป็น **เต็มจอ** มี 2 เฟสในคอมโพเนนต์เดียว:
  - **Landing ("Talk to Bite Home")**: แบรนด์ `BITE ME BABY` + มาสคอต (pose `greeting`) + ทักทาย 7 วัน (§5.1) + ปุ่มใหญ่ **"🎙 พูดกับ Bite"** (เริ่มฟัง mic เมื่อกด = user gesture) + chip [🔄 สั่งเหมือนเดิม][🍊 ช่วยเลือกให้หน่อย][🍽️ ดูเมนู] + **"เข้าสู่ร้าน →"**
  - **Conversation**: header `←` กลับหน้าแรก + "Talk to Bite" + 🛒 ตะกร้า; ข้อความ/การ์ดสินค้า/draft; mic + input
- `mode="hero"` → landing แสดง **inline บนหน้า Home `/`**; กดไหนก็เปิด conversation เป็น overlay **เต็มจอ** ทับทั้งแอป
- `mode="overlay"` (default) → ทั้งคอมโพเนนต์เป็นเลเยอร์เต็มจอ (Floating Bite / `/talk-to-bite`); Floating เปิดที่ `initialPhase="conversation"` แตะแล้วคุยได้เลย
- **ลบทิ้ง `BiteHero.tsx`** (แทนที่ด้วย Talk-to-Bite hero บน Home ตรง ๆ) — scan แล้วไม่มี ref เหลือ (เหลือแค่ comment ใน App.tsx)
- `HomePage` → `<TalkToBite mode="hero" />`; ลบ import/`getBiteMessage`/`getBitePose`|`biteMessage` ที่เลิกใช้
- ข้อ: ไม่ใช่ "landing เปล่า" ไม่ใช่ "chat box มายัดกลางจอ" — Landing+Conversation เป็นเฟสของ experience เดียวกัน เต็มจอ; ออกสนทนา → กลับ Land/Home + Floating Bite ตามเดิม

### Admin Asset Audit (read-only) — `/admin/asset-audit`
- 🔍 หน้าใหม่ **read-only**: การ์ดสรุป (สินค้าทั้งหมด / ขายได้ / ขาดรูป / ขายได้แต่ขาดรูป ⚠️)
- ตาราง "สินค้าขาดรูป" (`image_url` ว่าง) — **ชี้เป้าให้แอดมิน** พร้อมลิงก์ไป `/admin/products`; **ไม่เจนรูปเด็ดขาด** (image เดิมใน catalog เท่านั้น)
- manifest ไฟล์มาสคอต (24 pose) ให้ดูว่าใช้ไฟล์อะไรบ้าง
- เพิ่ม nav item `🔍 Asset Audit` (`src/lib/adminUi.ts`) + route `/admin/asset-audit` (AdminRoute)

### Gates (ผ่านจริง)
TSC 0 · LINT 0 · VITEST 50 files/**545** · BUILD 0 (PWA precache 134)

---

## 9. Round 11 — เต็มจอ Landing + Voice Bar + quick actions dynamic + memory (ล่าสุด)

### `/` = Talk to Bite Home เต็มจอ (ไม่มีแผง Store ช่วงล่าง)
- หน้าใหม่ **`src/pages/TalkToBiteHomePage.tsx`** → route `/` = **Landing เต็มจอ** (`<TalkToBite mode="home" landingClose={false}/>`) — ไม่มีแผง Store ข้างล่าง
- **Store Homepage ถูกย้ายไป `/shop`** (คงเนื้อหาทุกอย่างไว้) — เข้า via "เข้าสู่ร้าน →" → `/shop` หรือ BottomNav
- `TalkToBite` เพิ่ม mode `'home'` (fixed เต็มจอ + ซ่อน ✕ บน Landing) + prop `landingClose`
- Landing ใหม่: แบรนด์บน + **มาสคอต live ตาม state** (`bitePoseForState`) + bubble ทักทาย (7 วัน / "กลับมาแล้ว") + ปุ่มใหญ่ **"🎙 คุยกับ Bite ได้เลย"** + quick actions + "เข้าสู่ร้าน →"

### Voice First-Class (Voice Bar)
- Conversation เปลี่ยน input เล็ก → **Bite Voice Bar**: ปุ่มโค้งใหญ่ "🎙 คุยกับ Bite ได้เลย" (แตะ=ฟัง), ขณะฟังเปลี่ยนเป็น "● ● ● กำลังฟัง… แตะเพื่อหยุด" + แสดง live transcript
- มีปุ่ม `⌨️` สลับเป็นโหมดพิมพ์ (พิมพ์→ป้อนส่ง) + ปุ่มโหมดเสียงกลับ ยังใช้ `aiVoice` เดิม (STT/TTS)

### Quick Actions + dynamic
- Landing/Conversation: `🔄 สั่งเหมือนเดิม` · `✨ แนะนำให้หน่อย` · `🍽️ เมนูทั้งหมด` · **`🔥 ขายดีวันนี้`** (featured จริง) · **`❤️ ของโปรด`** (ถ้า authed — ใช้ `pickFavoriteProducts` จาก verified favorite category) · `📦 เช็กออเดอร์` · `🔐 เข้าสู่ระบบ` (guest)

### Bite จำคุณได้ (memory in UX)
- `buildBiteGreeting` + **`returning`** → 7 แบบ "กลับมาแล้ว/ Hey! กลับมาแล้ว 😎" สำหรับลูกค้าประจำ (evidence = `mem.total_orders>0`)
- `pickFavoriteProducts` ใหม่: ลำดับ favorite-category → featured → ชื่อ (deterministic)

### สรุปออเดอร์แบบพนักงาน + ตามหลัง
- draft เป็น "วันนี้ของคุณมี" recap + [เพิ่มทั้งหมด]; หลังยืนยัน Bite พูดยืนยัน + ปุ่ม **"ดูออเดอร์ →"** (msg `kind:'cta'`) → `/orders`

### Gates (ผ่านจริง)
TSC 0 · LINT 0 · VITEST 50 files/**549** (เพิ่ม 4) · BUILD 0

### ⚠️ ยังไม่ทำ (ขอบเขตถัดไป — ต้อง design กับ safe tool-calling)
- **"เข้าใจคำสั่งแบบคน" แบบเต็ม** เช่น "เอาของเมื่อวาน แต่เปลี่ยนน้ำเป็นชาเขียว" (ต้องการ LLM tool-call สรุปออเดอร์ + แก้สินค้า) — วางโครงแล้ว (`resolveOrderAgainFromOrder`) ยังไม่ทำ NL-modify
- จริง ๆ voice "ฟัง→คิด→ตอบเสียง" รอบนี้แกะ Voice Bar แล้ว แต่ auto-TTS reply ใช้ `aiVoice` (มีอยู่แล้ว)
---

## 10. Round 12 — NL order (เข้าใจสั่งแบบคน) + Chat Layout Framework

### NL-modify (WOW)
- **`talkToBite.ts`** เพิ่ม logic บริสุทธิ์ (test ได้ ไม่แตะ network):
  - `parseOrderIntent(text)` → จับ "สั่งเหมือนเดิม/เหมือนเมื่อวาน/ครั้งก่อน" (`likeBefore`) + ดึง `modifyFrom`/`modifyTo` จาก "เปลี่ยน X เป็น Y"
  - `applyOrderModify(order, catalog, intent)` → base = order-again จริง แล้ว swap รายการที่ match เป็นสินค้าจาก catalog จริง (fuzzy แบบ best-effort, ไม่ fake)
- **Wire เข้า `handleSend`**: พิมพ์/พูด "เอาของเมื่อวาน แต่เปลี่ยนน้ำเป็นชาเขียว" → Bite สรุปย้อน + ยก draft (ตรวจทาน + [เพิ่มทั้งหมด]); ไม่ถือว่า order intent → fallback `chatWithAI` ปกติ
- Cart mutation ยังผ่าน canonical `cartStore.addItem` (ความปลอดภัยคงเดิม)

### Chat Layout / Framework
- **Bite Hero Area** (Main chat): มาสคอตตาม state (bitePoseForState) + status + listening indicator — เป็น visual focal เหนือ conversation (compact ไม่ท่วมพื้นที่)
- Conversation เป็น **scroll area ชัดเจน** (flex-1 overflow-y-auto ภายใน container h-full — header/hero/input/actions เป็น shrink-0)
- Unified voice-first input อยู่ล่าง (voice bar + `⌨️` โหมดพิมพ์ + live transcript ตอนฟัง — ใช้ `aiVoice` จริง)
- Quick actions  горизонтал scroll ใกล้ input (real actions)
- reuse: `useBiteAIStore`/`aiVoice`/`aiMemory`/`ProductCard`/`cartStore` เดิม — **ไม่สร้าง chat system ซ้ำ**

### Gates (ผ่านจริง)
TSC 0 · LINT 0 · VITEST 50 files/**553** (เพิ่ม 4) · BUILD 0

### ยังเหลือ (next)
- NL "ไม่เผ็ด/เพิ่มไข่" (customization flag) ต่อจาก swap — โครงพร้อม, ยังไม่ทำ
- auto-TTS reply เต็ม voice loop (ตอบเสียงอัตโนมัติหลัง draft) — ใช้ `aiVoice` ได้ต่อ
---

## 11. Round 13 — NL customize (flag → item note) + Auto-TTS loop + Automation audit

### NL customize → item note
- `talkToBite.ts`: เพิ่ม `extractCustomizers(text)` — จับ phrase "เพิ่ม X / ไม่ X" เป็น plain-note map (Thai block) + `attachCustomizersToDraft(draft, customizers, targetId?)` — ผูก note + customizations map เข้า line ที่เลือก
- ต่อ end-to-end: `tryOrderIntent` ผูก customizers เข้า line ที่ swap/replace; draft card แสดง note (`ttb-draft-note`); `confirmDraft` → `cartStore.addItem(p, qty, line.customizations)` — ลง `order_items.customizations` (jsonb) จริง ไม่ fake
- Tests: attach mechanics ×3 + parse empty ×1 → VITEST 50/557

### Auto-TTS full voice loop
- `pushAssistant` auto-speak ทุก reply เมื่อ voice เปิด (text แสดงเสมอ — ไม่มี autoplay ตอนเข้า)
- Voice default ON; voiceRef โหลดได้แม้ไม่มี mic (TTS-only) ผ่าน `if(!micSupported && !ttsSupported) return`
- ปุ่ม 🔇/🔊 ยังใช้ได้ ไม่ double-speak (ลบ speak เก่าใน `handleSend`)

### Automation audit handoff
- `docs/BMB_HANDOFF_AI_AUTOMOTION_AUDIT_2026-10-07.md` — DONE/PARTIAL/NOT-DONE + checklist ถึง 100%

### Gates (ผ่านจริง)
TSC 0 · LINT 0 · VITEST 50 files/557 · BUILD 0

### ยังเหลือ (ดู handoff)
1. canonical keys ↔ Thai table (extra_egg/spicy/no_ice) — ตอนนี้ generic อย่างเดียว
2. ต่อ customizations เก่าเข้า order-again
3. Continuous-listen หลัง reply (policy-safe) · E2E
4. ลบ dead `getBiteMessage`/`getBitePose` · migrate `useCartStore` shim
---

## 12. Round 14 — แก้ภาษาพัง + ราก Omise (Stripe→Omise, TEST MODE)

### แก้ภาษาทั้งหมด
- รอบก่อนเอกสารไทยพัง (encoding/mojibake) — เขียนใหม่ทั้งหมด: `BMB_HANDOFF_AI_AUTOMOTION_AUDIT_2026-10-07.md` (ลบ+แทนของเก่า) · STATUS §11 · CONTEXT §13 — ตรวจแล้วไทยสะอาด

### ราก Omise (ยังไม่ switch live — cutover = next chat ตาม handoff §5)
- `.env.local` (gitignored): `OMISE_PUBLISHED_API_KEY_TEST_MODE` + `OMISE_SECRET_API_KEY_TEST_MODE` (owner วาง test key จริงแทน placeholder)
- `.env.example` บันทึกชื่อตัวแปร
- `vite.config.ts`: `envPrefix: ['VITE_', 'OMISE_PUBLISHED_API_KEY_TEST_MODE']` (ชื่อไม่มี VITE_ prefix → whitelist ให้ client อ่านได้)
- `src/lib/omise.ts`: config client-safe (`omiseConfig`/`isOmiseConfigured`/`omiseIsTestMode`) + seam `omise-checkout` — ไม่แตะ secret (server only)
- `src/__tests__/omise.test.ts`: 4 tests
- **Stripe path เดิมยังใช้ได้** — card checkout ทำงานต่อจนกว่า cutover เสร็จ

### Gates (ผ่านจริง)
TSC 0 · LINT 0 · VITEST 51 files/561 · BUILD 0

---

## 13. Round 15 — Omise cutover เต็มเส้น (code + EF + tests + deploy)

### EF ใหม่ 3 ตัว (mirror pattern เดิมเป๊ะ · deploy แล้ว + probe ผ่าน)
- **`omise-checkout`** (JWT on): ตรวจ JWT → สั่งออเดอร์ผ่าน token ผู้ใช้ (RLS) → **amount re-derive จาก `orders.total_amount` เสมอ** → single-open-intent guard (กัน charge ซ้ำ, reuse `pi-chrg_*` เดิม) → เรียก Omise Charges API (Basic auth ด้วย secret key ฝั่ง server เท่านั้น) → insert `payment_intents` (provider=omise, `payment_intent_id=NULL` ให้ webhook เป็นคนเขียน — ตาม contract RPC เดิม 010) → คืน `charge_id`/`authorize_uri`/`charge_status`
- **`omise-webhook`** (no-verify-jwt): ตรวจ `Omise-Signature` (t/v1 = HMAC-SHA256 ของ `ts.payload`, constant-time + กรอบ 300 วิ) → `charge.complete` → `record_payment_result` (idempotent + amount-match RPC เดิม ไม่ต้องแตะ migration) → `refund.complete` → sync ledger (`refund_ids`/`refunded_total_minor` + `orders.payment_status`) แบบ mirror stripe-webhook
- **`omise-refund`** (JWT on): ตรวจ `is_admin()` → เลือก intent ที่ `provider='omise'` → ledger guard (ไม่เกินยอดที่เคย charge) → เรียก Omise Refunds API → persist ผล (idempotency key `bmb-omise-refund-<order>-<minor>`)
- Probe production จริง: `GET omise-webhook → 200 ok` · `GET checkout/refund → 401 JWT` · `POST webhook ไร้ signature → 500 ERR_WEBHOOK_NOT_CONFIGURED` (จะผ่านเมื่อตั้ง secret) — **3/3 ตรงออกแบบ**

### Client (env-driven สลับกลับ Stripe ได้ ไม่พังกลางทาง)
- `paymentGateway`: `PaymentProvider` + `'omise'` · `createCheckout(orderNumber, {cardToken})` → invoke `omise-checkout` เมื่อ `isOmiseConfigured()` (คีย์ placeholder → fallback Stripe เดิมอัตโนมัติ) · `createPaymentIntent` ฝั่ง omise คืน pending UI-only **ไม่เขียนแถวอะไรจาก browser**
- `CardPaymentForm`: branch ใหม่ `OmiseCardForm` — กรอกบัตร → `omiseCreateCardToken` (Omise.js ตรงจาก browser, PCI อยู่ที่ Omise) → `omise-checkout` → ถ้า `pending`+`authorize_uri` → redirect 3DS แล้วกลับ `/payment/:order` (ผลจริงให้ webhook บันทึก) · Stripe เดิมอยู่ครบเป็น fallback
- `PaymentConfirmationPage` label `(Omise)`/`(Stripe)` ตามคีย์ · `stripeRefundOrder` เลือก `omise-refund`/`stripe-refund` ตาม `payment_intents.provider`

### Tests ใหม่ 4 ไฟล์ (+28)
`omiseWebhookSignature` (t/v1 HMAC + replay window + importKey guard) · `omiseRefundLogic` (ledger/idempotency/provider filter) · `omiseCheckoutLogic` (satang/return_uri/guard/ reuse decisions) · `omiseCutover` (paymentGateway omise path + fallback + money-out refusal) — **stripe tests เดิมคงไว้** ทดสอบ fallback path

### Gates (ผ่านจริง)
TSC 0 · LINT 0 · VITEST **55 files/589** (+4/+28) · BUILD 0

### ✅ Owner action ทำครบแล้ว (รอบ 15 ต่อ) — secrets set + runtime probes ผ่าน 3/3
1. **คีย์จริง + webhook secret วางแล้ว** — เจ้าของตั้งชื่อ `OMISE_WEBHOOK_SECRET_API_KEY_TEST_MODE` ตาม convention `_TEST_MODE` → EF แก้ให้อ่านชื่อนี้ก่อน (fallback `OMISE_WEBHOOK_SECRET`) + deploy ใหม่ · `supabase secrets set` ทั้งคู่ exit 0 · sync `supabase/secrets.local.env`
2. **Runtime probes production ผ่าน 3/3**: ไม่มี signature → `400 ERR_INVALID_SIGNATURE` (secret ทำงาน — ก่อนหน้าเป็น 500) · signature ถูกต้อง (order ปลอม) → **ผ่าน HMAC → เรียก RPC `record_payment_result` → 400 ERR_ORDER_NOT_FOUND** (chain ครบ ไม่มี side effect) · Omise API `GET /charges` → **200** (secret key ใช้ได้จริง)
3. **Leak check dist**: `pkey_test_` (client-safe, จำเป็น) มี · `skey_test_` / webhook secret / placeholder = **0** ✅
4. บันทึกบั๊ก: probe แรกพลาดเพราะ **`Get-Date -UFormat %s` ของ Windows PowerShell 5.1 คืน epoch ผิด +7 ชม. (25,200 วิ)** — ใช้ `[DateTimeOffset]::Now.ToUnixTimeSeconds()` แทน · ฝั่ง EF ไม่มีปัญหา
5. Gates รันซ้ำผ่าน: TSC 0 · LINT 0 · VITEST 55/589 · BUILD 0

### ⬜ เหลือขั้นเดียว: ทดสอบจ่ายบัตร test ใน browser (handoff §8) → ผ่านแล้วค่อยขอ live key (รอบหลัง)


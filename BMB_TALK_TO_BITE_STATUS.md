# BMB — TALK TO BITE STATUS (ภาษาไทย)

**ประเภทเอกสาร:** STATUS / TODO — สะท้อนสถานะโค้ดจริงหลัง Implementation Round "Talk to Bite"
**วันที่:** 2026-10-07 · **Repo:** `D:\A PROJECT\Bite Me Baby` (branch `main`)
**หมายเหตุ:** เอกสารภาษาไทย — code/identifier ตามมาตรฐาน project เดิม

---

## 1. Current HEAD / สถานะ

- **HEAD (รอบล่าสุด) = `162d319`** (`main` = `origin/main` — NL order + chat layout)
- **Push:** ✅ `origin/main` แล้ว · `local == remote == 162d319` · worktree clean
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

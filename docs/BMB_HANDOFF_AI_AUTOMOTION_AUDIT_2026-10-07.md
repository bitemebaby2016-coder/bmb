# BMB — AI Automation Audit + Handoff (2026-10-07)

> ส्थанаю: **AUDIT + HANDOFF** สำหรับพัฒนระบบให้ครบต่อไป
> รೌrém: `main == origin/main` · HEAD = Round 12 (NL order + customize + auto-TTS + chat layout)
> เอกنامهนี้เป็นจุดออกเดิน — อلاً implement ใหม่โดยออ่านฉส่านนี้ครบก่อน

---

## 1. ขอบเขต ("AI Automation" ในระบบนี้)

สองชั้นที่ควรแщщ претелить ต่างกัน:

### ชั้น A — AI-Waiter (Talk to Bite) · ได้ audit ครบใน repo นี้
- Unified AI-waiter (Bite) เดียวครอบทุกประสบями: Landing → Conversation, voice-first, memory, recommendation, order-again, NL re-order + customize.
- **ไฟล์หลัก:** `src/components/ai/TalkToBite.tsx` · `src/lib/talkToBite.ts` (pure logic) · `src/stores/useBiteAIStore.ts` · `src/lib/aiService/aiVoice/aiMemory/aiServerMemory` · `src/components/ai/ProductCard/BiteMascot` · `src/pages/TalkToBiteHomePage.tsx`
- เข้าถึงหน้า: `/` (landing), `/talk-to-bite`, Floating Bite, AdminAssetAudit `/admin/asset-audit`.

### ชั้น B — Operational automations (ระบบข้างที่ AI включит)
- **Inventory auto-deduct** — `supabase/migrations/026_inventory_aggregate_fix.sql`, `inventory_transactions`
- **Kitchen auto-queue** — `kitchenService` / `kitchenControl` (`kitchenItemLines`)
- **Delivery auto-dispatch** — `deliveryRouter` / `delivery_assignments` (020 bite-drive)
- **Availability Engine** — `availabilityEngine` (same_day / preorder)
- **Stripe webhook idempotent** — `stripeRefundLogic`
- **SMS transport** — `smsTransport`

---

## 2. สถанаção (DONE / PARTIAL / NOT DONE)

### ✅ DONE — มีหลักฐาน (test/build/git)

| Item | File | Evidence |
|---|---|---|
| Unified Talk-to-Bite (ระบบเดียว ไม่มี chat คู่ขนาน) | `TalkToBite.tsx` mode `home`/`overlay` + Floating Bite | legacy `BiteAIChat`/`AiChatPage` ลбแล้ว; Round 9 |
| 7-day rotating greeting + verified server-memory | `buildBiteGreeting`/`getGreetingIndex` + `aiServerMemory` | Round 9.1; `talkToBite.test` |
| Full-screen Landing → Conversation + Bite Hero (mascot per state) | `TalkToBiteHomePage.tsx` + hero area | Round 10–12; BUILD pass |
| Voice-first (mic STT + visualizer + 🎙/⌨️) + TTS reply | `aiVoice.ts` + TalkToBite input | `aiVoice.test` 10/10; WS-2 docs |
| **NL re-order** ("เอเหมือนเมื่อววัน") | `parseOrderIntent` + `resolveOrderAgainFromOrder` | Round 12 |
| **NL modify** ("เปลี่ยน X เป็น Y") | `applyOrderModify` | Round 12 |
| **NL customize → item note** ("เพิ่ม…", "ไม่…" → note + cart customizations) | `extractCustomizers` + `attachCustomizersToDraft` → `cartStore.addItem(p,q,customizations)` | Round 12 (ใหม่); 4 tests |
| **Auto-TTS reply loop** (ทุก Bite reply voiced + text ทั้ง) | `pushAssistant` auto-speak (voice-first default) | Round 12 (ใหม่) |
| Quick actions execute จริง (order-again/recommend/menu/bestsellers/favorites) | TalkToBite handlers | Round 11 |
| Data authority: `getProducts`/`getOrdersByCustomer`/`cartStore.addItem` | ทุกชั้น | no fake data |
| No AI image-gen (0 hits) | grep | Round 9.1–11 |
| Gates green | `tsc 0 · lint 0 · vitest 50/557 · build 0` | ✅ |
### ⚠️ PARTIAL — มีพื้นฐาน แต่ยังไม่ครบไ
| Item | สтая тутой | ที่เหลือต้องทำ |
|---|---|---|
| **NL customize vocabulary** — сейчас только Thai-block generic ("เพิ่ม X / не X" → plain note) | พimынth scalar | เพิ่มตانىلە شناخت canonical keys ↔ Thai (extra_egg/spicy/mild/hot/nões_ice) как kitchenControl ожидает `{extra_egg:true, spicy:'Mild'}` |
| **Voice loop "full"** — auto-TTS есть, но голоmic re-listen нет (user должен тапать 🎙 каждый раз) | Частично | optional "listen again after reply" (policy-safe, никак auto-opens mic) |
| Recommendation — deterministic heuristics (featured/favorite/name) | Base готовь | Добависть real-based trend ("что покупают в час X") из заказов |
| Order-again **не переносят** прошлые `customizations` (только product+qty) | Поряд | Добависть копирование extra_egg/spicy из прошлого в draft line |
| E2E для Talk-to-Bite | Нет | Добависть Playwright/E2E flow |
| NL multi-step / clarification | Ядро rule-based | Если тянуться к LLM semantics — нужен safe tool-calling (ниже) |

### ❌ NOT DONE — никогда ещё
1. **LLM safe tool-calling** для сложных NL фраз (design не начат).
2. **Continuous-listen loop** (после reply спрашивать "что ещё?" без авто-mic — permission).
3. **Real-based тренд-ранking** рекомендаций (не эвристика).
4. **Canonical customization mapping table** (только generic сейчас).
5. **E2E-browser automation** для всего waiter flow.
6. **Running assistant без gesture** (autoplay) — **deliberately НЕ** (policy: никогда autoplay voice).

---

## 3. Принципы — не нарушить при достройке
1. **Один chat engine** — всё через `TalkToBite` + `useBiteAIStore.biteState`.
2. **Данные только жирные** — menu `getProducts`, history `getOrdersByCustomer`, cart `cartStore.addItem`.
3. **No AI image-gen** (0 hits) — только `image_url` + `img-fallback`.
4. **Customization → real jsonb** — `cartStore.addItem(product, qty, customizations)`, как kitchenControl уже сетки.
5. **Voice: subtitles always, autoplay never** — TTS работает даже когда mic нет (`ttsSupported` guard).
6. **RLS/security** — клиент не посылает price; `aiToolCalling` getters-only.

---

## 4. Чек-лист "до 100%"
### 4.1 NL (высокий)
- [ ] Таблица canonical keys ↔ Thai (extra_egg/spicy/nões_ice) и перенос в cart customizations.
- [ ] Перенос прошлых customizations в order-again.
- [ ] Safe LLM tool-calling design (schema действий, allowlist, no-mutation).
### 4.2 Голос (высокий)
- [ ] Continuous-listen (со спросом, без авто-mic).
- [ ] Voice states в Bite Hero (`error`/`device`).
- [ ] Voice E2E (mock).
### 4.3 Рекомендация (средний)
- [ ] Real-based "что покупают в час X".
### 4.4 Тесты (высокий)
- [ ] E2E: landing → conversation → order-again → customize → add → checkout.
- [ ] Интегр: NL → `customizations` доходит до `order_items.customizations` (SQL).
### 4.5 Мелко (низкий)
- [ ] Удалить dead exports (`getBiteMessage`/`getBitePose` в `homeProviders.ts`).
- [ ] Мигрировать `useCartStore` shim → canonical `cartStore` (3 импортера).

---

## 5. Owner action — проверь сам
```bash
npm run dev
```
1. `/` Landing → Bite → conversation.
2. `Эเหมือนเมื่อว라는` → draft (order-again).
3. `Эเหมือนเมื่อว이라는 의เปลี่ยนน้ำ이 pneumonia` → draft с заменой.
4. `เพิ่ม пропуска` в order → draft note + add to cart → checkout → customizations в БД.
5. Voice reply auto-читается (не в entry).
6. `/shop` nav · Floating Bite drag/snap · 7-day greeting next day.

---

## 6. Git
- HEAD: local == remote (после push этой внедрки).
- Gates: TSC 0 · LINT 0 · VITEST 50/557 · BUILD 0.

---
*Document generated by Cline (AI) — handoff untuk ادامه توسعه.*
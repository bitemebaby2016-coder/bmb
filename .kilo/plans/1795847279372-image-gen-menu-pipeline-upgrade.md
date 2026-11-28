# Plan: Order-Mode Notice Popup (Preorder / Same-day) on Add-to-Cart

## Context
When a customer taps "add" (any add path), show a one-time-per-mode informational modal that addresses the customer by the name the AI uses, then auto-dismisses after **2 acknowledgements per order-mode per user** (persisted, not per item, not reset on new session). Do NOT build a parallel cart/notice system — reuse the canonical add path and existing modal pattern.

Key facts found:
- Single add funnel: `useCartStore.getState().addItem(product, qty, customizations, mode)` in `src/store/cartStore.ts:144` (returns `'added'`). ALL add sites go through it: `FoodTheater.add`, `TalkToBite.addToCart/confirmDraft`, `HomeProductCard` (via HomePage handlers), `ProductCard`, menu, etc. → a single event here covers every "กดปุ่มเพิ่มสินค้า".
- AI-address name = `mem?.name ?? customer?.name ?? 'ลูกค้า'` (`src/lib/aiServerMemory.ts` `hydrateMemoryFromServer` + `src/store/authStore.ts` `customer.name`).
- Global mount point: `src/components/layout/Layout.tsx` (already mounts `OrderBuilderModal`, `ToastContainer`, etc. at ~L339-343).
- Existing modal pattern: fixed overlay (`fixed inset-0 z-50 ... bg-black/50`) e.g. `ContentTab` catalog modal.
- `OrderMode` = `'SAME_DAY' | 'PRE_ORDER'` (from `@/config/platformConfig`).

## Decisions (confirmed)
- **Persistence = localStorage per browser** (no migration/DB). Key `bmb:order-notice:v1:<subject>:<mode>` where `subject = customer.id || 'guest'`. Survives new sessions; per person-per-browser-per-mode.
- **Trigger = event from `addItem`** on `'added'` only (not on blocked/context_blocked). Centralizes; no per-site edits.
- **Policy**: show when `count < 2`; increment on accept. 1st add→show, 2nd add→show, 3rd+→silent. Per mode independently. New session does NOT reset.
- **Popup is informational** (item already added); only an accept button (no X). Accept = "เข้าใจแล้ว ดำเนินการต่อ" + increments count.
- **Name**: `คุณ<name>` when name present, else `คุณ` (guest).

## Texts (exact)
- Preorder — title: `🍱 จองอาหารล่วงหน้า (Preorder)`; body: `คุณ{name}กำลังสั่งอาหารจองล่วงหน้า\n\nระบบจัดส่งตามวันที่ปฏิทินแสดงบนเมนูด้านขวามุมบนโดยอัตโนมัติ กรุณาเลือกรอบเวลาที่สะดวกให้ร้านจัดส่งด้วยตัวเอง`
- Same-day — title: `⚡ ส่งวันนี้ (Same-day)`; body: `คุณ{name}กำลังสั่งอาหารส่งวันนี้ระบบจัดส่งให้อัตโนมัติทันทีหลังปรุงเสร็จ`
- Button: `เข้าใจแล้ว ดำเนินการต่อ`
- Hint (small gray, inside same button, below label): `ขออภัยในความไม่สะดวก การแจ้งเตือนจะหายไปอัตโนมัติหลังกดปุ่มแล้ว 2 ครั้ง`

## Ordered tasks (atomic)
1. **`src/lib/orderNotice.ts` (new, pure helpers)**: `ORDER_MODE_ADD_EVENT='bmb:order-mode-add'`, `NOTICE_MAX=2`, `noticeKey(subject,mode)`, `getNoticeCount`, `bumpNoticeCount`, `shouldShowNotice`, `noticeSubject(customerId)`, `noticeWho(name)`, `noticeContent(mode,who)` (returns title/body/button/hint). No React.
2. **`src/store/cartStore.ts`**: before `return 'added'` in `addItem`, dispatch `window.dispatchEvent(new CustomEvent(ORDER_MODE_ADD_EVENT,{detail:{mode}}))` guarded by `typeof window !== 'undefined'`. Import the event constant.
3. **`src/components/order/OrderModeNoticeModal.tsx` (new)**: `useEffect` subscribes to `ORDER_MODE_ADD_EVENT`; on event compute `subject=noticeSubject(customer?.id)`, if `shouldShowNotice` → open with mode; resolve name (`hydrateMemoryFromServer(customer.id)` → `mem.name`, else `customer.name`); render fixed overlay (`z-[60]`, `bg-black/50`, `role="dialog" aria-modal`), title/body from `noticeContent`, accept button (label + `<span>` hint) → `bumpNoticeCount(subject,mode)` + close. Ignore events while already open.
4. **`src/components/layout/Layout.tsx`**: mount `<OrderModeNoticeModal />` next to `<OrderBuilderModal />`.
5. **Tests `src/__tests__/r132OrderModeNotice.test.ts` (new)**: unit-test helpers (shouldShow 0/1→true, 2→false; bump increments; key format; noticeWho name vs empty; titles); source assertions: cartStore dispatches `ORDER_MODE_ADD_EVENT`, Layout mounts `OrderModeNoticeModal`, modal contains button label + hint + both titles. No weakening of existing tests.
6. **Docs sync** (Protocol §0.3): CHANGELOG + MASTER_STATUS + WORK_QUEUE + AI_WORKING_STATE (R132). No PRODUCT_SPEC change.

## Edge cases / notes
- Guest→login changes `subject` (guest vs customer.id) → counts are independent (guest may see again after login). Acceptable per "per user"; note in docs.
- Rapid multi-add: single modal; first event opens, others ignored while open. A missed mode re-shows on that mode's next add (count still <2).
- No new dependency; no migration; frontend only (no EF deploy).
- Do not reuse/relabel removed `CartIsolationModal` (cart-clear) — this is a distinct informational notice.

## Validation
- `npx tsc --noEmit`, `npm run lint`, `npm test` (vitest run), `npm run build`.
- Manual: add a preorder item (count 0) → modal (คุณ<name>) → accept; add again → modal; 3rd add → no modal. Same for same-day. New reload (same browser) → counts persist (no modal after 2). Guest name → "คุณ".

## Open questions (non-blocking)
- None blocking. (Cross-device sync intentionally out of scope — localStorage chosen.)
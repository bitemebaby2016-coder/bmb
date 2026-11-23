# BMB Cart UX + Closed Rounds Display Plan

**Goal:** ปรับปรุงหน้า Cart + Checkout ตามคำขอ Owner 4 ข้อ (ข้อ 4 ทำความเข้าใจใหม่: ไม่มีฟีเจอร์แยกออเดอร์ใหม่)

**ขอบเขต:**
1. **CartPage** — เอาเซกชั่น 🎟️ คูปอง/โปรโมชั่น + 💰 สรุปราคา (รายละเอียด) ออก → เหลือรายการสินค้า + ปุ่ม "ยืนยันสั่งซื้อ →" เดียวไป /checkout
2. **CheckoutPage** — รอบที่แอดมินปิด (`status='closed'`) ต้อง **แสดงแต่เทา/กดไม่ได้** (ใช้ all-rounds fetch แทน active-only)
3. **ไม่มีฟีเจอร์แยกออเดอร์** — กติกา R5c "หนึ่งตะกร้า = หนึ่งออเดอร์" คงเดิม · ความจุหลายลูกค้าในรอบเดียวกันถูกจัดการโดย `current_count`/`max_capacity` อยู่แล้ว

---

## แผนงานรายละเอียด

### 1) CartPage.tsx — ปรับ UI
**ไฟล์เปลี่ยน:** `src/pages/CartPage.tsx`

| ขั้นตอน | การกระทำ |
|----------|----------|
| 1.1 | ลบ card "🎟️ คูปอง/โปรโมชั่น" (บรรทัด 130–133) ทิ้ง |
| 1.2 | ลบ card "💰 สรุปราคา" (บรรทัด 136–162) ทิ้ง |
| 1.3 | ย้ายปุ่ม `<Link to="/checkout" data-testid="go-checkout" ...>` ออกมาเป็น card เดียวสุดท้าย (แทน summary card) — รักษา logic `hasStalePreOrder` gating เดิม |
| 1.4 | คง `showCrossSell` (AddonCrossSellStrip) และ `hasStalePreOrder` warning เดิม |

**ผลลัพธ์ UI:** รายการสินค้า (มี add-on + +/- + ลบ) → cross-sell strip → (ถ้ามี stale pre-order → warning) → ปุ่ม "ยืนยันสั่งซื้อ →" กดไป /checkout

### 2) CheckoutPage.tsx — แสดงรอบปิด
**ไฟล์เปลี่ยน:** `src/pages/CheckoutPage.tsx`

| ขั้นตอน | การกระทำ |
|----------|----------|
| 2.1 | Import `getRoundsForDateAdmin` จาก `@/lib/bmbAdminApi_rounds` (มีอยู่แล้วใน admin) |
| 2.2 | ใน `useEffect` ที่ fetch rounds (บรรทัด 257–313) — สำหรับ PRE_ORDER: ใช้ `getRoundsForDateAdmin(scheduledDate)` แทน `listRoundsForDate(scheduledDate)` → ได้ rounds ทุกสถานะ (active/closed) |
| 2.3 | เปลี่ยน logic disabled ของ radio รอบ: `const closed = r.status === 'closed' || roundBookability(r, opts) !== 'open'` |
| 2.4 | UI radio row: เพิ่ม `opacity-60 cursor-not-allowed` สำหรับ `closed` (ปัจจุบันมีแค่ `opacity-60` เมื่อ `closed` จาก bookability) + label badge `ปิดแล้ว` / `ไม่เปิดรับ` สำหรับ closed rounds |
| 2.5 | SAME_DAY branch คงเดิม (auto-select แสดง 1 ใบ ไม่ใช่ list) — ไม่มีผล |

**ผลลัพธ์ UI:** PRE_ORDER → เลือกวัน → โชว์ทุกรอบ (เช้า/กลาง/เย็น) · รอบปิด = radio disabled + เทา + badge "ปิดรับ" · รอบเปิดแตก = bookability ปิดตามเดิม (cutoff/full/window/shop_closed)

### 3) Tests — อัปเดตตาม contract
**ไฟล์เปลี่ยน:** 
- `src/__tests__/r67Contracts.test.ts` (pin `go-checkout` ยังต้องมี)
- `src/__tests__/checkoutModeLock.test.ts` (mock `listRoundsForDate` → ให้ mock `getRoundsForDateAdmin` หรือปรับให้คืน closed rounds ด้วย)
- `src/__tests__/checkoutMixedSplit.test.ts` (同上)
- `src/__tests__/r65PickupHoursNotRounds.test.ts` (同上)
- `src/__tests__/cartPage.test.ts` (ถ้ามี — ต้องอัปเดตให้ไม่มี coupon/summary card แต่มี go-checkout)

**หลัก:** source-contract tests ต้องผ่าน → `go-checkout` testid คงอยู่ · mock rounds คืน closed rounds พร้อม `status='closed'` เพื่อ coverage

### 4) Docs — บันทึกสถานะ
- `docs/BMB_MASTER_STATUS.md` — เพิ่ม entry รอบใหม่
- `docs/AI_WORK_STATE.md` — เพิ่ม session log
- `docs/BMB_REMAIN_TESTS_LIVE_2026-11-23.md` — เพิ่ม test cases กลุ่มใหม่ (Cart UX + Closed rounds)

---

## ข้อตกลงสำคัญ (Decisions)

| หัวข้อ | ตัดสิน |
|---------|--------|
| ข้อ 4 "หลายออเดอร์ในเส้นทางเดียว" | **ไม่ทำ** — ความจุรอบ (`current_count`/`max_capacity`) จัดการแล้ว; R5c invariant คงเดิม |
| Cart summary card | ลบทิ้ง (ไม่แสดงยอดรวมบนหน้าตะกร้า) |
| Coupon card | ลบทิ้ง (เลือกคูปองอยู่หน้า checkout อยู่แล้ว — ตาม R10) |
| ปุ่มยืนยันสั่งซื้อ | ย้ายไป card เดียวสุดท้ายของหน้าตะกร้า |
| Closed rounds display | ใช้ `getRoundsForDateAdmin` (all non-archived) + disable `status='closed'` |
| SAME_DAY auto-round | คงเดิม (ไม่ใช่ list picker) |

---

## Validation Plan

| Gate | คำสั่ง |
|------|--------|
| TypeScript | `npx tsc --noEmit` |
| Lint | `npm run lint` |
| Unit tests (targeted) | `npx vitest run src/__tests__/r67Contracts.test.ts src/__tests__/checkoutModeLock.test.ts src/__tests__/checkoutMixedSplit.test.ts src/__tests__/r65PickupHoursNotRounds.test.ts src/__tests__/cartPage.test.ts` |
| Full vitest | `npx vitest run` |
| Build | `npm run build` |
| CI verification | GitHub API check-runs บน commit ที่ push |

---

## Risks & Rollback

| Risk | Mitigation |
|------|------------|
| Tests broken by rounds fetch change | Update mocks in 4 test files to return mixed active/closed rounds |
| SAME_DAY customers accidentally see closed rounds | SAME_DAY branch ไม่ใช้ list picker — auto-select จาก active rounds เหมือนเดิม |
| Cart summary missing → UX regression | Owner ยืนยันแล้วว่าต้องการลบทั้งหมด · ราคา server re-derive ที่ checkout |

---

## Open Questions (resolved)

- ✅ Q: ข้อ 4 ต้องการแยกออเดอร์จริงหรือไม่? → A: ไม่ ไปตามความจุรอบเดิม (user ตอบแล้ว)
- ✅ Q: คงปุ่ม `go-checkout` หรือเปลี่ยนชื่อ? → A: คง `data-testid="go-checkout"` ตาม contract `r67Contracts.test.ts`

---

## Implementation Order

1. CartPage.tsx (UI removal + button move)
2. CheckoutPage.tsx (fetch all rounds + disable logic + UI)
3. Update test mocks (checkoutModeLock, checkoutMixedSplit, r65PickupHoursNotRounds)
4. Run targeted tests → full vitest → lint → build
5. Commit + push → CI green
6. Update docs (MASTER_STATUS, AI_WORK_STATE, test pack)
7. Close session / hand off to live test
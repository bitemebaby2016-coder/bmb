# BMB — CHECKPOINT สถานะและเวลา ต่องาน (SAME_DAY / PRE_ORDER)

> **สร้าง:** 2026-10-13 (ICT) · **HEAD ณ สร้าง:** `fbe5ac6` = `origin/main` · **อนุมัติโดย:** Owner "PHASE 0 ACCEPTED → CONTROLLED EXECUTION"
> **หน้าที่:** เช็คพอยต์ให้ Owner ตรวจปิดเกตภาษาไทยได้ทุกจังหวะ — อัปเดตบรรทัดนี้ "ทุกครั้ง" ที่งานเริ่ม/จบ ห้ามทิ้งงานค้างโดยไม่มีสถานะ
> **เอกสารคู่:** `BMB_SAME_DAY_PRE_ORDER_MASTER_PLAN.md` · `PHASE_CONTRACTS.md` · `REGRESSION_MATRIX.md` · `EVIDENCE_LOG.md`

## 0. กติกาการใช้

- **สถานะที่ใช้ได้:** `DONE` (มีหลักฐานครบ) · `IN PROGRESS` (กำลังทำ) · `BLOCKED` (ติด hard stop / evidence — ต้องมีเหตุผล) · `DEFERRED` (เลื่อนตาม Owner decision) · `PENDING` (ยังไม่เริ่ม)
- เวลาเป็น **ICT (+07:00)** · เริ่ม = ลงมือทำจริง · จบ = gates ผ่าน + commit/push (ถ้ามี)
- หลักฐานอ้างด้วย `commit SHA` / `path:line` / `EV-xxx` เท่านั้น — **ห้ามอ้างความรู้สึก**
- อัปเดตด้วย editor/node (PowerShell พิมพ์ไทยเพี้ยน)

## 1. ตาราง Checkpoint ต่องาน

| # | งาน | สถานะ | เริ่ม (ICT) | จบ (ICT) | หลักฐาน / commit | หมายเหตุ |
|---|---|---|---|---|---|---|
| 0.1 | Phase 0 — audit + เอกสาร 5 ไฟล์ | **DONE** | 2026-10-13 (รอบ audit) | 2026-10-13 | EV-001..013 · ผล review = PASS ทุกหัวข้อ | Owner ACCEPTED |
| 0.2 | Phase 0 commit + push | **DONE** | 2026-10-13 09:06 | 2026-10-13 09:06 | `fbe5ac6` (5 ไฟล์ +430/−21) | HEAD == origin/main ✓ · worktree ✓ · stash ✓ |
| 0.3 | CI ของ `fbe5ac6` (ME-04) | **DONE** | 2026-10-13 09:06 | 2026-10-13 09:07 | GH Actions run #410 `completed/success` (updated 02:07:33Z) | ME-04 ปิดแล้ว |
| 3 | Phase 3 — AdminOrders filter wiring (RC-1) | **DONE** | 2026-10-13 09:11 | 2026-10-13 09:31 | commit `4cb22eb` · CI run #411 `completed/success` · `AdminOrders.tsx:70-79` + `adminOrdersModeFilter.test.ts` (6 tests) · EV-014 | gates 4/4 = 0 · 866/866 tests · regression พิสูจน์แล้ว (ถอด fix = 6/6 fail) · HEAD == origin/main ✓ |
| 1 | Phase 1 — Storefront eligibility (RC-2) | **DONE** | 2026-10-13 09:33 | 2026-10-13 09:44 | `talkToBite.ts` helpers + `homeProviders.ts` + `FoodTheater.tsx` + `HomePage.tsx` · `storefrontEligibility.test.ts` (8 tests) · EV-016 | gates 4/4 = 0 · 874/874 tests · proof: ถอด fix = 3 fail · caller survey: `handleReviewCta` แก้เพิ่ม · MenuPage/FoodMenuCard/homeShowcase ดีอยู่แล้ว |
| 2 | Phase 2 — Cart/Checkout consistency (RC-3) | **PENDING** | — | — | — | หลัง Phase 1 · HARD STOP ถ้าไม่ตรง OD-4 |
| 4 | Phase 4 — ยุบ AdminPreOrders (RC-6) | **PENDING** | — | — | — | **BLOCKED ตามสัญญา** — รอ Phase 3 มี evidence |
| 5 | Phase 5 — Homepage UX / A1 (RC-4, RC-5) | **PENDING** | — | — | — | หลัง Phase 1 + ตรวจ build identity บน `biteme-baby.com` (OD-2) · A2=DEFERRED |
| 6 | Phase 6 — Canonical field audit (RC-7) | **PENDING** | — | — | — | หลัง Phase 1 |
| 7 | Phase 7 — E2E / Production closure | **PENDING** | — | — | — | read-only ก่อน · ห้าม production mutation โดยไม่มี authorization เฉพาะ |

## 2. Baseline ที่ห้ามคลาดเคลื่อน (ตรวจอัตโนมัติก่อนเริ่มงานทุกครั้ง)

- `HEAD == origin/main` (ปัจจุบัน: `fbe5ac6` — อัปเดตเมื่อมี commit ใหม่)
- untracked เดิม **13 ไฟล์** (png 10 + webp 3) อยู่ครบ + ไฟล์เพิ่มใหม่ในรอบนี้ (เช่นเอกสารนี้) ต้องระบุไว้ใน status
- stash `local-edits-before-sync-2026-09-21` ไม่ถูกแตะ
- Quality gates (fresh): `npx tsc --noEmit --incremental false` · `npm run lint` · `npm test` · `npm run build` = 0 ทุกตัว

## 3. บันทึกการแก้ไข

- 2026-10-13 — สร้างฉบับแรก (หลัง Owner authorization) — เวลาอ้างอิงจาก git log / GitHub API

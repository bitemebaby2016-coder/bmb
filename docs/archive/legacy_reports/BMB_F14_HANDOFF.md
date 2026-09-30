# BMB_F14_HANDOFF.md
**F-14 RESOLUTION — Omnichannel Foundation · วันที่: 2026-09-27 · CORE = PASS · IDENTITY SCHEMA = BLOCKED (awaiting Owner) · HARD STOP**

## Production State
- Production migrations: **043, 044, 045 applied** (`supabase db push` log จริง)
  - `orders.source_channel` / `orders.external_ref_id` (nullable — historical = NULL ตาม Owner)
  - UNIQUE `(source_channel, external_ref_id)` WHERE external_ref_id IS NOT NULL
  - trigger `orders_stamp_source_channel` (legacy insert → PWA/MANUAL by actor)
  - `create_order_with_items` = **single 16-param signature** (core ย้ายไป
    `create_order_with_items_core` verbatim — business authority เดิมครบ)
- Edge Functions / Cloudflare: ไม่เปลี่ยน (dist = 84fbd75 ยังใช้ได้ — legacy 14-arg call ผ่าน)

## Implementation
- migrations 043/044/045 (additive + reversible) — **แก้ bug จริง 2 จุดที่เจอจาก production test**:
  1. PostgREST 42725 ambiguous overload (043) → 044 single signature
  2. wrapper UPDATE ทับ trigger stamp ด้วย NULL (044) → 045 tag-เฉพาะเมื่อระบุ
- probe `e2e/f14ChannelIntakeProbe.cjs` + evidence `e2e/f14-channel-intake-e2e.json`

## Runtime Verification (TEST DATA ONLY)
- **F-14 probe PASS 16/16**: legacy PWA/MANUAL intake + stamp ✓ · FACEBOOK/FACEBOOK_GROUP/
  MESSENGER schema intake simulation ผ่าน canonical contract ✓ · duplicate retry → SAME order
  (rows=1) ✓ · concurrent duplicate → ONE order ✓ · cross-channel no collision ✓ · NULL ref
  legacy semantics ✓ · invalid channel → ERR_INVALID_SOURCE_CHANNEL ✓ · anon → denied ✓ ·
  direct insert → 403 RLS ✓ · order history trigger ✓
- Regression: W3-A 11/11 · W3-B 13/13 · W3-C 12/12 · vitest 22 files/179 (canonical suite —
  exclude stale `src/.kilo` worktree copies) · tsc 0 · build ✓ · lint 0 · secret scan CLEAN

## Security
- RLS/grants/EXECUTE ตรวจ runtime · ไม่มี expose ใด ๆ · external payload ไม่ใช่ source of truth ·
  replay/duplicate protection = DB durable

## F-14 Status
- **F-14 CORE = PASS**
- **IDENTITY SCHEMA = BLOCKED — REQUIRED (รอ Owner)** — design ครบ: table
  `customer_channel_identities` (columns/PK/FK/UNIQUE/INDEX/RLS/GRANTS/SECURITY/MIGRATION/
  BACKFILL/DELETION/COLLISION/TEST PLAN) ใน BMB_F14_OMNICHANNEL_SCHEMA_EVIDENCE.md §14 ·
  **ห้ามสร้างจนกว่า Owner จะอนุมัติ migration**

## GAP (อัปเดต 2026-09-27: Identity Foundation = PASS — migrations 046/047 + E2E 19/19 · ด BMB_CHANNEL_IDENTITY_FOUNDATION_EVIDENCE.md)
- identity table (ข้างบน) · external channel production integration (FB/Messenger/LINE) —
  ห้ามทำจน identity + webhook verification ผ่าน Gate · pre-order RPC channel params (ต่อยอดภายหลัง)

## Next Step (อัปเดต 2026-09-27: W3-C-EXTERNAL = IMPLEMENTED + DEPLOYED + RUNTIME VERIFIED (foundation) · CONNECTED BLOCKED รอ Owner Meta config · ด BMB_W3C_EXTERNAL_EVIDENCE.md)
**HARD STOP — รอคำสั่ง Owner** · เมื่อ Owner อนุมัติ identity migration → กลับมาปิด W3-C
external-channel dependency → จากนั้น W3-D Notifications (ตาม execution order)
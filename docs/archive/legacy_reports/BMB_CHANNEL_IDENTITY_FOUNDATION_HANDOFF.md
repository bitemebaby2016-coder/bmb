# BMB_CHANNEL_IDENTITY_FOUNDATION_HANDOFF.md
**Identity Foundation · วันที่: 2026-09-27 · IDENTITY FOUNDATION = PASS · HARD STOP**

## Production State
- Production migrations: **046, 047 applied**
  - TABLE `customer_channel_identities` (deny-by-default RLS · UNIQUE (channel, external_user_id) ·
    FK auth.users · ไม่มี token/secret column)
  - RPCs: `link_channel_identity` (admin-only, audited, collision-safe) ·
    `unlink_channel_identity` (admin-only, audited) ·
    `resolve_channel_identity` (service_role only — สำหรับ verified adapter ในอนาคต)
  - REVOKE direct table writes จาก anon/authenticated (defense-in-depth)
- Edge Functions / Cloudflare: ไม่เปลี่ยน

## Implementation
- migration 046 + 047 (047 = concurrency fix จากบั๊กจริง: parallel link → raw unique_violation
  400 → ตอนนี้ report collision พร้อม audit)
- probe `e2e/identityFoundationProbe.cjs` + evidence `e2e/identity-foundation-e2e.json`

## Runtime Verification (TEST DATA ONLY)
- **PASS 19/19** — ครอบคลุม: NO SELF-LINKING (customer/driver denied) · admin link ✓ ·
  duplicate identity ✓ · cross-channel separate ✓ · collision rejected (owner unchanged) ✓ ·
  RLS matrix (admin/customer/driver/anon) ✓ · direct insert denied ✓ ·
  resolve service_role ✓ / anon denied ✓ · unlink/relink ✓ ·
  **concurrent → ONE row ผ่าน DB constraint** ✓ · audit 4 actions ✓

## Tests / Security
- Regression: F-05 12/12 · F-06 14/14 · F-18 15/15 · W3-A 11/11 · W3-B 13/13 · W3-C 12/12 ·
  F-14 16/16 · tsc 0 · vitest 22/179 (canonical suite) · build ✓ · lint 0 · secret scan CLEAN
- ไม่มี expose: external identity ไม่ถูกอ่านโดย customer/driver/anon (runtime-verified)

## Status ตามคำสั่ง
```
IDENTITY FOUNDATION      = PASS
F-14 CORE                = PASS
EXTERNAL CHANNEL INTEGRATION = NOT STARTED (ห้ามจน Owner เปิด)
W3-D                     = NOT STARTED (ห้ามจน Owner สั่ง)
```

## GAP
- production adapter/webhook (ทุกช่องทาง) = รอรอบถัดไป (foundation พร้อม)
- GDPR-style erasure/unlink policy ลึก = ออกแบบเพิ่มเมื่อจำเป็น

## Next Step
**HARD STOP — รอคำสั่ง Owner** · ทางเลือกถัดไปตาม execution order:
W3-C-EXTERNAL (Facebook/Messenger adapters ใช้ foundation นี้) → แล้ว W3-D Notifications
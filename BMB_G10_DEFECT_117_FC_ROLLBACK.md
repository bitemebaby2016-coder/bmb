# BMB — G10 DEFECT REPORT: MIGRATION 117 CLOBBERED FC GATES (112/114)

**สถานะ:** DEFECT ยืนยันแล้วด้วย production evidence (read-only) · **FIX = migration 118 AUTHORED + VERIFIED (16/16) — PENDING Owner approval ห้าม apply ก่อนอนุมัติ**
**ค้นพบ:** 2026-10-07 ระหว่าง G10 TRUE PRODUCTION CLOSURE verification (อ่านต่อจาก BMB_HANDOFF_NEXT_SESSION_2026-10-06 §4)
**Severity:** HIGH — ธุรกิจ regression จริงใน production (ระบบ gate ตามที่ Owner กำหนดไม่ถูกบังคับที่ order RPC)

---

## 1. DEFECT — เกิดอะไรขึ้น

Migration **117** (2026-10-06, Owner อนุมัติ) สร้าง `public.create_order_with_items` ใหม่จาก **ฐาน 089** ("089 verbatim + 048 channel semantics" — ระบุใน header ของไฟล์ 117 เอง) แต่ระหว่าง 089 → 117 มี migration **112** และ **114** ที่เคย rewrite function เดียวกันไปแล้ว (ทำให้ `fcVerify114` PASS เมื่อ 2026-10-05/06) → **การ apply 117 ทำให้ 112+114 ถูกแทนที่ (clobber)**

### สิ่งที่ production สูญเสีย (ยืนยันจาก live def = 15,462 chars)

| # | กลไก | อยู่ใน | สถานะ live ตอนนี้ |
|---|---|---|---|
| 1 | FC-1 branch-scoped `delivery_policy` load (`business_settings.branch_id` override) | 114 | ❌ หาย |
| 2 | FC-3 `branches.service_radius_km` → `v_radius_override` | 114 | ❌ หาย |
| 3 | FC-5 `bite_drive_enabled` gate → `ERR_BITE_DRIVE_DISABLED` | 114 | ❌ หาย |
| 4 | settings-driven zone (แทน hardcoded) — `5.00` คู่ **กลับมา** | 112 | ❌ หาย |
| 5 | `external_methods_enabled` / `allow_external_within_radius` gates | 114 | ❌ หาย |
| 6 | `compute_delivery_fee(..., v_resolved_branch_id)` — fee ไม่รู้ branch | 114 | ❌ หาย (เรียก 5 arg) |

### ผลกระทบจริง

- แอดมิน **ปิด Bite Drive แล้ว order ยังสั่ง self_delivery ได้** (FC-5 ไม่บังคับ)
- แอดมิน **แก้ radius/zone/external methods ใน `/admin/settings` แล้ว order RPC ไม่อ่านค่า** — ใช้ค่า hardcode `5.00` (ละเมิด Owner rule "Admin ปรับได้ทุกอย่าง" — master status §1)
- fee ไม่รู้ branch → branch radius override ไม่มีผลกับการคำนวณ
- ⚠️ ตอนนี้ค่า config จริง (bite_drive=true, radius=5) ตรงกับพฤติกรรม hardcode พอดี → **ยังไม่มีออเดอร์เสียหายจริง** (active=0) แต่ **capability ถูกปิดเงียบ**

## 2. EVIDENCE (READ-ONLY ทั้งหมด)

1. `node e2e/fcProdVerify.cjs` → **FAIL `rpc_fc1_fc5_live`** (เช็ค `ERR_BITE_DRIVE_DISABLED` + `v_resolved_branch_id)` ใน def) — check อื่น ๆ ผ่าน 5 ข้อแรก
2. `node e2e/fcVerify114.cjs` → **FAIL `create_fc1_branch_scoped_policy`** — ข้อก่อนหน้า (delivery_policy/order_policy/brand seeds) ผ่านหมด
3. `node e2e/g10ProdSnapshot.cjs` → `fc_markers_in_prod_def = {fc1:false, fc3:false, fc5:false, fee_call_with_branch:false, external_methods_gate:false, settings_driven_zone:false, hardcoded_500_literal:TRUE}` — เก็บใน `e2e/g10-prod-snapshot.json`
4. ตรวจ migration ทั้ง repo: `ERR_BITE_DRIVE_DISABLED` / `v_radius_override` / FC-1 policy string มี **เฉพาะใน 114 เท่านั้น** — ไม่มีใน 117
5. `e2e/m118BuildFromLive.cjs` assert: **live body == 117 file body (225 บรรทัด)** — prod เป๊ะกับ 117, ไม่มี drift อื่น
6. สิ่งที่ **ยังครบ** (ไม่ถูกแตะ): `compute_delivery_fee` (6 args, `p_branch_id`) · `enforce_pre_order_window` (FC-4 cutoff จาก settings) · `create_order_with_items_core` · helpers (`has_service_role`/`append_audit_log`/`kitchen_location`) — ดู `fc114_remaining_markers` ใน snapshot

> สาเหตุที่หลุด: รอบ apply 117 รันแค่ `intakeDriftProbe` + `channelWebhookProbe` (เช็ก channel intake) — **ไม่ได้ re-run `fcProdVerify`/`fcVerify114`** หลัง apply → regression ไม่ถูกจับจนรอบ G10 นี้

## 3. FIX — migration 118 (AUTHORED, ยังไม่ apply)

- ไฟล์: `supabase/migrations/118_restore_fc_gates_after_117.sql` — header `Owner approval: PENDING`
- วิธีสร้าง: `node e2e/m118BuildFromLive.cjs` (anchor-guarded) — เอา live def (= 117 body) + แทรก **FC block 16 บรรทัด + zone block 8 บรรทัด จากไฟล์ 114 แบบ verbatim** + fee arg + FC declarations (4 transforms: T1–T4)
- **ไม่ทำลาย channel intake ของ 117** (18-param signature, dup guard, channel tag, auth 048 — คงเดิมทุกประการ)
- **verify: `node e2e/m118Verify.cjs` = 16/16 ALL PASS** — 3-way textual diff: (ก) FC markers ครบ + ไม่มี 5.00 (ข) เสียจาก 117 แค่ 3 บรรทัดที่ถูกแทนที่จริง (ค) หายจาก 114 เฉพาะ 9 บรรทัดที่ตั้งใจไม่ restore (auth/INSERT branch_id/audit+return แบบ channel)
- Preconditions ผ่านแล้ว (read-only): `delivery_policy` มีครบทุก key ที่ FC block บังคับ (`bite_drive_radius_km:5`, `allow_external_within_radius:false`, `external_methods_enabled:[]`, `bite_drive_enabled:true`) → apply แล้วไม่เจอ `ERR_CONFIG_MISSING`

### หลัง Owner อนุมัติ — ลำดับ apply + verify

```text
1. ยืนยัน worktree clean + gates ผ่าน
2. apply ผ่าน Management API (precedent 117) หรือ supabase db push
3. node e2e/intakeDriftProbe.cjs      → INTAKE SIGNATURE: OK (18-param) ต้องยังผ่าน
4. node e2e/m118BuildFromLive.cjs     → live == 118 file + summary has_fc5=true no_500=true
5. node e2e/fcVerify114.cjs           → FC_VERIFY_114_ALL_PASS (ทุกข้อ)
6. node e2e/fcProdVerify.cjs          → FC_PROD_ALL_PASS (ทุกข้อ)
7. node e2e/w23SmsProbe-style ไม่เกี่ยว · channel probe = เฉพาะถ้า Owner สั่ง (สร้าง test orders)
Rollback: apply ใหม่ 117_channel_intake_repair.sql (ย้อนเป็น 117 body — เสีย FC กลับเป็นเหมือนเดิม)
```

## 4. FLAGS

```text
LOGIC CHANGED       = NO (ยังไม่ได้แก้ production — 118 ยังเป็นแค่ไฟล์)
DB CHANGED          = NO
MIGRATION           = NO (118 = AUTHORED PENDING — ยังไม่ apply)
SECURITY CHANGED    = NO
PRODUCTION MUTATION = NO รอบนี้ เฉพาะ SMS secrets + sms-send deploy + META_PAGE_ACCESS_TOKEN (Owner สั่ง)
```

## 5. OWNER DECISION ที่ต้องการ (HARD STOP)

1. **อนุมัติ apply migration 118** (หรือสั่งเลื่อน — ระบบยังทำงานได้จากค่า config ปัจจุบันที่ตรงกับ hardcode แต่ admin config ถูกปิดเงียบ)
2. ระหว่างไม่อนุมัติ — ห้ามมีการแก้ค่า radius/zone/bite_drive ใน admin โดยหวังผลที่ RPC (ไม่มีผลจนกว่า 118 apply)

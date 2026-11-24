# BMB — DOCUMENT INVENTORY & ARCHIVE MAP (R62 PHASE 5)

> **สร้างตามคำสั่ง Owner 2026-11-03** (WHOLE PROJECT FINAL CLOSURE · Old Documents = MOVE TO ARCHIVE, NO DELETE)
> · dependency check = `e2e/r62DocRefs.cjs` → `e2e/r62DocRefs-result.json` (สแกน code 1,552 ไฟล์: src/e2e/scripts/.github/public/supabase/workers)
> · **กติกา:** ① MOVE ห้าม DELETE ทุกกรณี ② เอกสารที่โค้ด/migration อ้าง = **BLOCKED ห้ามย้าย** (migrations ห้ามแตะ → แก้ comment ไม่ได้)
> ③ KEEP = canonical/current ที่ยังอ่าน/ใช้อยู่ ④ แผนผังเก่า→ใหม่ = §5 (ค้นย้อนหลังได้)

## §1 สรุปตัวเลข (ณ สร้างเอกสาร · HEAD `22e2b1b`)

| หมวด | จำนวน |
|---|---|
| Root .md ทั้งหมด | 56 |
| Root KEEP (ห้ามย้าย) | 7 |
| Root → ARCHIVE (แผนย้าย) | 49 |
| docs/*.md recursive ทั้งหมด | 230 |
| docs KEEP (canonical/current) | 12 |
| docs BLOCKED (โค้ด/migration อ้าง) | 8 |
| docs → ARCHIVE (แผนย้าย) | 50 |
| docs/archive มีอยู่แล้ว | 160 |

## §2 ROOT — KEEP (ห้ามย้าย · เหตุผลรายไฟล์)

| เหตุผล | ไฟล์ |
|---|---|
| canonical agent entry | `AI_ENTRYPOINT.md` · `AI_WORK_STATE.md` · `UNIVERSAL_MASTER_AI_RULES.md` · `README.md` |
| **TEST IMPORT** (`?raw` ใน `src/__tests__/g6g7OrderBoundary.test.ts`) | `BMB_G6_CONTRACT.md` · `BMB_G7_CONTRACT.md` |
| อ้างใน **migration 118** comment + `e2e/m118BuildFromLive.cjs` (ห้ามแตะ migrations) | `BMB_G10_DEFECT_117_FC_ROLLBACK.md` |

## §3 docs/ — KEEP (canonical / current / README อ้าง)

- `docs/01_SYSTEM_ARCHITECTURE.md`
- `docs/02_API_INTEGRATIONS.md`
- `docs/03_ADMIN_USER_GUIDE.md`
- `docs/04_DEPLOYMENT_RUNBOOK.md`
- `docs/BMB_HANDOFF_NEXT_SESSION_2026-11-02.md`
- `docs/BMB_MASTER_STATUS.md`
- `docs/BMB_MASTER_TEST_CHECKLIST_2026-10-28.md`
- `docs/BMB_OPENING_READINESS_MASTER.md`
- `docs/BMB_OWNER_LAUNCH_CHECKLIST.md`
- `docs/BMB_OWNER_ROLE_TEST_GUIDE_2026-10-27.md` → **ย้ายแล้ว (R62 PHASE 8): รวมเข้า `BMB_PRODUCTION_TEST_PACK.md` §RG + §MAP แล้ว MOVE ไป `docs/archive/BMB_OWNER_ROLE_TEST_GUIDE_2026-10-27.md`**
- `docs/BMB_PRODUCTION_TEST_PACK.md`
- `docs/BMB_REQUIREMENT_RECONCILIATION.md`

## §4 docs/ — BLOCKED (โค้ด/CI/migration อ้าง · ห้ามย้ายจนกว่าจะแก้ฝั่งโค้ด)

| เอกสาร | อ้างโดย (code paths) |
|---|---|
| `docs/BMB_CUSTOMER_JOURNEY_RECOVERY_GATE_2026-10-10.md` | `cr4ProdE2E.cjs` |
| `docs/BMB_FINAL_LAUNCH_CLOSURE_HANDOFF.md` | `launchVerify.cjs` |
| `docs/BMB_GROWTH_REWARDS_INVENTORY_2026-10-25.md` | `153_promotion_campaign_controls.sql` · `154_referral_program.sql` |
| `docs/BMB_HANDOFF_NEXT_SESSION_2026-10-31.md` | `r43_publish_probe.cjs` |
| `docs/BMB_R3_ENGINEERING_CLOSURE_2026-10-23.md` | `daily-backup.yml` · `r4Repair841205.cjs` |
| `docs/BMB_RECOVERY_PLAN_2026-10-23.md` | `138_payment_intents_read_authority.sql` · `139_pod_policies_trusted_helper.sql` |
| `docs/BMB_ROLE_PERMISSION_AI_AUDIT_2026-10-24.md` | `146_role_foundation.sql` |
| `docs/BMB_SAME_DAY_PRE_ORDER_REGRESSION_MATRIX.md` | `talkToBite.ts` |

## §5 แผนย้าย (MOVE → `docs/archive/`) — รันด้วย `git mv` เฉพาะไฟล์ · ห้าม `git add -A`

### 5.1 Root reports → `docs/archive/root_reports/` (49 ไฟล์)

- `BMB_ADMIN_AUDIT_2026-10-07.md` → `docs/archive/root_reports/BMB_ADMIN_AUDIT_2026-10-07.md`
- `BMB_ADMIN_GAP_SURVEY.md` → `docs/archive/root_reports/BMB_ADMIN_GAP_SURVEY.md`
- `BMB_ASSET_ADMIN_MAP.md` → `docs/archive/root_reports/BMB_ASSET_ADMIN_MAP.md`
- `BMB_B1_FIX_REPORT.md` → `docs/archive/root_reports/BMB_B1_FIX_REPORT.md`
- `BMB_CURRENT_PRODUCTION_CLOSURE_BASELINE.md` → `docs/archive/root_reports/BMB_CURRENT_PRODUCTION_CLOSURE_BASELINE.md`
- `BMB_FOOD_THEATER_REPORT_2026-10-08.md` → `docs/archive/root_reports/BMB_FOOD_THEATER_REPORT_2026-10-08.md`
- `BMB_FULL_PRODUCTION_INTEGRITY_CLOSURE_REPORT.md` → `docs/archive/root_reports/BMB_FULL_PRODUCTION_INTEGRITY_CLOSURE_REPORT.md`
- `BMB_G10_FINAL_REPORT.md` → `docs/archive/root_reports/BMB_G10_FINAL_REPORT.md`
- `BMB_G2RV_PROPOSALS.md` → `docs/archive/root_reports/BMB_G2RV_PROPOSALS.md`
- `BMB_G3_FINAL_REPORT.md` → `docs/archive/root_reports/BMB_G3_FINAL_REPORT.md`
- `BMB_G4_IMPLEMENTATION_REPORT.md` → `docs/archive/root_reports/BMB_G4_IMPLEMENTATION_REPORT.md`
- `BMB_G4_PRODUCTION_CONNECTION_REPORT.md` → `docs/archive/root_reports/BMB_G4_PRODUCTION_CONNECTION_REPORT.md`
- `BMB_G4_READINESS_REVIEW.md` → `docs/archive/root_reports/BMB_G4_READINESS_REVIEW.md`
- `BMB_G5_AI_ROUTING_AUDIT.md` → `docs/archive/root_reports/BMB_G5_AI_ROUTING_AUDIT.md`
- `BMB_G5_FINAL_REPORT.md` → `docs/archive/root_reports/BMB_G5_FINAL_REPORT.md`
- `BMB_G6_FINAL_REPORT.md` → `docs/archive/root_reports/BMB_G6_FINAL_REPORT.md`
- `BMB_G6_WORKLOG.md` → `docs/archive/root_reports/BMB_G6_WORKLOG.md`
- `BMB_G7_FINAL_REPORT.md` → `docs/archive/root_reports/BMB_G7_FINAL_REPORT.md`
- `BMB_G7_S4_R2_RUNTIME_REPORT.md` → `docs/archive/root_reports/BMB_G7_S4_R2_RUNTIME_REPORT.md`
- `BMB_G7_S4_RUNTIME_REPORT.md` → `docs/archive/root_reports/BMB_G7_S4_RUNTIME_REPORT.md`
- `BMB_G7_WORKLOG.md` → `docs/archive/root_reports/BMB_G7_WORKLOG.md`
- `BMB_G8_S0_AUTOMATION_AUDIT.md` → `docs/archive/root_reports/BMB_G8_S0_AUTOMATION_AUDIT.md`
- `BMB_G8_S1_ARCHITECTURE_DECISION.md` → `docs/archive/root_reports/BMB_G8_S1_ARCHITECTURE_DECISION.md`
- `BMB_G8_S2_QUEUE_RUNTIME_REPORT.md` → `docs/archive/root_reports/BMB_G8_S2_QUEUE_RUNTIME_REPORT.md`
- `BMB_G8_S3_CUTOVER_PREPARATION.md` → `docs/archive/root_reports/BMB_G8_S3_CUTOVER_PREPARATION.md`
- `BMB_G8_S4_QUEUE_DISPATCHER_RUNTIME_REPORT.md` → `docs/archive/root_reports/BMB_G8_S4_QUEUE_DISPATCHER_RUNTIME_REPORT.md`
- `BMB_G8_S5_CONTROLLED_CUTOVER_RUNTIME_REPORT.md` → `docs/archive/root_reports/BMB_G8_S5_CONTROLLED_CUTOVER_RUNTIME_REPORT.md`
- `BMB_G8_S5_FINAL_REPORT.md` → `docs/archive/root_reports/BMB_G8_S5_FINAL_REPORT.md`
- `BMB_G8_S5_HANDOFF_NEXT_CHAT.md` → `docs/archive/root_reports/BMB_G8_S5_HANDOFF_NEXT_CHAT.md`
- `BMB_G8_S5_ROOT_CAUSE_DIAGNOSTIC.md` → `docs/archive/root_reports/BMB_G8_S5_ROOT_CAUSE_DIAGNOSTIC.md`
- `BMB_G8_T1_TRANSPORT_DECISION_AUDIT.md` → `docs/archive/root_reports/BMB_G8_T1_TRANSPORT_DECISION_AUDIT.md`
- `BMB_G8_T2_SECURE_ENQUEUE_TRANSPORT_RUNTIME_REPORT.md` → `docs/archive/root_reports/BMB_G8_T2_SECURE_ENQUEUE_TRANSPORT_RUNTIME_REPORT.md`
- `BMB_G9_CONTRACT.md` → `docs/archive/root_reports/BMB_G9_CONTRACT.md`
- `BMB_G9_FINAL_REPORT.md` → `docs/archive/root_reports/BMB_G9_FINAL_REPORT.md`
- `BMB_G9_NONMETA_OWNER_REVIEW.md` → `docs/archive/root_reports/BMB_G9_NONMETA_OWNER_REVIEW.md`
- `BMB_GATE2_ASSET_BRAND_CONTROL_REPORT.md` → `docs/archive/root_reports/BMB_GATE2_ASSET_BRAND_CONTROL_REPORT.md`
- `BMB_HANDOFF_CHAT_THEME_UIUX_2026-10-09.md` → `docs/archive/root_reports/BMB_HANDOFF_CHAT_THEME_UIUX_2026-10-09.md`
- `BMB_HANDOFF_UXUI_2026-10-08.md` → `docs/archive/root_reports/BMB_HANDOFF_UXUI_2026-10-08.md`
- `BMB_MIGRATION_REPLAYABILITY_AUDIT.md` → `docs/archive/root_reports/BMB_MIGRATION_REPLAYABILITY_AUDIT.md`
- `BMB_OPEN_ITEMS_OWNER_TESTS_2026-10-08.md` → `docs/archive/root_reports/BMB_OPEN_ITEMS_OWNER_TESTS_2026-10-08.md`
- `BMB_OPEN_SHOP_ACCEPTANCE_HANDOFF.md` → `docs/archive/root_reports/BMB_OPEN_SHOP_ACCEPTANCE_HANDOFF.md`
- `BMB_POST_G2_SECURITY_REMEDIATION_REPORT.md` → `docs/archive/root_reports/BMB_POST_G2_SECURITY_REMEDIATION_REPORT.md`
- `BMB_PRODUCTION_MASTER_STATUS.md` → `docs/archive/root_reports/BMB_PRODUCTION_MASTER_STATUS.md`
- `BMB_SOCIAL_AI_ASSET_INVENTORY.md` → `docs/archive/root_reports/BMB_SOCIAL_AI_ASSET_INVENTORY.md`
- `BMB_SOCIAL_AI_NEXT_GATE_AUDIT.md` → `docs/archive/root_reports/BMB_SOCIAL_AI_NEXT_GATE_AUDIT.md`
- `BMB_TALK_TO_BITE_CONTEXT.md` → `docs/archive/root_reports/BMB_TALK_TO_BITE_CONTEXT.md`
- `BMB_TALK_TO_BITE_STATUS.md` → `docs/archive/root_reports/BMB_TALK_TO_BITE_STATUS.md`
- `BMB_UNIFIED_DESIGN_SYSTEM_REPORT_2026-10-10.md` → `docs/archive/root_reports/BMB_UNIFIED_DESIGN_SYSTEM_REPORT_2026-10-10.md`
- `BMB_W23_SMS_DELIVERY_DIAGNOSTIC.md` → `docs/archive/root_reports/BMB_W23_SMS_DELIVERY_DIAGNOSTIC.md`

### 5.2 docs/ point-in-time → `docs/archive/` (50 ไฟล์)

- `docs/05_FIX_LOG_2026-10-01_TENANT_ID_103.md` → `docs/archive/05_FIX_LOG_2026-10-01_TENANT_ID_103.md`
- `docs/06_FEATURE_LOG_2026-10-01_VOICE_AI.md` → `docs/archive/06_FEATURE_LOG_2026-10-01_VOICE_AI.md`
- `docs/07_FIX_LOG_2026-10-01_SECTION_TWO_TIER.md` → `docs/archive/07_FIX_LOG_2026-10-01_SECTION_TWO_TIER.md`
- `docs/11_UX_ENHANCEMENTS_2026-10-14.md` → `docs/archive/11_UX_ENHANCEMENTS_2026-10-14.md`
- `docs/BMB_ACCEPTANCE_PREPARATION_2026-10-14.md` → `docs/archive/BMB_ACCEPTANCE_PREPARATION_2026-10-14.md`
- `docs/BMB_ACCEPTANCE_RUNBOOK_2026-10-16.md` → `docs/archive/BMB_ACCEPTANCE_RUNBOOK_2026-10-16.md`
- `docs/BMB_ADMIN_CONSOLIDATION_HANDOFF.md` → `docs/archive/BMB_ADMIN_CONSOLIDATION_HANDOFF.md`
- `docs/BMB_ADMIN_LEGACY_DUPLICATION_AUDIT_2026-10-24.md` → `docs/archive/BMB_ADMIN_LEGACY_DUPLICATION_AUDIT_2026-10-24.md`
- `docs/BMB_ADMIN_LEGACY_DUPLICATION_AUDIT_REPORT_2026-10-24.md` → `docs/archive/BMB_ADMIN_LEGACY_DUPLICATION_AUDIT_REPORT_2026-10-24.md`
- `docs/BMB_BACKEND_AI_PART_1.md` → `docs/archive/BMB_BACKEND_AI_PART_1.md`
- `docs/BMB_BACKEND_CAPABILITY_CLOSURE_2026-10-19.md` → `docs/archive/BMB_BACKEND_CAPABILITY_CLOSURE_2026-10-19.md`
- `docs/BMB_CLOSURE_EXECUTION_REPORT_2026-10-16.md` → `docs/archive/BMB_CLOSURE_EXECUTION_REPORT_2026-10-16.md`
- `docs/BMB_CLOSURE_WAVE4.md` → `docs/archive/BMB_CLOSURE_WAVE4.md`
- `docs/BMB_CONSOLIDATED_CLOSURE_GAP_AUDIT_2026-10-15.md` → `docs/archive/BMB_CONSOLIDATED_CLOSURE_GAP_AUDIT_2026-10-15.md`
- `docs/BMB_E2E_PRODUCTION_ACCEPTANCE_PLAN_2026-10-24.md` → `docs/archive/BMB_E2E_PRODUCTION_ACCEPTANCE_PLAN_2026-10-24.md`
- `docs/BMB_FINAL_PRODUCTION_CLOSURE_REPORT.md` → `docs/archive/BMB_FINAL_PRODUCTION_CLOSURE_REPORT.md`
- `docs/BMB_GATE1_PREFLIGHT_GATE3_RELEASE_EVIDENCE_2026-10-14.md` → `docs/archive/BMB_GATE1_PREFLIGHT_GATE3_RELEASE_EVIDENCE_2026-10-14.md`
- `docs/BMB_GROWTH_REWARDS_REQUIREMENTS_2026-10-25.md` → `docs/archive/BMB_GROWTH_REWARDS_REQUIREMENTS_2026-10-25.md`
- `docs/BMB_HANDOFF_AI_AUTOMOTION_AUDIT_2026-10-07.md` → `docs/archive/BMB_HANDOFF_AI_AUTOMOTION_AUDIT_2026-10-07.md`
- `docs/BMB_HANDOFF_MASTER_2026-10-22.md` → `docs/archive/BMB_HANDOFF_MASTER_2026-10-22.md`
- `docs/BMB_HANDOFF_NEXT_SESSION_2026-10-26.md` → `docs/archive/BMB_HANDOFF_NEXT_SESSION_2026-10-26.md`
- `docs/BMB_HANDOFF_NEXT_SESSION_2026-10-27.md` → `docs/archive/BMB_HANDOFF_NEXT_SESSION_2026-10-27.md`
- `docs/BMB_HANDOFF_NEXT_SESSION_2026-10-27B.md` → `docs/archive/BMB_HANDOFF_NEXT_SESSION_2026-10-27B.md`
- `docs/BMB_HANDOFF_NEXT_SESSION_2026-10-28.md` → `docs/archive/BMB_HANDOFF_NEXT_SESSION_2026-10-28.md`
- `docs/BMB_HANDOFF_NEXT_SESSION_2026-10-29.md` → `docs/archive/BMB_HANDOFF_NEXT_SESSION_2026-10-29.md`
- `docs/BMB_HANDOFF_NEXT_SESSION_2026-10-30.md` → `docs/archive/BMB_HANDOFF_NEXT_SESSION_2026-10-30.md`
- `docs/BMB_HANDOFF_NEXT_SESSION_2026-11-01.md` → `docs/archive/BMB_HANDOFF_NEXT_SESSION_2026-11-01.md`
- `docs/BMB_OWNER_PREP_R16_D6_MIGRATIONS_2026-10-25.md` → `docs/archive/BMB_OWNER_PREP_R16_D6_MIGRATIONS_2026-10-25.md`
- `docs/BMB_OWNER_PRODUCTION_TEST_CHECKLIST_2026-10-19.md` → `docs/archive/BMB_OWNER_PRODUCTION_TEST_CHECKLIST_2026-10-19.md`
- `docs/BMB_OWNER_STATUS_REPORT_2026-10-25.md` → `docs/archive/BMB_OWNER_STATUS_REPORT_2026-10-25.md`
- `docs/BMB_P0_ADMIN_MENU_CART_EVIDENCE_2026-10-14.md` → `docs/archive/BMB_P0_ADMIN_MENU_CART_EVIDENCE_2026-10-14.md`
- `docs/BMB_QA_REVIEW_2026-10-29.md` → `docs/archive/BMB_QA_REVIEW_2026-10-29.md`
- `docs/BMB_R5_PRE_ORDER_SEPARATION_2026-10-23.md` → `docs/archive/BMB_R5_PRE_ORDER_SEPARATION_2026-10-23.md`
- `docs/BMB_REAL_ACCOUNT_VERIFICATION.md` → `docs/archive/BMB_REAL_ACCOUNT_VERIFICATION.md`
- `docs/BMB_RIDER_E2E_CLOSURE_2026-10-20.md` → `docs/archive/BMB_RIDER_E2E_CLOSURE_2026-10-20.md`
- `docs/BMB_ROUND_MODEL_ONE_PAGER_2026-10-24.md` → `docs/archive/BMB_ROUND_MODEL_ONE_PAGER_2026-10-24.md`
- `docs/BMB_SAME_DAY_PRE_ORDER_CHECKPOINT.md` → `docs/archive/BMB_SAME_DAY_PRE_ORDER_CHECKPOINT.md`
- `docs/BMB_SAME_DAY_PRE_ORDER_EVIDENCE_LOG.md` → `docs/archive/BMB_SAME_DAY_PRE_ORDER_EVIDENCE_LOG.md`
- `docs/BMB_SAME_DAY_PRE_ORDER_MASTER_PLAN.md` → `docs/archive/BMB_SAME_DAY_PRE_ORDER_MASTER_PLAN.md`
- `docs/BMB_SAME_DAY_PRE_ORDER_PHASE_CONTRACTS.md` → `docs/archive/BMB_SAME_DAY_PRE_ORDER_PHASE_CONTRACTS.md`
- `docs/BMB_STALE_CONTRACTS8_EVIDENCE_2026-10-25.md` → `docs/archive/BMB_STALE_CONTRACTS8_EVIDENCE_2026-10-25.md`
- `docs/BMB_STATUS_CLOSURE_2026-10-09.md` → `docs/archive/BMB_STATUS_CLOSURE_2026-10-09.md`
- `docs/BMB_STATUS_VERIFIED_2026-10-17.md` → `docs/archive/BMB_STATUS_VERIFIED_2026-10-17.md`
- `docs/BMB_UPGRADE_LOG_2026-10-29.md` → `docs/archive/BMB_UPGRADE_LOG_2026-10-29.md`
- `docs/BMB_UX_FIX_HANDOFF_2026-10-15.md` → `docs/archive/BMB_UX_FIX_HANDOFF_2026-10-15.md`
- `docs/BMB_WAVE2_M1_AND_READINESS.md` → `docs/archive/BMB_WAVE2_M1_AND_READINESS.md`
- `docs/BMB_WAVE5A_HANDOFF.md` → `docs/archive/BMB_WAVE5A_HANDOFF.md`
- `docs/BMB_WAVE5B_HANDOFF.md` → `docs/archive/BMB_WAVE5B_HANDOFF.md`
- `docs/BMB_WAVE5B_OWNER_DECISION_REVIEW.md` → `docs/archive/BMB_WAVE5B_OWNER_DECISION_REVIEW.md`
- `docs/BMB_WAVE5B_OWNER_REVIEW_PACK.md` → `docs/archive/BMB_WAVE5B_OWNER_REVIEW_PACK.md`

## §6 บันทึก

- **Stash** `local-edits-before-sync-2026-09-21` = ไม่เกี่ยวกับเอกสารนี้ · PRESERVE ตามเดิม
- ย้ายแล้วต้องรัน gates (vitest) ซ้ำ = พิสูจน์ว่าไม่มี test อ่านไฟล์ที่ย้าย (test import หลัก = G6/G7 contracts ซึ่ง KEEP แล้ว)
- รายงานเก่า = "รายงาน ณ วันนั้น" ห้ามแก้วันที่/สถานะในไฟล์ที่ย้าย (คงสภาพตามต้นฉบับ)
- dependency check ทุกครั้งก่อนย้าย: `node e2e/r62DocRefs.cjs` ใหม่ ถ้ามี ref เพิ่ม = ชะลอไฟล์นั้น
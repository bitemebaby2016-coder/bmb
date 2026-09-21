# BMB_100_PERCENT_CLOSURE_BOOK.md

> **Version 3.0 (2026-09-21, overwritten by reconciliation audit)**
> บทบาท: master checklist "อะไรยังเหลือก่อนปิด M1"
> กฎ: ปิดเฉพาะที่มี evidence, ไม่ปิดด้วยเอกสารเท่านั้น
> Statuses: LIVE / VERIFIED / PARTIAL / MISSING / BROKEN / DEFERRED / PENDING

---

## 2 Domains (ห้ามผสม)

| Domain | ความหมายของการปิด |
|-------|------------------|
| **DOMAIN A = BMB PRODUCTION 100% (Milestone 1)** | Bite Me Baby ทำงานบนแพลตฟอร์มได้อย่างน่าเชื่อถือ -- ไม่ใช่ "แพลตฟอร์มที่ขายได้" |
| **DOMAIN B = FUTURE SAAS PRODUCTIZATION (Milestone 2)** | ร้านอาหารที่สอง onboarding ได้โดยไม่แก้ code -- ทุก item DEFERRED จนกว่าผ่าน SAAS gate |

---

## Closure Table (updated 2026-09-21 by evidence)

| ID | Item | Status | Note |
|:---|:-----|:-------|:-----|
| PAY-01 | Server-authoritative pre-order pricing (017) | VERIFIED | RPC + RLS + quote/cancel |
| PAY-02 | Card loop + real bill | PARTIAL | Client flow ready; needs 1 real bill |
| PAY-03 | Real refund | PARTIAL | EF `stripe-refund` + logic ready; needs real refund evidence |
| PAY-04 | Canonical order vocabulary | VERIFIED | orderVocabulary.ts + test |
| ORD-01 | Server-side state machine + audit (017/018) | VERIFIED | transitions + append_audit_log |
| INV-01/02 | Inventory auto-deduct/restore (019) | VERIFIED | RPC deployed live |
| KIT-01/02 | Production batches/recipes/BOM (019) | VERIFIED | deployed; UI queue -- PARTIAL (admin) |
| DEL-01..04 | Bite Drive (020) | VERIFIED | DB APPLIED 2026-09-21 (db push) + REST probes 4/4 ERR-control; real rider flow --> REAL-WORLD PILOT |
| SEC-02 | AI key off client (ai-proxy EF) | VERIFIED | EF deployed; production bundle scan 2026-09-21 = **0 key hits** (9 JS files); client chat ผ่าน ai-proxy — `aiToolCalling.ts` เป็น dead path (ไม่ถูก wire/bundle) |
| AI-01..03 | AI guardrails/memory (021/022) | VERIFIED | server memory merge + injection suite |
| NOT-01 | Notification center (021) | VERIFIED | 4 channels + prefs + page |
| CI-01 | Customer intelligence (022) | VERIFIED | view + RPC + client service |
| CNT-01 | Content approval (022 + UI) | VERIFIED | `/admin/content-approvals` + banner gate |
| ADM-01 | System errors feed (021) | VERIFIED | record_system_error + /admin/errors |
| ADM-07 | Mascot overrides (021) | VERIFIED | /admin/mascot |
| ADM-UI-01 | Category headings (PHASE 6) | LIVE | `/admin/products` -> Categories headings manager |
| ADM-UI-02 | Image upload escape (PHASE 6) | LIVE | Remove-image button + URL input + preview |
| ADM-UI-03 | Admin navigation (PHASE 6) | LIVE | AdminNav on all /admin + Header by role + BottomNav Dashboard |
| PWA-01 | Vendor split/perf | PARTIAL | index ~114-118kB; final Lighthouse -- owner |
| PWA-02 | Retry/offline + ErrorBoundary | VERIFIED | offlineUtils + retry |
| QA-01..04 | CI/lint/tests/SQL contracts | VERIFIED | CI **PASS** run #15 (Node 24); lint 0; 163 tests; sqlContracts 29/29 |

---

## Migrations (verified 2026-09-21)

- 001-022 -- APPLIED on live DB (020/021/022 recorded 2026-09-21 via `supabase db push`)
- `node e2e/sqlContracts.cjs --include-new` = **29/29 PASSED** (2026-09-21)
- Owner SQL suites: `e2e/contracts_017_018.sql`, `_019_kitchen.sql`, `_020_bite_drive.sql`, `_021_phase4.sql`, `_022_phases_5_7.sql`

---

## PWA-100-GATE Criteria (checklist)

| # | Criterion | Status |
|---|----------|--------|
| 1 | All main flows work on production PWA | PARTIAL (Bite Drive RPCs deployed -- real rider flow รอ pilot) |
| 2 | Prices/payment server-authoritative | VERIFIED |
| 3 | auth/RLS/audit no sk in frontend | VERIFIED (service-role not exported) |
| 4 | AI: key in proxy, guardrails, memory | VERIFIED (SEC-02: bundle scan 0 key hits 2026-09-21) |
| 5 | Offline/retry + ErrorBoundary | VERIFIED |
| 6 | Perf: vendor split, build | PARTIAL (Lighthouse measurement by owner) |
| 7 | Evidence-pack: tests/build/lint/contracts | Ready: `docs/BMB_PWA_100_GATE_EVIDENCE_2026-09-21.md` |

> Gate passes ONLY with ALL evidence. Then REAL-WORLD PILOT (2-4 weeks) -> PATCH LOOP -> **M1**

---

## Exact Next Task (owner)

```
1) supabase db push                          -> DONE 2026-09-21 (020/021/022)
2) node e2e/sqlContracts.cjs --include-new   -> DONE (29/29 PASSED)
3) SQL Editor: contracts_020_bite_drive.sql  -> NEXT (owner)
4) Lighthouse production -> record in evidence pack
5) REAL-WORLD PILOT start
```

---

**End of Closure Book v3.0 -- Overwritten by 2026-09-21 reconciliation audit**

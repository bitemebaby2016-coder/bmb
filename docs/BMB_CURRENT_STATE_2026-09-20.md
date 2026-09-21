# BMB_CURRENT_STATE.md

> **Датا проверки:** 2026-09-21 (PHASE 6 UI/Admin + PHASE 7 content-approval UI completed)
> **Роль документа:** правда системы "на сегодня" — code > DB/migrations > Edge Functions > tests > prod evidence
> Источник: `README.md`, `BMB_MASTER_PRODUCT_SPEC.md`, `BMB_100_PERCENT_CLOSURE_BOOK.md`

---

## 1. Executive Summary

Bite Me Baby = production-first Cloud Kitchen Platform; первый реальный клиент — сам магазин
(Grab + social). PWA live на https://bitemebaby-5f7.pages.dev, Supabase project
`ivkdfognyiwjcmrhcnwz`. Деньги/заказы — server-authoritative (RPC + RLS + Stripe webhook).

В этом сегменте (2026-09-21) закрыты UI/Admin-разрывы PHASE 6 и доведён до конца UI
approval-workflow PHASE 7 (CNT-01).

## 2. Production Reality

| Channel | Status | Evidence |
|---|---|---|
| PWA production | LIVE — https://bitemebaby-5f7.pages.dev | e2e/prod-smoke.json |
| Supabase production | ivkdfognyiwjcmrhcnwz.supabase.co | e2e tests + live probes |
| Stripe webhook (EF) | VERIFIED 6/6 (2026-09-19) | e2e/webhook-smoke-result.json |
| Real orders | BMB-20260919-442, PO-20260919-430 | e2e/e2e-result.json |

## 3. Repository Snapshot

- Frontend: React + TypeScript strict + Vite + Tailwind + zustand + react-router + vite-plugin-pwa
- Pages: ~38 (`src/pages` — customer/admin/rider/ai)
- Lib layer: `src/lib/*`; stores: `src/store` + `src/stores`; admin: `src/pages/admin/*`
- Edge Functions (Deno): create-checkout · stripe-webhook · stripe-refund · phone-auto-login · ai-proxy
- Migrations: 001-022 in `supabase/migrations`

## 4. Money + Order spine (server-authoritative)

- Create order: RPC `create_order_with_items` (007) — цена/сумма из DB
- Pre-order: RPC `create_pre_order_with_items` / `quote_pre_order` / `cancel_pre_order` (017)
- Payments: `record_payment_result`/webhook verified, idempotent + amount-match (008/010)
- Audit: `append_audit_log` (018) — в money/order RPCs + client bridge
- Vocab заказов: canonical `orderVocabulary.ts` (PAY-04)

## 5. Migrations status (live DB, probing 2026-09-21)

| Migration | Live DB | Note |
|:--|:--|:--|
| 001-016 | APPLIED | base + RLS + add-ons/banner |
| 017 | APPLIED | pre-order server-authoritative + RLS revoke |
| 018 | APPLIED | server-side audit log |
| 019 | APPLIED | kitchen/inventory (deduct/restore, batches, recipes) |
| 020 | **PENDING OWNER `supabase db push`** | Bite Drive tables/RPCs НEE deployed → REST probes return PGRST202 |
| 021 | APPLIED | notifications/system_errors/ai_memory/mascot |
| 022 | APPLIED | save_ai_memory merge, customer_intelligence, content_approvals |

> Owner action: `supabase db push` (migration 020), затем `node e2e/sqlContracts.cjs --include-new` — после push 25/25 REST-проб при `pass`.

## 6. Tests · Build · Lint (measured 2026-09-21)

| Gate | Result |
|---|---|
| `npm test` | **163/163 PASS** (was 152 + 11 new PHASE 6/7 UI tests) |
| `npm run build` | PASS — tsc strict + vite + dist/sw.js (PWA precache 80 entries) |
| `npm run lint` | 0 errors (QA-02 baseline) |
| `node e2e/sqlContracts.cjs --include-new` | 25/29 (4 pending = Bite Drive 020 owner push) |

## 7. PHASE 6 UI/Admin — closed this session (facts in code)

| Item | Status | Where |
|---|---|---|
| Abrechnung категорий — «уغیرводить заголовки категорий» | LIVE | `/admin/products` → Categories-headings manager (create/rename/delete/hide + icon + order) |
| Upload image: выход из апцлоада / отмена | LIVE | кнопка **Remove image** + ввод URL (fallback) + предпросмотр |
| Back из /admin «превращал» в клиента | FIXED | Header: link Admin по role (не по email); BottomNav: вкладка Dashboard для admin; AdminNav на всех /admin страницах |
| User/Admin manual | UPDATED (overwrite) | docs/BiteMeBaby_ADMIN_GUIDE_TH.md · docs/BiteMeBaby_USER_GUIDE.md (essentials only) |

## 8. PHASE 7 — Growth UI completion

| Item | Status | Where |
|---|---|---|
| Content approval workflow UI | LIVE | `/admin/content-approvals` — submit (type/title/body) + review (approve/reject + note), gate: только `approved` публикуется |
| Баннеры Promotions | LIVE | при сохранении банера — автоsubmit на approval, badge «Approval» + переход в approvals |
| CNT-01 lib | VERIFIED | src/lib/contentApproval.ts (canPublish), RPC 022 на live DB |

## 9. PWA-100-GATE evidence pack

- Собран: `docs/BMB_PWA_100_GATE_EVIDENCE_2026-09-21.md`
- Тесты/build/lint + REST-пробы миг.= см. §6
- Известный residual: migration 020 pending owner `db push` + Lighthouse (был 29, улучшен кэш/сплит vendor: index 114-118kB) — замер owner на production

## 10. Известные нерешённые (честно)

- Migration 020 (Bite Drive) не применена на live DB (owner action)
- Lighthouse Perf ≥90 — требуется финальный owner прогон
- AI key VITE_OPENROUTER_API_KEY жив в .env.local (перенос в ai-proxy EF-секреты — SEC-02 продолжается)
- Card loop: нужен 1 реальный bill для полного PAY-02 (paymentGateway/client готов)

## 11. Next Required Actions

1. **Owner:** `supabase db push` → подтвердить 020 → `node e2e/sqlContracts.cjs --include-new` (29/29)
2. **Owner:** Supabase SQL Editor — прогнать `e2e/contracts_020_bite_drive.sql` (owner suite)
3. **Owner:** Lighthouse на production → записать в evidence pack
4. REAL-WORLD PILOT (2-4 нед) → PATCH/HARDENING LOOP → **M1 = BMB PRODUCTION 100%**
5. SAAS PRODUCTIZATION GATE → Domain B (PHASE 8+)

## 12. Evidence References

| Evidence | Location |
|---|---|
| Tests 163/163 | `npm test` (2026-09-21) |
| Build + PWA | `npm run build` → dist/sw.js |
| SQL contracts REST | `e2e/sql-contract-result.json` (25/29; 4 = 020) |
| Owner SQL suites | `e2e/contracts_017_018.sql … contracts_022_phases_5_7.sql` |
| Prod smoke / webhook | `e2e/prod-smoke.json`, `e2e/webhook-smoke-result.json` |
| PHASE 6/7 tests | `src/__tests__/adminUi.test.ts` (11) |
| Guides | `docs/BiteMeBaby_ADMIN_GUIDE_TH.md`, `docs/BiteMeBaby_USER_GUIDE.md` |

---

**Конец Current State — обновляется после каждого закрытого phase (overwrite, не append).**

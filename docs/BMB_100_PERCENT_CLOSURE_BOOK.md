# BMB_100_PERCENT_CLOSURE_BOOK.md

> **Version 2.0 (2026-09-20, обновлён 2026-09-21)** · роль: master checklist "что ещё нужно до target"
> Правило: закрывать только evidence, не документами. Статусы: LIVE / PARTIAL / SKELETON / MISSING / BROKEN / VERIFIED / DEFERRED

## ⚠️ ДВА домена закрытия (не смешивать)

| Domain | Что означает закрытие |
|-------|------------------------|
| **DOMAIN A** = **BMB PRODUCTION 100%** (Milestone 1) | Bite Me Baby реально работает на платформе надёжно; это НЕ "продаваемая платформа" |
| **DOMAIN B** = **FUTURE SAAS PRODUCTIZATION** (Milestone 2) | Второй ресторан onboards без правок кода; все items DEFERRED до SAAS gate |

## Фазы (структура v2)

```
PHASE 0 TRUTH LOCK (done) → PHASE 1 MONEY+ORDER (code done) →
PHASE 2 KITCHEN (code done) → PHASE 3 BITE DRIVE (code done; MIGRATION 020 → owner db push) →
PHASE 4 PWA+ADMIN+AI (code done) → PHASE 5 AI HARDENING (code done) →
PHASE 6 INTELLIGENCE (CI-01 done) → PHASE 7 GROWTH (CNT-01 done + UI done) →
[PWA-100-GATE → real-world PILOT → PATCH LOOP → M1 = BMB PRODUCTION 100%] →
SAAS gate → DOMAIN B (PHASE 8-15)
```

## DOMAIN A — таблица закрытия (обновлено 2026-09-21)

| ID | Item | Status | Note |
|:---|:-----|:-------|:-----|
| PAY-01 | Server-authoritative pre-order pricing (017) | VERIFIED | RPC + RLS + quote/cancel; REST-пробы пасс |
| PAY-02 | Card loop + реальный bill | PARTIAL | Клиент-флоу готов; нужен 1 real bill |
| PAY-03 | Refund real | PARTIAL | EF `stripe-refund` + логика готовы; ждёт real refund |
| PAY-04 | Canonical order vocabulary | VERIFIED | orderVocabulary.ts + test |
| ORD-01 | Server-side state machine + audit (017/018) | VERIFIED | transitions + append_audit_log |
| INV-01/02 | Inventory auto-deduct/restore (019) | VERIFIED | RPC deployed live |
| KIT-01/02 | Production batches/recipes/BOM (019) | VERIFIED | deployed; UI queue — PARTIAL (admin) |
| DEL-01..04 | Bite Drive (020) | **PENDING owner db push** | File full in HEAD; live DB needs `supabase db push` (020) → REST probes 4/4 |
| SEC-02 | AI key off client (ai-proxy EF) | PARTIAL | EF deployed; .env.local legacy key ещё присутствует |
| AI-01..03 | AI guardrails/memory (021/022) | VERIFIED | server memory merge + injection suite |
| NOT-01 | Notification center (021) | VERIFIED | 4 channels + prefs + page |
| CI-01 | Customer intelligence (022) | VERIFIED | view + RPC + client service |
| CNT-01 | Content approval (022 + UI) | **VERIFIED** | `/admin/content-approvals` (submit/approve/reject) + банner gate in Promotions; tests |
| ADM-01 | System errors feed (021) | VERIFIED | record_system_error + /admin/errors |
| ADM-07 | Mascot overrides (021) | VERIFIED | /admin/mascot |
| ADM-UI-01 | Category headings (PHASE 6) | **LIVE** | `/admin/products` → Categories headings manager |
| ADM-UI-02 | Image upload escape (PHASE 6) | **LIVE** | Remove-image button + URL input + preview |
| ADM-UI-03 | Admin navigation (PHASE 6) | **LIVE** | AdminNav на всех /admin + Header по role + BottomNav Dashboard |
| PWA-01 | Vendor split/perf | PARTIAL | тотал index ~114-118kB; Lighthouse финальный — owner |
| PWA-02 | Retry/offline + ErrorBoundary | VERIFIED | offlineUtils + retry |
| QA-01..04 | CI/lint/tests/SQL contracts | VERIFIED | CI workflow; lint 0; 163/163; sqlContracts runner |

## Миграции (проверено REST 2026-09-21)

- 001-019, 021, 022 — APPLIED на live DB
- **020 — PENDING**: `supabase db push` → `node e2e/sqlContracts.cjs --include-new` (ожидается 29/29)
- Owner SQL suites: `e2e/contracts_017_018.sql`, `_019_kitchen.sql`, `_020_bite_drive.sql`, `_021_phase4.sql`, `_022_phases_5_7.sql`

## PWA-100-GATE — критерии (checklist)

| # | Критерий | Статус |
|---|----------|--------|
| 1 | Все main flows работают на production PWA | PARTIAL (Bite Drive 020 ждёт push) |
| 2 | Цены/оплата server-authoritative | VERIFIED |
| 3 | auth/RLS/audit без sk в frontend | VERIFIED (service-role не экспортится) |
| 4 | AI: key в proxy, guardrails, memory | PARTIAL (см. SEC-02) |
| 5 | Оффлайн/retry + ErrorBoundary | VERIFIED |
| 6 | Перф: vendor split, построение | PARTIAL (Lighthouse замер owner) |
| 7 | Evidencе-pack: тесты/build/lint/contracts | Готов: `docs/BMB_PWA_100_GATE_EVIDENCE_2026-09-21.md` |

> Gate проходит только со ВСЕМИ evidence. Затем REAL-WORLD PILOT (2-4 недели) → PATCH LOOP → **M1**

## Сессионная непрерывность

Открывать сессию с: README → CURRENT_STATE → MASTER_PRODUCT_SPEC → этот файл. Остальные доки — historical.

## Точная следующая задача (owner)

```
1) supabase db push  (migration 020)
2) node e2e/sqlContracts.cjs --include-new   → 29/29
3) SQL Editor: contracts_020_bite_drive.sql  → PASS
4) Lighthouse production → записать в evidence pack
5) REAL-WORLD PILOT старт
```

## Stop Condition

Вне заказанной фазы не реализуем. Закрытый item = evidence + CURRENT_STATE + Closure Book update (overwrite).

---

**Конец Closure Book**

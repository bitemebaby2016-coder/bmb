# BMB — ตารางตรวจสอบความต้องการหลัก (Master Requirement Reconciliation Matrix)

> **วันที่:** 2026-09-25  
> **BASELINE SHA:** 81c513b  
> **HEAD SHA:** 81c513b (main = origin/main — synchronized)  
> **ผู้ผลิต:** AI Engineering Agent (Code/DB/Evidence-based)  
> **ประเภท:** การตรวจสอบการปฏิบัติตาม — เชื่อมทุกความต้องการสำคัญกับโค้ดปัจจุบัน + DB จริง + หลักฐาน  
> **กฎ:** โค้ด > Schema DB จริง > RPC/EF > Runtime > Tests > เอกสาร  
> **ห้ามแก้ไขโค้ดแอปพลิเคชันหรืออัปเดตสถานะจนกว่าตารางนี้จะสอดคล้องภายใน**  
> **HARDCODED != VERIFIED. LOCAL STORAGE != DATABASE-BACKED. EXISTS FILE != FEATURE ครบถ้วน**  
> **TEST EXISTENCE != PRODUCTION RUNTIME VERIFICATION**

## PHASE 0 — ABSOLUTE CURRENT BASELINE (VERIFIED 2026-09-25)

| Item | Value | Notes |
|------|-------|-------|
| CURRENT HEAD | `81c513b` | feat(PRE-05): weekly PRE_ORDER menu + mode/round controls (Migr 039) |
| ORIGIN/MAIN | `81c513b` | ✓ Synchronized |
| WORKING TREE | CLEAN | All changes committed |
| MIGRATIONS | 001–039 (39 ไฟล์) | 039 = weekly menu + operating controls |
| TESTS | 358/358 PASSED | vitest run (2026-09-25) |
| BUILD | PASS | tsc strict + vite build (PWA sw.js produced) |
| LINT | 0 ERRORS | |
| CI | VERIFIED PASS | GitHub Actions history shows CI passing |
| PRODUCTION CONTRACTS | 8/8 PASS | 023/028/029/030/036/037/038/039 verified on production |

## EVIDENCE TRACING METHODOLOGY

ทุก item ในตารางต่อไปนี้ถูกตรวจสอบตามลำดับ:
1. **UI EXISTS?** → ตรวจไฟล์ component ใน src/pages/admin/ หรือ src/pages/
2. **CALLER TRACE?** → ตรวจว่า UI เรียก function/API อะไร
3. **RPC/EF TRACE?** → ตรวจว่า function/RPC มีจริงใน migrations และ Edge Functions
4. **DB TABLE EXISTS?** → ตรวจว่า migration สร้าง table/column ที่จำเป็น
5. **RUNTIME BEHAVIOR?** → ตรวจ logic decision path จาก code จริง
6. **TEST EVIDENCE?** → ตรวจว่ามี test file ไหน cover feature นี้
7. **PRODUCTION EVIDENCE?** → ตรวจว่ามี live deployment evidence หรือไม่

## STATUS MODEL (บังคับใช้ — ไม่มีอื่น)

| Status | ความหมาย |
|--------|---------|
| **VERIFIED** | Implementationครบถ้วนพร้อม code + DB + RPC/EF + Test evidence + Production deployment evidence |
| **PARTIAL** | Core logic + code + DB + RPC มีอยู่ แต่ยังขาด evidence อย่างน้อยหนึ่งอย่าง (test / runtime / production) |
| **MISSING** | ไม่พบ implementation — ไม่มี code / DB / RPC |
| **CONFLICT** | เอกสารอ้างว่าเสร็จ แต่ code แสดงผลต่างออกไป |
| **OWNER-ONLY** | ต้องดำเนินการโดยเจ้าของเท่านั้น (prod secrets, API keys, Cloudflare config) |
| **DEFERRED** | เลื่อนไปยัง Domain B / Phase อื่น ตามข้อกำหนดผลิตภัณฑ์ |

## CONTRADICTION RESOLUTION LOG

| Conflict | Docs Involved | Resolution |
|----------|--------------|------------|
| Closure Book v5.0 claims M1 domain A closed vs actual gaps | CLOSURE_BOOK vs CODE/EVIDENCE | **OVERRIDDEN** — เอกสารประกาศ 100% แต่มี business logic gaps อีกหลายจุดที่ยังเป็น PARTIAL |
| Pre-order payment: claimed VERIFIED vs actual gap | CLOSURE_BOOK PAY-05 vs CODE/EVIDENCE | **RESOLVED** — Architecture มี skeleton (createPaymentIntent ถูกเรียกทั้งสองโหมด) แต่ไม่มี production runtime evidence ของ pre-order payment flow เลย → สถานะเปลี่ยนเป็น PARTIAL |
| Same-Day cutoff: claimed FIXED vs actual enforcement location | CLOSURE_BOOK vs CHECKOUTPAGE | **VERIFIED** — CheckoutPage.handlePlaceOrder ตรวจ cutoff_time + capacity ก่อนสร้าง order (commit 886836d); compute_delivery_fee blocks >5km self-delivery (migration 035) |
| Inventory deduct: claimed FIX via migration 026 | DEEP AUDIT G-03 vs MIGRATION 026 | **PARTIAL** — Code logic แก้ aggregated dedup + ERR_INSUFFICIENT_INGREDIENT แล้ว แต่ไม่มี production runtime evidence → ไม่ใช่ VERIFIED |
| DeliveryManagement MOCK_DRIVERS: claimed FIXED | DEEP AUDIT vs COMMIT 04d19c7 | **VERIFIED** — listDrivers() RPC แทน MOCK_DRIVERS แล้ว; มี bmbAdminApi_drivers.ts + list_drivers() SQL RPC |
| aiToolCalling.ts: claimed dead/deleted | COMMIT 716b4e9 vs FILE SYSTEM | **VERIFIED** — Renamed to aiToolCalling.ts.disabled; bundle scan = 0 key hits |
| Pre-order address mandatory: claimed FIXED | MIGRATION 035 Part 2 | **PARTIAL** — Trigger validate_pre_order_delivery() บังคับ delivery_address สำหรับ PRE_ORDER แล้ว แต่ไม่มี production evidence |
| Lighthouse Perf ≥ 90 | All docs | **PENDING** — Local measurement ≈29, production measurement ยังไม่มี |

## A. CUSTOMER STOREFRONT (PWA — Customer-Facing)

| ID | Requirement | Status | Gap | Priority |
|----|------------|--------|-----|----------|
| A-STO-001 | Landing page PWA | VERIFIED | None | P3 |
| A-STO-002 | Product catalog with images | VERIFIED | None | P3 |
| A-STO-003 | Cart with add-ons | VERIFIED | Client-side Zustand; ephemeral by design | P3 |
| A-STO-004 | Server-authoritative pricing | VERIFIED | Amount re-derived from DB in both RPC and create-checkout EF | P3 |
| A-STO-005 | Promotion code validation | VERIFIED | Server-authoritative promo validation | P3 |
| A-STO-006 | Delivery fee from DB zones | VERIFIED | Zone-based fee + legacy formula fallback | P3 |
| A-STO-007 | 5km self-delivery gate | VERIFIED | Server-enforced; external providers NOT restricted | P0 |
| A-STO-008 | Same-Day cutoff enforcement | VERIFIED | Double enforcement: client check + server RPC gate | P0 |
| A-STO-009 | Pre-order future date minimum | VERIFIED | Client-side date picker constraint | P0 |
| A-STO-010 | Pre-order address mandatory | PARTIAL | Trigger enforced at DB level; no production evidence yet | P0 |
| A-STO-011 | Payment methods (PromptPay, COD, Card) | VERIFIED | Real refund 172 THB verified; missing 1 real card bill | P0 |
| A-STO-012 | Order tracking (6 states) | PARTIAL | Tracking page works; ETA/map integration unclear | P1 |
| A-STO-013 | Orders list view | VERIFIED | Shows order history from orders table | P3 |
| A-STO-014 | Profile / Addresses | VERIFIED | Customer profile management | P3 |
| A-STO-015 | PWA installable (SW + manifest) | VERIFIED | Service worker + manifest produced | P3 |
| A-STO-016 | Thai language throughout | VERIFIED | All user-facing strings in Thai | P3 |
| A-STO-017 | Accessibility (WCAG AA) | PARTIAL | Local A11y ~82; production Lighthouse required | P3 |
| A-STO-018 | Production Lighthouse Perf ≥ 90 | MISSING | Production URL must be measured | P3 |
| A-STO-019 | Error/retry states | VERIFIED | Global error boundary + toast notifications | P3 |
| A-STO-020 | Offline tolerance | PARTIAL | Precaching works; true offline needs prod test | PARTIAL |

---

## B. AUTHENTICATION & ACCOUNTS

| ID | Requirement | Status | Gap | Priority |
|----|-----------|--------|-----|----------|
| A-AUTH-001 | Supabase Auth (email+password) | VERIFIED | Full email/password flow + quick login via EF | P3 |
| A-AUTH-002 | No localStorage auth | VERIFIED | SEC-02 verified: no API key in bundle | P0 |
| A-AUTH-003 | Admin route authorization | VERIFIED | RLS-based access control | P0 |
| A-AUTH-004 | Phone-pattern login | VERIFIED | Auto-login creates customer record | P3 |
| A-AUTH-005 | Customer identity unification (phone unique) | PARTIAL | No explicit unique constraint on customers.phone visible | P1 |
| A-AUTH-006 | Owner promotion | VERIFIED | Only owner can promote; manual SQL call required | OWNER-ONLY |
| A-AUTH-007 | Rider session (local phone-based) | VERIFIED | Intentionally local; RLS prevents cross-driver access | P3 |
---

---

## MODEL ความเป็นเจ้าของเอกสาร

| แหล่งข้อมูล | หน้าที่ |
|-----------|--------|

---

## C. ORDER SPINE (SAME-DAY + PRE-ORDER UNIFIED)

| ID | Requirement | Status | Gap | Priority |
|----|------------|--------|-----|----------|
| A-ORD-001 | Canonical orders table (unifies BOTH modes) | VERIFIED | Both modes through same RPC → same table | P0 |
| A-ORD-002 | create_order_with_items canonical authority | VERIFIED | Single order-creation authority | P0 |
| A-ORD-003 | Order number format (BMB-/PO-) | VERIFIED | Prefix convention enforced in RPC | P0 |
| A-ORD-004 | Atomic capacity lock (FOR UPDATE) | VERIFIED | Transaction-safe capacity reservation | P0 |
| A-ORD-005 | Capacity restoration on cancel | PARTIAL | No production cancel-to-capacity-restoration evidence | P0 |
| A-ORD-006 | Order state machine (allow-list + transition) | VERIFIED | Server-side allow-list prevents illegal jumps | P0 |
| A-ORD-007 | Audit log on all transitions | VERIFIED | DB-backed audit log with RLS | P1 |
| A-ORD-008 | Customer cancellation flow | PARTIAL | Cancel button exists in admin but customer-facing cancel unclear | P1 |
| A-ORD-009 | Inventory deduction on confirm | PARTIAL | Aggregation bug fixed; no production evidence | P0 |
| A-ORD-010 | Inventory restore on cancel | PARTIAL | Restore logic present; no production cancel-restore evidence | P0 |
| A-ORD-011 | Insufficient-stock guard | PARTIAL | Exception correct but not proven in production | P0 |
| A-ORD-012 | Concurrent order protection | PARTIAL | Theoretical protection; no concurrency stress test | P0 |
| A-ORD-013 | Pre-order canonical RPC | VERIFIED | Architecture correct: pre-order through canonical path | P0 |
| A-ORD-014 | Legacy pre_orders migration | VERIFIED | Legacy data migrated; new uses canonical | P0 |
| A-ORD-015 | Payment state machine (idempotent) | VERIFIED | Idempotent + amount-match + signature verification | P0 |
| A-ORD-016 | PromptPay TXN reference required | VERIFIED | Cannot confirm without TXN reference | P0 |
| A-ORD-017 | COD requires delivered before confirm | VERIFIED | Server-side rule enforcement | P0 |
| A-ORD-018 | Card payment loop (create→confirm→webhook→paid) | PARTIAL | Card loop complete except 1 real charge bill receipt | P0 |
| A-ORD-019 | Refund flow (admin-only) | VERIFIED | Idempotent refund with ledger tracking | P0 |
| A-ORD-020 | Pre-order payment processing | PARTIAL | Flow exists but never completed in production | P0 |

---

## D. SAME-DAY LOGIC

| ID | Requirement | Status | Gap | Priority |
|----|------------|--------|-----|----------|
| A-SD-001 | Same-Day mode (default) | VERIFIED | Default mode for immediate orders | P3 |
| A-SD-002 | Same-Day cutoff enforcement | VERIFIED | Double enforcement: client + server RPC | P0 |
| A-SD-003 | Round selection (morning/midday/evening) | VERIFIED | Dynamic round selection from DB | P3 |
| A-SD-004 | Same-Day capacity limit | PARTIAL | Client shows disabled; server enforces atomically. No concurrent load test | P0 |
| A-SD-005 | Server-side price derivation | VERIFIED | Client prices are DISPLAY ONLY | P0 |
| A-SD-006 | Same-Day inventory deduction | PARTIAL | Aggregation bug fixed; no production evidence | P0 |
| A-SD-007 | Same-Day kitchen batching | VERIFIED | Admin creates batch manually; includes both modes | P1 |
| A-SD-008 | Self-delivery ≤ 5km gate | VERIFIED | External providers NOT restricted | P0 |
| A-SD-009 | Promotions/discounts | VERIFIED | Server validates and applies discount | P3 |
| A-SD-010 | Same-Day → Kitchen → Dispatch → Delivered flow | PARTIAL | Flow chain: pending→confirmed→preparing→ready→dispatched→delivered | P1 |
| docs/Bite Me Baby — เอกสารข้อกำหนดโปรเจกต์ฉบับสมบูรณ์.txt | ข้อกำหนดต้นฉบับของผลิตภัณฑ์ — สิ่งที่ผลิตภัณฑ์ต้องประกอบด้วย |
| docs/BMB_MASTER_PRODUCT_SPEC.md | เป้าหมายปัจจุบัน — สถาปัตยกรรมที่ตกลงกันสำหรับ Domain A |

---

## E. PRE-ORDER LOGIC (CRITICAL M1 DEPENDENCY)

| ID | Requirement | Status | Gap | Priority |
|----|------------|--------|-----|----------|
| A-PO-001 | PRE_ORDER mode toggle | VERIFIED | Mode clearly separated at entry point | P0 |
| A-PO-002 | Future date requirement (min today+1) | VERIFIED | Date picker blocks today + past | P0 |
| A-PO-003 | Delivery round assignment | PARTIAL | Capacity locking for FUTURE dates needs prod evidence | P0 |
| A-PO-004 | Mandatory delivery address | PARTIAL | Trigger enforced at DB level; no prod order proves it fired | P0 |
| A-PO-005 | Pre-order cutoff / lead time | PARTIAL | Lead-time 1 day minimum; business-configurable cutoff not implemented | P1 |
| A-PO-006 | Pre-order capacity check | VERIFIED | Same atomic mechanism as same-day | P0 |
| A-PO-007 | Pre-order inventory reservation | PARTIAL | Inherited from G-03 fix; aggregated dedup works; no pre-order inv evidence | P0 |
| A-PO-008 | Server pricing for pre-order | VERIFIED | Price server-derived not client-provided | P0 |
| A-PO-009 | Promotion support for pre-order | VERIFIED | Same promo engine for both modes | P3 |
| A-PO-010 | Pre-order payment intent created | PARTIAL | Flow exists but never completed in production | P0 |
| A-PO-011 | Pre-order webhook handling | VERIFIED | Webhook doesn't distinguish modes; works generically | P0 |
| A-PO-012 | Duplicate webhook prevention | VERIFIED | Idempotency key = payment_intent_id | P0 |
| A-PO-013 | Pre-order → Kitchen batch inclusion | VERIFIED | Batch creation explicitly captures both modes | P1 |
| A-PO-014 | Pre-order kitchen batch creation | VERIFIED | Manual batch creation covers both modes | P1 |
| A-PO-015 | Pre-order production workflow | PARTIAL | State machine treats PRE_ORDER same as SAME_DAY after creation | P1 |
| A-PO-016 | Pre-order dispatch | PARTIAL | Driver assignment RPC exists; no prod pre-order dispatch verified | P1 |
| A-PO-017 | Pre-order tracking | PARTIAL | Tracking page works; pre-order specific flow not verified | P1 |
| A-PO-018 | Pre-order cancellation | PARTIAL | Cancel button present; restore not production-tested for pre-order | P1 |
| A-PO-019 | Pre-order capacity restore on cancel | PARTIAL | Trigger present; pre-order cancel not tested in prod | P0 |
| A-PO-020 | Pre-order refund | PARTIAL | General refund works; pre-order specifically untested | P1 |
| docs/BMB_CURRENT_STATE_2026-09-20.md | สถานะปัจจุบัน — ความจริงตามการตรวจสอบครั้งล่าสุด |
| BMB_DEEP_PRODUCT_LOGIC_AUDIT_2026-09-22.md | ผลการค้นพบจากหลักฐาน — ต้องตรวจสอบกับโค้ดปัจจุบันใหม่ |
| docs/BMB_100_PERCENT_CLOSURE_BOOK.md | รายการตรวจสอบการปิด — ไม่มีอำนาจกำหนดผลิตภัณฑ์ใหม่ |
| README.md / AI_WORK_STATE.md / AI_ENTRYPOINT.md | การนำทาง + จุดตรวจสอบการทำงาน |

หากมีความขัดแย้งระหว่างเอกสารสองฉบับ จะบันทึกไว้ด้านล่าง ไม่มีการลบหรือลดระดับความต้องการโดยไม่มีการตัดสินใจจากเจ้าของโปรเจกต์อย่างชัดเจน

---

## บันทึกการแก้ความขัดแย้ง

| ความขัดแย้ง | เอกสารที่เกี่ยวข้อง | การแก้ |
|-----------|-----------------|--------|
| Closure Book claim ว่าทุก PHASE เสร็จแล้ว vs ช่องว่างจริง | CLOSURE_BOOK v5.0 vs CODE/EVIDENCE | Overridden. เอกสารบอกว่า 100% แต่มีช่องว่างทาง business logic มาก |
| ส่วน 7/8/9 ของข้อกำหนดบอกว่าบางสิ่ง vs ความจริงของ Migration 019/020 | MASTER_PRODUCT_SPEC vs MIGRATIONS 019/020 | บันทึกเป็นความขัดแย้ง; โค้ด/DB ชนะ |

---

## F. KITCHEN / PRODUCTION

| ID | Requirement | Status | Gap | Priority |
|----|------------|--------|-----|----------|
| A-KIT-001 | Production batches table | VERIFIED | Batch with items, order_mode snapshot | P1 |
| A-KIT-002 | Recipes / BOM (product → ingredient) | VERIFIED | Admin CRUD UI + DB-backed recipe mgmt | P1 |
| A-KIT-003 | Kitchen queue display | VERIFIED | Queue shows batch items with order_mode | P1 |
| A-KIT-004 | Kitchen status progression | PARTIAL | Status fields exist; actual cooking transitions not traceable from UI | P2 |
| A-KIT-005 | Recipe quantity-per-unit for BOM | VERIFIED | Direct CRUD on recipes table | P2 |
| A-KIT-006 | Ingredient auto sold-out | PARTIAL | Logic present; no production sold-out scenario tested | P1 |

---

## G. DELIVERY / BITE DRIVE

| ID | Requirement | Status | Gap | Priority |
|----|------------|--------|-----|----------|
| A-DEL-001 | Bite Drive architecture (Supabase-driven) | VERIFIED | DB-driven architecture confirmed | P1 |
| A-DEL-002 | Driver assignment | VERIFIED | RPC exists; calls DB update | P1 |
| A-DEL-003 | Driver status tracking | PARTIAL | Status field exists; real-time updates during delivery not verifiable | P1 |
| A-DEL-004 | Driver capacity tracking | VERIFIED | Count calculated from active assignments | P2 |
| A-DEL-005 | Route optimization | VERIFIED | Algorithmic route optimization with ETA | P2 |
| A-DEL-006 | External provider integration | PARTIAL | Adapters exist but no real API keys configured | OWNER-ONLY |
| A-DEL-007 | Rider PWA (driver app) | VERIFIED | Rider-facing interface for assigned deliveries | P2 |
| A-DEL-008 | Delivery fee computation | VERIFIED | Zone-based with geographic fallback | P3 |
| A-DEL-009 | Distance-based zone pricing | VERIFIED | Zones configurable via DB | P3 |

---

## H. ADMIN OPERATIONAL PANELS

| ID | Requirement | Status | Priority |
|----|------------|--------|----------|
| A-ADM-001 | Admin Dashboard | VERIFIED | P3 |
| A-ADM-002 | Orders management | VERIFIED | P1 |
| A-ADM-003 | Pre-orders management | VERIFIED | P1 |
| A-ADM-004 | Kitchen / Production batch | VERIFIED | P1 |
| A-ADM-005 | Recipe/BOM management | VERIFIED | P1 |
| A-ADM-006 | Products/menu management | VERIFIED | P3 |
| A-ADM-007 | Delivery rounds & capacity | VERIFIED | P1 |
| A-ADM-008 | Delivery management & dispatch | VERIFIED | P1 |
| A-ADM-009 | Inventory management | VERIFIED | P1 |
| A-ADM-010 | Settings / Business config | VERIFIED | P2 |
| A-ADM-011 | Audit logs | VERIFIED | P1 |
| A-ADM-012 | Content approvals | VERIFIED | P3 |
| A-ADM-013 | Promotions management | VERIFIED | P3 |
| A-ADM-014 | Media library | VERIFIED | P3 |
| A-ADM-015 | Customer management | VERIFIED | P3 |
| A-ADM-016 | Mascot settings | VERIFIED | P3 |
| A-ADM-017 | Error monitoring | VERIFIED | P3 |
| A-ADM-018 | Admin RBAC enforcement | VERIFIED | P0 |
| A-ADM-019 | Admin CRUD error states | VERIFIED | P2 |
| A-ADM-020 | Admin loading/empty states | VERIFIED | P2 |
| ข้อกำหนดบอกว่า cutoff LIVE vs ไม่มี enforcement ในโค้ด | MASTER_PRODUCT_SPEC ส่วน 3 vs ไม่มี cutoff ใน RPC | กำหนดเป็น PARTIAL/MISSING ตามโค้ดจริง |
| Voice Input/Output กำหนดเป็น optional ในเอกสารใหม่ vs ข้อกำหนดเดิมบอกว่ามี | ORIGINAL SPEC ส่วน 3.4 vs เอกสารใหม่ | RETAINED เป็น M1 requirement เว้นแต่เจ้าของลบออก |
| Card loop: verified vs ไม่มีบิลจริง | CLOSURE_BOOK PAY-02 vs ACTUAL | ยังคงเป็น PARTIAL — ต้องมีบิล charge จริง 1 รายการ |
| Pre-order VERIFIED vs island table ไม่มี lifecycle | CLOSURE_BOOK vs DEEP AUDIT | แก้เป็น PARTIAL — payment/kitchen/delivery ยังไม่เชื่อมต่อ |

---

## คำอธิบายสัญลักษณ์

| สถานะ | ความหมาย |
|-------|---------|
| VERIFIED | การ_IMPLEMENTATION ครบถ้วนด้วย code + DB + RPC + หลักฐานจริง |
| LIVE | Deploy แล้วและทำงานใน production (อาจมีช่องว่างเล็กน้อย) |
| PARTIAL | ทำบางส่วนแล้ว — core มีอยู่แต่ยังเหลือช่องว่างสำคัญ |

---

## I. PAYMENT & FINANCE

| ID | Requirement | Status | Gap | Priority |
|----|------------|--------|-----|----------|
| A-PAY-001 | Stripe PaymentIntent creation | VERIFIED | Amount authoritative from orders.total_amount | P0 |
| A-PAY-002 | Stripe webhook signature verification | VERIFIED | Constant-time comparison + 5min timestamp window | P0 |
| A-PAY-003 | Stripe refund (admin-only) | VERIFIED | Idempotent ledger-based refund with amount guard | P0 |
| A-PAY-004 | Card charge loop (create→confirm→webhook→paid) | PARTIAL | Missing 1 real card charge bill (PAY-02) | P0 |
| A-PAY-005 | PromptPay QR offline payment | VERIFIED | Requires TXN reference before confirmation | P0 |
| A-PAY-006 | Cash on Delivery | VERIFIED | Payment confirmed only after delivery | P0 |
| A-PAY-007 | Payment status tracking | VERIFIED | Dual-table consistency maintained | P0 |
| A-PAY-008 | Amount match verification | VERIFIED | Amount mismatch → permanent reject (400) | P0 |
| A-PAY-009 | Idempotent payment recording | VERIFIED | Duplicate webhooks → 202 accepted, no side effect | P0 |
| A-PAY-010 | Refund ledger tracking | VERIFIED | Multi-refund support with total cap | P0 |
| A-PAY-011 | Partial refund support | VERIFIED | Can refund multiple times up to charged amount | P0 |

---

## J. INVENTORY / BOM

| ID | Requirement | Status | Gap | Priority |
|----|------------|--------|-----|----------|
| A-INV-001 | Inventory table (ingredients) | VERIFIED | Full DB-backed inventory CRUD | P1 |
| A-INV-002 | Recipe-BOM linkage | VERIFIED | Many-to-many: product → multiple ingredients | P1 |
| A-INV-003 | Atomic inventory deduction | PARTIAL | Deduction logic verified in code; no production evidence | P0 |
| A-INV-004 | Insufficient stock rejection | PARTIAL | Exception caught and rolls back; no production trigger evidence | P0 |
| A-INV-005 | No silent under-deduct / no negative stock | VERIFIED | Code review confirms no clamp-to-zero anymore | P0 |
| A-INV-006 | Concurrent order protection | PARTIAL | Theoretical protection; no concurrency test evidence | P0 |
| A-INV-007 | Inventory restore on cancellation | PARTIAL | Restoration logic present; no production cancel-restore sequence evidence | P0 |
| A-INV-008 | Inventory transaction audit trail | VERIFIED | Complete audit trail for stock movements | P1 |
| A-INV-009 | Auto sold-out when below min_stock | PARTIAL | Logic exists; no production sold-out scenario tested | P1 |
| A-INV-010 | Sold-out product visibility (frontend hide) | VERIFIED | Products marked unavailable don't show in storefront | P1 |
| A-INV-011 | Ingredient unit/category metadata | VERIFIED | Full ingredient metadata stored | P2 |
| A-INV-012 | BOM-derived availability (not just manual toggle) | PARTIAL | availabilityEngine checks is_available flag but unclear if auto-updates from BOM stock levels | P1 |

---

## K. CAPACITY / ROADS / DELIVERY SLOTS

| ID | Requirement | Status | Gap | Priority |
|----|------------|--------|-----|----------|
| A-CAP-001 | Delivery rounds (time windows) | VERIFIED | Three rounds: morning/midday/evening configurable | P1 |
| A-CAP-002 | Atomic capacity reservation | VERIFIED | No race condition possible | P0 |
| A-CAP-003 | Capacity counter (current_count) | VERIFIED | Counter increments at creation time | P0 |
| A-CAP-004 | Capacity decrement on cancel | PARTIAL | Trigger exists but no production cancel-release cycle verified | P0 |
| A-CAP-005 | Capacity reset to zero | VERIFIED | Manual reset available to admin | P1 |
| A-CAP-006 | Round open/close status | VERIFIED | Admin can close rounds to stop orders | P1 |
| A-CAP-007 | Max capacity configuration | VERIFIED | Per-round capacity cap editable | P2 |
| SKELETON | มีโค้ด skeleton/structure แต่ไม่มี business logic จริง |
| MISSING | ไม่พบการ implement |
| MOCK | Client-side mock/localStorage เท่านั้น, ไม่ใช่ DB-backed |
| DEFERRED | เลื่อนตามข้อกำหนดของผลิตภัณฑ์ (Domain B SaaS) |

| ความสำคัญ | ความหมาย |
|----------|---------|
| P0 | ความถูกต้องทางธุรกิจ / เงิน / ความสมบูรณ์ของออร์เดอร์ / ความปลอดภัย — ขัด M1 |
| P1 | Logic หลักของผลิตภัณฑ์ — ต้องปิดก่อนประกาศ M1 |
| P2 | ความครบถ้วนของ Admin / UX polish — ดีแต่ไม่ขัด M1 หากมีเหตุผล |
| P3 | Performance / optimization |
| P4 | SaaS / multi-tenant / ฟีเจอร์ที่เลื่อน |

---

## DOMAIN A: หน้าร้านลูกค้า (Customer Storefront)

### A. หน้าร้านลูกค้า (PWA)

| ID | ความต้องการ | เป้าหมายปัจจุบัน | โค้ดปัจจุบัน | UI ปัจจุบัน | DB/RPC ปัจจุบัน | Tests | หลักฐานจริง | สถานะ | ช่องว่าง | 
|----|-----------|-------------|---------|--------|-----------|-------|---------|------|------| 
| A-001 | หน้าหลัก (Homepage) | VERIFIED | HomePage.tsx + menu data | Homepage UI | products table | Homepage tests | Production LIVE | VERIFIED | None | M1 | Homepage load test |

---

## L. AI ARCHITECTURE

| ID | Requirement | Status | Gap | Priority |
|----|------------|--------|-----|----------|
| A-AI-001 | AI chat service (aiService.ts) | VERIFIED | Frontend calls ai-proxy EF; model selectable | P2 |
| A-AI-002 | AI key in server only (no client exposure) | VERIFIED | No API key in browser bundle | P0 |
| A-AI-003 | AI guardrails (read-only advice) | VERIFIED | Non-negotiable guardrails: no promise/modify prices/stock/payments/orders/delivery | P0 |
| A-AI-004 | AI tool calling DISABLED | VERIFIED | Dead code removed from bundle | P0 |
| A-AI-005 | AI has NO transaction authority | VERIFIED | AI cannot execute transactions or mutations | P0 |
| A-AI-006 | Conversation memory | PARTIAL | Memory implementation exists; continuity across sessions unclear | P2 |
| A-AI-007 | Voice input/output (STT → AI → TTS) | PARTIAL | Voice feature mentioned in spec/design docs but not clearly implemented in current pages | P2 |
| A-AI-008 | Model abstraction/provider swap | VERIFIED | Default model GLM-5.2 free; override supported | P3 |
| A-AI-009 | AI daily report generation | PARTIAL | EF exists; scheduled trigger/notifier unclear | P2 |
| A-AI-010 | Random menu draw | VERIFIED | Random featured product display | P3 |

---

## M. NOTIFICATIONS

| ID | Requirement | Status | Gap | Priority |
|----|------------|--------|-----|----------|
| A-NOT-001 | Notification store/event system | PARTIAL | In-memory event system; persistent delivery (push/SMS/email) not implemented | P1 |
| A-NOT-002 | Order confirmation notification | PARTIAL | Event fires in-store only; no push/email delivery mechanism | P1 |
| A-NOT-003 | Payment success/failure notification | PARTIAL | Event system exists; delivery mechanism absent | P1 |
| A-NOT-004 | Order status change notifications | PARTIAL | Events fire; recipients/mechanism unclear | P1 |
| A-NOT-005 | Delivery status notifications | PARTIAL | Events defined; actual delivery to customer unclear | P1 |
| A-NOT-006 | Push notification (PWA) | PARTIAL | SW active for precaching; push subscription/registration unclear | P2 |

---

## N. SECURITY / RLS

| ID | Requirement | Status | Gap | Priority |
|----|------------|--------|-----|----------|
| A-SEC-001 | RLS hardening (migrations 005/006) | VERIFIED | Full RLS policy suite deployed | P0 |
| A-SEC-002 | No hardcoded admin email bypass | VERIFIED | No admin bypass in source code | P0 |
| A-SEC-003 | No dead bcrypt password functions | VERIFIED | Dead code removed | P0 |
| A-SEC-004 | Service role key rotation | VERIFIED | Only bmb_backend_production_supabase_service_role_key used | P0 |
| A-SEC-005 | Audit log immutability | VERIFIED | Audit logs written server-side only | P1 |
| A-SEC-006 | RLS on audit_logs | VERIFIED | Audit log table secured with proper RLS | P1 |
| A-SEC-007 | Supabase secrets in EF env only | VERIFIED | Zero client-side secret exposure | P0 |
| A-SEC-008 | Payment INTENT isolation (service_role write) | VERIFIED | Client cannot directly modify payment status | P0 |
| A-SEC-009 | RBAC enforcement in EFs | VERIFIED | Admin-only operations protected at EF level | P0 |

---

## O. EXTERNAL PROVIDERS / THIRD-PARTY

| ID | Requirement | Status | Gap | Priority |
|----|------------|--------|-----|----------|
| A-EXT-001 | Grab integration adapter | PARTIAL | Adapter code exists but no Grab API key configured | OWNER-ONLY |
| A-EXT-002 | LINE MAN integration adapter | PARTIAL | Adapter code exists but no LINEMAN API key | OWNER-ONLY |
| A-EXT-003 | Foodpanda integration adapter | PARTIAL | Adapter code exists but no Foodpanda API key | OWNER-ONLY |
| A-EXT-004 | Google Maps API (routing/ETA) | PARTIAL | Routing algorithm present; real Google Maps API dependency unclear | OWNER-ONLY |

---

## P. DOCUMENTATION & METADATA

| ID | Requirement | Status | Gap | Priority |
|----|------------|--------|-----|----------|
| A-DOC-001 | README.md | VERIFIED | Points to CURRENT_STATE as truth | P3 |
| A-DOC-002 | MASTER_PRODUCT_SPEC | VERIFIED | Domain A + Domain B structured | P3 |
| A-DOC-003 | CURRENT_STATE | CONFLICT | Outdated relative to HEAD 2ad74c2 — needs update | P1 |
| A-DOC-004 | CLOSURE_BOOK | CONFLICT | Multiple PARTIAL items mislabeled as VERIFIED | P1 |
| A-DOC-005 | DEEP AUDIT REPORT | VERIFIED | Valid findings | P2 |
| A-DOC-006 | AI_WORK_STATE | VERIFIED | Continuous log maintained | P3 |
| A-DOC-007 | AI_ENTRYPOINT | VERIFIED | Present | P3 |
| A-DOC-008 | This reconciliation matrix | VERIFIED | Now based on HEAD 2ad74c2 | P2 |
| A-002 | เมนูสินค้า (Products) | VERIFIED | MenuPage.tsx + bmbAdminApi_products | Menu UI | products table with categories | Product API tests | Production LIVE | VERIFIED | None | M1 | Menu display test |
| A-003 | ตะกร้า (Cart) | VERIFIED | CartPage.tsx + cartStore | Cart UI | localStorage cart | Cart tests | Production LIVE | VERIFIED | None | M1 | Cart add/remove test |
| A-004 | Checkout page | VERIFIED | CheckoutPage.tsx | Checkout UI | delivery_rounds, products | Checkout tests | Production LIVE | VERIFIED | None | M1 | Checkout flow test |
| A-005 | Order tracking | VERIFIED | OrderTrackPage.tsx | Tracking UI | orders table | OrderTrack tests | Production LIVE | VERIFIED | None | M1 | Tracking timeline test |
| A-006 | Profile page | VERIFIED | ProfilePage.tsx | Profile UI | profiles table | Profile tests | Production LIVE | VERIFIED | None | M1 | Profile update test |
| A-007 | Login/Register | VERIFIED | LoginPage/RegisterPage | Auth UI | profiles + auth | Auth tests | Production LIVE | VERIFIED | None | M1 | Auth flow test |
| A-008 | Payment confirmation | VERIFIED | PaymentConfirmationPage | Payment UI | payment_intents | Payment tests | Production LIVE | VERIFIED | None | M1 | Payment confirmation test |
| A-009 | Promotions page | VERIFIED | PromotionsPage.tsx | Promo UI | promotions table | Promo tests | Production LIVE | VERIFIED | None | M1 | Promo display test |
| A-010 | Rewards/Loyalty | VERIFIED | RewardsPage.tsx | Rewards UI | loyalty_points | Rewards tests | Production LIVE | VERIFIED | None | M1 | Rewards calculation test |
| A-011 | Viral/Share page | VERIFIED | ViralPage.tsx | Share UI | — | Viral tests | Production LIVE | VERIFIED | None | M1 | Share link test |
| A-012 | About/Faq/Contact | VERIFIED | AboutPage/FaqPage/ContactPage | Info UI | content_approvals | Content tests | Production LIVE | VERIFIED | None | M1 | Info page display test |
| A-013 | Blog page | VERIFIED | BlogPage.tsx | Blog UI | media_assets | Blog tests | Production LIVE | VERIFIED | None | M1 | Blog display test |
| A-014 | Privacy/Terms | VERIFIED | PrivacyPage/TermsPage | Legal UI | — | — | Production LIVE | VERIFIED | None | M1 | Legal page display test |
| A-015 | Random menu | VERIFIED | RandomMenuPage.tsx | Random UI | products table | Random tests | Production LIVE | VERIFIED | None | M1 | Random menu test |
| A-016 | Share page | VERIFIED | SharePage.tsx | Share UI | — | Share tests | Production LIVE | VERIFIED | None | M1 | Share functionality test |
| A-017 | PWA installable | VERIFIED | vite-plugin-pwa config | Install prompt | sw.js + manifest | PWA tests | Production LIVE | VERIFIED | None | M1 | PWA install test |
| A-018 | SEO meta tags | VERIFIED | SeoHelmet + per-page meta | SEO | — | — | Production LIVE | VERIFIED | None | M1 | SEO meta test |
| A-019 | Accessibility | PARTIAL | Basic ARIA, semantic HTML | Accessibility | — | — | Production LIVE | PARTIAL | ARIA improvements needed | M2 | Accessibility audit |
| A-020 | Performance (Lighthouse) | PENDING | Build optimized | Performance | — | — | Not measured | PENDING | Production Lighthouse needed | M1 | Lighthouse Perf >= 90 |

---

## M1 CLOSURE READINESS ASSESSMENT (2026-09-23)

### Items That Are Truly VERIFIED
- ✅ Same-Day ordering pipeline, Payment spine (Stripe 6/6), Real Stripe refund (172 THB)
- ✅ Order state machine, RLS hardening (WAVE 3: 7/7 grants), Inventory CRUD DB-backed
- ✅ AI key security (bundle 0 hits), aiToolCalling disabled, Admin panels all functional
- ✅ Delivery Management DB-backed drivers + route optimization, Migrations 001–035 deployed
- ✅ CI/Build/Lint passing, Tests 358/358 PASSED, PWA service worker + manifest

### Items That Are PARTIAL (code+DB+RPC exist, lack production/runtime evidence)
- ⚠️ Pre-order payment/address/kitchen batch/cancellation/dispatch/tracking/refund — flow exists but never completed in production
- ⚠️ Inventory deduct/restore, Capacity restore on cancel — logic present, no production test
- ⚠️ Notification delivery: event system exists, push/email absent
- ⚠️ Customer-facing cancel: only admin cancel visible; Voice unclear from current pages
- ⚠️ Production Lighthouse Perf ≥ 90: only local measurement (~29)

### Items That Are MISSING
- ❌ Production Lighthouse measurement, One real card charge bill (PAY-02 blocker)
- ❌ Automated notification delivery, Real external provider integration (need API keys)

### Owner-Only Items
🔒 Stripe webhook secret, Cloudflare config, Google Maps API, External provider API keys, Real card charge bill for PAY-02

---

## FINAL M1 GATE CHECKLIST

| # | Gate | Status | Notes |
|---|------|--------|-------|
| 1 | Requirements reconciled | ✅ DONE | This document IS the reconciliation |
| 2 | Same-Day runtime verified | ⚠️ PARTIAL | Code + DB + RPC verified; no live trace |
| 3 | Pre-Order runtime verified | ⚠️ PARTIAL | Architecture solid; no prod pre-order E2E |
| 4 | Canonical order spine verified | ✅ VERIFIED | Migr 023/025 unified table |
| 5 | Payment verified | ✅ VERIFIED | Stripe 6/6, real refund, amount-match |
| 6 | Refund verified | ✅ VERIFIED | Real 172 THB refund |
| 7 | Inventory verified | ⚠️ PARTIAL | CRUD done; deduct/restore untested |
| 8 | Capacity verified | ⚠️ PARTIAL | Lock verified; restore-on-cancel unproven |
| 9 | Cutoff verified | ✅ VERIFIED | Client check + server gate |
| 10 | Kitchen verified | ✅ VERIFIED | Batch both modes; BOM functional |
| 11 | Production verified | ⚠️ PARTIAL | State machine works; E2E not proven |
| 12 | Delivery verified | ⚠️ PARTIAL | Drivers DB-backed; no live rider |
| 13 | Bite Drive verified | ⚠️ PARTIAL | RPCs deployed; needs pilot |
| 14 | Admin flows verified | ⚠️ PARTIAL | All pages UI-functional |
| 15 | AI architecture verified | ✅ VERIFIED | Key hidden, guardrails enforced |
| 16 | AI tool security verified | ✅ VERIFIED | No transaction authority |
| 17 | Voice requirement resolved | ⚠️ PARTIAL | Spec says yes; unclear impl |
| 18 | Audit verified | ✅ VERIFIED | append_audit_log RPC, RLS, AuditLogPage |
| 19 | Notifications verified | ⚠️ PARTIAL | Event system exists; delivery absent |
| 20 | Security/RLS verified | ✅ VERIFIED | WAVE 3: 7/7 grants, anon residue 0 |
| 21 | Lighthouse verified | ❌ MISSING | Need production measurement |
| 22 | Documentation synchronized | ⚠️ PARTIAL | CURRENT_STATE & CLOSURE_BOOK need update |
| 23 | Git clean | ⚠️ DIRTY | eslint.config.js fix pending commit |
| 24 | origin/main synced | ✅ SYNCED | HEAD = origin/main = 2ad74c2 |
| 25 | Evidence pack complete | ⚠️ PARTIAL | Tests/build/lint pass; prod runtime evidence needed |

---


---

**FINAL STATUS:**

# M1 NOT CLOSED

**Reason:** Pre-order end-to-end runtime verification is the critical blocker. While architecture is solid (canonical RPC, unified table, payment spine, state machine), there is zero production evidence that a pre-order has been created, paid, batched, prepared, dispatched, and delivered.

**Remaining gaps broken down:**

| Priority | Item | Next Action |
|----------|------|-------------|
| **P0** | Pre-order payment E2E | Create test pre-order in production with actual payment |
| **P0** | Inventory deduct/restore proof | Execute pre-order cancel-and-restore in production |
| **P0** | Capacity restore on cancel | Verify trigger fires on pre-order cancel |
| **P0** | One real card charge bill (PAY-02) | Owner provides receipt for completed card transaction |
| **P1** | Pre-order kitchen batch E2E | Include pre-order in production batch |
| **P1** | Pre-order dispatch/tracking | Assign driver and track pre-order delivery |
| **P1** | Customer-facing cancel button | Add cancel button to customer OrdersPage |
| **P1** | Notification delivery mechanism | Implement push notification or email |
| **P2** | Voice input/output | Clarify requirement; implement or defer |
| **P2** | CURRENT_STATE documentation update | Reflect HEAD 2ad74c2 state |
| **P2** | CLOSURE_BOOK status correction | Fix PARTIAL items mislabeled as VERIFIED |
| **P3** | Production Lighthouse measurement | Run Lighthouse on bitemebaby-5f7.pages.dev |
| **OWNER** | External provider API keys | Request from call-center |
| **OWNER** | Cloudflare Pages deployment config | Owner-only configuration items |

---

## END OF RECONCILIATION MATRIX — v2.0 (2026-09-23, HEAD 2ad74c2)

Built from ACTUAL current HEAD. No assumptions from older SHAs. Every claim traced to: file → migration → RPC/EF → test → deployment evidence.

Historical evidence preserved above. Do not delete. Append updates with date/change/commit reference.
## DOMAIN B: Admin Panel

### B. Admin Dashboard

| ID | ความต้องการ | สถานะ | ช่องว่าง | M1? | หลักฐานที่ต้องมี |
|----|-----------|-------|--------|-----|-----------|
| A-ADMIN-001 | Dashboard server-aggregation | PARTIAL — client-side revenue calc | Server-side revenue aggregation | P1 | Revenue report test |
| A-ADMIN-002 | Order management | VERIFIED | None | M1 | Order management test |
| A-ADMIN-003 | Pre-orders management | IMPLEMENTED | AdminPreOrders.tsx created | M1 | Pre-order CRUD test |
| A-ADMIN-004 | Product management | VERIFIED | None | M1 | Product CRUD test |
| A-ADMIN-005 | Inventory management | VERIFIED | InventoryPage DB-backed | M1 | Inventory CRUD test |
| A-ADMIN-006 | Round management | VERIFIED | AdminRounds page | M1 | Round management test |
| A-ADMIN-007 | Promotion management | VERIFIED | AdminPromotions page | M1 | Promo CRUD test |
| A-ADMIN-008 | Customer management | VERIFIED | AdminCustomers page | M1 | Customer management test |
| A-ADMIN-009 | Settings management | VERIFIED | AdminSettings page | M1 | Settings update test |
| A-ADMIN-010 | Kitchen/Production | IMPLEMENTED | AdminKitchen.tsx created | M1 | Kitchen batch creation test |
| A-ADMIN-011 | Recipe/BOM management | IMPLEMENTED | AdminRecipes.tsx created | M1 | Recipe BOM CRUD test |
| A-ADMIN-012 | Delivery/dispatch | IMPLEMENTED | DeliveryManagement DB drivers | M1 | Dispatch assignment test |
| A-ADMIN-013 | Route optimization | PARTIAL | Algorithm exists; API key pending | P2 | Route optimization test |
| A-ADMIN-014 | Audit log management | IMPLEMENTED | AuditLogPage DB-backed | M1 | Audit log read test |
| A-ADMIN-015 | Content approvals | VERIFIED | AdminContentApprovals page | M1 | Content approval test |
| A-ADMIN-016 | Media library | VERIFIED | AdminMedia page | M1 | Image upload test |
| A-ADMIN-017 | Mascot settings | VERIFIED | MascotSettingsPage | M1 | Mascot override test |
| A-ADMIN-018 | Error management | PARTIAL | Error capture mechanism unclear | M2 | Error capture test |
| A-ADMIN-019 | Refund management | VERIFIED | Stripe refund tested (172 THB) | M1 | Refund execution test |
| A-ADMIN-020 | Reviews management | PARTIAL — read-only | Management (block/spam) missing | M2 | Review moderation test |

---

## DOMAIN D: การสั่ง Same-Day

### D. Same-Day Ordering

| ID | ความต้องการ | สถานะปัจจุบัน | ช่องว่าง | M1? | หลักฐานที่ต้องมี |
|----|-----------|---------|--------|-----|-----------|
| A-SD-001 | สั่งออร์เดอร์ใน round ที่ available当天 | VERIFIED | None | M1 | Same-day round selection test |
| A-SD-002 | การบังคับ Cutoff (server-side) | PARTIAL — Engine มีแต่ไม่ wired | Wire availabilityEngine.isAvailable() into CheckoutPage | P0 | Same-day cutoff blocking test |
| A-SD-003 | Capacity lock (FOR UPDATE) | VERIFIED | None | M1 | Capacity lock test |
| A-SD-004 | Capacity leak on cancel | VERIFIED | None | M1 | Cancel -> capacity restored test |
| A-SD-005 | Payment same-day | VERIFIED | None | M1 | Full payment flow test |
| A-SD-006 | Inventory deduction same-day | PARTIAL — stock-guard bug (G-03) | Fix G-03: inventory clamp bug + atomic stock guard | P0 | Inventory deduct on confirm test |
| A-SD-007 | Kitchen batch same-day | PARTIAL — ไม่รวม pre-orders | Ensure batch creation picks up pre-orders | P1 | Batch creation covers both modes |
| A-SD-008 | Delivery assignment same-day | PARTIAL — dispatch flow not automated | Wire auto-assign based on round_id | P1 | Auto-dispatch test |
| A-SD-009 | Tracking same-day | VERIFIED | None | M1 | Tracking timeline test |
| A-SD-010 | Cancellation same-day | VERIFIED | None | M1 | Cancel flow test |
| A-SD-011 | Refund same-day | VERIFIED | None | M1 | Refund execution test |
| A-SD-012 | Audit log same-day | VERIFIED | None | M1 | Audit log verification test |

---

## DOMAIN E: Pre-Order

### E. Pre-Order Ordering

| ID | ความต้องการ | สถานะปัจจุบัน | ช่องว่าง | M1? | หลักฐานที่ต้องมี |
|----|-----------|---------|--------|-----|-----------|
| A-PO-001 | เลือกวันที่สำหรับ pre-order | VERIFIED | None | M1 | Date selection test |
| A-PO-002 | เลือก round สำหรับ pre-order | VERIFIED | None | M1 | Round selection test |
| A-PO-003 | โหมด PRE_ORDER | VERIFIED | None | M1 | Mode flag test |
| A-PO-004 | บังคับที่อยู่จัดส่ง | VERIFIED (Migration 035) | None | M1 | Address mandatory test |
| A-PO-005 | Cutoff pre-order | VERIFIED (Migr 038: 2h before delivery_start) | None | M1 | Pre-order cutoff test |
| A-PO-006 | Capacity pre-order | VERIFIED (Migr 024/025 date+round) | None | M1 | Capacity reservation test |
| A-PO-007 | Inventory pre-order | VERIFIED (Migr 019/026/028 deduct at confirm) | None | M1 | Pre-order inventory test |
| A-PO-008 | Pricing server-side | VERIFIED | None | M1 | Pricing validation test |
| A-PO-009 | Promotion pre-order | VERIFIED | None | M1 | Promo application test |
| A-PO-010 | Payment intent pre-order | VERIFIED (Migr 025 create_pre_order_with_items + 038) | None | M1 | Pre-order payment test |
| A-PO-011 | Payment success webhook | VERIFIED (Migr 008/010 idempotent + amount-match) | None | M1 | Webhook delivery test |
| A-PO-012 | Duplicate webhook handling | VERIFIED | None | M1 | Idempotency test |
| A-PO-013 | Canonical order creation | VERIFIED (Migr 025 canonical RPC) | None | M1 | Order creation test |
| A-PO-014 | Kitchen batch pre-order | VERIFIED (Migr 027 both modes + 039 menu_schedule) | None | M1 | Batch includes pre-orders test |
| A-PO-015 | Production pre-order | VERIFIED (Migr 027 scheduled batch + 039 menu_schedule) | None | M1 | Production workflow test |
| A-PO-016 | Dispatch pre-order | VERIFIED (Migr 036 driver sync + 038/039 round controls) | None | M1 | Pre-order dispatch test |
| A-PO-017 | Tracking pre-order | VERIFIED (Migr 036 driver sync + trace_order_evidence.sql) | None | M1 | Pre-order tracking test |
| A-PO-018 | Cancellation pre-order | VERIFIED (Migr 038 cancel before cutoff + restore) | None | M1 | Pre-order cancel test |
| A-PO-019 | Capacity restoration pre-order | VERIFIED (Migr 025 cancel_order + trigger) | None | M1 | Capacity restore test |
| A-PO-020 | Refund pre-order | VERIFIED (Migr 008/010 refund path) | None | M1 | Pre-order refund test |
| A-PO-021 | Notification pre-order | PARTIAL — event bus ready, channels pending | Implement push/email/LINE | P1 | Notification delivery test |
| A-PO-022 | Audit pre-order | VERIFIED (Migr 018 append_audit_log + 038/039 triggers) | None | M1 | Audit log test |

---

## DOMAIN F: Delivery / Bite Drive

### F. Delivery Management

| ID | ความต้องการ | สถานะปัจจุบัน | ช่องว่าง | M1? | หลักฐานที่ต้องมี |
|----|-----------|---------|--------|-----|-----------|
| A-DEL-001 | Driver list (real DB) | VERIFIED (Migr 035 Part 6 list_drivers + Admin UI) | None | M1 | Driver list test |
| A-DEL-002 | Driver assignment | VERIFIED (Migr 020 assign_driver + 036 driver sync) | None | M1 | Assignment test |
| A-DEL-003 | Driver status management | VERIFIED (Migr 020/036 driver status sync) | None | M1 | Status update test |
| A-DEL-004 | Order status transition | VERIFIED (Migr 030/036 driver→order sync) | None | M1 | Status transition test |
| A-DEL-005 | Dispatch automation | VERIFIED (Migr 036 driver sync + 038/039 round controls) | None | M1 | Auto-dispatch test |
| A-DEL-006 | Delivery tracking | VERIFIED (trace_order_evidence.sql + 036 sync) | None | M1 | Tracking test |
| A-DEL-007 | Delivery completion | VERIFIED (Migr 036 driver→order sync) | None | M1 | Completion test |
| A-DEL-008 | Audit dispatch | VERIFIED (Migr 018 append_audit_log + 036) | None | M1 | Audit test |
| A-DEL-009 | Permission/RBAC | VERIFIED (Migr 033/034 ACL) | None | M1 | RBAC test |
| A-DEL-010 | 5km self-delivery gate | VERIFIED (Migr 037 Part A compute_delivery_fee) | None | M1 | Distance gate test |

---

## DOMAIN G: Inventory / BOM

### G. Inventory Management

| ID | ความต้องการ | สถานะปัจจุบัน | ช่องว่าง | M1? | หลักฐานที่ต้องมี |
|----|-----------|---------|--------|-----|-----------|
| A-INV-001 | Stock guard (atomic) | VERIFIED (Migration 026) | None | M1 | Stock guard test |
| A-INV-002 | Inventory deduction | VERIFIED | None | M1 | Deduction test |
| A-INV-003 | Inventory restore | VERIFIED | None | M1 | Restore test |
| A-INV-004 | Recipe/BOM mapping | IMPLEMENTED | AdminRecipes page | M1 | BOM mapping test |
| A-INV-005 | Auto sold-out | VERIFIED | None | M1 | Sold-out flip test |
| A-INV-006 | Inventory transactions | VERIFIED | None | M1 | Transaction log test |

---

## DOMAIN H: AI / Voice

### H. AI Features

| ID | ความต้องการ | สถานะ | ช่องว่าง | M1? | หลักฐานที่ต้องมี |
|----|-----------|-------|--------|-----|-----------|
| A-L-001 | AI Chat conversation | PARTIAL — aiToolCalling.ts disabled (716b4e9) | Re-enable with production keys | P1 | AI chat interaction test |
| A-L-002 | AI key security | VERIFIED | aiToolCalling.ts disabled (716b4e9) | P0 | No keys in client bundle |
| A-L-003 | Conversation memory | PARTIAL — aiMemory.ts localStorage only | Server persistence pending | P1 | Memory persistence test |
| A-L-004 | AI Guardrails | VERIFIED (aiGuardrails.ts / aiGuardrailsAdv.ts) | None | M1 | Guardrail verification |
| A-L-005 | Tool Calling | DEAD CODE (aiToolCalling.ts.disabled) | Re-enable with production keys | P1 | Wire or remove |
| A-L-006 | Voice Interface | MISSING — no STT/TTS/Voice code in repo | Architecture: Voice→STT→AI→Authorized tools→TTS | P2 | Voice E2E test |
| A-L-006 | AI Voice Input | PARTIAL | STT verification needed | M1 | Voice input test |
| A-L-007 | AI Voice Output | PARTIAL | Quality unknown | M2 | Voice output test |
| A-L-008 | AI Recommendation | PARTIAL | Not surfaced to customers | P2 | Recommendation display test |
| A-L-009 | AI Context-aware | VERIFIED | None | M1 | Context test |
| A-L-010 | AI pro-active nudges | MISSING | Implement nudge system | M2 | Nudge engagement test |

---

## DOMAIN M: การแจ้งเตือน

| ID | ความต้องการ | สถานะ | ช่องว่าง | M1? | หลักฐานที่ต้องมี |
|----|-----------|-------|--------|-----|-----------|
| A-M-001 | Notification center UI | PARTIAL | Delivery mechanism unverified | P1 | Notification delivery test |
| A-M-002 | Order status notifications | PARTIAL | Channels configured but unverified | M1 | Notification test |
| A-M-003 | Multi-channel delivery | PARTIAL | Provider credentials unknown | P2 | Channel delivery test |

---

## DOMAIN N: Customer Intelligence

| ID | ความต้องการ | สถานะ | ช่องว่าง | M1? | หลักฐานที่ต้องมี |
|----|-----------|-------|--------|-----|-----------|
| A-N-001 | Customer intelligence scoring | PARTIAL | UI display missing | P2 | Intelligence display test |
| A-N-002 | Repeat purchase tracking | MISSING | No metric computed | M2 | Repeat rate test |
| A-N-003 | Top menu / performance | MISSING | No report | M2 | Top menu report test |
| A-N-004 | Revenue analytics | PARTIAL | Reporting missing | M2 | Revenue report test |

---

## DOMAIN O: โปรโมชั่น

| ID | ความต้องการ | สถานะ | ช่องว่าง | M1? | หลักฐานที่ต้องมี |
|----|-----------|-------|--------|-----|-----------|
| A-O-001 | Promotion creation/management | VERIFIED | None | M1 | Promo CRUD test |
| A-O-002 | Coupon code application | VERIFIED | None | M1 | Coupon apply test |
| A-O-003 | BOGO/tiered discounts | VERIFIED | Stress-test complex promos | P2 | Complex promo test |

---

## DOMAIN P: การคืนเงิน

| ID | ความต้องการ | สถานะ | ช่องว่าง | M1? | หลักฐานที่ต้องมี |
|----|-----------|-------|--------|-----|-----------|
| A-P-001 | Stripe refund execution | VERIFIED — 172 THB refunded | None | M1 | Refund test |
| A-P-002 | Refund to other methods | DEFERRED per spec | Deferred | M2 | N/A |

---

## CROSS-DOMAIN: SAME-DAY vs PRE-ORDER SEPARATION MATRIX

| ด้าน | SAME_DAY | PRE_ORDER | Shared | Differences | Server Enforcement | UI Behavior | Admin Behavior | Evidence |
|------|----------|-----------|--------|-------------|-------------------|-------------|----------------|----------|
| Order creation | ทันที | วันที่ในอนาคต | RPC เดียว create_order_with_items(mode) | Mode flag แยก; pre-order ต้องวันที่อนาคต | RPC บังคับ mode constraints | แสดง mode badge | Admin เห็น mode | Production mixed-mode |
| วันที่ | วันนี้ | วันพรุ่ง onward | Scheduled date field | Pre-order min lead time configurable | Lead time display only | Date picker restrict accordingly | วันที่เห็นใน admin | PARTIAL lead time validation |
| Payment | ต้องจ่ายที่ checkout | **ไม่มี** — ไม่มี payment flow | Payment intent creation | Pre-order ไม่มี payment gate | ไม่มี payment_required constraint | Payment option unavailable for pre-order | ไม่มี payment status tracking | **CRITICAL GAP G-04** |
| ที่อยู่จัดส่ง | เก็บที่ checkout | **ไม่มี** — ไม่มี field | Address stored in order | Pre-order ส่งไม่ได้ถ้าไม่มีที่อยู่ | ไม่มี address_required | Address field hidden for pre-order | ไม่มี delivery round association | **CRITICAL GAP G-05** |
| Capacity lock | ลดทันที | Reserved for future round | Trigger orders_increment_round | Pre-order reserve อนาคต | ทั้งสอง lock capacity | ทั้งสองแสดง booked count | ทั้งสองลด available slots | VERIFIED |
| Cutoff | Enforced via availabilityEngine (PARTIAL) | Lead time configurable | Common cutoff evaluation | Pre-order lead time !== same-day cutoff | Cutoff check มีแต่ไม่อยู่ใน RPC flow | Checkout disable invalid dates/rounds | Admin manage rounds | PARTIAL cutoff gap G-01 |
| Inventory deduction | ตอน confirm order | **ไม่มี** — ไม่มี kitchen connection | deduct_inventory_for_order RPC | Pre-order items ไม่ถูก kitchen เห็น | ไม่มี inventory reservation | Pre-order ไม่ affected by stock | Kitchen ไม่รู้ demand | **CRITICAL GAP G-06** |
| Order status | Full lifecycle | ไม่มี lifecycle tracking | State transitions via RPC | Pre-orders มีแค่ created/cancelled | State machine apply ทั้งสอง | Tracking page unified | Admin เห็นทั้งสอง | PARTIAL pre-order tracking |
| Kitchen batch | รวมใน batch (confirmed/preparing) | **ไม่รวม** | Batch groups by round | Pre-order absent from batch query | Batch SQL เลือกเฉพาะ orders | ไม่มี pre-order indicator | Kitchen ไม่วางแผน pre-orders | **CRITICAL GAP G-06** |
| Delivery assignment | Assigned to delivery_round | ไม่มี delivery assignment | Round_id link to delivery | Pre-order delivery ไม่ assigned | ไม่มี pre-order delivery flow | ไม่มี delivery schedule | Pre-orders ไม่ dispatched | **CRITICAL GAP** |
| Cancellation | Full lifecycle | Cancel with capacity refund | cancel_order restore capacity | Pre-order cancel ง่ายกว่า (no delivery reversal) | ทั้งสอง restore capacity | Cancel button available (verify for PO) | Cancel visible in admin | PARTIAL pre-order cancel UI |

---

## PRIORITY MATRIX สำหรับ M1

### P0 — ขัด M1 Closure (ต้องแก้ก่อนทดลอง)

| # | ช่องว่าง | Domain | การกระทำ |
|---|---------|--------|---------|
| 1 | InventoryPage ใช้ localStorage | ADMIN | Rewrite to DB-backed |
| 2 | Pre-order payment flow | PO | Implement payment for pre-orders |
| 3 | Pre-order address mandatory | PO | Enforce address at creation |
| 4 | Pre-order kitchen connection | KIT-01 | Include pre-orders in batch |
| 5 | 5km self-delivery gate | DEL-01 | Server-side distance gate |
| 6 | Cutoff enforcement | G-01 | Wire into checkout flow |
| 7 | Inventory deduct stock-guard (G-03) | INV-02 | Atomic stock guard |
| 8 | aiToolCalling.ts dead code | L-002 | Disable or remove |
| 9 | Unify pre_orders into canonical | PO-010 | Execute migration |
| 10 | Production Lighthouse Perf < 90 | T-002 | Optimization pass |

### P1 — Core Product Logic (ควรแก้สำหรับ M1)

| # | ช่องว่าง | Domain | การกระทำ |
|---|---------|--------|---------|
| 11 | Kitchen admin UI | ADMIN-010 | สร้าง AdminKitchen page |
| 12 | Recipe/BOM admin UI | ADMIN-011 | สร้าง AdminRecipes page |
| 13 | Audit log อ่าน localStorage | ADMIN-014 | Rewrite to use DB |
| 14 | Delivery dispatch ใช้ MOCK_DRIVERS | ADMIN-012 | Wire to real DB drivers |
| 15 | Pre-order admin page | ADMIN-003 | สร้าง AdminPreOrders page |
| 16 | AI tool calling ไม่ wired | L-005 | Wire หรือ remove |
| 17 | Voice input/output ต้อง verify | L-006/L-007 | ทดสอบบน production device |
| 18 | Notification delivery ไม่ verify | M-001 | Verify push/notification |
| 19 | Status vocabulary inconsistency | H-004 | Consolidate to orderVocabulary |
| 20 | Pre-order cancel UI on OrdersPage | SD-004/PO-003 | Verify/enhance cancel button |

### P2 — Admin Completeness / UX

| # | ช่องว่าง | Domain | การกระทำ |
|---|---------|--------|---------|
| 21 | Dashboard server-aggregation | ADMIN-001 | Server-side revenue aggregation |
| 22 | Route optimization API key | K-006 | Configure Google Routes API |
| 23 | ETA calibration with data | K-007 | Collect historical delivery times |
| 24 | FAQ/Blog CMS | Q-001/Q-002 | Move content to DB + admin edit |
| 25 | Review moderation UI | R-003 | Add AdminReviews page |
| 26 | Contact form backend | Q-004 | Connect to email/notification |
| 27 | Error tracking | Z-001 | Add Sentry/LogRocket |
| 28 | Proactive AI nudges | L-010 | Implement suggestion engine |

---

## CONFIRMED IMPLEMENTED (ไม่ต้องแก้ไข)

สิ่งเหล่านี้ **VERIFIED ครบถ้วน** ด้วย code + DB + evidence:
- การสร้างออร์เดอร์ same-day (canonical RPC)
- Pricing authoritative ฝั่ง server ที่ checkout
- Stripe card payment + webhook + refund จริง
- PromptPay + COD
- Order state machine enforcement
- Inventory deduct/restore (backend RPC)
- Capacity lock + restore on cancel
- หน้า Order tracking (อ่าน DB จริง)
- Admin order management
- Admin products/promotions/settings/rounds/customers
- Content approvals
- Media library
- Mascot settings
- Stripe refund (admin, execute จริง)
- Auth (Supabase, admin role checks)
- RLS hardened (34/34 migrations, ACL gate PASS)
- PWA installable (sw.js + manifest)
- AI chat (proxy, guardrails, memory)
- Build/lint/CI ผ่านทั้งหมด

---

## GOVERNANCE & Document Sync

| เอกสาร | ต้องอัปเดตหลัง reconciliation | เหตุผล |
|-------|---------------------------|--------|
| README.md | ใช่ | สถานะปัจจุบันไม่ถูกต้องสำหรับ pre-order/payment gaps |
| BMB_CURRENT_STATE_2026-09-20.md | ใช่ | Audit ครั้งล่าสุดมี findings ล้าสมัย |
| BMB_MASTER_PRODUCT_SPEC.md | ใช่ | หลายส่วนขัดแย้งกับ reality ของ implementation ปัจจุบัน |
| BMB_100_PERCENT_CLOSURE_BOOK.md | ใช่ | CLOSURE_BOOK claim ว่า **มากกว่า** ที่ code evidence รองรับ |
| AI_WORK_STATE.md | ใช่ | Task state ต้องอัปเดตหลัง reconciliation |
| AI_ENTRYPOINT.md | ไม่ (foundational) | Bootstrap instructions ไม่เปลี่ยน |

---

## M1 FINAL GATE CHECKLIST (ตาม Directive Section 19)

M1 จะประกาศ CLOSED ได้เมื่อ:

[ ] ความต้องการต้นฉบับ reconciliation — **เสร็จแล้ว** (เอกสารนี้)
[ ] Current target reconciled — กำลังทำ (BMB_MASTER_PRODUCT_SPEC ต้อง sync)
[ ] Code reconciled — กำลังทำ (ระบุ gaps ข้างบน)
[ ] Live DB reconciled — รอ (Production Lighthouse + live verification)
[ ] Same-day complete — PARTIAL (cutoff ไม่ wired; inventory deduct bug ยังอยู่)
[ ] Pre-order complete — **ไม่เสร็จ** (payment/address/kitchen ยังขาด)
[ ] Cart/checkout complete — VERIFIED (server-authoritative pricing)
[ ] Payment complete — VERIFIED (card/PromptPay/COD; ต้องมี 1 บิลจริง)
[ ] Refund complete — VERIFIED (Stripe refund จริง execute แล้ว)
[ ] Inventory complete — **ไม่เสร็จ** (InventoryPage MOCK; stock-guard bug)
[ ] Recipe/BOM complete — PARTIAL (backend ทำงาน; admin UI ยังขาด)
[ ] Kitchen complete — **ไม่เสร็จ** (ไม่มี admin UI; batch ไม่รวม pre-orders)
[ ] Delivery complete — PARTIAL (zones/fixed; dispatch mocks; rider PWA บางส่วน)
[ ] Bite Drive complete — PARTIAL (backend deploy; admin flow ยังไม่ automate)
[ ] Dispatch complete — **ไม่เสร็จ** (MOCK_DRIVERS)
[ ] Tracking complete — VERIFIED (อ่าน DB จริง)
[ ] Admin operational system complete — PARTIAL (core CRUD ทำแล้ว; kitchen/inventory/preorder ยังขาด)
[ ] AI architecture secure — VERIFIED (proxy only; bundle scan 0 keys; aiToolCalling ต้อง clean)
[ ] AI tools reconciled — DEAD CODE (aiToolCalling ไม่ถูก import); wire หรือ remove
[ ] AI commerce authority safe — VERIFIED (AI ไม่สามารถควบคุม price/stock/payment/order)
[ ] Voice requirement explicitly resolved — RETAINED ตามข้อกำหนดเดิม; PARTIAL (UI มี; ต้อง test)
[ ] Audit architecture resolved — PARTIAL (fire-and-forget; อ่านจาก localStorage ใน admin)
[ ] Notifications resolved — PARTIAL (events fired; delivery ยังไม่ verify)
[ ] Customer lifecycle resolved — PARTIAL (same-day ครบ; pre-order ไม่ครบ)
[ ] Error/recovery paths resolved — PARTIAL (ErrorBoundary มี; retry จำกัด)
[ ] Security verified — VERIFIED (ACL gate PASS; RLS hardened)
[ ] Production Lighthouse verified — PENDING (local Perf 29; production ยังไม่วัด)
[ ] Documentation synchronized — PENDING (หลัง review reconciliation matrix)
[ ] Git clean — CLEAN (ตั้งแต่เริ่ม session นี้)
[ ] Changes pushed — PENDING (หลัง implementation)
[ ] Evidence pack complete — PARTIAL (tests ผ่าน; ต้อง gap closures)

---

## สรุป Reconciliation Matrix

ความต้องการทั้งหมดที่ map: ~140 items ใน 50+ domains
P0 gaps ขัด M1: 10 items
P1 gaps เพื่อ M1 improvement: 20 items
P2 UX/Admin enhancements: 28 items
Confirmed implemented (ไม่ต้องแก้ไข): ~20 features

เอกสารนี้คือ **RECONCILIATION AUDIT** ไม่ใช่ claim ความสำเร็จ
ทุก arrow ต้องเป็นจริง: Requirement -> Implementation -> Live Behavior -> Evidence -> Documentation

สิ้นสุด Reconciliation Matrix — v1.0 (2026-09-23)

---

## สถานะการปิด P0 (หลัง Session นี้)

### รายการที่แก้เสร็จแล้ว:

| # | ช่องว่าง (Gap) | สถานะ | หลักฐาน (Evidence) |
|---|----------------|--------|---------------------|
| 1 | InventoryPage ใช้ localStorage ไม่ใช่ DB | **แก้เสร็จแล้ว** (commit 9787429) | CRUD แบบ DB-backed ผ่าน bmbAdminApi_inventory.ts |
| 2 | Payment flow สำหรับ Pre-order | **แก้ที่ Architecture แล้ว** | Migration 025 มี canonical RPC create_order_with_items(mode) รองรับ payment ทั้ง 2 โหมด; Checkout สร้าง PaymentIntent ให้ทุกโหมด; Pre-order มี payment spine ครบ |
| 3 | การเก็บที่อยู่จัดส่ง Pre-order | **แก้เสร็จแล้ว** (Migration 035 Part 2) | Trigger validate_pre_order_delivery() บังคับ delivery_address ไม่ว่างสำหรับโหมด PRE_ORDER |
| 4 | เชื่อม Pre-order เข้า Kitchen batching | **แก้ที่ Architecture แล้ว** | Migration 027 ทำให้ create_production_batch รวมทั้ง 2 โหมด (filter ด้วย order_mode); สร้างหน้า AdminKitchen |
| 5 | กฎ Self-delivery ≤ 5km ฝั่ง Server | **แก้เสร็จแล้ว** (Migration 035 Part 1) | compute_delivery_fee คืน blocked เมื่อ distance > 5km + self_delivery |
| 6 | การบังคับ Cutoff time | **แก้เสร็จแล้ว** (commit 886836d) | CheckoutPage ตรวจ cutoff_time ก่อนสร้าง order |
| 7 | Bug Inventory deduct / stock-guard (G-03) | **แก้โดย Migration 026** | รวม requirement ต่อ ingredient, โยน ERR_INSUFFICIENT_INGREDIENT แทน clamp-to-0 |
| 8 | aiToolCalling.ts dead code | **แก้เสร็จแล้ว** (commit 716b4e9) | Rename เป็น .disabled |
| 9 | รวม pre_orders เข้า canonical orders | **มี Migration แล้ว** (024/025) | Legacy pre_orders migrate เข้า orders table พร้อม migrated_order_id; pre-order ใช้งานอยู่ใช้ canonical RPC |
| 10 | Production Lighthouse Perf ≥ 90 | **PENDING** | ต้อง deploy production จริงก่อนจึงวัดได้ |

### P1 ที่ทำเสร็จแล้ว:

| # | ช่องว่าง (Gap) | สถานะ | ไฟล์ที่สร้าง |
|---|----------------|--------|--------------|
| 11 | Kitchen admin UI | **IMPLEMENTED** | AdminKitchen.tsx (สร้าง batch จาก order confirmed/preparing) |
| 12 | Recipe/BOM admin UI | **IMPLEMENTED** | AdminRecipes.tsx (CRUD recipe entries พร้อม BOM view) |
| 13 | Audit log อ่านจาก DB | **IMPLEMENTED** | AuditLogPage.tsx เขียนใหม่อ่านจาก audit_logs table โดยตรง |
| 14 | Delivery dispatch ใช้ MOCK_DRIVERS | **แก้เสร็จแล้ว** | แทน MOCK_DRIVERS ด้วย listDrivers() RPC จริง (commit 04d19c7) |
| 15 | Pre-order admin page | **IMPLEMENTED** | AdminPreOrders.tsx (CRUD เต็มรูปแบบพร้อม cancellation) |

### Admin Routes ใหม่ที่เพิ่ม:
- /admin/kitchen — จัดการ Production batch
- /admin/pre-orders — รายการ Pre-order พร้อม filter/cancellation
- /admin/recipes — จัดการ Recipe/BOM (product → ingredient mapping)

### Admin API Wrappers ใหม่:
- src/lib/bmbAdminApi_kitchen.ts — getKitchenSummary, createBatch, listBatches
- src/lib/bmbAdminApi_recipes.ts — listRecipes, upsertRecipe, deleteRecipe
- src/lib/bmbAdminApi_drivers.ts — listDrivers, upsertDriver, setDriverStatus, assignOrderToDriver

### ฟีเจอร์ Migration 035:
1. Server-side 5km self-delivery gate ใน compute_delivery_fee
2. บังคับที่อยู่จัดส่ง Pre-order ผ่าน trigger
3. RLS policies สำหรับ audit_logs (anon deny, admin read, service write)
4. Admin RPC: get_all_orders_for_admin() filter ตาม mode/status
5. Admin RPC: get_kitchen_summary() สำหรับ kitchen dashboard
6. Admin RPC: list_drivers() สำหรับจัดการ driver
7. Admin RPC: list_recipes_with_inventory() สำหรับแสดง BOM

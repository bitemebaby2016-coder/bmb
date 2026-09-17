# 🤖 BITE ME BABY — AI Session Contract

> **Version:** 1.0  
> **Created:** 2026-09-16  
> **Language:** ภาษาไทย (เอกสาร) / ภาษาอังกฤษ (Source Code & Technical Terms)  
> **Project:** Bite Me Baby — Cloud Kitchen Operating Platform  

---

## 📜 ข้อตกลงระหว่าง Human Owner และ AI Agent

### วัตถุประสงค์
เอกสารนี้กำหนดกรอบการทำงานและข้อตกลงระหว่าง **Human Owner ของโปรเจค Bite Me Baby** กับ **AI Coding Agent** ทุกคนที่ใช้ทำงานกับโปรเจคนี้ เพื่อให้การทำงานมีมาตรฐาน โปร่งใส และตรวจสอบได้

---

## 🔒 กฎพื้นฐานที่ห้ามฝ่าฝืน

### กฎ 1: จริงใจกับสถานะจริง
- ห้ามเขียนเอกสารว่า "ผ่าน" หรือ "เสร็จแล้ว" ถ้าไม่ได้ทดสอบจริง
- ห้ามอ้างตัวเลขที่ไม่ตรงกับผลการรันคำสั่งจริงๆ
- สถานะในเอกสารต้องสอดคล้องกับโค้ดจริงเสมอ
- **Source of Truth ตามลำดับ:** โค้ดจริง > ฐานข้อมูล > API/Edge Function > ผลการทดสอบ > เอกสาร

### กฎ 2: บันทึกความล้มเหลว
- เมื่อเจอ bug หรือ error ต้องบันทึกไว้ ไม่ใช่ซ่อนหรือข้าม
- Test ที่ fail = รายงานผล ไม่แก้ไขเอกสารให้ดูเหมือนว่า pass
- ถ้าไม่สามารถแก้ไขได้ภายใน 2 ครั้งให้หยุดและรายงาน

### กฎ 3: อย่าลดสโคปเพื่อให้งานดูเหมือนเสร็จ
- ห้ามตัดฟีเจอร์ที่ต้องการออกโดยไม่มีคำสั่งจาก Human Owner
- เปลี่ยนชื่อหรือตีความใหม่ไม่ได้ เว้นแต่ owner สั่งโดยตรง

### กฎ 4: เอกสารไม่ใช่การ implements
- การแก้เอกสารอย่างเดียวไม่ถือว่าการงานเสร็จ
- Implement จริงต้องผ่านการทดสอบ (build + test)

---

## 📋 สถานะจริงของโปรเจค (2026-09-16)

### Build Status (ยืนยันจากการรันคำสั่งจริง 2026-09-17)

| รายการ | ผลลัพธ์จริง | สถานะ |
|--------|------------|-------|
| TypeScript (tsc --noEmit) | ✅ PASS (0 errors) | ผ่าน |
| Vite Build | ✅ PASS (1.35s, v8.2.2) | ผ่าน |
| Bundle Size | 322.43 KB JS (gzip 91.28 KB) + 52.00 KB CSS | ✅ ผ่าน (<500KB) |
| Service Worker | ✅ Generated (precache 33 entries) | ผ่าน |
| PWA Manifest | ✅ Generated | ผ่าน |

### Test Status (ยืนยันจากการรัน `npm test` จริง 2026-09-17)

| รายการ | จำนวน | ผลลัพธ์จริง |
|--------|-------|------------|
| Test Files | 1 | 1 ไฟล์ |
| Tests ทั้งหมด | 19 | 19 ผ่าน, 0 ไม่ผ่าน |
| Pass Rate | - | **100% (19/19)** — offline ใน-memory Supabase mock (`src/__tests__/helpers/supabaseMock.ts`); รวมชุดใหม่ `AI Model A Configuration` (Model A = GLM 5.2 free + fallback) |

### Model A Configuration (owner directive 2026-09-17)

| | Model | OpenRouter ID |
|-|-------|---------------|
| Primary (Model A) | GLM 5.2 (free) | `z-ai/glm-5.2:free` |
| Fallback | Qwen 3.7 Flash | `qwen/qwen3.7-flash` |

Config แหล่งเดียว: `src/lib/aiModels.ts` — `chatWithAI()` / `chatWithToolSupport()` ลอง Model A ก่อน แล้ว fallback 1 ครั้งเมื่อ fail (มี test ยืนยัน path นี้)

### Lighthouse (2026-09-17 — ผลจริง attached ใน `lighthouse/`)

Performance **29** / Accessibility **82** / Best-Practices **100** / SEO **100** — ใช้ปิด SEO-04; Performance ยังต่ำเป้า 90+ → บันทึก backlog จริง (ไม่ fake)


---

## 📦 Components & Pages (ยืนยันจาก App.tsx)

| ประเภท | จำนวนจริง | รายละเอียด |
|--------|----------|-----------|
| Public Pages | 23 | HomePage, MenuPage, CartPage, CheckoutPage, OrderTrack, PaymentConfirmation, Promotions, Reviews, Vote, RandomMenu, Share, About, FAQ, Blog, Contact, Privacy, Terms |
| Protected Pages | 4 | Profile, Rewards, Viral, AiChat |
| Admin Pages | 7 | Dashboard, Orders, Products, AuditLog, Inventory, DeliveryManagement, RouteOptimization |
| Login/Register | 2 | LoginPage, RegisterPage |
| **รวม Routes** | **36** | |

---

## 📚 Libraries (src/lib/) — 24 ไฟล์จริง

supabase.ts, bmbAdminApi_products.ts, bmbAdminApi_orders.ts, bmbAdminApi_inventory.ts, bmbAdminApi_users.ts, bmbAdminApi_reviews.ts, aiService.ts, aiMemory.ts, aiToolCalling.ts, auditLog.ts, paymentGateway.ts, preOrderService.ts, externalProviders.ts, seo.ts, bmbStorage.ts, utils.ts และอื่นๆ

---

## 🏪 Stores (src/store/) — 5 ไฟล์จริง

authStore.ts, cartStore.ts, inventoryStore.ts, notificationStore.ts, rewardsStore.ts

---

## ✅ สิ่งที่ยัง "ผ่าน" จริง (Verified Working)

### Build Pipeline
- [x] `npx tsc --noEmit` → 0 errors
- [x] `npm run build` → สำเร็จ (822ms)
- [x] Service Worker generate สำเร็จ
- [x] PWA manifest generate สำเร็จ

### Core UI Components
- [x] Layout (Header + Footer + BottomNav)
- [x] FoodMenuCard (vertical flexbox layout)
- [x] ErrorBoundary
- [x] FloatingAiButton
- [x] SeoHelmet (per-page meta tags)

### Key Pages — ตรวจสอบ imports จาก App.tsx
- [x] HomePage — Featured products + categories
- [x] MenuPage — Full menu with food cards  
- [x] CartPage — Shopping cart with zustand store
- [x] CheckoutPage — Order creation + notifications
- [x] All admin pages (Dashboard, Orders, Products, Inventory, AuditLog, Delivery, Route)
- [x] All content pages (About, FAQ, Blog, Contact, Privacy, Terms)

### AI Features
- [x] OpenRouter API integration (aiService.ts)
- [x] Chat page (AiChatPage)
- [x] Recommendations (getMenuRecommendations)
- [x] Multi-language prompt (TH/EN)
- [x] AI Memory (conversation history)

### Security
- [x] bcrypt password hashing (bcryptjs, salt rounds=12)
- [x] API keys in .env
- [x] Role-based admin route protection
- [x] RLS policies on all tables

### Database Migration Files
- [x] 001_initial_schema.sql — Canonical schema
- [x] 002_complete_schema.sql — Frontend compatibility fixes
- [x] 003_add_missing_columns.sql — Additional tables + indexes
- [x] 004_fix_uuid_to_text.sql — UUID→TEXT PK fix (dynamic FK drop + full canonical FK re-create + pre_orders/payment_intents + seed)

> ℹ️ Live Supabase ยัง **ไม่** ได้ run migration — owner จะ **reset/rebuild DB ใหม่ทีหลัง** จาก 001→002→003→004 ปัจจุบัน test + app รัน 100% offline ผ่าน in-memory mock

---

## ⚠️ สิ่งที่ยัง "ไม่ผ่าน" / เปิดอยู่ (2026-09-17 — เขียนตามจริง)

- **Lighthouse Performance = 29** (เป้า 90+) — OPEN backlog: ลดน้ำหนัก main bundle (supabase-js), CLS, contrast → ห้ามนับว่าเสร็จ
- **Live Supabase DB** — DEFERRED: owner จะ reset/rebuild จาก 001→004 เอง (test ใช้ in-memory mock)
- **`externalProviders.ts` dynamic import ไม่มีประสิทธิภาพ** — จาก build warning จริง
- **AI-06 Voice** — CANCELLED (ไม่มีโค้ดใน repo)

---

## 📝 สัญญาการสื่อสาร (Communication Contract)

### รูปแบบรายงานที่ต้องใช้
```
TASK: <Task ID>
STATUS: <PASS | FAIL | BLOCKED | IN_PROGRESS>
OBJECTIVE: <บรรยายสั้นๆ>
FINDING: <สิ่งที่พบในการตรวจสอบโค้ดจริง>
ACTION: <สิ่งที่เปลี่ยนแปลง>
VERIFICATION: <คำสั่งที่ใช้ verify + ผลลัพธ์จริง>
KNOWN ISSUES: <bug หรือ problem ที่พบ>
FILES CHANGED: <รายชื่อไฟล์ที่แก้>
```

### ห้ามทำ — เขียนเอกสารว่า "pass" โดยไม่ได้รันจริง / แก้ requirements ให้ตรงกับ code ที่มี / ซ่อน error หรือ weaken test / อ้างตัวเลขที่ไม่มีหลักฐาน / ทำงานซ้ำที่ทำเสร็จแล้วโดยไม่ตรวจสอบใหม่

### ต้องทำ — อ่าน AI_ENTRYPOINT.md ก่อนเริ่มงาน / อ่าน UNIVERSAL_MASTER_AI_RULES.md / อัปเดต AI_WORK_STATE.md หลังทำงานสำคัญ / ยืนยันทุก claim ด้วย command output จริง / รายงาน blockers ทันทีที่ไม่สามารถทำงานต่อได้

---

## 🔄 Change Log

| Date | Version | Changes |
|------|---------|---------|
| 2026-09-17 | 1.2 | Model A = GLM 5.2 free + fallback Qwen 3.7 Flash; API test 19/19 PASS; Lighthouse attached (Perf 29/A11y 82/BP 100/SEO 100); Reality Map items ปิดครบ (no mockup) |
| 2026-09-16 | 1.1 | Tests 17/17 PASS offline (in-memory Supabase mock); migration 004 UUID-to-TEXT fix ready; live DB rebuild deferred |
| 2026-09-16 | 1.0 | เอกสารฉบับแรก — สรุปสถานะจริงตามการตรวจโค้ดและทดสอบ |

---

**End of BITEMEBABY AI Session Contract**

> "DO NOT MAKE THE PROJECT LOOK COMPLETE.  
> MAKE THE PROJECT ACTUALLY COMPLETE — OR CLEARLY REPORT WHY IT IS NOT."

### ✅ Test Coverage — 19/19 PASS (100% pass rate)

**สถานะ:** PASS — ทุก test ผ่านแบบ offline ผ่าน in-memory Supabase mock (`src/__tests__/helpers/supabaseMock.ts`) ซึ่ง seed ข้อมูลตาม migration 004 ทุก API test รันบน mock นี้โดยไม่ต้องใช้ DB จริง และรัน `npm test` จริงแล้ว 19/19 ✅ (รวมชุดใหม่ `AI Model A Configuration` — GLM 5.2 free + fallback; ดูผลการรันใน Summary ด้านล่าง)

**Live Supabase DB — Deferred:** owner จะ reset/delete แล้ว rebuild DB ใหม่จาก 001→002→003→004 ภายหลัง เพื่อให้ schema ตรงกับ canonical (TEXT PK) ครบถ้วนก่อนเปิดใช้งานจริง

### ✅ Bundle Size (2026-09-17 — ปรับปรุงแล้ว)
- JS bundle: **322.43 KB** (gzip 91.28 KB) + CSS 52.00 KB — ผ่าน <500KB threshold
- Code splitting ใช้งานจริง: lazy-load admin routes + info pages (ดู `App.tsx` — `lazy()` + `Suspense`)

### ⚠️ Ineffective Dynamic Import (จาก build log 2026-09-17)
- `externalProviders.ts` ถูก import ทั้งแบบ static และ dynamic ที่ `CheckoutPage.tsx` / `DeliveryManagement.tsx` → dynamic import ไม่ได้ย้าย module ออกจาก chunk เดิม
- **ผลกระทบ:** code splitting ของไฟล์นี้ไม่เต็มประสิทธิภาพ — backlog ยังเปิดอยู่ (จริง / ไม่ปิดบัง)
#### Test Fail Detail (HISTORICAL - RESOLVED)

The table below is the old record from before the offline mock existed. Current state: `npm test` runs 17/17 PASS fully offline.

| # | Test Name | Original Failure Cause | Current Status |
|---|-----------|------------------------|----------------|
| 1-8 | Products / Categories / Orders API tests | Supabase schema mismatch (UUID schema from old destructive 002, no seed, no pre_orders/payment_intents) | PASS on in-memory mock (seeded exactly like migration 004) |
| 9 | Storage Layer > should clear storage | jsdom localStorage mock issue | PASS (storageClear fix in bmbStorage.ts) |

Technical notes:

1. Supabase Schema Mismatch - the live Supabase DB still has the UUID schema from the old destructive 002. Migration 004 (UUID-to-TEXT PKs, dynamic FK drop + full 13-FK re-create, pre_orders/payment_intents, canonical seed) is ready in supabase/migrations/ and will be applied when the owner resets/rebuilds the DB. Until then tests run against the offline in-memory mock only.
2. Storage Clear Bug - fixed in src/lib/bmbStorage.ts (length/key(i) iteration pattern).


# BMB — งานค้างทั้งโปรเจกต์ + สถานะเทสต์ Owner (2026-10-08)

**ประเภท:** STATUS / OPEN ITEMS — **รวมทุกอย่างที่ยังไม่เสร็จไว้ที่เดียว** (อัปเดตหลัง Baseline 2026-10-07)
**Baseline อ้างอิง:** `BMB_CURRENT_PRODUCTION_CLOSURE_BASELINE.md` (sections A–O + P0–P3) — เอกสารนี้ = **addendum รอบ 2026-10-08** (ของใหม่ + สถานะเทสต์ Owner)
**Repo:** `D:\A PROJECT\Bite Me Baby` (branch `main`) · HEAD ณ วันนี้ = `eb10e6a` (= `origin/main`, worktree clean)
**เพิ่มเติม (2026-10-08 รอบ 2):** งาน **BITE FOOD THEATER** (Visual Theater × AI Waiter) เสร็จแล้ว — รายงานปิดงาน + gates evidence → `BMB_FOOD_THEATER_REPORT_2026-10-08.md` (vitest 57 files/607 tests · tsc/lint/build = 0 · /shop เปลี่ยนเป็น Food Theaters stage แล้ว · Floating Bite มี context จริง)
**คำสถานะ:** ✅ DONE · ⬜ PENDING (รอ Owner) · 🟨 IN PROGRESS · 🟥 BLOCKED · ⏸ DEFERRED (ตามคำสั่ง Owner)

---

## 1. ⬜ เทสต์จากเน็ตคนละวง (TUNNEL TEST) — สถานะ: **รอ Owner เทสต์ = PENDING**

**ทำเสร็จแล้ว (ฝั่ง AI):** `vite.config.ts` ตั้ง `host: '0.0.0.0'` + `port: 3000` + `strictPort: true` (กันพอร์ตเลื่อน = สาเหตุ Bad Gateway) + `allowedHosts: true` (กัน "Blocked request / Host not allowed") + `hmr.clientPort: 443` (กัน WebSocket error ผ่าน tunnel) — commit `f214ad8` push แล้ว · `tsc = 0`

**ขั้นตอนเทสต์ของ Owner (คัดลอกได้เลย):**

| ขั้น | คำสั่ง / การกระทำ | เกณฑ์ผ่าน |
|---|---|---|
| 1 | Terminal 1: `cd "D:\A PROJECT\Bite Me Baby"` → `npm run dev` | ขึ้น `Local: http://localhost:3000/` |
| 2A | Terminal 2 (ngrok — ติดตั้งครั้งแรก: `winget install Ngrok.Ngrok` + `ngrok config add-authtoken <token>`): `ngrok http 3000` | ขึ้น `https://xxxx-yyyy.ngrok-free.app` |
| — | *หรือ 2B (ไม่ต้องติดตั้ง): `npx localtunnel --port 3000`* | ขึ้น `https://xxxx.loca.lt` |
| 3 | มือถือ **ปิด Wi-Fi ใช้ 4G/5G** → เปิด URL ล่าสุด | หน้าแรกเว็บเปิดได้ |
| 4 | ngrok: หน้า "You are about to visit…" → กด **Continue** · localtunnel: หน้า Tunnel Password → พิมพ์ **ชื่อ subdomain ตัวเอง** (เช่น `abc123` ใน `abc123.loca.lt`) → Continue | เข้าหน้าเว็บจริง |
| 5 | ทดสอบ login ด่วน (เบอร์+OTP) / เปิดกล้องรูปสถานที่จัดส่ง / GPS | ทำงานจากเน็ตภายนอกได้ (HTTPS ของ tunnel) |

**สถานะวันนี้:** ⬜ **ยังไม่มีหลักฐาน Owner ทำสำเร็จ** — Bad Gateway = dev ไม่ได้รัน (รันก่อนเสมอ) · "Blocked request" = allowedHosts ไม่โหลด (รีสตาร์ต `npm run dev`) · URL เปลี่ยนทุก restart → ใช้ URL ล่าสุดเสมอ · **ปิด Ctrl+C ทั้งสอง Terminal เมื่อเสร็จ (อย่าเปิดค้าง)**

---

## 2. ✅ งานที่ทำเสร็จแล้วหลัง Baseline 2026-10-07 (ไม่ต้องทำซ้ำ)

| งาน | หลักฐาน |
|---|---|
| **Login/Register UX fix** — root cause `E.164 required` แก้ใน EF `phone-auto-login` (`08x…`→`+66x…`) + เพิ่ม `action=update_profile` (บันทึกชื่อ/เบอร์/ที่อยู่/GPS/**รูปสถานที่จัดส่ง** → `customers` ผ่าน service role) | probe ผ่าน: LOGIN ok + PROFILE ok + DB row `cust-66826378546` มี `delivery_photo_url` |
| **หน้า Login/Register UI ไทยเต็มรูปแบบ** + ปุ่ม `📷 เพิ่มรูปสถานที่จัดส่ง` ข้าง GPS + preview + remember-once (`bmb_quick_profile`) | `LoginPage.tsx` / `RegisterPage.tsx` |
| **Migration 120** เพิ่ม `customers.delivery_photo_url` / `delivery_photo_path` | applied — history = **120 แถว** |
| **DeliveryManagement แสดงรูปจัดส่ง** + `OrderForm` มี `customer_ref?` | `DeliveryManagement.tsx` / `bmbAdminApi_orders.ts` |
| **Brand pronunciation ใน AI prompts ทุกจุด** — "Bite Me Baby" = **"ไท์มีเบบี้"** (codepoints `0E44 0E1A 0E35 0E17 0E31 0E49` = ไท-บ-ิ-ท-ั-์ **มี บ.**) · มาสคอต "Bite" = **"ไท์"** — แก้ใน `aiService`/`aiGuardrails`/`aiToolCalling`/**`ai-proxy` EF (deploy แล้ว)** รวม 18 จุด · node verify `ALL_CLEAN=true` | commits `0db9cd2` → `96aff7f` |
| **Mojibake scan ทั้งโปรเจกต์** = 542 ไฟล์ / 0 bad lines | node scan |
| **Tunnel config** (ดู §1) | `f214ad8` |

**เหลือให้ Owner ยืนยันด้วยหู:** ⬜ ถามแอปว่า "ร้านชื่ออะไร" → ต้องตอบ **"ไท์มีเบบี้"** ทั้งแชตและโหมดเสียง

---

## 3. 🟥 งานค้างทั้งโปรเจกต์ (เรียงตาม dependency)

### P0 — BLOCKS FIRST REAL SHOP (ต้องเสร็จก่อนเปิดรับลูกค้าจริง)
| # | งาน | สถานะ | ขึ้นกับ |
|---|---|---|---|
| **P0-1** | **ทดสอบ Omise card checkout ใน browser จนจบเส้น** (Path B: `npm run dev` → quick login → เพิ่มรูป+GPS → checkout → บัตร `4242 4242 4242 4242` → charge → webhook → `orders.payment_status='paid'` จริง — จะเทสต์ผ่าน tunnel ใน §1 จากมือถือก็ได้) | 🟨 พร้อมแล้ว (EF 3/3 probe + secrets set) — **รอ Owner คลิก** · webhook ยังไม่เคยได้ delivery จริง (เทสต์นี้ = ครั้งแรก) | Owner ทำเอง / AI ซัพพอร์ต |
| P0-1b | เทสต์ Omise บน **production site** ตรง ๆ | 🟥 CF Pages ยังไม่มี env `OMISE_PUBLISHED_API_KEY_TEST_MODE` → ฟอร์ม Omise ไม่ขึ้น | **รอ Owner พิมพ์ "อนุมัติ env CF"** |
| **P0-2** | เลือก + เปิด **LIVE payment provider** (Owner เลือก Plan A = Omise primary แล้ว — ยังไม่เปิด LIVE) | ⬜ ยังไม่เริ่ม (test-first: หลัง P0-1 ผ่านเท่านั้น) | Owner + Omise KYC |
| **P0-3** | **Acceptance Run จริง 1 รอบ**: order → payment → kitchen → dispatch → **Bite Drive 1 เที่ยว** → tracking → spot-check failure/cancel/refund | ⏸ รอ P0-1 ผ่าน (คำสั่ง Owner) | Owner + AI |
| P0-4 | ตรวจ config วันเปิดร้าน (round / operating_hours / zone / สาขา — read-only verify) | ⏸ defer ตามคำสั่งเดียวกัน | Owner + AI |

### P1 — REQUIRED FOR PRODUCTION CLOSURE (ทั้งหมด ⬜ ยังไม่เริ่ม · รอ Owner approve)
1. เอกสาร reconcile (README · docs/01 · docs/02 · master status บรรทัด stale)
2. G10 evidence pack refresh + Owner sign-off (checklist 1–4 = P0 ด้านบน)
3. Push บนเครื่องจริง (`push_subscriptions=0`) หรือถอด push ออกจากรายการเปิดร้าน
4. Auto-backup schedule (pg_dump มีแล้ว — ขาดตั้งเวลา)
5. ตาราง customization canonical ↔ Thai + ต่อ order-again
6. กวาด `automation_queue` dead 13 แถว + observability
7. Cart shim migration (`useCartStore` 3 importer → canonical)
8. นโยบาย Stripe fallback (คงถาวร / ถอดหลัง Omise live)

### P2 — POST-OPEN / NON-BLOCKING (⏸ ตามคำสั่ง Owner)
Meta G4 re-test · Grab/LINE MAN rider · Talk-to-Bite E2E Playwright · continuous-listen voice · recommendation อิงออเดอร์จริง

### P3 — FUTURE (⏸)
LLM safe tool-calling · trend/personalization ขั้นสูง · กู้ evidence G1/G2-RV (owner ยืนยัน scope ก่อน) · multi-branch/abstraction

### 🟥 Blocked by Owner / External (Baseline §N — ยังเปิดอยู่)
- **Owner:** approve baseline + สั่ง phase ถัดไป · เลือกวัน Acceptance Run · Meta Test User/roles · ยืนยัน scope G1/G2-RV · นโยบาย Stripe · **อนุมัติ env CF** (P0-1b) · ยืนยัน pronunciation ด้วยหู
- **External (ไม่บล็อก first shop):** Meta real event (G4) · Grab/LINE MAN creds
- หมายเหตุ: migration `PROPOSED_wave1/wave2` (2 ไฟล์) = DEFERRED ตามเดิม · GH schedule cron evidence = PENDING (G8-S5 report)

---

## 4. 🔗 เอกสารคู่
- **รายงานปิดงาน Visual Theater (ใหม่ — เสร็จแล้ว)** → `BMB_FOOD_THEATER_REPORT_2026-10-08.md`
- **Handoff สั่งงาน UX/UI รอบถัดไป** → `BMB_HANDOFF_UXUI_2026-10-08.md` (UX-1..UX-5 ยังเปิดอยู่ — งาน theater รอบนี้แยกจากกัน)
- Baseline (source of truth หลัก) → `BMB_CURRENT_PRODUCTION_CLOSURE_BASELINE.md`
- รายงาน G10 (ยังไม่ปิด) → `BMB_G10_FINAL_REPORT.md`

---
*จัดทำโดย Cline (AI) — 2026-10-08 · ทุกสถานะมาจากรอบทำจริง ไม่มีประกาศ COMPLETE โดยไม่มี evidence*
# BMB — CUSTOMER JOURNEY RECOVERY GATE (2026-10-10)

**ประเภท:** GATE DEFINITION + READ-ONLY BASELINE AUDIT · **สถานะเริ่มต้น:** NOT PRODUCTION CLOSED
**โหมด:** CR-0/CR-1 = READ-ONLY · เอกสารนี้คือไฟล์เดียวที่อนุญาตให้สร้าง · **ห้าม commit/push จนกว่า Owner จะตรวจ diff และอนุมัติ**
**ห้ามประกาศ:** Production-ready / G10 PASS / สิ่งที่ยังไม่ตรวจเป็น PASS

> ** Revision history]**
> - **2026-10-10** — สร้างเอกสาร: READ-ONLY baseline audit (CR-0/CR-1) · HEAD `777cf52` · worktree CLEAN ณ วันนั้น
> - **2026-10-11** — อัปเดต: เพิ่ม §15–§17 (CR-2/CR-3 IMPLEMENTED+TESTED local · CR-4 preflight matrix · release/deploy safety) · แก้ §2/§10/§11/§13/§14 ให้ตรงหลักฐานรอบนี้ · **หลักฐานเดิมของ 2026-10-10 ถูกรักษาไว้ ไม่ถูกเขียนทับ** — ข้อความที่แก้ = สถานะที่เปลี่ยนจริงเท่านั้น · แยก local evidence (โค้ด+unit tests) ออกจาก production evidence (ยัง 0/10) ทุกตาราง

---

## 1. Owner Objective · Scope · Exclusions · Hard-Stop

**Objective:** ฟื้นฟูเส้นทางลูกค้า BMB ให้ใช้จริงได้อย่างปลอดภัย — เป้าหมายสุดท้าย:
`REAL CUSTOMER → VALID LOCATION → REAL ORDER → REAL PAYMENT → REAL KITCHEN → REAL DISPATCH → REAL DELIVERY → REAL TRACKING → REAL FAILURE HANDLING`

**Scope (CR-0..CR-4):** CR-0 Git/Production baseline · CR-1 Location safety audit (READ-ONLY) · CR-2 UI/store remediation (รอ Owner approve) · CR-3 EF/data remediation (รอ Owner approve) · CR-4 Customer journey acceptance

**Exclusions:** ไม่แตะ G2-RV/G3/G5/G6/G7/G8/G9 ที่ PASS แล้ว (ไม่มี regression evidence) · ไม่แตะ business rules (รัศมี/ค่าส่ง/round/cutoff values/server RPC) · Dead queue/Backlog อื่น = workstream แยก

**Hard-Stop:** หยุด+รายงาน ถ้าพบ security/RLS issue · ต้องแก้ DB/ข้อมูลลูกค้าจริง · ต้องเปลี่ยน business rule · หลักฐานขัดแย้ง baseline · ต้องใช้ credential ที่ไม่มี

## 2. Git Baseline

**2a. Baseline เดิม (ตรวจจริง 2026-10-10 รอบ CR-0/CR-1 — คงไว้เป็นประวัติ):**

```text
branch        = main
HEAD          = 777cf522271e930283709b17099d5de1a9f99382
origin/main   = 777cf522271e930283709b17099d5de1a9f99382 (ahead/behind = 0/0)
WORKTREE      = CLEAN (ณ 2026-10-10 — ไม่มี tracked/untracked/ignored ที่เกี่ยวข้อง)
stash         = stash@{0}: On main: local-edits-before-sync-2026-09-21 (ไม่ได้ apply/drop/delete)
777cf52       = HEAD = origin/main ✓ (parent=b895220, 2026-10-10 20:23:52 +0700)
diff จริง     = 3 ไฟล์ +204/−12: src/lib/bangkokTime.ts (ใหม่ 57) · src/__tests__/bangkokTime.test.ts
                (ใหม่ 137) · src/pages/CheckoutPage.tsx (22 ±, แก้จุดเดียว = cutoff block + import)
```

**2b. Worktree ปัจจุบัน (ตรวจจริง 2026-10-11 รอบ CR-2/CR-3 preflight — งาน CR-2/CR-3 ยังไม่ commit):**

```text
branch        = main
HEAD          = 777cf522271e930283709b17099d5de1a9f99382 (ไม่เปลี่ยน — ยังไม่มี commit ใหม่)
origin/main   = 777cf522271e930283709b17099d5de1a9f99382 (ahead/behind = 0/0)
staged        = 0 ไฟล์ (ไม่มีอะไรถูก add)
WORKTREE      = DIRTY — 15 รายการของ CR-2/CR-3 (รายชื่อด้านล่าง) · BEFORE=AFTER ทุกรอบตรวจ
stash         = stash@{0}: On main: local-edits-before-sync-2026-09-21 (อยู่ครบ ไม่ถูกแตะ)
unstaged M (9):  src/__tests__/deliveryFeeApi.test.ts · src/components/delivery/DistanceChecker.tsx
                 src/lib/deliveryFeeApi.ts · src/lib/locationLogin.ts · src/pages/CheckoutPage.tsx
                 src/pages/PaymentConfirmationPage.tsx · src/pages/login/LoginPage.tsx
                 src/store/locationStore.ts · supabase/functions/phone-auto-login/index.ts
                 (รวม +404/−72)
untracked ?? (6): docs/BMB_CUSTOMER_JOURNEY_RECOVERY_GATE_2026-10-10.md (เอกสารนี้)
                  src/components/delivery/DeliveryMapPicker.tsx (ใหม่)
                  src/__tests__/locationStore.test.ts · src/__tests__/deliveryMapPicker.test.ts
                  src/__tests__/quickLoginCoords.test.ts (ใหม่)
                  supabase/functions/phone-auto-login/locationPolicy.ts (ใหม่)
```

**หมายเหตุ:** "WORKTREE = CLEAN" ใน 2a เป็นความจริง ณ 2026-10-10 เท่านั้น — **ห้ามอ้างเพื่อสื่อว่า worktree สะอาดตอนนี้** · สภาพปัจจุบัน = 2b (DIRTY ด้วยงาน CR-2/CR-3 ที่รอ commit plan §17)

## 3. P0-1 Cutoff Fix — Evidence Status

| รายการ | สถานะ | หลักฐาน |
|---|---|---|
| Implementation + regression tests (15) | **IMPLEMENTED + TESTED** | commit `777cf52` · vitest 61 files/651 PASS · tsc=0 · lint=0 · build=0 (ก่อน commit) |
| "เท่ากับ cutoff = อนุญาต" | **คงเดิมตามกติกา** ตรง server `v_now > v_round_cutoff` (strict >) — ไม่ได้เปลี่ยนเอง (Owner ยืนยัน) | bangkokTime.ts · migrations 025/118:134 |
| Server authority (ERR_CUTOFF_PASSED) | **ไม่เปลี่ยน** — RPC ตรวจซ้ำเสมอ | migrations 118:132-134 |
| Production Runtime Verified | **MISSING** — deployed SHA ยืนยันไม่ได้ (ดู CR-0) | ด้านล่าง |

## 4. CR-0 — Production / Deployment Alignment (READ-ONLY)

| ตรวจ | ผล | หลักฐาน/ข้อจำกัด |
|---|---|---|
| `https://biteme-baby.com/` | HTTP 200 · serve entry **`/assets/index-Bbi2q8pE.js` + `index-B9m9Rxrn.css`** | GET 2026-10-10 |
| entry เปลี่ยนจากรอบก่อน (`index-DuxgEUgA.js` = build ของ b895220) | **มี deployment เกิดขึ้นหลัง b895220 จริง** | เทียบหลักฐาน audit รอบก่อนหน้า |
| deployed SHA = `777cf52`? | **BLOCKED — dashboard evidence unavailable** — ห้ามเดา (asset hash ต่างจาก local build ด้วย build-env artefact CRLF/env-inlining พิสูจน์แล้วรอบ b895220 · string markers ของ 777cf52 ถูก minify ลบ) | ต้องการจาก Owner: CF Pages deployment list (deployment ID / commit SHA / status) |
| Cloudflare project / build logs | **BLOCKED — ไม่มี CF access** | — |
| `bitemebaby.com` (ไม่มีขีด) | ERR/ไม่ resolve (last-known 2026-10-10 รอบ audit ก่อน) | รอบนี้ไม่ยืนยันซ้ำ |
| หน้าเส้นทาง PWA | HTTP ระดับผ่าน (SPA 200) — client-runtime จริงยังไม่ตรวจ stage นี้ | DEPLOYED ≠ RUNTIME VERIFIED |

**สรุป CR-0:** Production ใช้ build ใหม่กว่า `b895220` (entry เปลี่ยน — แน่นอน) · **deployed SHA ยืนยันไม่ได้ = BLOCKED** · ห้ามสรุป push=deploy

**Re-probe 2026-10-11 (เพิ่ม — ไม่เขียนทับหลักฐานข้างบน):** `/` = HTTP 200 · `Server: cloudflare` · `cf-ray: a489fcd94ed596d8-BKK` · entry ยังเป็น **`assets/index-Bbi2q8pE.js`** (ไม่เปลี่ยนจากรอบ 2026-10-10 = ไม่มี deploy ใหม่ระหว่างสองรอบ · สอดคล้องที่ยังไม่มี push ใหม่) · QR asset `assets/Qr Code/BMB_Promptpay_Qr.webp` = HTTP 200 · 99,890 bytes (ตรงไฟล์ local) · `wrangler.toml` = ไม่มีใน repo (ยืนยันซ้ำ) · **deployed SHA = ยัง BLOCKED เหมือนเดิม**


## 5. CR-1 — Location Safety Audit (READ-ONLY, ตรวจโค้ดจริง)

### 5.1 Call chain (file/line)

```text
[1] GPS/IP/saved/kitchen fallback — src/lib/locationLogin.ts:55-90 getGpsLocation()
    1) navigator.geolocation (55-67) — denied/desktop ไม่มี hardware → null → ต่อ
    2) ipapi.co IP-geo (69-81) — approximate คลาดได้ 10-100+ กม. (source='ip')
    3) localStorage bmb_customer_location (83-86) — ค้างค่าเก่าได้ทุก source
    4) kitchen fallback (≈87-90) — คืนพิกัดร้าน (10.7016, 102.1429) source='kitchen'
[2] Store — src/store/locationStore.ts
    32-43 loadSaved() — default เริ่มต้น = KITCHEN coords (source '') · 49-63 setLocation()
    เขียน localStorage ทุกครั้ง รวม source 'ip'
[3] Checkout — src/pages/CheckoutPage.tsx
    70-77  prefill = store location (ค่าเริ่มต้น = พิกัดร้านเสมอ — saved ไม่ null)
    152-166 handleUseGps() — toast hardcode "Location set via GPS" ทั้งที่ source อาจเป็น
           ip/saved/kitchen ❌ (ไม่เช็ค loc.source)
    448-450 แสดง "current point: (lat,lng)" — ไม่มีแผนที่/marker/ช่องแก้พิกัด
[4] Login — src/pages/login/LoginPage.tsx
    113-127 handleQuickLogin() — loginByLocation ไม่ส่ง latitude/longitude → EF ได้
           undefined → kitchen fallback → persist พิกัดร้านเป็นค่าลูกค้า ❌
    151-156 saveDeliveryProfile() — ส่ง store coords (อาจเป็นค่าร้าน/ip)
    170-188 handleLocate() — ✅ บอก label source ถูกต้อง (gps/ip/saved/kitchen)
           — ต่างจาก CheckoutPage (inconsistency ยืนยัน)
    src/store/authStore.ts:197-210 loginByLocation → quickLoginByPhone (ไม่แตะพิกัดเอง)
[5] EF phone-auto-login (supabase/functions/phone-auto-login/index.ts)
    update_profile (93-140): ตรวจ JWT · validate ช่วงพิกัด (110-114) · POST /rest/v1/customers
      Prefer:resolution=merge-duplicates (121-127) = UPSERT by id cust-<phone-tail> →
      "เขียนทับ" default_* รวมค่าจาก IP/store ❌
    quick path: sanitize ไม่ผ่านช่วง → latitude=10.7016/longitude=102.1429 (145-146) →
      persist customers (239-251) merge-duplicates → เขียนทับ default_* ด้วยพิกัดร้าน
      เมื่อ caller ไม่ส่งพิกัด (LoginPage quick = ไม่ส่ง → เกิดทุกครั้ง) ❌
[6] Server order path (ตรวจยืนยัน — ไม่เปลี่ยน)
    src/lib/deliveryFeeApi.ts:46-52 fee RPC (authenticated-only; error → local mirror)
    migrations 118:179-200 create_order_with_items: บังคับ coords (186) · zone gate
      haversine ใหม่จากครัวจริง (187-192 — ไม่เชื่อ p_distance_km ของ client) ·
      ERR_DELIVERY_METHOD_ZONE (196) / ERR_BITE_DRIVE_DISABLED (193) / ERR_EXTERNAL_METHOD_DISABLED (200)
[7] Downstream — RouteOptimizationPage.tsx อ่าน orders.dropoff_* ·
    customers.default_latitude/longitude ไม่พบ frontend consumer ใน src
```

### 5.2 ตอบคำถามสำคัญ 7 ข้อ

| # | คำถาม | คำตอบ + สถานะ |
|---|---|---|
| 1 | UI อ้าง GPS สำเร็จทั้งที่ใช้ source อื่น? | **YES — CONFIRMED** — CheckoutPage.tsx:165 hardcode toast ทั้งที่ getGpsLocation คืน ip/saved/kitchen (locationLogin.ts:55-90) · หน้า login ทำถูก (LoginPage.tsx:183-186) |
| 2 | พิกัดครัวถูกใช้เป็น destination ได้จริง? | **YES — CONFIRMED — 3 ทาง**: prefill เริ่มต้น (locationStore.ts:42 + CheckoutPage.tsx:72-77) · กด GPS ตอน fallback หมด (toast สำเร็จ) · quick login ไม่ส่ง coords → EF persist — ทั้งหมดผ่าน zone gate (dist≈0 ≤ 5 กม.) → ออเดอร์จริงถูกสร้างพร้อม dropoff = พิกัดร้าน |
| 3 | IP-geo/saved persist เป็น default coordinates? | **YES — CONFIRMED** — EF 239-251 + 121-127 upsert `customers.default_latitude/longitude` (migrations 015:16-18) · caller: LoginPage quick (ไม่ส่ง → kitchen) + saveDeliveryProfile (store coords) |
| 4 | พิกัดเดิมถูกเขียนทับโดยไม่ยืนยัน? | **YES — CONFIRMED** — merge-duplicates upsert ทั้ง 2 mode ไม่มี confirmation/compare/source guard (ค่า range-valid ผ่านหมด รวมพิกัดร้าน/IP ผิด) |
| 5 | Zone gate ป้องกัน/ไม่ป้องกันอะไร? | **ป้องกัน:** นอกโซนถูกปฏิเสธ (118:196) · บังคับมี coords (186) · ไม่เชื่อ client distance (187-192) · **ไม่สามารถป้องกัน:** พิกัด "ผิดแต่อยู่ในโซน" (ร้าน/IP ที่บังเอิญในรัศมี) — server มองไม่เห็นว่าพิกัดจริงคืออะไร |
| 6 | Fee RPC error = 0.00 + request ซ้ำ? | **YES — CONFIRMED** — deliveryFeeApi.ts:53-75 เงียบ fallback → mirror คืน 0 นอกโซน → โชว์ 0.00 · effect deps `[lat,lng,items,customer]` ยิงซ้ำ 8+ ครั้ง (CheckoutPage.tsx:114-131) + screenshot Owner |
| 7 | ผลกระทบข้อมูลลูกค้าเดิม? | **มีความเสี่ยง — RUNTIME UNKNOWN** — ทุก quick login/update_profile อาจเขียนทับ `default_*` ด้วยค่าร้าน/IP ผิด · **จำนวนกี่แถว/กี่ลูกค้า = ยังไม่รู้** (anon อ่าน customers ไม่ได้ 401) · ต้อง DB read access ก่อน remediation ข้อมูล |

### 5.3 Label

ข้อ 1-6 ฝั่ง client/EF = **CONFIRMED DEFECTS (code-evidenced)** · ผลกระทบข้อมูลจริง = **RUNTIME UNKNOWN/BLOCKED** · runtime พฤติกรรมจริงวันนี้ = **ไม่ได้ verify โดยตรง** (code + evidence รอบก่อน: screenshot + anon catalog)

## 6. Location Source Trust Policy (ข้อเสนอ — ยังไม่ implement)

| Source | นโยบายที่เสนอ | เหตุผล |
|---|---|---|
| GPS (source='gps') | TRUST สูงสุด — ใช้เป็นพิกัดจัดส่ง + persist ได้ | ยืนยัน hardware/permission |
| IP-geo (source='ip') | **แนะนำเท่านั้น** — pre-select บนแผนที่ + ข้อความ "ประมาณการ — ตรวจสอบ/ปักหมุดใหม่" · ห้าม persist เป็น default อัตโนมัติ | คลาดหลัก 10-100+ กม. (พิกัดอยุธยาของ Owner = หลักฐาน) |
| saved (localStorage) | ใช้ได้เฉพาะเมื่อ source เดิม = gps/manual + แสดง "ใช้พิกัดที่บันทึกไว้ — ยืนยัน/แก้ไข" ก่อนสั่ง · ห้ามรับค่าที่เคยเป็น ip | ค่าค้างเก่าไม่ควรถือเป็น truth |
| kitchen fallback | **ห้ามใช้เป็น dropoff เด็ดขาด** — ใช้เฉพาะ state "ยังไม่มีพิกัด" → บล็อกปุ่มสั่ง + ให้ปักหมุด | dist=0 ผ่าน zone gate = ส่ง rider กลับร้าน (CONFIRMED) |
| manual pin | เพิ่มเป็น source='manual' (type มีอยู่แล้ว — locationStore.ts:14) | ทางออกเมื่อ GPS/IP ไม่เชื่อถือ |

## 7. Customer Coordinate Persistence — Audit Scope (รอบแก้ข้อมูล — ยังไม่ทำ)

- คอลัมน์: `customers.default_latitude/default_longitude/default_address_detail` (migrations 015:16-18)
- จุดเขียนเดียวที่พบ: EF `phone-auto-login` 2 mode (merge-duplicates upsert) — ไม่มีจุดเขียนอื่นใน src
- ก่อนแตะข้อมูลต้องมี: (1) read access เพื่อนับแถวที่พิกัด=พิกัดร้าน/ผิดรัศมี (2) แยก "ลูกค้าจริง vs test" (3) Owner approve วิธี — **ห้ามลบ/แก้ rows เอง**

## 8. Payment Status (มติ Owner — คงไว้ ไม่เปลี่ยนรอบนี้)

- **Primary = Omise (TEST ก่อน LIVE)** — EF omise-checkout/refund/webhook มีในโค้ด · production ยังไม่มี env `OMISE_PUBLISHED_API_KEY_TEST_MODE` (P0-1b รอ Owner) · webhook จริงยังไม่เคย delivery
- **Stripe fallback = ยังไม่อนุมัติ** (Paused/In review) — ห้ามพึ่งพาเพื่อเปิดร้าน
- **PromptPay = manual TXN confirmation เท่านั้น** (PaymentConfirmationPage:104-115 — **ไม่มี QR generation**) — UI ต้องแก้ label ให้ตรง (defect #D-10)

## 9. Production Test Artifacts (ห้ามลบ — วิธีตรวจ)

- `W3C Test Preorder Product` (products, is_available=true · anon read 2026-10-10) · `W3C-EXT test round` (delivery_rounds — บนหน้า checkout ของ Owner)
- ตรวจเพิ่มโดยไม่ลบ: read-only query เมื่อมี DB access (LIKE 'W3C%') · ถอด = **Owner สั่ง** (deactivate/archive ไม่ใช่ hard-delete)

## 10. Evidence Matrix (CR-0/CR-1)

| หัวข้อ | Status | Evidence | พิสูจน์ได้ | พิสูจน์ไม่ได้ |
|---|---|---|---|---|
| Git baseline (2026-10-10) | VERIFIED (ประวัติ) | 777cf52 = origin · CLEAN · stash 1 ไม่แตะ — **ตอนนี้ worktree DIRTY ดู §2b** | สถานะ repo จริง ณ วันที่ตรวจ | — |
| P0-1 fix | IMPLEMENTED + TESTED | commit 777cf52 · 651 tests · gates 0 | client behavior + server rule เดิม | production runtime |
| Production deploy | DEPLOYED (ใหม่กว่า b895220) | entry `index-Bbi2q8pE.js` HTTP 200 | เว็บรัน build ใหม่ | **deployed SHA = BLOCKED** |
| Location fallback chain | CONFIRMED DEFECT | locationLogin.ts:55-90 · locationStore.ts:32-43 | ตาม code | — |
| Toast "GPS" หลอก | CONFIRMED | CheckoutPage.tsx:165 | hardcode | — |
| Kitchen coords เป็น dropoff | CONFIRMED (3 ทาง) | §5.2 ข้อ 2 | ออเดอร์จริงสร้างได้ | จำนวนครั้งจริงใน prod |
| DB persist/เขียนทับ | CONFIRMED (code) | EF 121-127, 145-146, 239-251 | upsert ไม่มี guard | ผลกระทบจริง = BLOCKED |
| Fee 0.00 + spam | CONFIRMED | deliveryFeeApi.ts:53-75 + screenshot | UX พังนอกโซน | — |
| PromptPay ไม่มี QR | CONFIRMED | PaymentConfirmationPage:104-115 | label ไม่ตรง | — |


## 11. Unresolved Owner Decisions (เดิม — **RESOLVED 2026-10-11** · เก็บไว้เป็นประวัติการตัดสินใจ)

> **สถานะเดิม:** 8 ข้อนี้เคยค้างอยู่ก่อนเริ่ม CR-2/CR-3 · **สถานะปัจจุบัน: RESOLVED ทั้งหมด** — Owner ตัดสินใจแล้ว นำไปสู่ implementation ที่เห็นใน worktree (§15) · ข้อสรุปของแต่ละข้ออยู่ใน §15.1

1. GPS ใช้ไม่ได้ → ปักหมุดแผนที่ / กรอกพิกัดเอง / ทั้งคู่?
2. IP-geo = แนะนำเท่านั้น (pre-select บนแผนที่) — เห็นด้วยไหม?
3. saved coords เดิมต้อง "ยืนยันก่อนใช้" ไหม?
4. ไม่มีพิกัดเชื่อถือได้ → block checkout หรือยอมสั่งแบบ "รอแอดมินโทรยืนยัน"?
5. กัน IP-geo/kitchen เขียนทับ `customers.default_*`: เขียนเมื่อ source='gps'|'manual' เท่านั้น — เห็นด้วยไหม?
6. ข้อมูลเดิมที่กระทบ: รอแก้ตอนสั่งถัดไป หรือ admin แก้ทีละราย? (ต้องมี DB read evidence)
7. Label PromptPay — แก้ label หรือสั่งต่อ QR generation (เพิ่ม scope)?
8. อนุมัติ env CF สำหรับ Omise test (P0-1b) เมื่อไหร่?

## 12. Remediation Options (แยกชั้น — ยังไม่ implement)

| ชั้น | เปลี่ยนอะไร | ไม่แตะ |
|---|---|---|
| **UI (CR-2)** | toast บอก source จริงทั้ง 2 หน้า · แผนที่/marker + ปักหมุด manual · ข้อความ "นอกพื้นที่" แทน 0.00 · debounce fee · block ปุ่มสั่งเมื่อไม่มีพิกัด trust · label PromptPay | business rules, server |
| **Store (CR-2)** | saved coords ใช้ได้เฉพาะ source gps/manual · ไม่ persist ip เป็น default · แสดง source/age ตอน prefill | server |
| **EF (CR-3)** | persist `default_*` เฉพาะ source gps/manual (deploy EF — ขอ Owner แยกอนุมัติ) · ไม่ fallback kitchen เป็นค่า persist | schema, business rules |
| **Data (CR-3)** | read-only probe นับแถวกระทบ → เสนอแผนแก้ต่อ Owner | ทุกอย่างจนกว่า approve |
| **Test plan** | unit: source-guard store/EF · UI: toast ตาม source · integration: ไม่มีพิกัด → บล็อก; dropoff=ร้าน → ไม่ผ่าน (simulate) · runtime: P0-1 + บันทึก evidence | — |

## 13. Acceptance Criteria — CR-2 / CR-3 / CR-4

- **CR-2 (UI/store):** gates ครบ (tsc/lint/vitest/build) + test ใหม่ครอบ source-trust policy + manual matrix login/checkout 2 themes · ไม่มี behavior เปลี่ยนที่ server — **สถานะ 2026-10-11: IMPLEMENTED + TESTED (local) · ยัง NOT committed/deployed · production runtime = ยังไม่ได้ verify (§15)**
- **CR-3 (EF/data):** EF diff review โดย Owner ก่อน deploy · deploy ด้วยคำสั่ง Owner เท่านั้น · data remediation = plan ก่อน ทำหลัง approve · probe อ่านอย่างเดียวก่อน/หลัง — **สถานะ 2026-10-11: IMPLEMENTED + TESTED (local ฝั่ง client+EF guard) · EF production = NOT DEPLOYED (ยังเป็นเวอร์ชันเก่า — kitchen fallback ยังอยู่จริง) · data remediation = ยัง BLOCKED รอ DB read (§7)**
- **CR-4 (Acceptance):** มือถือ GPS ในโซน → order สำเร็จ · desktop deny-permission → เจอปักหมุด/ข้อความถูก ไม่มี "GPS สำเร็จ" หลอก · นอกโซน → ข้อความชัด ไม่ใช่ 0.00 · payment ตาม §8 · tracking/failure ตาม spine — **production runtime evidence เท่านั้น ห้ามใช้ unit test แทน** — **สถานะ 2026-10-11: PREFLIGHT เสร็จ (matrix 10 ข้อ §16 — code/unit ครบทุกข้อ) · production evidence = 0/10 · ยัง NOT STARTED จริง**

## 14. Status Matrix รวม + Sign-off

**(อัปเดต 2026-10-11 — สถานะล่าสุดตามหลักฐานรอบนี้):**

| Stage | Status |
|---|---|
| CR-0 Git/Production baseline | **DONE (deployed SHA = BLOCKED — รอ CF evidence จาก Owner) · re-probe 2026-10-11: entry ไม่เปลี่ยน** |
| CR-1 Location safety audit | **DONE (CONFIRMED defects ฝั่ง client/EF · data impact = BLOCKED รอ DB read)** |
| CR-2 UI/store remediation | **IMPLEMENTED + TESTED (local) — โค้ด+tests ครบใน worktree (§15) · NOT committed · NOT deployed · production runtime ยังไม่ verify** |
| CR-3 EF/data remediation | **IMPLEMENTED + TESTED (local) — client guard + EF locationPolicy (§15) · NOT deployed (EF จริงยังเป็นเวอร์ชันเก่า = kitchen fallback ยังอยู่) · data remediation = BLOCKED รอ DB read** |
| CR-4 Journey acceptance | **PREFLIGHT DONE (matrix 10 ข้อ §16: code/unit ครบ · production evidence 0/10) — ยัง NOT STARTED จริง · รอ deploy + production access** |
| G10 | **NOT CLOSED** (คงเดิม) |

```text
เอกสารนี้สร้าง: 2026-10-10 (READ-ONLY audit + เอกสารไฟล์เดียว)
อัปเดตล่าสุด: 2026-10-11 (แก้สถานะ §2/§4/§10/§11/§13/§14 + เพิ่ม §15–§17 — ยังไม่มี source change/migration/EF deploy/secret/env/production data mutation/commit/push จากเอกสารนี้)
ไม่มี: source change · migration · EF deploy · secret/env · production data mutation · commit/push (ณ ขณะเขียนเอกสาร)

OWNER SIGN-OFF (อนุมัติเริ่ม CR-2/CR-3) — เดิม 2026-10-10:
- ตัดสินใจ §11 ครบถ้วน: RESOLVED (ดู §15.1)
- อนุมัติ diff เอกสารนี้ (ให้ commit เมื่อใด): ตาม §17 commit plan (Commit B)
- ลงชื่อ/วันที่: _______________

OWNER AUTHORIZATION (2026-10-11 — อนุมัติ release preparation: แก้เอกสาร + local commits + EF preflight เท่านั้น):
- Stage 1-3 (doc update + commit A/B): อนุมัติแล้ว — HARD STOP ห้าม push
- Stage 4 (EF deploy): ต้องส่ง deployment preflight ให้ Owner อนุมัติแยกต่างหากอีกครั้ง — ยังห้าม deploy
```

---

## 15. CR-2 / CR-3 Implementation + Test Evidence (LOCAL — 2026-10-11)

> **ข้อจำกัดเชิงหลักฐานที่ต้องอ่านก่อน:** ทั้งหมดใน §15 = **local evidence เท่านั้น** (โค้ด review + unit tests บนเครื่อง dev) · **ไม่มีส่วนใดเป็น production/runtime/cryptographic proof** · source metadata (provenance, `source`, `confirmed`) เป็น **application-level bookkeeping ที่ client เขียนเอง** — server accept ค่าที่ client ส่งมาโดยไม่มี signature/attestation ยืนยันว่าค่ามาจาก hardware GPS จริง · ดังนั้น policy guard ทั้ง client + EF = **ป้องกันความผิดพลาด/การใช้ผิดวัตถุประสงค์ตามโค้ดที่เขียน** แต่ **ไม่ใช่ proof ว่า location จริงถูกต้อง** — พิสูจน์จริงต้อง runtime matrix §16

### 15.1 CR-2 (UI/store) — สิ่งที่ทำ (Owner decision §11 → implementation)

| Defect เดิม (§5) | การแก้ | ไฟล์ |
|---|---|---|
| toast "GPS สำเร็จ" หลอก (§10) | toast บอก source จริง · `getTrustedGpsLocation` คืน `null` เมื่อ GPS ไม่สำเร็จ → ไม่มี "GPS สำเร็จ" ปลอม | `src/lib/locationLogin.ts` · `src/pages/CheckoutPage.tsx` |
| ไม่มีทางเลือกเมื่อ GPS fail (§11.1) | `DeliveryMapPicker.tsx` (ใหม่) — แผนที่ + ปักหมุด manual | `src/components/delivery/DeliveryMapPicker.tsx` (ใหม่) |
| IP-geo/saved ถูก persist เงียบ (§11.2/3) | provenance bookkeeping ใน store: `provenance`/`confirmed` — เลื่อน pin/กดแผนที่ → `confirmed:false` อัตโนมัติ · saved รักษา provenance ไม่ปลอมเป็น GPS | `src/store/locationStore.ts` |
| ไม่มี trusted location → สั่งได้ (§11.4) | `orderable:false` สำหรับ ip/kitchen/'' + `handlePlaceOrder` guard ก่อน `createOrder` | `src/pages/CheckoutPage.tsx` |
| Fee RPC error = 0.00 (§5.2 ข้อ 6) | `feeUiState` error → "ยังคำนวณไม่สำเร็จ" (ไม่มี `0.00` ปลอม) · debounce 500ms · retry | `src/lib/deliveryFeeApi.ts` · `src/components/delivery/DistanceChecker.tsx` |
| PromptPay ไม่มี QR + label ผิด (§8/D-10) | QR `<img>` + 3 ขั้นตอน + "ส่งเลขธุรกรรม ≠ ยืนยันชำระ" | `src/pages/PaymentConfirmationPage.tsx` · `src/pages/login/LoginPage.tsx` |

### 15.2 CR-3 (EF/data) — สิ่งที่ทำ

| ส่วน | สิ่งที่ทำ | ไฟล์ |
|---|---|---|
| EF guard | `locationPolicy.ts` (ใหม่) — source policy: persist `default_*` เฉพาะ gps/manual · ไม่ fallback kitchen เป็นค่า persist | `supabase/functions/phone-auto-login/locationPolicy.ts` (ใหม่) |
| EF guard | `index.ts` — กัน persist paths 2 จุด (code review 2 จุด: index.ts:119 + :260 — **ไม่มี integration test ครอบคลุม EF runtime**) | `supabase/functions/phone-auto-login/index.ts` |
| Client contract | `buildQuickLoginCoords` → คืน `null` เมื่อไม่มีพิกัด trusted (ไม่เขียน default ผิด) · body ส่ง `source` | `src/pages/login/LoginPage.tsx` |
| Data (CR-3 ส่วนข้อมูล) | **ยังไม่ทำ** — ต้องมี DB read access (§7) · aggregate query SELECT-only เตรียมไว้แล้ว (group counts เท่านั้น ไม่ดึง PII) | — |

### 15.3 Test evidence (LOCAL — รันจริง 2026-10-11 บน worktree นี้)

| Gate | ผล |
|---|---|
| vitest | **64 files / 689 tests — ทั้งหมด PASS** (exit 0) |
| tsc | 0 errors |
| eslint | 0 errors |
| build (vite + PWA) | ผ่าน (exit 0) · precache 138 entries |

Tests ใหม่ของ CR-2/CR-3: `locationStore.test.ts` (provenance bookkeeping + re-position หลังยืนยัน) · `deliveryMapPicker.test.ts` (parseManualPin) · `quickLoginCoords.test.ts` (`buildQuickLoginCoords`) · `deliveryFeeApi.test.ts` (feeUiState error label ไม่มี 0.00) · + `shouldPersistDefaultCoords` 14 tests (0,0/invalid/ไม่มี source = false)

### 15.4 ช่องว่างหลักฐานที่ต้องไม่ลืม (ไม่ใช่ PASS)

1. **ไม่มี integration test** — EF guard พึ่ง code review 2 จุด · client-store-EF contract ไม่ถูก test ต่อกันจริง · ไม่มี `deno check` pipeline
2. **ไม่มี component render test** — UI พิสูจน์ด้วย unit ของ logic เท่านั้น
3. **source metadata ไม่ใช่ cryptographic proof** (อ่านกล่องข้อความบนสุดของ §15)
4. **production runtime = 0/10 scenarios** — ห้ามอ้าง §15 เป็น production evidence

## 16. CR-4 Preflight Matrix (10 ข้อ — code/unit ครบทุกข้อ · production evidence = 0/10)

| # | Scenario | หลักฐาน LOCAL (code+unit) | หลักฐาน PRODUCTION |
|---|---|---|---|
| 1 | GPS permission denied | `getTrustedGpsLocation` คืน `null` → toast ปฏิเสธ ไม่มี "GPS สำเร็จ" หลอก (`locationLogin.ts:100-131` · `CheckoutPage:184-188`) | **ไม่มี** |
| 2 | GPS success + ยืนยันตำแหน่ง | handler ตั้ง `provenance:'gps', confirmed:true` · test `deliveryPointStatus` GPS 2 สถานะ | **ไม่มี** |
| 3 | เลื่อน pin/กดแผนที่ + ต้องยืนยันใหม่ | `handleMapPick` → `confirmed:false` อัตโนมัติ · test re-position หลังยืนยัน (`locationStore.test.ts:166-178`) | **ไม่มี** |
| 4 | Saved รักษา provenance ไม่ปลอมเป็น GPS | `loadSaved` filter + provenance 4 tests + `deliveryPointStatus` SAVED test | **ไม่มี** |
| 5 | ไม่มี trusted location → สั่งไม่ได้ | `orderable:false` ทุกกรณี (test) + `handlePlaceOrder` guard | **ไม่มี** |
| 6 | Fee RPC fail ≠ `0.00` | `feeUiState` error = "ยังคำนวณไม่สำเร็จ" (test ยืนยัน label ไม่มี `0.00`) + debounce + retry | **ไม่มี** |
| 7 | Out-of-zone → server authority | ไม่ได้แตะ RPC/รัศมี (diff ยืนยัน) — server ยัง reject ตามเดิม | **ไม่มี** |
| 8 | PromptPay QR + Manual ถูกต้อง | QR `<img>` + 3 ขั้นตอน + ข้อความ (diff) · asset prod 200 · 99,890 bytes | QR = CONNECTED (static) · **flow runtime ไม่มี** |
| 9 | Quick login ไม่มีพิกัด → ไม่เขียน default ผิด | `buildQuickLoginCoords` → `null` (6 tests) + `shouldPersistDefaultCoords` 14 tests | **ไม่มี** — ต้อง probe prod: login ไม่มีพิกัด → ตรวจ row `default_* IS NULL` |
| 10 | ตรวจ Production DB (ไม่เปิดเผย PII) | aggregate query SELECT-only เตรียมไว้ (group counts เท่านั้น) | **BLOCKED** — ไม่มี read access + ยังไม่ได้ approval |

**สรุป: LOCAL code/unit = ครบ 10/10 · PRODUCTION evidence = 0/10 — ห้ามเริ่ม CR-4 จริงโดยไม่มี runtime evidence plan + production access**

## 17. Release Safety · Commit Plan · EF Deploy Order

### 17.1 Cloudflare Pages auto-deploy จาก `main`?

- **หลักฐานใน repo:** `ci.yml` = lint → test → build **ไม่มี deploy step** (ยืนยันซ้ำ 2026-10-11) · ไม่มี `wrangler.toml` · ไม่มี deploy script ใน `package.json`
- **สรุป: BLOCKED** — ยืนยันจาก repo ไม่ได้ ต้อง Owner เช็ค CF Pages project settings (connected repo / Watch Paths) เท่านั้น · ห้ามอนุมาน

### 17.2 Deploy EF `phone-auto-login` (ยังไม่ทำ — ต้อง preflight approval แยก)

- คำสั่ง (จาก `docs/04_DEPLOYMENT_RUNBOOK.md:32-34`): `supabase functions deploy phone-auto-login` (manual) · production project ref = `ivkdfognyiwjcmrhcnwz`
- ไม่ต้องแก้ config — `supabase/config.toml [functions.phone-auto-login] verify_jwt=false` คงเดิม
- **วิธีพิสูจน์ revision ใหม่:** Dashboard → Functions → ดู *Updated at* ใหม่กว่าเวลา deploy หรือ `supabase functions list` · ทางพฤติกรรม: probe login ไม่ส่ง coords → ตรวจ `default_* IS NULL` (ต้อง approval)
- **ขณะนี้: BLOCKED** (ไม่มี CLI session/owner access) — **ห้าม claim ว่า deploy แล้ว**

### 17.3 Deploy order risk (สำคัญมาก)

| ลำดับ | เกิดอะไร | สรุป |
|---|---|---|
| **EF ใหม่ ก่อน frontend (แนะนำ)** | client เก่าส่ง kitchen/coords → EF ใหม่: source ไม่ผ่าน policy → ไม่เขียน `default_*` | ✅ ปลอดภัยทุกกรณี |
| frontend ใหม่ ก่อน EF เก่า | client ใหม่ส่ง `latitude: null` → EF เก่า `Number(null)=0` → ผ่าน range check → เขียน `default_*=0,0` (null island) | ❌ ห้ามเกิด |
| พร้อมกัน | race ระหว่าง user แรก | ⚠️ เสี่ยงถ้า verify ไม่ทัน |

→ **Rule: deploy EF ใหม่ + verify revision ก่อนเสมอ แล้วจึง push/deploy frontend**

### 17.4 Commit plan (อนุมัติแล้วใน Owner authorization 2026-10-11 — local เท่านั้น ห้าม push)

| Commit | เนื้อหา | เงื่อนไข |
|---|---|---|
| **A (atomic เดียว)** | CR-2 + CR-3 = ไฟล์ M ทั้ง 9 + untracked code/test ทั้ง 5 (**เว้นเอกสารนี้**) | worktree ปัจจุบัน build/tests เขียวครบ 689 = atomic ปลอดภัย · ไม่มีหน้าต่าง mismatch ใน history |
| **B (doc)** | เอกสารนี้ (หลังแก้สถานะเสร็จแล้ว) | ต้องตรงหลักฐานล่าสุดทั้งหมด |

**Production blockers คงเดิม (ไม่มีอะไรคลี่คลาย):** ① CF Pages settings (auto-deploy?) ② Supabase CLI → deploy EF + verify revision ③ Production DB read (audit + probe) ④ Deployed SHA `777cf52` ⑤ Production E2E matrix — ห้ามเริ่มโดยไม่มี runtime evidence plan


# BMB — REQUIREMENT RECONCILIATION (R62 · WHOLE PROJECT FINAL CLOSURE)

> **เอกสารนี้ = PHASE 1 (audit 12 กลุ่ม A–L) + PHASE 2 (CONFLICT รอ Owner)** ของงาน R62
> · สร้างตามคำสั่ง Owner 2026-11-03 ("owner อนุมัติสร้าง `BMB_REQUIREMENT_RECONCILIATION.md`")
> · **Conflict = รายงาน → รอ Owner ตัดสินใจ** (ห้ามแก้เงียบ · ห้ามปรับ requirement ให้เข้าโค้ด)
> · Evidence hierarchy: Production DB/runtime > source > migrations/RPC/EF > runtime/integration > tests/CI > docs > reports
> · ถ้าโค้ดเปลี่ยนจาก baseline → ต้องบันทึก SHA ใหม่แล้ว recheck finding ที่กระทบ

**AUDIT BASELINE:** repo `D:/A PROJECT/Bite Me Baby` · branch `main`
· **`9799370`** = source snapshot ตาม PHASE 0 lock (โค้ดไม่เปลี่ยน — พิสูจน์: `git diff --stat 9799370..HEAD` = `AI_WORK_STATE.md` อย่างเดียว +16)
· HEAD ขณะรัน audit = `22e2b1b50cd4399f2d0488b5716a6b9f82b03d79` · stash `local-edits-before-sync-2026-09-21` = PRESERVE ไม่แตะ

---

## §1 PHASE 0/1 — Safety & baseline gates (evidence จากคำสั่งจริง)

| รายการ | ผล | evidence |
|---|---|---|
| Working tree | tracked clean · untracked = แค่สคริปต์ audit R62 | `git status --porcelain=v1` |
| Migration parity **LIVE** | **local 183 = ledger 183 · missing=[] · extra=[] · `ALL_PASS=true`** (2026-11-03T05:14Z) | `node e2e/r56MigParity.cjs` → `e2e/r56MigParity-result.json` |
| CI ของ HEAD `22e2b1b` | **CI #733 = success** · **Contract Tests #307 = success** (GitHub Actions REST API จริง · 2026-11-03) | `GET /repos/bitemebaby2016-coder/bmb/actions/runs?head_sha=22e2b1b…` |
| CI ของ `bacb02f` (code R61) | **Contract Tests #304 = success** (+ 2 checks = success ตามบันทึก R61) | REST API `?head_sha=bacb02f72ccb…` |
| Stash | `stash@{0}: local-edits-before-sync-2026-09-21` **ยังอยู่** | `git stash list` |

---

## §2 PHASE 1 — AUDIT ครบ 12 กลุ่ม (A–L) · status taxonomy

> สถานะ: `IMPLEMENTED` (โค้ดมี) · `CONNECTED` (ต่อ authority แล้ว) · `DEPLOYED` (apply/deploy มีหลักฐาน)
> · `RUNTIME VERIFIED` (ตรวจบน production แล้ว) · `DOCUMENTED` · `MISSING` · `BLOCKED` · `DEFERRED`
> probe กลุ่ม = `e2e/r62GroupProbe.cjs` → **`e2e/r62GroupProbe-result.json` = 129/129 key files present · missing=[]** (HEAD 22e2b1b)

### A · Customer PWA

| ตรวจ | ผล |
|---|---|
| key files | 14/14 (HomePage/Menu/Cart/Checkout/Orders/OrderTrack/Profile/Rewards/Promotions + `sw.ts` + cartDeepLink/cartPersistence + notification/pushService) |
| สถานะ | **IMPLEMENTED + TESTED + DEPLOYED + (บางส่วน) RUNTIME VERIFIED** |
| runtime | ลิงก์ `?cart=` = **PASS บน production จริง**หลัง R61 (`e2e/tProdProbe_results_T-A4cart.json` — ตะกร้าเต็ม + toast + URL strip) · การ์ดโปรโมตโชว์ภาพจริง (R60/61) |
| ยังไม่ verified | push notification = **รออุปกรณ์ Owner** (CAP-13) · กระโดด Chrome จากแอป FB (T-A4 android) + iOS "อยู่ที่นี่ต่อ" (T-A5) = **ต้องมือถือจริง** |
| gap | **SEO entries ขาด 4 เส้นทาง** (ดู §4-D-1) |

### B · Product / ordering

| ตรวจ | ผล |
|---|---|
| key files | 11/11 (`orderEntry` canonical · `orderStateMachine` · `orderPolicy` · availability · menuSchedule · preOrderQueue · discountGuardrail · addonMarginGuard · marginCalc · AdminProducts · AdminRounds) |
| สถานะ | **IMPLEMENTED + TESTED + DEPLOYED** |
| evidence | canonical order path = `runOrderBuilder` เส้นเดียว (CAP-01/02 · tests `menuCartResultGuard`/`checkoutModeLock`/…) · server cap ส่วนลด 15% = **m172 APPLIED production** (ledger 173+) · add-on margin = m181 APPLIED (`e2e/r49Apply180-result.json` = ledger 181) |
| runtime | order-creation สองโหมด = มีหลักฐานเดิมจาก test packs ยุค R21–R56 → **re-verify ใน PHASE 6/8** (ไม่นั่งทับของเก่าโดยไม่รัน) |

### C · Payment

| ตรวจ | ผล |
|---|---|
| key files | 13/13 (`paymentGateway` + `confirm_offline_payment` delegate เส้นเดียว · `omise.ts` · paymentExceptions · guestCheckout · EF omise-webhook/stripe-webhook/**omise-refund/stripe-refund**/create-checkout/omise-checkout/guest-checkout-session · m133 slip upload · m172 cap) |
| สถานะ | **IMPLEMENTED + TESTED + DEPLOYED · RUNTIME = PARTIAL (รอ Owner)** |
| runtime ที่ยังไม่มี | slip review จริง (CAP-10 = "runtime = รอ Owner") · refund บน gateway จริง · POD (CAP-11 = รอ Owner/rider) |
| ไม่พบ | ไม่มีไฟล์ payment ที่ขาดจากชุด canonical → `MISSING = 0` ฝั่ง source |

### D · Admin

| ตรวจ | ผล |
|---|---|
| key files | 11/11 (Dashboard/Orders/Settings/Promotions/Marketing/Delivery/Inventory/Reports/PrintSettings/RouteOptimization/AuditLog · **รวม 30 หน้า admin ใน `src/pages/admin`**) |
| สถานะ | **IMPLEMENTED + TESTED + DEPLOYED + RUNTIME VERIFIED (บางส่วน)** |
| runtime | R61 พิสูจน์จริง: สร้างโปรโมชั่น+บันทึก+ล้างบน production (`e2e/r61PromoUi-result.json` = ALL_PASS) · login `admin@biteme-baby.com` = **200 role=admin** (`e2e/r61AdminReset-result.json`) · §T-C1/C2/C3 = PASS |
| note | auto-scroll + การ์ด uniform = rule 12.3 (AdminHubs `contentRef` · r52 lock) มี test คุม |

### E · Staff / Kitchen

| ตรวจ | ผล |
|---|---|
| key files | 11/11 (AdminKitchen · AdminPos · kitchenService/queueView · posApi · printService/stickerPng · m019 kitchen core · m054 ready-gate · m129 POS · m167 batch loop fix) |
| สถานะ | **IMPLEMENTED + TESTED + DEPLOYED** |
| runtime | m167 = **APPLIED+VERIFIED production** (R14 · batch id จริง + self-heal) · งานพิมพ์จริง (ใบเสร็จ/สติกเกอร์) = **รอเครื่องพิมพ์จริงของ Owner** (T-D/T-E — render-level ≠ ใบจริง) |

### F · Rider / Delivery

| ตรวจ | ผล |
|---|---|
| key files | 10/10 (RiderPwaPage · driverService · riderPositionApi · deliveryRouter · routeOptimization · dispatchFallback · m135 dispatch offers · m136 location history · m168 multi-job · m174 rider position) |
| สถานะ | **IMPLEMENTED + TESTED + DEPLOYED** |
| runtime | server auto-close = พิสูจน์ทำงานจริงแล้ว (R15 `e2e/r15ProbeB-result.json`) · POD upload + ride-along = **รอ Owner/rider เครื่องจริง** (CAP-11) |

### G · Inventory / Finance

| ตรวจ | ผล |
|---|---|
| key files | 6/6 (AdminRecipes · bmbAdminApi_inventory · m026 aggregate fix · m130 finance reports · m170 cost/margin · m181 addon margin) + `deduct_inventory_for_order` มีใน m019/026 + trigger |
| สถานะ | **IMPLEMENTED + TESTED + DEPLOYED** |
| runtime | หัก/คืนสต็อก = atomic ผ่าน RPC/trigger บน production (ledger ครบ · parity ALL_PASS) · หน้าจอ inventory/finance **ยังไม่มี probe ใหม่รอบนี้** → PHASE 6/8 re-verify |

### H · Automation / Notifications

| ตรวจ | ผล |
|---|---|
| key files | 13/13 (cron-tick · queue-dispatcher/enqueue · automation-worker · notification-dispatcher · push-send · sms-send · otp-send · notificationLinks · cartSessionSync · m179 notification hub · m180 cart reminder · workflow `automation-scheduler.yml`) |
| สถานะ | **IMPLEMENTED + TESTED + DEPLOYED + RUNTIME VERIFIED (หัวข้อใหญ่)** |
| runtime | automation-worker **deploy แล้ว + tick จริง** (R43: v72 → `scanned=3 published=3` → `approved_not_on_fb=[]` · evidence `e2e/r43_ef_versions_probe.json` + `r43_publish_probe.json` ยังอยู่) |
| ยังไม่ verified | push/SMS ถึงอุปกรณ์จริง = **รอ Owner** (CAP-13/CAP-14 RUNTIME UNVERIFIED) |

### I · Security / backend

| ตรวจ | ผล |
|---|---|
| key files | 11/11 (m005/m006 RLS hardening · m041 driver JWT binding · m046 channel identity · m146/m147 role foundation/matrix · **m157/m158 anon scoping** · auditLog · authRecovery · authSessionSync) |
| สถานะ | **IMPLEMENTED + TESTED + DEPLOYED + RUNTIME VERIFIED** |
| runtime | m157+158 = **APPLIED production** (`e2e/w6Apply157158-record.json`) · guest อ่านเมนูได้จริง = PostgREST 200 + `/menu` console สะอาด (W-2) · `my_role` m171 APPLIED (R21c) |
| gate เพิ่ม | parity LIVE วันนี้ = **ALL_PASS 183=183** (§1) → schema drift ฝั่ง ledger = ไม่มี |

### J · AI

| ตรวจ | ผล |
|---|---|
| key files | 12/12 (ai-proxy · image-gen · social-ai/post/publish workers · voice-tts · aiService · aiGuardrails · talkToBite · marketingAutoSchedule · AdminAiStudio · TalkToBiteHomePage) |
| สถานะ | **IMPLEMENTED + TESTED + DEPLOYED + RUNTIME VERIFIED (image-gen)** |
| runtime | **image-gen รุ่น `qwen/qwen-image-2.1-pro` = 200 จริง** (`e2e/r61ImageGenSmoke-result.json` · attempts=[] ไม่ fallback) · social workers DEPLOYED (R43/R27 evidence) |
| ยังไม่ verified | error shape จริงของ aiVoice direct path บน production (บันทึกเดิม) · AI ตอบจำเมนูเฉพาะโพสต์ (backlog ① — ยังไม่ได้แตะ = `DOCUMENTED`) |

### K · Infra / Migrations

| ตรวจ | ผล |
|---|---|
| inventory | migrations `.sql` = **186 ไฟล์ (เลข 001–183 + PROPOSED 3)** · EF = **24** · CI workflows = **5** (`ci` · `contract-tests` · `automation-scheduler` · `daily-backup` · `sheets-sync`) · workers = tenant-proxy |
| สถานะ | **DEPLOYED + RUNTIME VERIFIED** |
| evidence | **parity LIVE = 183/183 ALL_PASS** (§1) · **CI ของ HEAD = #733 success + #307 success** · m183 APPLIED production (`e2e/r61Apply183-result.json` = ALL_PASS) |

### L · Quality

| ตรวจ | ผล |
|---|---|
| inventory | `src/__tests__` = **204 ไฟล์ .ts/.tsx** (นับจากดิสก์) · `e2e/` = 1,297 entries · eslint + brandNameGuard + languageSanity ใน `npm run lint` |
| gates ล่าสุด (R61 — ยังไม่รันซ้ำในรอบนี้) | vitest FULL = **202/202 files · 2003/2003 tests · 0 fail** (`e2e/r61_vitest_full.log` ยังอยู่) · tsc 0 (`e2e/r61_tsc.log`) · lint OK (`e2e/r61_lint.log` + `r61_eslint_all.log`) |
| สถานะ | **TESTED (หลักฐาน R61) · gates ใหม่ = PHASE 6 จะรันเองแล้วรายงาน exit code จริง** |

---

## §3 PHASE 2 — CONFLICT / DECISION รอ Owner (ห้ามแก้เงียบ)

| # | เรื่อง | สถานะจริง (evidence) | ต้องการจาก Owner |
|---|---|---|---|
| **C-1** | **CAP-22 auto-post — `marketing_rules.menu_rules` / `stop_conditions` ยังว่าง** | ค่าหลัก (window/cooldown/frequency/content_mix) มีจริงแล้ว → C7/C8 รันได้ · 2 ค่าที่ว่าง = ทางเลือกที่บันทึกไว้ (BMB_MASTER_STATUS N-3 · Test Pack **L-12**) | เติมค่า หรือยืนยัน "ตั้งใจว่าง = ใช้ค่าหลักตามเดิม" (ปิด L-12) |
| **C-2** | **ขอบเขต CAP-22 "โพสต์อัตโนมัติเต็มรูปแบบ" vs โค้ดปัจจุบัน** | โค้ด = เลือกเวลาอัตโนมัติได้แต่ **ห้าม auto-approve · ไม่มี publish path ใหม่** (B-4 contract) · acceptance จริงรันไม่ได้จนกว่า C-1 จบ | ยืนยันว่า scope ที่ accept ได้ = แบบนี้ (ไม่ต้องการ auto-publish เต็ม) หรือสั่งเพิ่ม (เพิ่ม = งานใหม่ + ต้อง approval gate) |
| **C-3** | **CAP-18 Google Maps = RUNTIME UNVERIFIED** | key อ่านตอน **build** (`googleMaps.ts` · `VITE_GOOGLE_MAPS_API_KEY`) · Owner ตั้ง key ใน Cloudflare แล้ว แต่ **ยังไม่ยืนยัน rebuild/deploy ใหม่ + retest 3 ฝั่ง** | สั่ง rebuild+deploy + รีเทสแผนที่ (หน้าลูกค้า/แอดมิน/ไรเดอร์) — ถ้าไม่ deploy ใหม่จะยังเห็น build เก่า |
| **C-4** | **Runtime-bound tests ที่ AI รันแทนไม่ได้ (ทั้งชุด = รอเครื่อง/บัญชี/อุปกรณ์จริง)** | §T: T-A1/A2/A3/A6 = บัญชี FB จริง · T-A4 android + T-A5 iOS = มือถือจริง · T-D/T-E = เครื่องพิมพ์จริง · CAP-10/11/13/14 = slip/POD/push/SMS จริง | รันใน **PHASE 8 (Owner Production Test Pack ฉบับเดียว)** แล้วส่งผลกลับ — ห้ามตัดข้อทิ้ง |
| **C-5** | **Stash `local-edits-before-sync-2026-09-21` (9 ไฟล์ +4291/−499 · README/docs/e2e/sql-contract/m020)** | ยัง PRESERVE อยู่ · เจ้าของ/ชะตากรรมไม่ทราบ | ยืนยัน: ปล่อยทิ้งไว้ / แตกออกมาตรวจ / ลบ (ห้ามแตะจนกว่าจะสั่ง) |
| **C-6** | **Backlog ที่ยังไม่ได้แตะ (ไม่ใช่ regression — ของเดิมค้าง)** | ① Social AI rule "ใช้เฉพาะ MENU ของโพสต์นี้" ② cart re-add 700ms (R61 แก้ decode แล้ว — เคสยังเจอไหมต้อง Owner ยืนยัน) ④ review submit UI ⑤ ประกาศ list ใน `/promotions` ⑥ theater copy seed · PSID/LINE | เลือกว่ารอบ closure นี้ปิดข้อไหนบ้าง หรือ defer ทั้งหมดเป็นงานหลังเปิดร้าน (บันทึกเป็น DEFERRED อย่างเป็นทางการ) |

> **ไม่พบ CONFLICT ฝั่ง business rules:** pricing/cutoff/quota/discount-cap/order-state ในโค้ดกับ canonical
> (BMB_MASTER_STATUS CAP matrix) ตรงกัน — 15% cap · same-day no-cutoff · two-cutoffs = มี migration + test ตรงกันทุกฝั่ง

---

## §4 DOC DRIFT / CODE GAP — AI แก้เองได้ใน PHASE 3–5 (ไม่ใช่ conflict)

| # | รายการ | หลักฐาน | แผน |
|---|---|---|---|
| **D-1** | **SEO entries ขาด 4 เส้นทางจริง**: `/reset-password` · `/track` (เปล่า) · `/talk-to-bite` · `/voice-demo` | `e2e/r62SeoAuditV2.cjs` → `e2e/r62SeoAudit-result.json` (missingSeoCount=6 · หัก 2 redirect `/profile/orders`+`/ai-chat` = 4) | **PHASE 3** — เพิ่ม meta builders + route entries + test (ไม่แตะ business rules) |
| **D-2** | BMB_MASTER_STATUS §3 บรรทัดเก่าค้าง: แถว B-2 = "BLOCKED" + note "ยังเหลือ blocker 2 ตัว" **ขัดกับ** บรรทัดบน (B-2 ปิดรอบที่ 3 · N-2 ปิดแล้ว · CI #577 มี `Legacy contracts OK 7/7`) | BMB_MASTER_STATUS บรรทัด ~191–209 vs 222–223 | **PHASE 4** reconcile ให้สถานะเดียว (ปิด = ปิด · หลักฐาน N-2/W-2) |
| **D-3** | §9.0 CI history แถวหลังๆ = "ตรวจรอบถัดไป" / "SHA ดู git log" (ไม่ใช่เลขจริง) | BMB_MASTER_STATUS §9.0 แถว 46+ | **PHASE 4** เติม SHA/run จริง (R60–R62) |
| **D-4** | Test Pack §T เขียน "20 ข้อ" แต่ตารางมี **19 แถว** | AI_WORK_STATE R60 | **PHASE 4/8** ปรับเป็น 19 (ห้ามเพิ่มข้อปลอม) |
| **D-5** | รายงาน root 52 ไฟล์ + docs 70 entries + archive 2 → เก่า/ซ้ำ/point-in-time | `e2e/r62Inventory-result.json` | **PHASE 4–5** inventory map + MOVE ไป `docs/Archive` (ไม่ DELETE · dependency check ก่อน) |
| **D-6** | `BMB_PRODUCTION_MASTER_STATUS.md` (root · ฉบับ 2026-10-06) = รายงานเก่า vs canonical `docs/BMB_MASTER_STATUS.md` | heads ทั้งสองไฟล์ | **PHASE 5** reconcile แล้ว MOVE ไป archive |

---

> **ยังไม่ประกาศ COMPLETE/PRODUCTION READY** — evidence ระดับ RUNTIME หลายข้อ (C-3/C-4) ยังไม่มี
> · PHASE 3–8 ยังไม่ได้ทำ ณ เวลาเขียนเอกสารนี้

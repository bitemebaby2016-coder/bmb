# BMB_MASTER_REALITY_GAP_MAP.md
**แผนที่ช่องว่างความจริงของระบบ BITE ME BABY — Single Source of Truth สำหรับการ Remediation หลังจากนี้ทั้งหมด**
**วันที่ Freeze:** 2026-09-27 · **HEAD:** `fdc7898` · **Supabase Production:** `ivkdfognyiwjcmrhcnwz` · **PWA:** `bitemebaby-5f7.pages.dev`
**แหล่งข้อมูล:** Reconcile BMB_00–BMB_06 + evidence ทั้งหมด (prod-phase2-audit.json, prod-phase3-e2e.json, prod-phase4-admin.json +4b, prod-phase5-operational.json, prod-phase6-{integration,bundle-scan,voicechunk}.json, ภาพ p3-*/p4-*, ผล npm test)
**กฎเหล็ก:** READ-ONLY — ไม่มีและไม่อนุญาตการแก้ code / DB / config / RLS / auth / secrets / deploy ใด ๆ
**น้ำหนักหลักฐาน:** 1.ทดสอบจริงที่รันแล้ว → 2.Production DB/Config → 3.ซอร์สโค้ด → 4.RPC/EF/RLS → 5.Migrations → 6.เอกสารสถาปัตยกรรม → 7.README → 8.การคาดเดา
**คลังคำสถานะ:** READY · PARTIAL · BLOCKED · BROKEN · MISSING · DORMANT · DUPLICATE · CONTRADICTED · UNKNOWN · NOT VERIFIED (ห้าม DONE/COMPLETE/100%)

## 1. ความจริงของระบบ ณ วัน Freeze

BMB = PWA บน Supabase — migration ครบ **39/39** บน production, Edge Function deploy จริงเพียง **4/14** · อำนาจธุรกรรม (สร้างออเดอร์/ราคา/ค่าส่ง/สถานะ/ชำระเงิน) อยู่ที่ **PostgreSQL (RPC+trigger+RLS) ทั้งหมด — พิสูจน์ระดับ runtime** · PWA ลูกค้าใช้ได้ระดับเมนู/ตะกร้า/ติดตาม · Admin login ได้จริง (ด้วย credential สาธารณะ) แต่ session ไม่ทน reload · AI ทั้งหมดใช้ไม่ได้ (ai-proxy 404 สด) · ไม่มี integration ช่องทางภายนอกใด ๆ · lifecycle จริงเคยเดินถึงแค่ pending/confirmed · drivers/kitchen/provider_orders = 0 แถว

**พิสูจน์แล้วว่า READY:** สร้างออเดอร์ (RPC + capacity FOR UPDATE + triggers) · บังคับลำดับสถานะ (ผิดลำดับถูก DB ปฏิเสธ) · Stripe webhook + idempotency (PI จริง 6 events, duplicate=0) · ค่าส่ง RPC+โซน · รอบส่ง/cutoff/ความจุต่อวัน · RLS ทุกตาราง (anon เขียนไม่ได้เลย) · PWA install · guard admin ไม่ล็อกอิน · เกตเมนู 039 · MenuPage อ่าน DB

## 2. แผนที่ช่องว่างหลัก (Master Gap Register — 23 เรื่องจริง)

| ID | ระดับ | โดเมน | ชั้นปัญหา | ช่องว่าง | หลักฐาน | สถานะ | ขึ้นกับ | กระทบ |
|---|---|---|---|---|---|---|---|---|
| F-01 | CRITICAL | ความปลอดภัย/Auth | auth+config | Credential admin ตัวอย่าง (admin@bmb.co.th/admin123) **ใช้เข้าจริงบน production** + แสดงบน login สาธารณะ | Phase 4 ล็อกอินสำเร็จ (p4-after-login.png) | BROKEN | แก้ก่อนตรวจ admin ทุกเรื่อง | Admin ทั้งหมด |
| F-02 | HIGH | Auth/Session | auth | Session admin **หายเมื่อ reload** → deep-link /admin/* เด้ง /login 16/16 | prod-phase4-admin.json | BROKEN | ก่อน automation/deep-link | Admin ทุกหน้า |
| F-03 | CRITICAL | AI/Edge | deployment | **ai-proxy ไม่ถูก deploy** — GET+POST 404 จริง | Phase 6 probe สด | BROKEN | ก่อน AI ทุกฟีเจอร์ | แชท Bite, AI memory, คำแนะนำ |
| F-04 | HIGH | ความปลอดภัย/Secrets | frontend build | aiVoice.ts:95 อ่าน VITE_OPENROUTER_API_KEY → **key ฝัง lazy chunk ใน build local**; prod bundle ณ วันนี้สะอาด (สแกน lazy chunk แล้ว) | prod-phase6-voicechunk + dist scan | PARTIAL (path ตายบน prod) | พึ่ง F-03 | /voice-demo, build |
| F-05 | CRITICAL | Observability | DB schema | **ไม่มีตารางประวัติสถานะออเดอร์** — audit_logs ไม่มี order event เลย | Phase 5 ตรวจระดับ function body | MISSING | ก่อน kitchen/ops/forensics | Orders, Kitchen, Tracking |
| F-06 | HIGH | Driver/Identity | RPC identity | driver_login **สมัครตัวตนอัตโนมัติจากเบอร์ client ส่งมา** — ไม่ผูก JWT | body จริง Phase 5 | BROKEN | ก่อนมอบงานส่ง + dispatch >5km | Rider PWA, assignments |
| F-07 | HIGH | Kitchen | routing | AdminKitchen ไม่มี route + production_batches=0 + get_kitchen_summary ไม่มี caller | App.tsx:36-38 + Phase 2/5 | MISSING | พึ่ง F-05 | งานครัวทั้งสาย |
| F-08 | HIGH | PWA ลูกค้า | frontend state | **ตะกร้าไม่ทน reload** | Phase 3 runtime (p3-cart.png) | BROKEN | — | PWA ลูกค้า |
| F-09 | HIGH | เมนู/สินค้า | แหล่งข้อมูล | หน้าแรก drinks/snacks อ่าน **static lib ไม่ใช่ DB** — admin แก้แล้วหน้าแรกไม่เปลี่ยน | DrinksSection.tsx:10 / SnacksSection.tsx:10 | CONTRADICTED | — | หน้าแรก |
| F-10 | MEDIUM | Delivery | frontend | ส่ง >5km **ถูกบล็อกที่ frontend** (hardcode self_delivery) ทั้งที่ backend รองรับ | CheckoutPage.tsx:99,201 | BLOCKED | พึ่ง F-06 เฉพาะ >5km | checkout |
| F-11 | MEDIUM | PWA ลูกค้า | copy UX | Toast "สั่งซื้อสำเร็จ" ตอนหยิบใส่ตะกร้า = เข้าใจผิด | Phase 3 runtime | BROKEN | — | PWA |
| F-12 | MEDIUM | Tracking | display state | /track ไม่ต้องล็อกอิน + timeline ใช้ client state อาจเหลื่อมจาก DB | Phase 3/5 | PARTIAL | พึ่ง F-05 | Tracking |
| F-13 | MEDIUM | เมนู | label UX | ป้าย "จองล่วงหน้า (2)" ไม่ตรงการ์ดจริง | Phase 3 runtime | BROKEN | — | เมนู |
| F-14 | HIGH | Omnichannel | DB schema | **ไม่มี source_channel/external-message-id** — ไม่มี identity ออเดอร์รวมหลายช่องทาง | สแกน schema Phase 6 | MISSING | ก่อนต่อช่องทางใด ๆ | schema ออเดอร์ |
| F-15 | MEDIUM | Edge Functions | deployment | **10/14 EF ไม่ได้ deploy** (บางตัวไม่มี caller) | Phase 2 API + Phase 6 404 | DORMANT | ตัดสิน keep/drop รายตัว | Automation/AI |
| F-16 | MEDIUM | Notifications | integration | **in-app เท่านั้น** — ไม่มี email/LINE/Messenger/SMS/push | Phase 6 code+DB | PARTIAL | พึ่ง F-14 | การแจ้งลูกค้า |
| F-17 | LOW | ความปลอดภัย/Config | เอกสาร/env | .env/.env.example/เอกสาร ยังมี VITE_*SECRET* (src ไม่อ่านแล้ว จึงยังไม่ leak) | Phase 0 + PROD-CONTRA-3 + Phase 6 | CONTRADICTED | — | build/setup docs |
| F-18 | MEDIUM | ความปลอดภัย/RLS | DB policy | drivers auth_read using=true + recipes anon SELECT=true — grant กว้าง อาศัย policy กรอง (ยังไม่ทดสอบสด) | BMB_02_RLS audit | PARTIAL (ตั้งใจหรือไม่ = UNKNOWN) | ต้องทดสอบสด | RLS |
| F-19 | MEDIUM | Kitchen/Delivery | การใช้จริง | lifecycle จริงเคยเดินถึงแค่ pending/confirmed — preparing→delivered **ไม่เคยรันจริง** | data_sanity + Phase 5 | PARTIAL | พึ่ง F-05/F-07 | order spine ops |
| F-20 | LOW | Data | ความสะอาด DB | paid-ไม่มี-PI ×2 (test artifacts) · audit_logs 'test' ×6 · 3 ออเดอร์ไม่มีรอบ | Phase 2/5 | PARTIAL (อธิบายได้) | เก็บกวาดเมื่ออนุญาต | orders/audit_logs |
| F-21 | LOW | ความปลอดภัย UX | UX | หน้า login แสดง credential สาธารณะ — **รวมเข้า F-01** | Phase 3 capture | BROKEN | = F-01 | หน้า login |
| F-22 | LOW | PWA ลูกค้า | copy/UI | สะกดผิด tracking (กำลังงทำ/ส่งสำเรจ) · โซนขนมไม่แสดงบนหน้าแรก | Phase 3 runtime | BROKEN | snacks พึ่ง F-09 | หน้าแรก/Tracking |
| F-23 | MEDIUM(สงสัย) | Config wiring | consumer | business_settings.hours + delivery_policy.radius_km **ไม่มีผู้บริโภคที่พิสูจน์ได้** | Phase 2 settings | UNKNOWN | ไล่ trace ต่อ | Settings |

**คำตอบโดยตรง:** ระบบมีปัญหาจริงค้างอยู่ **23 เรื่อง** — CRITICAL 3 (F-01, F-03, F-05) · HIGH 7 (F-02, F-04, F-06, F-07, F-08, F-09, F-14) · MEDIUM 10 · LOW 3 (หลัง merge ของซ้ำ: L-2→F-01, OP-4→F-12 — ไม่มีการบวมเลข)

## 3. การแยก 3 ชั้นของทุกช่องว่าง (A/B/C)

| ID | A. ความจริงปัจจุบัน | B. เป้าหมายที่ต้องเป็น (จากเจตนาสถาปัตยกรรม/ธุรกิจใน repo) | C. การแก้ |
|---|---|---|---|
| F-01 | credential สาธารณะใช้ได้จริง | ตัวตน admin ปลอดภัย ไม่มี credential สาธารณะ | TBD |
| F-02 | session ตายเมื่อ reload | session ทน reload + deep-link ใช้ได้ | TBD |
| F-03 | ai-proxy 404 | AI มีขอบเขต provider ฝั่ง server ที่ปลอดภัยและ active | TBD |
| F-04 | key ฝัง client เมื่อ build มี env | ไม่มี secret ของ provider ใดอยู่ใน client bundle | TBD |
| F-05 | ไม่มีประวัติสถานะออเดอร์ | ประวัติ lifecycle authoritative ฝั่ง DB | TBD |
| F-06 | เบอร์โทร = ตัวตน | ตัวตนผูกกับ auth ที่ตรวจสอบได้ | TBD |
| F-07 | ครัวไม่มี route, ข้อมูล 0 | พื้นผิวครัวใช้ได้กับ lifecycle จริง | TBD |
| F-08 | ตะกร้าอยู่ใน memory | ตะกร้าทน reload/session loss | TBD |
| F-09 | หน้าแรก = static lib | ลูกค้าทุกจุดอ่าน DB เดียวกับ admin | TBD |
| F-10 | >5km ไม่มี UI | เลือกวิธีส่งได้ตามความสามารถ backend | TBD |
| F-11/F-13/F-22 | copy/label ผิด | copy ตรงความจริงของระบบ | TBD |
| F-12 | tracking = client defaults | tracking = ความจริงจาก DB (หลังมีประวัติ) | TBD |
| F-14 | ไม่มี identity ช่องทาง | identity ออเดอร์รวมรองรับหลายช่องทาง | TBD |
| F-15 | 10 EF ไม่ deploy | ทุก EF active หรือถูกลบอย่างมีเหตุผล | TBD |
| F-16 | in-app เท่านั้น | transport แจ้งเตือนตามขอบเขตธุรกิจ | TBD |
| F-17 | รูปแบบ secret อยู่ใน env/docs | เอกสารไม่สอน VITE_*SECRET* | TBD |
| F-18 | grant กว้าง | grant ตรงเจตนา policy | TBD |
| F-19 | lifecycle ใช้จริงบางส่วน | lifecycle เดินครบจริง | TBD |
| F-20/F-23 | artifacts / config ไร้ผู้ใช้ | production สะอาด ทุก config มีผู้บริโภค | TBD |

หมายเหตุ: **ห้ามเขียนแผนโค้ดลงใน Freeze** — การแก้ทั้งหมดคง TBD ในระดับ dependency

## 4. การตัดสินข้อขัดแย้ง (ตามลำดับน้ำหนักหลักฐาน)

| หัวข้อ | ข้ออ้างเก่า | พิสูจน์จริง | สถานะสุดท้าย |
|---|---|---|---|
| ai-proxy | "อาจ dormant" (Phase 1/2 คาดเดา) | GET+POST = **404 สด** (Phase 6) | **BROKEN — พิสูจน์ระดับ runtime** |
| OpenRouter secret | SEC-02 "client สะอาด, bundle 0 hits" | aiVoice.ts:95 + lazy chunk build local **มี key จริง**; prod bundle สะอาด ณ วันนี้ | **F-04 คงอยู่** — สแกนรอบเก่าไม่ได้ดู lazy chunk ที่เกี่ยวข้อง จึงไม่เพียงพอ ห้ามเลือกผลที่ "ดูดีกว่า" |
| Admin guard | "มี guard = ปลอดภัย" (เอกสาร) | ล็อกอินด้วย credential สาธารณะสำเร็จ + session ตายเมื่อ reload (Phase 4) | **F-01/F-02 คงระดับเดิม** — Route guard ≠ admin session ที่ปลอดภัยใช้ได้จริง |
| Audit trail | audit_logs มี 31 แถว | ไม่มี order event เลย + lifecycle จริงแค่ pending/confirmed | **OP-1 = MISSING (F-05)** — audit_logs ≠ ประวัติ lifecycle ออเดอร์ |
| ตัวตน rider | "driver RPC ครบ" (Phase 2 แก้ไข) | identity = เบอร์จาก client ไม่มี JWT binding | **OP-2 = HIGH / เสี่ยงปลอมตัวตน (F-06)** |
| README | 34/34 migrations, 179/163 tests | จริง 39/39 + npm test 358/358 (44 ไฟล์ = 22 จริง + 22 worktree ซ้ำ) | README = STALE/CONTRADICTED (ทำเครื่องหมายเก่า ไม่นับเป็น finding ใหม่) |
| Stripe | ".env.example: BLOCKED" vs README "6/6" | webhook ACTIVE v41 + PI จริง 6 events | **Stripe = READY (พิสูจน์ runtime)** — เอกสารเก่า STALE |

**ของเก่าที่ทำเครื่องหมาย STALE/SUPERSEDED (ไม่นับ):** ตัวเลข README (P0) · worktree copy (P0, DUPLICATE — ห้ามใช้เป็นหลักฐาน) · src/counter.ts + main.ts (dead code) · เอกสารเก่า D16/D12 (superseded โดย HEAD code) · Phase 1 "ai-proxy active" (superseded โดย runtime Phase 6)

## 5. สถานะรายโดเมน (22 โดเมน)

| โดเมน | สถานะ | ช่องว่างที่เกี่ยว |
|---|---|---|
| 1 ความปลอดภัย/Secrets | PARTIAL | F-01, F-04, F-17 |
| 2 Auth/Authorization | PARTIAL | F-01, F-02 · RLS ทุกตาราง ✓, anon เขียน = 0 ✓ |
| 3 PWA ลูกค้า | PARTIAL | F-08, F-11, F-13, F-22 · เรียกดู/เมนู/track ✓ ไม่มี console error |
| 4 Order Spine | READY (อำนาจ) / PARTIAL (ops) | อำนาจ = DB ✓ พิสูจน์ runtime · F-05, F-19 |
| 5 การชำระเงิน | READY (บัตร/คืนเงิน) · PARTIAL (PromptPay/COD สด) | webhook+idempotency ✓ จริง · offline สด = NOT VERIFIED |
| 6 Delivery | PARTIAL | ค่าส่ง/โซน ✓ · F-10, provider DORMANT |
| 7 Driver/Rider | PARTIAL + ช่องโหว่ | F-06, drivers=0, session rider อยู่ localStorage |
| 8 งานครัว | MISSING | F-07, F-19 |
| 9 Admin | BROKEN (session) | F-01, F-02 · dashboard/CRUD ✓ ผ่าน is_admin RLS |
| 10 เมนู/สินค้า | PARTIAL | F-09, F-13, L-3 · MenuPage=DB ✓ + เกต 039 ✓ |
| 11 AI | BROKEN | F-03, F-04 · ขอบเขตอำนาจ AI ✓ (อ่านอย่างเดียว) |
| 12 Edge Functions | PARTIAL | deploy จริง 4/14 (เรียกถึง+ตรวจแล้ว) · F-15 |
| 13 Automation | MISSING | ไม่มี scheduler/queue/event path |
| 14 Omnichannel | MISSING | F-14 · FB/Messenger/LINE/Make ไม่มี implementation |
| 15 Webhooks | READY | stripe-webhook ตัวเดียว — HMAC+idempotency ✓ จริง |
| 16 Notifications | PARTIAL | F-16 · in-app + ตาราง ✓ |
| 17 Customer Intelligence | PARTIAL/UNKNOWN | ตาราง+RPC มี · แถว/ผู้ใช้ยังไม่ได้นับ |
| 18 Content Generation | DORMANT | content_approvals=0 · เกตอนุมัติ ✓ ตาม design |
| 19 Observability/Audit | PARTIAL | F-05, F-20 |
| 20 E2E/QA | PARTIAL | 358/358 (44 ไฟล์ปน worktree) · E2E สดทั้ง flow = NOT VERIFIED |
| 21 หนี้สถาปัตยกรรม | PARTIAL | store ×2, เมนู 2 แหล่ง, worktree, dead code, F-23 |
| 22 Dormant/Duplicate/Dead | PARTIAL | 10 EF · 3 หน้า admin ตาย · lib ซ้ำ · aiVoice transport ซ้ำ |

## 6. แผนที่รวมตามสถานะ

- **READY (พิสูจน์ runtime):** สร้างออเดอร์ · บังคับลำดับสถานะ · Stripe webhook+idempotency · ค่าส่ง · รอบ/cutoff/ความจุ · RLS ทุกตาราง · PWA install · guard admin · เกตเมนู 039 · MenuPage อ่าน DB
- **PARTIAL:** PromptPay/COD (DB ✓, สด NOT VERIFIED) · จองล่วงหน้า (1 ออเดอร์) · แจ้งเตือน (in-app) · tracking · ความกว้าง RLS (F-18) · test suite · customer intelligence · ตารางเมนูรายสัปดาห์ (backend ✓ ไม่มี UI admin)
- **BLOCKED:** UI >5km (F-10) · E2E ชำระเงินสด (ไม่มีบัญชีทดสอบ + ห้ามแก้ข้อมูล) · automation รายหน้า admin (F-02 + rate-limit)
- **BROKEN:** แชท AI (F-03) · session admin ตอน reload (F-02) · ตะกร้าตอน reload (F-08) · credential สาธารณะ (F-01) · copy/label (F-11/13/22)
- **MISSING:** ประวัติออเดอร์ (F-05) · identity omnichannel (F-14) · งานครัว (F-07) · automation · Make/FB/Messenger/LINE · transport แจ้งเตือนภายนอก
- **DORMANT:** 10 EF (F-15) · content generation · provider adapters/provider_orders · หน้า admin ตาย · lib ซ้ำ

## 7. สมุดทะเบียนความปลอดภัย / ความลับ / อำนาจ

**ยืนยันแล้ว (พิสูจน์ runtime):**
- F-01 credential admin ตัวอย่างใช้ได้จริงบน production + เปิดเผยสาธารณะ (Phase 4 ล็อกอินสำเร็จ)
- F-02 session admin ไม่ทน reload (16/16 เด้ง)
- F-04 code อ่าน key provider ฝั่ง client + build local ฝัง key จริง (prod bundle สะอาด ณ วันนี้)
- anon เขียน = 0 · orders UPDATE ถูกบล็อก (using=false) · อำนาจชำระเงิน = DB RPC เท่านั้น · เครื่องมือ AI อ่านอย่างเดียว · webhook HMAC + idempotency จริง (PI 6 events, duplicate=0)

**เสี่ยง (ยืนยันรูปแบบแล้ว ยังไม่พิสูจน์การโจมตี — ห้ามเรียก confirmed vulnerability):**
- F-06 ปลอมตัวตน rider (body ใช้เบอร์จาก client ไม่มี JWT binding — ทดสอบปลอมสด = ห้ามทำ)
- F-17 VITE_*SECRET* ใน .env/เอกสาร (src ไม่อ่าน → ยังไม่ leak ณ ปัจจุบัน)
- F-18 ความกว้างการอ่าน drivers/recipes (policy กรองอยู่ — ยังไม่ได้ทดสอบสด)

**ยังไม่พิสูจน์ (Not Verified):**
- ทดสอบสดข้ามบัญชีลูกค้า · anon อ่านออเดอร์ (กรองสถานะ) สด · ปลอมตัวตน rider สด · ชำระ offline สด · search_path ของ 103 functions · diff ระดับ byte ของ function bodies · bypass RLS สด

## 8. เมทริกซ์ Integration ภายนอก

| Integration | ซอร์ส | Provider | Auth | Runtime | DB | Idempotency | Retry | ขอบเขตความล้มเหลว | สถานะ |
|---|---|---|---|---|---|---|---|---|---|
| Stripe | stripe-webhook EF v41 | Stripe API | HMAC whsec ✓ | **ACTIVE จริง** (PI 6 events) | PI + replay guard | ✓ DB-enforced | Stripe backoff | ไม่มี success ปลอม ✓ | READY |
| OpenRouter | ai-proxy (ซอร์ส) + aiVoice (client) | OpenRouter | key ฝั่ง server (EF) / key ฝั่ง client ⚠️ | EF 404 · voice ไม่มี key config | ตาราง ai | — | client fallback 1 ครั้ง | error กลับ client | BROKEN/PARTIAL |
| DeepSeek | ไม่มี | — | — | — | — | — | — | — | MISSING |
| ai-proxy | ซอร์ส ✓ | — | JWT (ซอร์ส) | 404 จริง | — | — | — | — | DORMANT/404 |
| Make.com | ไม่มี | — | — | — | — | — | — | — | MISSING |
| Facebook / Messenger | แค่ลิงก์ footer | — | — | — | — | — | — | — | MISSING |
| LINE | แค่ลิงก์ footer (phone-auto-login ไม่ใช่ LINE) | — | — | — | — | — | — | — | MISSING |
| Delivery provider | adapters ×4 | MOCKUP/Sandbox | — | ✗ | provider_orders=0 | — | — | — | DORMANT |
| Notifications (ภายนอก) | ไม่มี | — | — | — | notifications/prefs ✓ | — | — | — | PARTIAL (in-app เท่านั้น) |

**ของ MISSING → Business Decision Required = YES** (Owner ต้องตัดสินขอบเขต: Make.com, FB/Messenger, LINE, delivery provider, DeepSeek) — ห้ามผู้พัฒนาตัดสินเองว่า "ไม่จำเป็น"

## 9. เมทริกซ์ Edge Function (14/14)

| Edge Function | ซอร์ส | Deploy | เรียกถึง | ผู้เรียก | Auth | หลักฐาน production | สถานะ |
|---|---|---|---|---|---|---|---|
| create-checkout | ✓ | ✓ v33 | ✓ | paymentGateway.ts:66 | JWT | 401 สด | ACTIVE |
| stripe-webhook | ✓ | ✓ v41 | ✓ | Stripe (ภายนอก) | HMAC | 200 สด + PI จริง | ACTIVE |
| stripe-refund | ✓ | ✓ v3 | ✓ | bmbAdminApi_orders.ts:264 | JWT | 401 สด | ACTIVE |
| phone-auto-login | ✓ | ✓ v1 | ✓ | ไม่พบ caller ใน repo | ไม่มี | 405 สด | ACTIVE (caller ไม่ทราบ) |
| ai-proxy | ✓ | ✗ | 404 จริง | aiService.ts:53 | — | 404 GET+POST | 404/DORMANT |
| ai-daily-report, daily-report, generate-rewards, inventory-reorder, random-menu-draw, track-share, vote-menu | ✓ | ✗ | 404 | ไม่พบ caller | — | 404 | Source-only/DORMANT |

สรุป: **Active 4** · **Source-only/DORMANT 10** · บางตัวอาจตั้งใจให้ cron ภายนอกเรียก = NOT VERIFIED (ไม่พบ cron ใน probe ของ Supabase)

## 10. เส้นทางลูกค้าจริง (Landing → … → Delivery)

| ขั้น | Runtime | Backend | Frontend | หลักฐาน | ช่องว่างบังคับ |
|---|---|---|---|---|---|
| Landing | ✓ render | — | หน้าแรก ผสม DB/static | p3-home | F-09, L-3 |
| เมนู | ✓ 7 รายการ | DB + เกต 039 ✓ | ✓ | p3-menu | F-13 |
| สินค้า | ✓ | — | ✓ | probe | — |
| ตะกร้า | ✓ ในเซสชัน | — | ✗ ไม่ทน reload | p3-after-add/cart | **F-08** |
| Checkout | เกต ✓ | ค่าส่ง RPC ✓ | ✗ >5km ไม่มี | p3-checkout-gate | F-10 |
| ชำระเงิน | NOT VERIFIED (ห้ามจ่ายจริง) | EF+DB READY | UI ✓ | — | ไม่มีบัญชีทดสอบ |
| ออเดอร์ | NOT VERIFIED สด | RPC READY ✓ | ✓ | Phase 2/5 | — |
| Tracking | ✓ render | getOrder ✓ | timeline client-state | p3-track | F-05, F-12 |
| Delivery | ✗ | design ✓ 0 แถว | ✗ | Phase 5 | F-06, F-10 |

**ห้ามเรียก "ครบวงจร (end-to-end complete)"** — ยังมีช่องว่าง: ตะกร้าไม่ทน reload, UI >5km, สร้างออเดอร์/ชำระเงินสด, ประวัติออเดอร์, ops delivery

## 11. เส้นทาง Admin จริง (Login → … → Settings)

| ขั้น | สถานะ | หลักฐาน |
|---|---|---|
| Login | เสี่ยงร้ายแรง (credential ตัวอย่างใช้ได้จริง) | Phase 4 ล็อกอินสำเร็จ |
| Session | **BROKEN** (reload → /login 16/16) | prod-phase4-admin.json |
| Dashboard | เข้าถึงได้ ✓ (ดึงจาก DB) | p4-after-login |
| Orders/ชำระเงิน/คืนเงิน | เข้าถึงได้ (อำนาจ RPC ✓) — เดินเฉพาะหน้าต่อหน้า BLOCKED (F-02 + rate-limit) | Phase 4 |
| Kitchen | **ตาย** (ไม่มี route) | App.tsx:36-38 |
| เมนู (products) | เข้าถึงได้ — แก้ข้อมูลจริง NOT VERIFIED | Phase 4 §3 |
| Recipes | **ตาย** (AdminRecipes ไม่มี route) | App.tsx |
| Delivery | เข้าถึงได้ — dispatch ไม่เคยใช้ (0 แถว), MOCKUP | Phase 4 |
| Settings | เข้าถึงได้ — hours/radius_km ผู้บริโภค UNKNOWN (F-23) | Phase 2 |
| PreOrders admin | **ตาย** (AdminPreOrders ไม่มี route) | App.tsx |

## 12. เส้นทาง AI จริง (User → … → Intelligence)

`ผู้ใช้ → UI AI → AI Service → Proxy/API → Provider → Response → DB/Intelligence`

- **แชท Bite AI:** UI ✓ (มี route, ต้องล็อกอิน) → aiService ✓ → **ai-proxy = 404 (จบตรงนี้)** → Provider ติดต่อไม่ได้ → Response ✗ → Intelligence (ตาราง ai มีแต่ไม่มี event ใหม่) — **BROKEN ทั้งสายหลัง UI**
- **AI Voice (/voice-demo):** UI ✓ → aiVoice.ts เรียกตรง → ไม่มี VITE_OPENROUTER_API_KEY ใน prod build → error ฝั่ง client (รูปแบบ error = NOT VERIFIED) — **PARTIAL/เสี่ยง (F-04)**
- **OpenRouter:** provider เดียวใน code (Model A nemotron free + fallback qwen) — ยังไม่ active จริงที่ใด
- **DeepSeek:** MISSING ทุกชั้น
- **ai-proxy:** ไม่ได้ deploy — พิสูจน์ 404 สด
- **Tool calling / คำแนะนำ / content AI:** DORMANT (อยู่หลังแชทที่พัง / การอนุมัติ = 0)

## 13. กราฟความเชื่อมโยง (พิสูจน์จากหลักฐาน — ไม่ใช่การจัดอันดับ)

```text
F-01/F-02 ขอบเขตความปลอดภัย/ความลับ/Session Admin
        ↓ (แก้ก่อน: การตรวจสอบใด ๆ ที่ใช้ admin runtime + กันข้อมูลถูกแก้ระหว่างทำ)
F-05 ประวัติ Lifecycle ออเดอร์     [ทางเทคนิคไม่พึ่ง F-01 — ทำขนานได้]
        ↓ (ครัว/ops/ความจริง tracking ต้องอ่านประวัติจากที่นี่)
F-07 พื้นผิวงานครัว
F-06 ตัวตน Driver (ผูก auth↔drivers)
        ↓ (dispatch >5km ต้องมีตัวตนที่เชื่อถือได้)
F-10 UI Delivery (≤5/>5km) + F-19 lifecycle ใช้จริง
F-03 การตัดสิน deploy AI/Edge Function (+F-04 ขอบเขต secret ตัดสิน transport)
        ↓ (ฟีเจอร์ AI ทุกตัว + การตัดสิน transport)
F-14 Identity ออเดอร์ Omnichannel → F-15 keep/drop EF → F-16 transport แจ้งเตือน
F-08/F-09/F-11/F-13/F-22 ฝั่ง PWA ลูกค้า (ตะกร้า/หน้าแรก/copy)  [ทางเทคนิคอิสระ]
        ↓
E2E Production เต็ม (ต้องมีบัญชีทดสอบ + session admin แก้แล้ว + ประวัติออเดอร์ + ตัดสิน EF แล้ว)
```

**ลูกโซ่บังคับจริงที่ยืนยันได้:** F-01/F-02 → (การตรวจ admin ทุกอย่าง) · F-05 → F-07, F-12 · F-06 → F-10(>5km) · F-03 → F-04 → ฟีเจอร์ AI · F-14 → F-16, ช่องทางภายนอก

## 14. ปรับลำดับ dependency เดิมของ Phase 6 (จากหลักฐาน)

| ลำดับเดิม (P6) | ตรวจจากหลักฐาน | ความสัมพันธ์ใหม่ |
|---|---|---|
| 1 secret → 2 session admin → 3 ประวัติออเดอร์ → 4 ตัวตน driver → 5 ตัดสิน EF → 6 ช่องทาง omnichannel → 7 ครัว → 8 หน้าแรก/ตะกร้า → 9 UI delivery → 10 E2E สด | ประวัติออเดอร์ (F-05) ไม่มี dependency ทางเทคนิคต่อ secret hygiene — **ทำขนานได้** (เดิมเรียงเป็นเส้นตรง) | ถอด F-05 ออกจากลูกโซ่ S-1→S-2 |
| | หน้าแรก/ตะกร้า (F-08/F-09) ไม่พึ่ง deploy EF หรือช่องทาง omnichannel — **อิสระ** | ถอดออกจากลูกโซ่ |
| | ครัว (F-07) พึ่ง F-05 เท่านั้น ไม่พึ่งตัวตน driver | ครัว ← F-05 เท่านั้น |
| | UI delivery (F-10) พึ่ง F-06 เฉพาะ >5km; ≤5km แก้ได้ก่อน | แยก ≤5 / >5 |
| | ช่องทาง omnichannel (F-14) ไม่พึ่งการตัดสิน deploy EF (schema ทำก่อน deploy ได้เสมอ) | F-14 ก่อน/ขนานกับการตัดสิน F-03 ได้ |

## 15. คลื่นงานแก้ (Remediation Waves — วางแผนเท่านั้น ห้ามลงมือใน Freeze)

**คลื่น 1 — ความปลอดภัย/อำนาจ:** F-01, F-02, F-17 (+F-21 ที่ merge แล้ว) · เงื่อนไข: Owner อนุมัติ rotate credential · ตรวจ: ล็อกอินด้วย credential ใหม่จากช่องทางลับ + session ทน reload 16/16 ผ่าน

**คลื่น 2 — ตัวตน/ประวัติออเดอร์:** F-05, F-06, ทดสอบสด F-18 · เงื่อนไข: คลื่น 1 (สำหรับตรวจฝั่ง admin) · ตรวจ: transition จริงถูกบันทึก + เบอร์ปลอมถูกปฏิเสธ

**คลื่น 3 — AI/Edge/Integration:** F-03, F-04, F-14, F-15, F-16 (+integration ที่ขาด ตามการตัดสิน Owner) · เงื่อนไข: ตัดสิน F-04 (ห้ามมี key ฝั่ง client) + schema F-14 · ตรวจ: ai-proxy สดตอบ 200 + สแกน lazy chunk ไม่พบ secret + probe ช่องทาง

**คลื่น 4 — ครัว/เมนู/ตะกร้า/Delivery:** F-07, F-08, F-09, F-10, F-11, F-13, F-19, F-22, F-20, F-23 · เงื่อนไข: F-05 · ตรวจ: admin แก้เมนู → ลูกค้าเห็นครบทุกจุด + batch ครัวเดินต่อออเดอร์จริง

**คลื่น 5 — E2E เต็ม/Regression:** ทุกเส้นทาง §10–12 · เงื่อนไข: คลื่น 1–4 + บัญชีทดสอบ + Owner อนุมัติแก้ข้อมูลในแถวทดสอบ · ตรวจ: E2E สดผ่านทั้งลูกค้า/admin/AI

ชื่อคลื่นไม่ใช่ผลสุดท้าย — ถ้าหลักฐานใหม่ขัด dependency ให้เปลี่ยนตาม §13–14

## 16. การตัดสินใจที่ต้องได้จากเจ้าของระบบ (ห้ามผู้พัฒนาตัดสินเอง)

1. deploy/สร้าง `ai-proxy` ใหม่ หรือเปลี่ยนสถาปัตยกรรม AI · 2. นโยบาย OpenRouter vs DeepSeek · 3. รับ Make.com หรือไม่ · 4. ขอบเขต FB/Messenger/LINE · 5. ขอบเขต delivery provider (rider ภายนอก >5km) · 6. โมเดลตัวตน driver · 7. โมเดลการทำงานครัว · 8. นโยบาย PromptPay/ชำระ offline · 9. โมเดลแหล่งออเดอร์แบบ omnichannel · 10. ขอบเขต automation เนื้อหา AI · 11. เก็บ/ลบ 10 EF dormant · 12. rotate credential ตัวอย่าง + สร้างบัญชีทดสอบ (จำเป็นต่อคลื่น 1/5) · 13. F-18 ความกว้าง RLS "ตั้งใจหรือไม่" · 14. F-20 เก็บกวาดข้อมูลทดสอบ

## 17. ไฟล์ trace ประกอบ

`e2e/master-reality-freeze.json` — register แบบ machine-readable + map หลักฐาน (สร้างแล้ว, อ่านอย่างเดียว, ตรวจแล้วด้วย node: 23 findings)

## 18. เกณฑ์การยอมรับ

- Phase 0–6 reconcile ครบ ✓ · findings รวมของซ้ำแล้ว (23 เรื่องจริง, merge L-2→F-01, OP-4→F-12) ✓ · ข้อขัดแย้งตัดสินด้วยน้ำหนักหลักฐานแล้ว ✓ · 23 ข้อง Phase 6 trace ครบ ✓ · ของเก่า/ของทับถูก mark ✓ · ความจริงปัจจุบัน ≠ เป้าหมายสถาปัตยกรรม แยกชัด (§3) ✓ · กราฟ dependency มีหลักฐาน (§13–14) ✓ · คลื่นงานแก้ = วางแผนเท่านั้น ✓ · การตัดสินของ Owner แยกออกแล้ว (§16) ✓ · **ไม่มีการแก้ code/DB/config/deploy เลย** ✓

**REALITY FREEZE = READY**

**HARD STOP** — หยุดรอคำสั่งจาก Owner เท่านั้น (ห้ามเริ่มคลื่น 1 / การแก้ / implementation)
# HANDOFF → แชทถัดไป (17 ต.ค. 2026 รอบเย็น — แก้ปัญหาที่ Owner เจอจากภาพ)

> ต่อจาก `docs/BMB_HANDOFF_NEXT_SESSION_2026-10-17-PM.md` — อัปเดตหลังแก้ "ตอบเบิ้ล/สะกดผิด/ข้อมูลมั่ว/แชตหาย/เงียบ"

---

## 1. สิ่งที่ probe เจอจากของจริง (social_events 17 ต.ค. ไม่ใช่เดา)

| อาการที่ Owner รายงาน | ต้นเหตุจริง |
|---|---|
| ตอบเบิ้ล 2 ครั้งใต้โพสต์/แชท | ① bot ตอบคอมเมนต์/echo **ของตัวเอง** (event `..._940089778887913` = ข้อความ bot เอง) ② 2 ข้อความชิดกัน → ทัก "สวัสดีค่ะ~" ใหม่ทุกครั้ง ดูเหมือนเบิ้ล |
| ตัวแรกสะกดผิด | โมเดล deepseek-v4-flash ไม่มี persona/บริบท → คำมั่ว ("เพ็มBITE", "เดลิเชฟ") + ใช้ "ค่ะ" ทั้งที่ persona = "ครับ" |
| ข้อมูลร้านมาจากไหน (มั่ว 10:00-21:00) | social-ai-worker **ไม่มี DB context** (web มี aiDbContext แต่ตัวนี้ไม่มี) → โมเดลมโน (จริง = 07:00-20:00) |
| ถาม "ไม่กินเผ็ด" แล้วหายทั้ง Messenger/web | Messenger: draft โดน reject `source_event_id_mismatch` (โมเดลก๊อป event_id ผิด) → status=FAILED **เงียบถาวร** · web: typing ค้าง (TTS throw ก่อนเข้า try) → แชตตาย |

## 2. แก้แล้ว + deploy แล้ว (4 EF) — รอ Owner เทสต์ซ้ำ

1. **`channel-webhook`**: self-echo guard — sender == page → reject ไม่ ingest (กัน bot ตอบตัวเองถาวร)
2. **`social-ai-worker`**:
   - self-echo guard ซ้ำชั้นใน worker + **conversation thread** (6 ข้อความล่าสุด) + กติกา "ห้ามทักทายซ้ำ/ตอบต่อเนื่อง"
   - `source_event_id_mismatch` → **normalize ไม่ reject** (ห้ามเงียบ — content bans เดิมยัง reject อยู่)
   - ฉีด **BITE_PERSONA_SEGMENT** ("ครับ" ห้าม "ค่ะ") + **REPLY_CONTINUITY_RULES** + **shopContext ข้อมูลร้านจริง**
3. **`_shared/shopContext.ts` (ใหม่)**: บริบทชุดเดียวทุกตัว AI — เมนู/ราคา/หมด จาก `products` · หมวด · โปรโมชัน · `business_settings` + SHOP_FACTS (mirror `SHOP_CONTACT` ใน Footer, Owner 2026-10-17) · cache 5 นาที · READ-ONLY
4. **`social-post-worker`**: ใช้ shopContext เดียวกัน (โพสต์ไม่มั่วชื่อเมนู/เวลา) + คีย์ใหม่
5. **`ai-proxy`**: คีย์ใหม่ fallback
6. **คีย์ OpenRouter ใหม่ (`BMB_openrouter_api_key`)**: พบว่าอยู่ใน `.env.local` จริงแต่ **บรรทัด 54-55 ถูกขึ้นบรรทัดค้างตอน paste** (ชื่อบรรทัดเดียว ค่าอีกบรรทัด) → รวมบรรทัดแล้ว + ตั้ง secret `BMB_OPENROUTER_API_KEY` ฝั่ง Supabase แล้ว (HTTP 201) — โค้ดทั้ง 3 ตัวอ่านคีย์ใหม่ก่อน fallback `OPENROUTER_API_KEY`
7. **`TalkToBite.handleSend`**: ทุกอย่างอยู่ใน try/finally (กัน typing ค้าง) + กัน TTS พังพาแชตล่ม + กันข้อความตอบว่าง
8. **ฟุตเตอร์ social/LINE แอดมินใส่เองได้**: `src/lib/socialLinks.ts` (คีย์ `business_settings` = `social_links`) + ช่องกรอกใน AdminSettings → "โซเชียล & LINE" (เว้นว่าง = ซ่อนปุ่ม) — **รอแอดมินใส่ลิงก์ LINE ทีหลัง**
9. **FAQ typo ไทยเก็บทั้งไฟล์** `faqContent.ts` (คุสามารถ/แบบฟอรม/คปอง/เมน/อรเดอร ฯลฯ)

**Gates**: tsc 0 · lint 0 (brandNameGuard) · **tests 101 ไฟล์ / 1,064 ผ่าน** (รวม `socialAiContinuity.test.ts` ใหม่ 13 ข้อ) · build 0 — **deploy EF 4 ตัว EXIT=0 ทั้งหมด**

## 3. งานที่เหลือ/รอ Owner

- ⬜ **เทสต์ Messenger ซ้ำ**: ทัก "ไม่กินเผ็ด สั่งได้ไหม" + 2 ข้อความชิดกัน → ต้องตอบ 1 ครั้งต่อข้อความ, ไม่ทักซ้ำ, ใช้ "ครับ", เวลา 07:00-20:00, แนะนำเมนูไม่เผ็ดจากเมนูจริง
  - event ค้าง `msg-m_NZz...` (ไม่กินเผ็ด) = FAILED เก่า เก็บไว้เป็นหลักฐาน — ถามใหม่ได้คำตอบแน่นอน
- ⬜ **เทสต์ web chat ซ้ำ**: ถาม "ไม่กินเผ็ด" ในหน้าเว็บ — ต้องตอบต่อเนื่อง ไม่หาย
- ⬜ **แอดมินใส่ LINE/social**: Admin → Business Settings → "โซเชียล & LINE" → บันทึก (คีย์ `social_links`)
- ⬜ Checklist เดิมของ Owner ที่ยังไม่ปิด: เทสต์ same-day/pre-order 2 ใบ · OTP flag `QUICK_LOGIN_REQUIRE_OTP` · ลบ/noindex `bitemebaby-5f7.pages.dev` · Omise LIVE · GO decision (ดู `docs/BMB_HANDOFF_NEXT_SESSION_2026-10-17-PM.md` §4)

## 4. กติกา/หมายเหตุที่ยังคงเดิม
- `.clinerules` ห้าม commit · `chat\bmb\` ห้ามแตะ · HARD STOP ห้ามขายจริงจนกว่า Owner สั่ง go
- Contract tests ที่ต้องรักษา: `socialAiContinuity` (ใหม่) + G6/G7 เดิม (`g6Security` ยังผ่าน — คงตรรกะ `source_event_id_mismatch`/`OPENROUTER_API_KEY`/claim ไว้ครบ)
- Path ใหม่: `supabase/functions/_shared/shopContext.ts` · `src/lib/socialLinks.ts` · `src/__tests__/socialAiContinuity.test.ts`

---

# อัปเดต 17 ต.ค. 2026 รอบค่ำ — ROUND-LINK (Directive: menu schedule ↔ pre-order)

## 5. สิ่งที่ทำ (รอบนี้)
Owner สั่ง: "menu schedule ซ้ำซ้อนกับ pre-order ให้ลิ้งค์กันจริงด้วย round key + ปุ่มเปิดปิดทุกรอบส่ง + แอดมินเป็นสวิตช์/ดรอปดาวน์"

| ปัญหาที่พบ (โค้ดจริง) | แก้ไขแล้ว |
|---|---|
| `AdminMenuSchedule` hardcode `ROUND_KEY_OPTIONS = ['', 'morning','midday','evening']` — **ไม่ผูก** `delivery_rounds` (สั่ง `rounds` มาแล้วทิ้งด้วย `void rounds`) ขณะที่ `CheckoutPage` ใช้รอบจริง (`listRoundsForDate` + `selectedRound.round_key` เข้า gate/RPC) | dropdown รอบสร้างจาก `delivery_rounds` ของวันที่เลือกจริง (`roundKeyOptions(dateRounds)`) — `menu_schedule.delivery_round_key ↔ delivery_rounds.round_key` ชุดเดียวกับ checkout |
| ไม่มีปุ่มเปิด/ปิดทุกรอบส่งในหน้าจัดการเมนู | การ์ด "🚦 รอบส่งของวันนี้" + ToggleSwitch รายรอบ (เขียน `delivery_rounds.status` ผ่าน `setRoundStatus`) + ปุ่ม ensure rounds (`ensure_rounds_for_date`) ถ้ายังไม่มีรอบของวันนั้น |
| แอดมินใช้ checkbox/ปุ่มคู่ open-close | ทั้ง `AdminMenuSchedule` (สินค้า) และ `AdminRounds` (รอบ) เป็น `ToggleSwitch` + ดรอปดาวน์ (มี testId ครบ) |
| API ทับซ้อน 2 ชุด (`getDeliveryRounds` vs `getDeliveryRoundsAdmin`) | เพิ่ม `getRoundsForDateAdmin(date)` ใน `bmbAdminApi_rounds` (ชุดเดียวกับ checkout) — หน้า schedule เลิกใช้ตัวซ้ำ |

**ไฟล์ที่เปลี่ยน:** `src/lib/bmbAdminApi_rounds.ts` (+`getRoundsForDateAdmin`) · `src/lib/bmbMenuSchedule.ts` (+`roundKeyOptions`/`nextRoundStatus`/`toggleDraftEntry`) · `src/pages/admin/AdminMenuSchedule.tsx` · `src/pages/admin/AdminRounds.tsx` · `src/__tests__/menuScheduleRoundLink.test.ts` (ใหม่ 9 ข้อ) · `AI_WORK_STATE.md` (ใหม่ — .clinerules บังคับ)

## 6. Phase A audit snapshot (Directive §3 — ตรวจโค้ดจริง ยังไม่ครบ → งานถัดไป)

| พื้นที่ | สถานะ | หลักฐาน |
|---|---|---|
| Pre-order/Same-day สั่งได้จริง (ไม่ใช่ปุ่มเปล่า) | ✅ มีและทำงานได้ (ระดับ test) | `CheckoutPage` round picker จาก DB + cutoff/capacity client guard + `create_order_with_items` (025/044/048/104) — ยังไม่มี E2E ออเดอร์จริง |
| menu schedule ↔ pre-order ผูกด้วย round key | ✅ แก้แล้วรอบนี้ | `mirrorPreOrderScheduleGate` + `menuScheduleRoundLink.test.ts` |
| ปุ่มเปิด/ปิดทุกรอบส่ง | ✅ แก้แล้วรอบนี้ | `AdminMenuSchedule` round-toggles + `AdminRounds` |
| Mixed cart (SAME_DAY+PRE_ORDER ปน) | ⚠️ มี guard ฝั่งเพิ่มสินค้า (homePreOrderModeGuard: mixed line kept + navigate) — **ต้อง audit ฝั่ง checkout/payment ต่อ** ว่าเงื่อนไขชำระเงินตรงกับโหมดออเดอร์จริง | `homePreOrderModeGuard.test.ts` |
| Homepage pre-order 2 จุด (บนก่อน Popular Menu + Footer) | ✅ แก้แล้วรอบนี้ | เพิ่มจุดเข้าบน HomePage (ก่อน Popular Menu — render `homePreOrderTitle` ที่เคยเป็น config เปล่า) + ปุ่ม Footer — ทั้งคู่ใช้ `preOrderEntryPath()` ตัวเดียว (workflow เดียว) · `preOrderEntry.test.ts` |
| Audience Voices ผูกเมนู/รีวิวจริง | ✅ มีและตรง (audit แล้ว) | `SOCIAL_PROOF_REVIEWS` = curated marketing testimonials (มี sourceLabel ระบุชัด ไม่แอบอ้างเป็นรีวิวร้าน — RE-D2) + `VerifiedReviewsSection` (CAT-04) ดึงจากตาราง `reviews` จริงผ่าน `reviewApi` |
| FB Comments/Messenger → ส่งต่อออเดอร์เข้า Cart/Order | ✅ แก้แล้วรอบนี้ (§3/§4) | `_shared/socialOrderIntake.ts` (create-only ผ่าน `rpc/create_order_with_items` + idempotent `p_external_ref_id` = event id) · worker intake เฉพาะ Messenger; comment สาธารณะชวนเข้า Inbox (ไม่เปิดเผยรายละเอียด) · `socialOrderIntake.test.ts` 20 ข้อ |
| Bite จำบริบทจาก Cart/Order จริง (§5) | ✅ แก้แล้วรอบนี้ | `TalkToBite.composeRealContext()` — รายการ/จำนวนใน Cart จาก cart store + route จริง + ช่องทาง ส่งเข้า chatWithAI ทุกข้อความ |
| Web: AI เพิ่มรายการที่ลูกค้ายืนยันลง Cart (§3) | ✅ มีอยู่แล้ว | `TalkToBite.confirmDraft` → canonical `cartStore.addItem` (human-in-loop: ลูกค้ากดยืนยัน draft ก่อน) + AddToCartResult guard |
| G6/G7 rule ตาม §3 (สร้างใหม่ได้/แก้ของเดิมไม่ได้) | ✅ แก้แล้วรอบนี้ | G6-09 revised ใน `g6Security.test.ts` — create-only delegation + แบน mutation ทุกตัว |
| Webhook retry กันเพิ่มซ้ำ | ✅ มี | `channel_event_duplicate` + `eventSeen` + `p_client_submit_key` double-submit |

## 7. งานเหลือก่อน Final E2E (ลำดับถัดไป)
1. audit ต่อ: mixed-cart payment condition · login→landing routing/theater context (Directive §3.1/§4/§9)
2. ~~ตัดสินใจเรื่อง FB order auto/human-in-loop~~ → **Owner ตัดสินแล้ว (§3): AI สร้างออเดอร์ใหม่ได้ผ่าน workflow อนุญาต** — ทำแล้วรอบนี้
3. E2E checklist รอบเปิดร้าน (ดู §8 ล่าง) — ต้องทดสอบบน production กับ Owner

---

# อัปเดต 17 ต.ค. 2026 รอบดึก — PRE-TEST CLOSURE (Directive §3/§4/§5)

## 8. สิ่งที่ทำ (รอบนี้)

| Directive | สิ่งที่พบ (โค้ดจริง) | แก้ไขแล้ว |
|---|---|---|
| §3 AI สร้างออเดอร์ใหม่ได้ / ห้ามแก้ของเดิม | worker เดิมตอบอย่างเดียว G6-09 แบน `create_order` ทั้งหมด | `_shared/socialOrderIntake.ts`: extraction→catalog match→identity (046)→round (active+ว่าง)→**create เดียว** `rpc/create_order_with_items` + `p_external_ref_id`=event id · G6-09 revised (แบน mutation ทุกตัว + worker ห้ามเรียก RPC ตรง) |
| §4 รับรายการจาก Comments/Messenger เข้า workflow กลาง | — | Messenger (ส่วนตัว): intake เมื่อยืนยันชัดเจน · Comment สาธารณะ: ไม่สร้าง/ไม่เปิดเผย ชวนเข้า Inbox (§5.1) · ไม่ชัดเจน=ถามก่อน (semantic `confirmed` บังคับ) |
| §4 Webhook retry ห้ามสร้างซ้ำ | RPC 048 มี dedupe ในตัว | `p_external_ref_id` = event id ทุก submit + test คุม (duplicate:true → เลขที่เดิม) |
| §3 ห้ามเคลมสำเร็จก่อนระบบยืนยัน | — | `buildIntakeLine` (ระบบเขียนจากผล RPC เท่านั้น) + draft ถูก banned-regex คุม + fallback เมื่อ draft พัง (ไม่เงียบ) |
| §5 Bite จำบริบทจริง | context pipe (openChat) เป็น dormant — ไม่มี component เรียก | `composeRealContext()` ใน TalkToBite: Cart รายการ/จำนวนจาก store + route + ช่องทาง ส่งทุกข้อความ |

**ไฟล์ที่เปลี่ยน:** `supabase/functions/_shared/socialOrderIntake.ts` (ใหม่) ·
`supabase/functions/social-ai-worker/index.ts` · `src/__tests__/g6Security.test.ts` ·
`src/__tests__/socialOrderIntake.test.ts` (ใหม่ 20 ข้อ) · `src/components/ai/TalkToBite.tsx` ·
`AI_WORK_STATE.md`

## 9. Final E2E Checklist (Owner เริ่มทดสอบได้ทันที — ยังไม่ Production Verified)
1. **เว็บ:** login → หน้าหลัก (ไม่วน Landing) → เลือกเมนู → Cart → checkout → เลือกวัน/รอบ (รอบปิด/เต็มเลือกไม่ได้) → ชำระเงิน → order แสดงใน /admin/orders
2. **Same-day/Pre-order:** สั่งตามเวลาจริง · รอบหมดเวลา/เต็ม = ถูกบล็อก · Mixed cart = split orders + cash_on_delivery เท่านั้น
3. **Pre-order 2 จุด:** ปุ่มบน HomePage (ก่อน Popular) + Footer → เข้า /menu?category=<หมวดพรีออเดอร์> ชุดเดียวกัน
4. **แอดมิน:** Menu Schedule — dropdown รอบ = รอบจริงของวัน, สวิตช์เปิด/ปิดทุกรอบส่งมีผลทันที, สวิตช์สินค้า + Save/Publish
5. **Bite (เว็บ):** ถามเรื่อง Cart ที่เพิ่งเพิ่ม → ตอบได้ตรงรายการ/จำนวน · แชตไม่ค้าง/ไม่หายเมื่อ AI ล่ม
6. **Messenger (เพจจริง):** "สั่งผัดไทย 2 จาน" → ถามยืนยันถ้าไม่ครบ → ยืนยัน → ได้เลขที่ออเดอร์จริง + ลิงก์ /payment/... → เลขที่เดิมเมื่อส่งซ้ำ (idempotent) · ข้อความกำกวม → ถาม ไม่สั่งแทน
7. **FB Comment:** คอมเมนต์สั่งของ → ไม่มีรายละเอียดรายการ/ราคาในคอมเมนต์สาธารณะ + ชวนทัก Inbox
8. **AI Failure:** ปิด key/จำลอง AI ล่ม → ลูกค้ายังสั่งผ่านหน้าร้านได้ปกติ · intake ที่สำเร็จแล้ว reply ไม่เงียบ (fallback)
9. **Regression:** ออเดอร์เดิมแก้ไข/ยกเลิกได้เฉพาะฝั่งแอดมิน/ลูกค้าตาม workflow (AI แตะไม่ได้ — ตรวจจาก audit_logs)


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

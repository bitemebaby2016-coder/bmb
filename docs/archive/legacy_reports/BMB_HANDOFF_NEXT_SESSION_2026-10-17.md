# BMB HANDOFF — Next Session (2026-10-17 08:30)

> ต่อจาก `BMB_HANDOFF_NEXT_SESSION_2026-10-16.md` + `BMB_ACCEPTANCE_RUNBOOK_2026-10-16.md`
> Repo: `D:\A PROJECT\Bite Me Baby` · branch `main` · HEAD = **`a1736c8`** (pushed, worktree clean, stash เดิมอยู่)
> Production: `biteme-baby.com` (auto-deploy) · `bitemebaby-5f7.pages.dev` = STALE ห้ามใช้ QA

---

## 1. สถานะรวมเช้าวันที่ 17 ต.ค.

**ทำเสร็จทั้งหมด (verified) — ไม่มีค้าง:**

| ชิ้น | สถานะ | หลักฐาน |
|---|---|---|
| P0 idempotency (create_order_with_items_i + submit key) | ✅ ใช้จริง | order `BMB-20261016-497`, 1042 tests, Docker ALL_GREEN |
| QR PromptPay (asset→render→TXN→admin confirm) | ✅ PASS | `backups/qr-*` |
| Dead queue 13/13 ปิด (closed_expired_no_retry) | ✅ | `b9d9fcd`, audit 13 แถว |
| W3C product | ✅ archived (FK RESTRICT ×12 ห้าม hard delete) | audit |
| SMS/OTP ส่งจริง 081 784 7992 | ✅ 2 ข้อความ | `c52e7b8` |
| FB post ภาพเมนูจริง + public | ✅ LIVE | post `862940416913026_122144132217204867` (app = LIVE mode) |
| social-publish-worker imageUrls หลายภาพ | ✅ | `35ac7e0` |
| AI ตอบคอมเมนต์ (bug 3 ตัว) | ✅ | `3ea92ef` |
| **FULL-AUTO AI (ไม่ต้องอนุมัติ)** | ✅ ใช้จริงแล้ว | auto-reply ใต้คอมเมนต์จริง `..._940089778887913` (23:50 16 ต.ค.) |
| **Messenger chat AI (น้อง Bite)** | ✅ code+deploy | ⏳ **ยังไม่ได้เทสต์กับแชทจริง** (ต้องทักแชทเพจ) |
| Model chains (ERNIE ยกเลิก) | ✅ | ตาราง §4 |
| Prompt ใหม่ (Marketing AI + น้อง Bite) | ✅ | ผูก THEME_OF_DAY ↔ Theater Daily Copy แล้ว |
| Menu 17 ต.ค. (2 PRE_ORDER ฿79) + 3 รอบส่ง + backup แรก | ✅ | `backups/local-backup-2026-10-16.json` |

**ยังไม่เสร็จ = เทสต์รับจริง (acceptance) เท่านั้น:**
- ❌ **ออเดอร์ยังไม่เข้าสักใบ** — หน้าต่าง pre-order "ส่งวันที่ 17" **ปิดแล้ว** (เลยเที่ยงคืน 16→17 โดยไม่มีออเดอร์)
- ⏳ ปรับแผน: **วันนี้ (17 ต.ค.) สั่ง SAME-DAY ทันที** ตามรอบ 10:30 / 16:00 / 19:00 (≤300฿) + pre-order คืนนี้ก่อนเที่ยงคืนเพื่อส่ง **18 ต.ค.**
- ⏳ หลังออเดอร์เข้า: admin confirm → paid → kitchen → dispatch → เช็ค `📍 dropoff_detail` + tracking ครบ (runbook §D/E)

---

## 2. สิ่งที่แชทหน้าต้องทำ (ลำดับ)

1. **เปิดเทสต์รับจริงกับเพื่อน 085 810 1984** (ลิงก์โพสใน FB) — สั่ง same-day วันนี้ตามรอบที่ยังไม่ปิด
2. ประกบทุกขั้น: จ่าย (QR PromptPay 3 ทาง / Omise) → ยืนยันออเดอร์ใน Admin → เข้าครัว → ส่ง → ตรวจจุดส่ง + tracking
3. **เทสต์ Messenger จริง**: ให้คนทักแชทเพจ "สวัสดีครับ มีอะไรน่ากินบ้าง" → น้อง Bite ต้องตอบเอง ≤ ~1 นาที + ชวน `/shop`
4. โพส AI อัตโนมัติ: `social-post-worker` รันได้ (draft → content_approvals `pending`) — โพสยังต้องกด publish จาก Admin (G7)
5. เขียนรายงานปิดรับ + รอ Owner สั่ง go-live ขายจริง (hard stop เดิม)

## 3. FULL-AUTO AI — สิ่งที่เปิดไว้ (Owner directive 16 ต.ค. 23:50)

- คอมเมนต์/ข้อความเข้า → `channel-webhook` ยิง `social-ai-worker` เอง (EdgeRuntime.waitUntil) → classify+draft → **ส่งออก Meta ทันที** (comment reply = `POST /{comment_id}/comments`, Messenger = `POST /{page_id}/messages`) → `reply_status='sent'`/`'failed'` + `reply_provider_id`
- **กันจุดเดียว:** `safety_flags ≠ none` → ไม่ยิงเอง (ค้าง `pending_review`) + banned-content regex (ราคา/จ่ายเงิน/สั่งซื้อ/publish) fail-closed เหมือนเดิม
- `META_PAGE_ACCESS_TOKEN` + `AUTOMATION_TOKEN` มีครบใน EF secrets แล้ว
- code: `social-ai-worker/index.ts` (sendReply), `channel-webhook/index.ts` (triggerAi) · tests: g6 G6-18v2/19v2, g7 cross-check

## 4. Model chains (OWNER 2026-10-16 — ERNIE ยกเลิก ไม่มีบน OpenRouter)

| Task กลุ่ม | หลัก | รอง |
|---|---|---|
| FB automation: `social_comment_classify`, `social_reply_draft`, `social_post_draft`, `content_automation` | `deepseek/deepseek-v4-flash` | `qwen/qwen3.7-flash` |
| Web น้อง Bite: `chat`, `streaming`, `recommendation`, `tool_support`, `support`, `admin_ai` | `qwen/qwen3.7-flash` | `xiaomi/mimo-v2.6-flash` |
| `voice_stt` | gemini-2.5-flash-lite | whisper-1 (เดิม) |

ศูนย์กลาง: `_shared/aiPolicy.ts` (MODEL_FB_*/MODEL_A_*) · mirror `src/lib/aiModels.ts` · aiVoice fallback = `xiaomi/mimo-v2.6-flash` · maxTokens 1500–2500 (โมเดล reasoning — ห้ามลด)

## 5. Prompt ที่ติดตั้งแล้ว

- **Marketing AI** (post worker POST_DRAFT_SYSTEM + social-ai DRAFT_SYSTEM): โทนคนจันทบุรี, ห้าม Hard-code ราคา/ส่วนลด/เวลาส่ง/เคลมขายดี, ทุกชิ้นชวน Inbox/น้อง Bite ที่ `biteme-baby.com/shop` · ธีมรายวันจาก `business_settings.theater_daily_copy` (THEME_OF_DAY, fail-open)
- **น้อง Bite** (BITE_MESSENGER_SYSTEM + `src/lib/aiService.ts`): ต้อนรับเชื่อมโพสโปรโมชัน, เชียร์จากแคตตาล็อกจริงเท่านั้น, order intent → ตะกร้า, สรุปรอบ Same-day/Pre-order → `/checkout` (PromptPay, Omise), ทุกคำตอบชวน `/shop`

## 6. เทสต์ / Deploy ล่าสุด

- tests: **158/158** (aiRouting 32, g6 27, g7 63, api 36) + full suite เดิม ~1042 (2 ตัว flaky timeout จากเครื่องโหลด — รันเดี่ยวผ่านทุกครั้ง)
- lint: 0 errors · EF deploy ล่าสุด: `social-ai-worker`, `channel-webhook`, `social-post-worker`, `ai-proxy` (คืน 16 ต.ค. ~23:50)
- commits คืนนี้: `3ea92ef` (bug AI 3 ตัว) → `a1736c8` (full-auto + Messenger + โมเดล + prompt)

## 7. กติกา/คำสั่งที่ผูกมัด (ห้ามละเมิด)

- **HARD STOP:** ห้ามขายจริง/ตัดเงินจริง/ส่งจริง นอกขอบเขตเทสต์ จนกว่า Owner สั่ง go
- เทสต์รับ = เพื่อน 085 810 1984 เท่านั้น, งบ ≤300฿, คืนเงินเทสต์เสมอ
- Backups = local-storage รายวัน (`backups/local-backup-*.json`) แทน PITR — อย่าแตะ/รีสโตร์โดยไม่บอก
- W3C = archived ห้ามลบ (FK) · scheduler ห้ามมี job social-ai-worker (webhook trigger แล้ว)
- โพสยังต้องมีคนกด publish (G7) — **ยกเว้นคอมเมนต์/แชท = ออโต้แล้ว**

## 8. หมายเหตุเครื่องมือ (เตือนตัวเอง)

- BMB = `D:\A PROJECT\Bite Me Baby` — ห้ามแตะ `chat\bmb\` (เก่า) · `search_codebase` ใช้กับ BMB ไม่ได้ ใช้ `Select-String`/`read_files` path เต็ม
- `node -e` ซับซ้อนพังใน PowerShell → เขียน `e2e/tmp_*.cjs` รันแล้วลบ · evidence ลง `backups/*`
- คำสั่ง shell อย่ารันคู่ขนาน (เคยชนกันตอน push) · editor payload ≤~6000 chars
- เวลาเครื่อง = ICT (UTC+7) · pre_order_lead_days=1 = สั่งก่อนเที่ยงคืนของวันก่อนวันส่ง
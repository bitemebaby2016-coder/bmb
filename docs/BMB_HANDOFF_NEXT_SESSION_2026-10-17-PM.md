# HANDOFF → แชทถัดไป (17 ต.ค. 2026 รอบบ่าย · ปิดเซสชั่นนี้)

> เอกสารนี้คือแหล่งความจริงล่าสุดสำหรับเริ่มงานทันที — สถานะอัปเดตหลัง push `0826d92`
> (เอกสารเก่า `docs/BMB_HANDOFF_NEXT_SESSION_2026-10-17.md` รอบเช้า = ถูกเอกสารนี้แทนที่แล้ว)

---

## 0. กติกาเหล็ก (อ่านก่อนทำอะไรทุกครั้ง)

1. **โปรเจคอยู่ที่ `D:\A PROJECT\Bite Me Baby` เท่านั้น** — `chat\bmb\` ใน workspace แชทคือของเก่าเน่า ห้ามแตะ/ห้ามอ้างอิง
2. **ห้ามเชื่อเอกสาร — probe ของจริงก่อนเสมอ** (สั่ง SQL/อ่านโค้ด/รันของจริง แล้วค่อยสรุป)
3. **PowerShell**: ห้าม pattern ภาษาไทยในคำสั่ง inline (PSReadLine พังทุกที) → ใช้สคริปต์ Node ไฟล์ temp ใน `e2e\` เขียนลงไฟล์ แล้ว `read_files` อ่าน แล้วลบทิ้ง · ห้าม `node -e` ยาว ๆ · output ต้อง redirect ลงไฟล์
4. **Gates ก่อน commit เสมอ**: `npx tsc --noEmit` · `npm run lint` · `npm test` · `npm run build` — ต้องเขียวทั้ง 4 ก่อน push
5. **HARD STOP**: ห้ามขายจริง/เงินจริง/ออเดอร์จริงนอก scope เทสต์ (เพื่อน 085 810 1984, ≤300฿ เท่านั้น)
6. `.clinerules` มีการแก้ค้างในเครื่อง (ไม่ใช่งาน AI) — ห้าม commit
7. Commit message สั้น คม + push ทันทีที่เขียว ห้ามหมกงานค้าง

---

## 1. งานวันนี้ที่เสร็จแล้ว (push แล้ว 3 commits)

| Commit | เนื้อหา |
|---|---|
| `b8930e1` | ซ่อมข้อมูลจริง (ลบ `menu_sections` 4 แถวซ้ำซ้อน + ปลดล็อกเครื่องดื่ม) + `docs/BMB_STATUS_VERIFIED_2026-10-17.md` + evidence `backups/data-repair-menu-unify-2026-10-17.json` |
| `0491a7d` | **ระบบ "หัวข้อเมนู" เดียว** — แอดมินมีตัวจัดการเดียว (เพิ่ม/แก้/เรียง/ซ่อน/ลบถาวร/ย้ายเมนู) ไม่มี "เพิ่มหมวดหมู่"/"+ Section" คู่กัน · /shop + /menu ใช้ `buildHeadingGroups` ตัวเดียวกัน (ครบทุกเมนู ไม่มีตัวซ้อน ไม่มีเมนูหายจากชั้นซ่อน) · ตัดแถวพรีออเดอร์ auto ที่ทำเมนูซ้ำบนหน้าแรก · regression tests ปิดบั๊กจริง |
| `0826d92` | **ข้อมูลร้านจริง** (Footer/Contact/About/FAQ: เมืองจันทบุรี · 094 2649269 · admin@biteme-baby.com · Open Daily 7.00 am. - 20.00 pm. · FB+Messenger ลิงก์จริง ตัดโซเชียลปลอม) · **ลิงก์เมนูในฟุตเตอร์ดึงจากหมวดจริงใน DB แบบ dynamic** · `/menu?category=` ใช้งานได้จริง (รับ slug/id) · ซ่อมลิงก์ `/track` ตาย → หน้ากรอกเลขออเดอร์ · `e2e/metaSubscribeMessages.cjs` |

**Gates รอบล่าสุด**: tsc 0 · lint 0 · **tests 100 ไฟล์ / 1,047 ผ่าน** · build ผ่าน

---

## 2. ความจริงที่ probe แล้ว (อย่าเชื่ออย่างอื่น)

- **หมวดเมนู 6 ตัว** (`product_categories`): `cat-1` ส่งวันนี้/Same Day (slug `dish`) · `cat-2` จองล่วงหน้า/พรีออเดอร์ (slug `rice`, **archived**) · `cat-4` เครื่องดื่ม (slug `drink`) · `cat-3` เมนูสุขภาพ (slug `curry`) · `cat-5` ของทานเล่น/ผลไม้ (slug `dessert`) · `cat-1790830853978` สินค้าสำเร็จรูป — slug ยังเป็น legacy ตั้งใหม่ได้โดยแอดมิน
- **สินค้า 20** = ขายได้ 19 + archived 1 (W3C) + coming-soon ฿1 สองตัว
- **ออเดอร์ 208 = ทดสอบทั้งหมด ยังไม่มีออเดอร์ลูกค้าจริงสักใบ**
- **`menu_sections` = 0 แถว** (ลบแล้ว) — โค้ดรุ่นใหม่ละเลย `menu_section_id` เก่าถาวร (มี regression test คุม)
- **AI pipeline จริง**: `channel-webhook` (Meta events) → ตาราง `social_events` → `social-ai-worker` (เรียก OpenRouter ด้วย env `OPENROUTER_API_KEY`) → ตอบ comment/ส่งข้อความผ่าน Graph API — ไม่มี queue/scheduler (G8)
- **Messenger**: ไม่มี event แบบ `message` เข้าเลยตั้งแต่ 6 ต.ค. → สาเหตุคือ field `messages` ไม่ได้ subscribe → **subscribe สำเร็จแล้ววันนี้** (ดูข้อ 3)

## 3. Messenger webhook — แก้แล้ว รอทดสอบ

- `node e2e/metaSubscribeMessages.cjs` → **SUBSCRIBE 200 {"success":true}**
- CHECK ยืนยัน app "Bite Me Baby" (`1737887467512190`) มี `subscribed_fields: feed, messages, messaging_postbacks, messaging_optins, messaging_referrals`
- ⬜ **ขั้นถัดไป**: Owner ทัก Messenger เข้าเพจ **"BITE ME BABY - Main Page TH"** (page_id `862940416913026`) ใหม่ → แล้ว probe `social_events` ต้องมีแถว `platform=MESSENGER event_type=message` มี content → worker จะตอบ AI อัตโนมัติ
- ⚠️ ถ้าทักแล้วยังเงียบ: เช็คว่าทักเข้า "เพจ" จริงไหม (ไม่ใช่โปรไฟล์ส่วนตัว), เช็ค `OPENROUTER_API_KEY` ของ functions ยังใช้ได้ไหม, ดู `social_events.last_error/attempts`

---

## 4. งานที่ Owner สั่ง (ทำต่อในแชทใหม่ — เรียงลำดับ)

### 4.1 สลับ OpenRouter key ใหม่ `BMB_openrouter_api_key`
- AI ของเว็บ **ตัวสร้างคอนเทนต์ + Bite แชต/Avatar** ให้ใช้ key ใหม่ชื่อ **`BMB_openrouter_api_key`** ซึ่ง Owner ใส่ไว้ใน `.env.local` แล้ว
- คีย์เก่า (`OPENROUTER_API_KEY` เดิม) ใกล้เต็ม $155/$160 → คีย์ใหม่คือตัวแทนที่
- งานจริง: (ก) หาทุกจุดที่ใช้ `OPENROUTER_API_KEY` (`social-ai-worker`, `ai-proxy`, `aiService.ts`, `automation-worker`, อื่น ๆ อย่าเดา ให้ grep) (ข) เปลี่ยนไปใช้ค่าจาก `BMB_openrouter_api_key` — ฝั่ง functions ต้อง `supabase secrets set` ค่า key ใหม่ (หรือตั้งชื่อ secret ใหม่แล้วแก้โค้ด) (ค) **ห้าม key หลุดเข้า client bundle** (ห้าม `VITE_`) (ง) ทดสอบ AI จริงทั้งแชตหน้าเว็บ + คอมเมนต์ + Messenger หลังสลับ

### 4.2 ลิงก์ LINE ⚠️ ข้อมูลยังไม่ครบ
- Owner พิมพ์ค้างไว้ว่า "ลิ้งค์ไอดี ไลน์ คือ ___" — **ยังไม่ได้ค่าลิงก์/ID** → **ถามในแชทใหม่ก่อน** แล้วค่อยเพิ่มปุ่ม LINE ในฟุตเตอร์/หน้าติดต่อ/FAQ (ตอนนี้ตัด LINE ปลอมออกแล้ว เหลือ FB + Messenger)

### 4.3 ฟุตเตอร์ให้ครบสมบูรณ์
- ภาษา: เก็บ typo ไทยที่เหลือทั้งเว็บ (ที่พบแล้ว: `faqContent.ts` "คุสามารถ", "แบบฟอรม", "อย่มุมขวาล่าง", "•social media" — ไล่ต่อทั้งไฟล์/หน้าอื่น)
- การเชื่อมต่อข้อมูล: ลิงก์/ข้อมูลทุกตัวต้องชี้ของจริง (ตรวจซ้ำอีกรอบ end-to-end)
- บทความ/เนื้อหาที่เกี่ยวข้อง: blog/SEO/ข้อความหน้าต่าง ๆ ให้ตรงกับเว็บจริง (footer ตอนนี้มี: เมนูอาหาร(จาก DB) · เกี่ยวกับเรา · บริการ · ติดต่อเรา(ข้อมูลจริง) + ปุ่ม FB/Messenger)

### 4.4 แอดมินต้องแก้ copy เองได้โดยไม่แตะ logic
- รวม copy ที่แก้บ่อย (ข้อความหน้า/FAQ/ข้อมูลร้าน/ป้าย) ไว้ในที่เก็บเดียว มีคำอธิบายวิธีแก้+deploy เองชัดเจน
- สำรวจว่าตอนนี้มีกี่ช่องทาง: `business_settings`/`site_copy` (แอดมินแก้ผ่านหน้าแอดมินได้แล้ว — `HomePopularManager`/site copy) vs copy hardcode ในไฟล์ → จัดระเบียบให้ชัดว่าอะไรแก้ที่ไหน + เขียนคู่มือสั้นให้ Owner (แก้ไฟล์ → commit/push → deploy ตัวเอง ไม่กระทบ logic)
- ข้อมูลจริงของร้านตอนนี้รวมที่ `SHOP_CONTACT` ใน `src/components/layout/Footer.tsx` (footer/contact/about ใช้ร่วมกัน)

### 4.5 เทรซ end-to-end ทุกเส้นโดยสัตย์จริง ห้ามมี hardcode
- ไล่ทุกทางเดิน: ดูเมนู → ตะกร้า → checkout (member/guest) → จ่ายเงิน (Omise/Stripe/เก็บเงินสด) → ออเดอร์ → ครัว → ส่ง → tracking → หลังการขาย/รีวิว/แต้ม
- + ทาง AI: แชตหน้าเว็บ / คอมเมนต์ FB / Messenger / content automation
- ทุกจุดต้องอ่านข้อมูลจาก DB/server จริง ห้ามค่า hardcode หลอกตา/ทางลัดที่ข้าม RPC canonical → เขียนผลเป็น checklist พร้อมหลักฐาน (probe/ทดสอบ)

### 4.6 ทดสอบร่วมกับ Owner จนเปิดร้านได้
- เทสต์รับจริง: same-day 1 ใบ + pre-order 1 ใบ (เพื่อน 085 810 1984, ≤300฿) ผ่านสายจริง: จ่าย → Admin confirm → ครัว → ส่ง → เช็ค `📍dropoff_detail` + tracking (runbook `docs/BMB_ACCEPTANCE_RUNBOOK_2026-10-16.md` §C–E)
- ทดสอบ Messenger AI ทักใหม่หลัง subscribe (ข้อ 3) + AI แชตหน้าเว็บหลังสลับคีย์ (ข้อ 4.1)
- หมายเหตุ: เอกสารเก่าบอกว่าหน้าแรกมีระบบเวลาสั่งล่วงหน้า — โค้ดตอนนี้ pre-order อยู่ในหัวข้อเมนูของตัวเอง + ปุ่ม 📅 ต่อการ์ด + แท็บ /menu (แถวพรีออเดอร์ auto ถูกตัดออกเพื่อไม่ให้เมนูซ้ำ — ถ้า Owner อยากได้แถวแยก ให้สร้างหัวข้อ "พรีออเดอร์" แล้วจัดเมนูเข้าไปในหน้าแอดมิน)

---

## 5. จุดเสี่ยง/ข้อห้าม (contract tests ที่ต้องรักษา)

- tests ที่ผูก source code (ห้ามไปลบ/เปลี่ยนจนพัง): `adminCategoryLifecycle` (บล็อก `handleMoveProducts` ห้ามมี `deleteCategory`/`deleteProduct`), `adminCustomerVisibility` (guard `if (!created)`/`if (!updated)` ก่อน toast), `canonicalFallbackContract` (ทุกบรรทัดมี `is_preorder` ต้องใช้ `??`), `menuCartResultGuard` (บล็อก `handleSameDay`/`handlePreOrder` ใน MenuPage), `cartEntryPoints` (strings `visibilitychange`), `homePreOrderModeGuard`, `homeSectionModeCta`, `categorySections`, `catalogControl`, `appRoutes`, `adminShell`, `brandNameGuard`
- ตาราง `menu_sections` ยังอยู่ใน DB (ว่าง) — ระบบใหม่ไม่ใช้แล้ว ห้ามกลับไปพึ่งพา
- `products` มี FK จาก `order_items` ×12 → "ลบถาวร" สินค้าที่มีประวัติจะโดน DB ปฏิเสธ (UI แจ้งให้ใช้ "จัดเก็บ" แทน — ออกแบบไว้แล้ว)
- คีย์เก่า OpenRouter เหลือ ~$5 → ถ้ายังมีตัวไหนใช้คีย์เก่าค้าง จะหยุดกลางอากาศ

## 6. Path สำคัญ

| สิ่งที่ | ที่อยู่ |
|---|---|
| ระบบหัวข้อเมนู | `src/lib/catalogStructure.ts` (`buildHeadingGroups`/`headingChips`) → ใช้โดย `HomePage`/`MenuPage`/`CategorySections` |
| ข้อมูลร้านจริง | `SHOP_CONTACT` ใน `src/components/layout/Footer.tsx` |
| ฟุตเตอร์ (ลิงก์เมนูจาก DB) | `src/components/layout/Footer.tsx` |
| หน้าแอดมินเมนู | `src/pages/admin/AdminProducts.tsx` |
| AI pipeline | `supabase/functions/channel-webhook` → `social_events` → `supabase/functions/social-ai-worker` |
| สมัคร webhook Meta | `e2e/metaSubscribeMessages.cjs` (ใช้ `META_PAGE_ACCESS_TOKEN` + `META_PAGE_ID` จาก `.env.local`) |
| Probe DB (read-only) | `e2e/adminDbDiag.cjs` (Management API + `SUPABASE_ACCESS_TOKEN`) |
| สถานะทั้งโปรเจค | `docs/BMB_STATUS_VERIFIED_2026-10-17.md` |
| Runbook เทสต์ | `docs/BMB_ACCEPTANCE_RUNBOOK_2026-10-16.md` |

## 7. งานค้างตกทอด (อย่าลืม)
- งบ OpenRouter: เปลี่ยนเป็นคีย์ใหม่ (ข้อ 4.1) แล้วปัญหานี้ปิด
- เทสต์รับจริง 2 ใบ (ข้อ 4.6)
- ⬜ รอ Owner ให้ "go" สร้างโพสทดสอบเต็มระบบ (โพสรูปเมนูจริง + ประกบทุกขั้น) — ยังไม่เริ่มจนกว่า Owner จะสั่ง
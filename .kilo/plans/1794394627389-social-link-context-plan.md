# แผน R92 — ลิงก์โซเชียลใช้ได้จริง + บริบทเดียวกัน 3 ช่องทาง (โพส / ข้อความ Messenger / เว็บ)

Owner 2026-11-11: "เอไอตอบโพสกับแมสเซนเจอร์พูดกันคนละบริบท · ตอบโพส/ข้อความ/ในเว็บต้องบริบทจริงเดียวกันรับงานต่อเนื่องกันได้ · กดลิงก์จากโพสไปใช้ไม่ได้แล้ว"

## วินิจฉัยจากหลักฐาน (3 ภาพ owner + โค้ดปัจจุบัน) — ซื่อสัตย์แยกตามอาการ

| อาการ | ต้นตอที่พิสูจน์แล้ว | แคชเฟสเกี่ยวไหม |
|---|---|---|
| กดลิงก์ในโพส → หน้าพัง `ERR_UNKNOWN_URL_SCHEME` (ภาพ 3: error page โชว์ URL `intent://biteme-baby.com/shop?fbcid=...`) | ปุ่ม `intent://` ใน InAppBrowserBanner — FB Android WebView ไม่ dispatch intent = บทเรียน R76/R79/R81-B2 ที่เคยลบปุ่มนี้ไปแล้ว แต่กลับมาใส่ใหม่ผิดพลาด | **ไม่เกี่ยว** — ข้อจำกัด WebView |
| คำตอบ AI ใน Messenger (ภาพ 1) และคอมเมนต์ (ภาพ 2) ไม่มีลิงก์ `?cart=` — มีแต่ `https://biteme-baby.com/shop` เปล่า | `social-ai-worker`: เมื่อ `matchOrderItems` มี unmatched → `footer: ''` → ลูกค้าได้ลิงก์ตายไม่มีตะกร้า (ดีไซน์เดิมตั้งใจ แต่ UX พัง) | **ไม่เกี่ยว** — server-side |
| ข้อความ AI สะกดเพี้ยน ("เมี่ยงจาได้", "ลากลุลต้อง", "ซองวันนี้") | ยังไม่ยืนยัน: ชื่อเมนูในแคตตาล็อกเพี้ยนเอง (AI คัดลอกตาม) vs โมเดล deepseek chain เขียนไทยเพี้ยน | **ไม่ใช่แคช** — ข้อความสร้างฝั่ง server (Edge Function → โมเดล → Graph API) เบราว์เซอร์ไม่เกี่ยว |
| เว็บในเฟสโหลด build เก่า/พฤติกรรมแปลก ๆ | เว็บเราเป็น PWA: `vite.config.ts` `injectRegister:'auto'` + `src/sw.ts` workbox precache + `NavigationRoute` เสิร์ฟ index.html จาก precache — ใน FB WebView การอัปเดต SW ไม่เสถียร → ลูกค้าอาจค้าง build เก่า | **ใช่ — นี่คือจุดที่แคชมีส่วนจริง** (หลักฐานเดิมในโค้ด: OWNER FIX 2026-10-26 "เห็น UI เก่าค้างถาวร") |

## การตัดสินใจ (resolved)

1. **เอา `intent://` ออกจากแบนเนอร์ถาวร** (R81-B2) — หลักฐานภาพ 3 ชัดเจน ห้ามกลับมาใส่อีก · ปุ่มหลักเดียว = คัดลอกลิงก์ + guide ต่อ platform (ทางเดียวที่พิสูจน์ว่าใช้ได้จริงคือเมนู ⋯ ของแอปเอง + วางลิงก์)
2. **ลิงก์ตะกร้าต้องติดทุก reply ที่จับคู่ได้บางส่วน** — matched บางส่วน → แนบลิงก์ของรายการที่จับคู่ได้ + ให้ AI ถามชื่อที่เหลือ (ไม่ใช่ซ่อนลิงก์ทั้งหมด)
3. **บริบทต่อเนื่องข้ามช่องทางผ่านพารามิเตอร์ `?s=` ในลิงก์** — ข้อความสรุป "เขียนโดยระบบ" (ช่องทาง+รอบ+ชื่อรายการจาก matched เท่านั้น) ไม่ใช่ข้อความเสรีของ AI (กัน prompt-injection/PII) · web ฝั่งเดียวอ่าน (Layout จับก่อน strip → socialHandoff → TalkToBite inject)
4. **ห้าม register SW ใน in-app browser (FB/IG/LINE)** + unregister/clear caches เดิมที่นั่น → ลูกค้าเฟสเห็น build ใหม่เสมอ (แก้คลาสบั๊ก "UI เก่าค้าง" ถาวร)
5. ขอบเขตนอก (บันทึกตรง ๆ): ทิศกลับ web→FB, การรวม identity login↔FB sender, การแก้ fuzzy-match ชื่อเมนู = งานรอบถัดไป

## งานเรียงลำดับ (implementation-ready)

### Step 0 — พิสูจน์ก่อนแก้ (read-only)
- ตรวจ `products` ในแอดมิน/DB: มีเมนู "เมี่ยง…" สะกดเพี้ยนจริงไหม (ภาพ 1-2 ทั้งคู่เพี้ยนคำเดียวกัน → น่าจะมาจากแคตตาล็อกหรือโมเดล)
- ดึง `social_events` ล่าสุดดู `reply_draft` จริง: ยืนยันว่า reply ไม่มี ?cart= เกิดจาก branch ไหน (matched=0 / unmatched>0)
- สรุปลง `e2e/_r92_step0.md` · ถ้าต้นตอ = โมเดล → แยก task ถัดไป (aiPolicy) ไม่แตะในรอบนี้

### Step 1 — Escape ที่ใช้ได้จริง: `src/components/InAppBrowserBanner.tsx`
- ลบ `intentUrl` + `<a href={intentUrl}>` + ตัวแปร `isAndroid` ที่ใช้ทำ intent ทั้งหมด
- ปุ่มหลักเดียว: **"📋 คัดลอกลิงก์ · เปิดใน Chrome / Safari"** (ตามสั่ง owner — ชื่อมี Chrome / Safari) → คัดลอก handoff URL (มี `?cart=` เสมอ) → เปิดแผง guide
- Guide ต่อ platform (`isMessengerUA` มีอยู่แล้ว): Android FB: `⋯ → เปิดในเบราว์เซอร์` · Messenger: `⋯ → เปิดในเบราว์เซอร์` / แชร์→Safari · iOS: แชร์ → Safari · สำรองทุกเครื่อง: วางลิงก์ใน Chrome/Safari
- คงไว้: `decodeCartParam`, lazy useState capture ก่อน Layout strip, handoff URL restore, dismiss, install-app, **hooks ทุกตัวก่อน early return** (กฎ R90-hotfix — regression test คุมอยู่)

### Step 2 — ลิงก์ตะกร้าติดทุก reply ที่มีของ: `supabase/functions/_shared/socialOrderIntake.ts` + `social-ai-worker/index.ts`
- pure helper ใหม่ใน shared: `cartFooterForMatch(m: { matched, unmatched })` →
  - matched ครบ → footer เดิม (buildCartSummaryFooter)
  - matched บางส่วน → footer = ลิงก์ตะกร้าของ "รายการที่จับคู่ได้เท่านั้น" + note บังคับ AI ถามยืนยันรายการที่เหลือ (ห้ามสั่งแทน)
  - matched=0 → footer='' (เดิม)
- worker เรียก helper ในทุก branch (comment/message/!confirmed) — footer เดียวกันทั้งสองช่องทาง
- Deploy: `supabase functions deploy social-ai-worker` + log `e2e/_r92_deploy.log` (เคยทำได้ 2026-11-10)

### Step 3 — บริบทแนบในลิงก์ `?s=`: server + web
- Server (`socialOrderIntake.ts`): `buildCartLink(items, site, note?)` → เติม `&s=<b64url(JSON {v:1, src:'facebook'|'messenger', t:'<สรุป ≤200 chars>'})>` · ข้อความ t = ระบบเขียนจากข้อมูลจริง (ช่องทาง + รอบ/โหมด + ชื่อรายการ matched) · `normalizeAiTextLinks` ไม่ตัด (`&`/`=` อยู่ใน char class แล้ว)
- Web: `Layout.tsx` อ่าน `s` ก่อน strip → `socialHandoff.ts` เพิ่ม field `summary` (cap 200 chars, ปฏิเสธถ้ามี http)
- `TalkToBite.tsx`: `buildSocialHandoffContext` ใช้ summary เป็นประโยคแรก "ต่อจากที่คุยกันใน Messenger: <summary>" (โครง inject มีอยู่แล้วจาก R91)

### Step 4 — กันแคชเก่าใน in-app browser: `src/main.tsx` (หรือจุด register SW)
- ตรวจจุด register จริง (plugin inject `registerSW.js` เอง — `injectRegister:'auto'`): เพิ่ม guard ก่อน register เมื่อ UA ตรง in-app (reuse `isInAppBrowser` logic) → ไม่ register + `navigator.serviceWorker.getRegistrations()` → unregister + `caches.keys()` → delete ทั้งหมด (เฉพาะ in-app เท่านั้น — PWA จริงบน Chrome/Safari คงอยู่)
- ถ้า plugin inject ไม่ง่ายต่อการ guard → เปลี่ยน `injectRegister: 'manual'` + เรียกเองใน main.tsx พร้อม guard (ตัดสินใจตอน implement ตาม build จริง)

### Step 5 — เทสต์ + gates + เอกสาร
- `r46LinkOut.test.ts`: แก้ contract แบนเนอร์ — **ห้ามมี `intent://`** (regression guard ใหม่), ปุ่ม copy หลักมี "Chrome / Safari", guide/MESSENGER คงเดิม, hooks-before-return + decodeCartParam คงเดิม
- `socialOrderIntake` เดิมมี web tests คุม pure — เพิ่มเคส `cartFooterForMatch` 3 branch + s-param round-trip + `socialHandoff` summary (รวมเคส reject ที่มี URL/ยาวเกิน)
- Gates 4/4 (tsc/lint/vitest/build) → deploy worker (log) → docs: `AI_WORK_STATE.md` + `docs/BMB_MASTER_STATUS.md`

## ความเสี่ยง & ทางสำรอง
- FB อาจ strip/แก้ `?s=` (fbcid ถูก "เติม" ไม่ใช่ "แทนที่" — ภาพ 3 ยืนยัน) → ถ้าหาย: ดีเกรดเป็นบริบทรายการจาก `?cart=` (มีอยู่แล้ว ไม่พัง)
- Deploy worker ล้ม → rollback commit + redeploy · gates กันฝั่ง web
- clipboard โดนบล็อก (iOS Messenger) → textarea fallback มีอยู่แล้ว + guide ชี้เมนู ⋯
- ลบ SW ใน in-app อาจกระทบ push ในเฟส → push ใน FB WebView ไม่เคยรองรับอยู่แล้ว (banner บอกตรง ๆ) — ยอมรับได้

## Live-test checklist (owner หลัง deploy)
1. โพส FB → กดลิงก์ → **หน้าไม่พัง** → คัดลอก/⋯ เปิด Chrome → ตะกร้าเติม
2. Messenger → กดลิงก์ → เหมือนข้อ 1 (มีลิงก์ ?cart= ติด reply เมื่อจับคู่ได้)
3. เปิด Bite AI บนเว็บ → ต้องพูดต่อจากที่คุยบน FB + รู้รายการที่สรุปไว้
4. ในเฟส UI ต้องเป็น build ใหม่เสมอ (ไม่มีอาการ UI ค้างเก่า)

## เปิดค้าง (ทำใน Step 0 — ไม่บล็อก)
- ต้นตอสะกดเพี้ยน: แคตตาล็อก vs โมเดล deepseek — ถ้าโมเดล เป็น task แยก (สลับ/เพิ่ม guard ใน aiPolicy ของ FB tasks)

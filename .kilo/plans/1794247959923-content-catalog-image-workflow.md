# แผนเชื่อมรูปเมนูกับหน้าสร้างเนื้อหาเดิม

สถานะ: PLANNED — ยังไม่แก้ source / ยังไม่ทดสอบ runtime
ฐานตรวจ: HEAD `0584667`, main ตรงกับ origin/main, worktree สะอาดขณะตรวจ
บริบท: อ่าน AI_ENTRYPOINT.md, UNIVERSAL_MASTER_AI_RULES.md, AI_WORK_STATE.md และสถานะ canonical BMB_MASTER_STATUS.md แล้ว; เอกสารเก่ามีสถานะเกินหลักฐาน ต้องยึดโค้ดและผลทดสอบจริง

## เป้าหมายและมติ Owner
- เพิ่มปุ่ม “เลือกรูปจากเมนู” ถัดจาก “เลือกไฟล์จากเครื่อง” ใน ContentTab เดิม
- Owner เลือกให้รองรับทั้งสองการกระทำอย่างชัดเจน: “ใช้เป็นรูปเนื้อหา” และ “ใช้เป็นต้นแบบ AI” ไม่ผูกสองอย่างอัตโนมัติ
- ใช้กับโพสต์ โปรโมชั่น แบนเนอร์ และประกาศ เชื่อมตั้งแต่เลือกภาพ → preview → บันทึก → อนุมัติ → ปลายทางเดิม
- รูปที่ AI เจนต้องกด “ใช้” เองก่อนแทนภาพเนื้อหา; ไม่เขียนทับข้อมูล/ภาพสินค้า
- ไม่สร้างหน้า Studio คลังภาพ API ตาราง หรือระบบเผยแพร่คู่ขนาน; ใช้ URL ภาพสินค้าจริงและระบบเดิม ไม่มี migration หรือ dependency ใหม่โดยปริยาย

## หลักฐานและขอบเขตที่ต้องซ่อมร่วมกัน
1. `ContentTab.tsx:227–240`: reference AI ใช้ postImages เท่านั้น ไม่อ่านภาพโปรโมชั่น/แบนเนอร์
2. `ContentTab.tsx:287–326`: upload/เลือกภาพ AI เปลี่ยนเฉพาะ postImages และ “เอารูปออก” ลบไฟล์ storage จริง เสี่ยงลบภาพสินค้าเมื่อใช้ URL ร่วมกัน
3. `ContentTab.tsx:384–389`: submit อาจเลือกภาพ AI แทนภาพอื่นโดยอัตโนมัติ ต้องเคารพภาพที่ผู้ใช้เลือกจริง
4. `ContentTab.tsx:424,452`: submit approval โปรโมชั่น/แบนเนอร์ไม่ส่ง image URL และ mascot ทั้งที่ API รองรับ
5. `PlannerTab.tsx:54–61`: เลือกเมนูแล้วเป็น toast เท่านั้น; parent `AdminMarketingPromotions.tsx:107–125` ไม่มี handoff draft/ภาพ
6. ใช้ `getProducts()` ใน `bmbAdminApi_products.ts:57–76` ตาม tenant/brand ปัจจุบัน; มี picker behavior เดิมใน `AdminMarketing.tsx:636–658` และ modal pattern ใน `AdminMediaPortfolio.tsx:403–425` นำแนวทางมาใช้ในหน้า active ไม่คืนหน้าเก่า
7. ตรวจ dependency คิวอนุมัติจริง: `contentApproval.ts` เลือก reviewer_id แต่ migration ใช้ reviewed_by; การ review ต้องเชื่อม status marketing_posts กับ SocialTab/auto-schedule ไม่ใช่เปลี่ยนเฉพาะคิว
8. การ์ดประกาศใน FloatingAdBanners กรอง URL เมนูออก ขณะที่ feed รับ image_urls; ต้องตรวจปลายทางของรูปที่ผู้ใช้เลือก ไม่แอบเปลี่ยนเป็นรูป fallback คนละภาพ

## งาน Atomic ตามลำดับ
### 1. ยืนยันขอบเขตจริงก่อนแก้
- ตรวจ HEAD, diff, stash และงานผู้ใช้อีกครั้ง; ใช้ Task ID งานสร้างเนื้อหาเดิมใน ledger ถ้ามี ไม่เปิดงานซ้ำ
- ตรวจ schema/RPC/RLS เฉพาะ approval และ marketing_posts แบบ read-only ก่อนแก้ชื่อ field/status; ไม่ถือว่า migration file คือสถานะ production
- วาด mapping สั้น ๆ ของรูปและสถานะสำหรับ content ทั้ง 4 ชนิด และ consumer ที่มีจริง; ถ้า standalone banner ไม่มี consumer ห้ามรายงานว่าเชื่อมแล้ว ต้องซ่อมผ่านเส้นทาง approval/banner เดิมใน scope นี้

### 2. ทำ draft และ selection ให้เป็นแหล่งเดียว
- ใน ContentTab เดิมทำ handler กลางรับ image URL/source/เจตนาการใช้; upload, AI album และ catalog ใช้ handler เดียวกัน
- แยก AI reference ออกจาก final creative แสดง thumbnail/ชื่อเมนูและปุ่มเอาออกแยกกัน
- “ใช้เป็นรูปเนื้อหา”: post/announcement แนบโดยไม่ซ้ำตามจำนวนที่ระบบเดิมรองรับ; promotion/banner กำหนด banner_image พร้อม preview; เปลี่ยนรูปเดี่ยวต้องไม่ลบไฟล์เดิม
- ส่ง final selection จริงตอนบันทึก ไม่ให้ภาพ AI ที่ค้างอยู่แอบชนะภาพที่ผู้ใช้เพิ่งเลือก
- ใช้ draft state ที่ parent เดิมเป็นเจ้าของหรือคง instance ContentTab เดิม เพื่อสลับ Planner/content แล้วไม่ทำร่างหาย รวมกรณี parent reload; ไม่เพิ่มระบบ autosave ใหม่

### 3. เพิ่มปุ่มเลือกเมนูและเชื่อม Planner
- ใช้ API catalog ตาม tenant/brand และ modal pattern เดิม มีค้นหาชื่อ thumbnail และสองปุ่ม “ใช้เป็นรูปเนื้อหา”/“ใช้เป็นต้นแบบ AI”
- แสดง loading/empty/error/retry; เมนูไม่มีภาพเลือกไม่ได้และบอกเหตุผล; แยก unavailable กับไม่มีภาพให้ชัด ไม่ผูกความพร้อมขายกับสิทธิ์เลือกรูปโดยพลการ; ไม่แสดง archived/ข้าม tenant
- ไม่เปลี่ยนชื่อ/ข้อความที่ผู้ใช้พิมพ์แล้วโดยอัตโนมัติ; เติม subject AI จากชื่อเมนูได้เฉพาะช่องว่าง
- Planner ส่ง product/image กลับ ContentTab ผ่าน callback/state เดิม ใช้ selection handler เดียว ไม่ทำ picker/ร่างอีกชุด; เลื่อนไป panel ที่เลือกและคืน focus เมื่อปิด modal รองรับ keyboard/Escape และ mobile

### 4. ป้องกันการลบภาพต้นทางและรักษากฎขนาด
- “เอาออกจากเนื้อหา/ต้นแบบ” = detach เท่านั้น ห้ามเรียก storage.remove สำหรับ URL ที่แนบใช้ร่วมกัน
- การลบไฟล์จริงคงอยู่เฉพาะเครื่องมือจัดการสื่อเดิมตามสิทธิ์ ไม่เพิ่ม destructive cleanup ใหม่
- เลือก catalog = ใช้ URL เดิม ไม่คัดลอก/ดาวน์โหลด/บีบอัดทับภาพสินค้า; upload และภาพ AI ใหม่ใช้ compressToWebLimits เดิม ≤300px ด้านยาวและ ≤100KB
- ไม่ลดคุณภาพหรือแปลงภาพเก่าทั้งคลังโดยไม่ขออนุมัติ; reference URL ต้องเป็น URL ภาพที่ระบบยอมรับ ไม่ส่ง javascript/data URL โดยไม่ตรวจ

### 5. เชื่อม submit และ approval ให้จบ
- ส่งภาพ/mascot ที่เลือกเข้า submitContentForApproval เดิมพร้อมข้อมูลแต่ละประเภท; promotion ต้องผูก approval_id กับภาพเดียวกัน ไม่ผูกกับ discount scope_product_ids
- approval submit ล้มเหลวต้องหยุด dependent save และไม่ขึ้น success; บันทึกสำเร็จบางขั้นต้องรายงานตามจริง รักษาร่าง และ retry โดยไม่สร้างซ้ำ ใช้ cleanup/transaction ที่มีอยู่และสิทธิ์อนุญาต ไม่แนะนำ migration ก่อนพิสูจน์ว่าจำเป็น
- แก้ field queue ให้ตรง schema ที่ตรวจจริง แสดง error แทนแกล้งเป็นคิวว่าง
- review approve/reject/resubmit ต้องปรับ linked post status ผ่านทางเดิมและ reload parent ให้ SocialTab/scheduler เห็นผล ไม่เผยแพร่โดยการเลือกภาพหรือกดอนุมัติในขั้นทดสอบโดยไม่ตั้งใจ
- รักษา approval gate ทุก consumer; ถ้าการ์ดประกาศ/แบนเนอร์กรอง URL catalog ที่เลือกอย่างชัดเจน ให้รองรับภาพจาก content ที่อนุมัติแล้ว ไม่สุ่มนำรูปสินค้าอื่นมาแทน และไม่เปิดเผย pending/rejected
- รักษาโฟลตติ้งสูงสุด 3, ทุก browser และ badge เดิม; ไม่ขยายงานเป็น redesign โฟลตติ้ง/การเรียงลำดับทั้งระบบ

### 6. ทดสอบพฤติกรรมและ regression
- เพิ่ม/ปรับเทสต์ในไฟล์ที่เหมาะสมเดิมก่อนสร้างไฟล์เทสต์ใหม่; ไม่ใช้แค่ source-string assertion และไม่ลด expectation เพื่อให้เขียว
- ตรวจทั้ง 4 content types: เลือก catalog → preview → payload/save → approval image → ปลายทางตรง URL; ใช้ reference-only แล้ว final creative ไม่เปลี่ยน; เจนสำเร็จไม่แทนรูปจนกดใช้
- ยืนยัน upload/AI album/external URL/Supabase URL เดิมยังใช้งาน; สลับชนิดเนื้อหา/Planner/โหลด parent ไม่ทำ draft สลับกันหรือหาย
- Spy/assert เอาภาพเมนูออกแล้วไม่มี storage.remove และ products.image_url ไม่เปลี่ยน; ภาพซ้ำ/ไม่มีภาพ/404/API fail/tenant เปลี่ยนระหว่างโหลด/approval fail/save fail/double click/retry/rejected ต้องไม่เผยแพร่หรือแสดง success ปลอม
- ยืนยัน approval → สถานะ post → scheduling ด้วย integration และทดสอบ UI; การยิง social จริงต้องขออนุญาต/ใช้ test target ไม่ส่งถึงลูกค้าจริง
- รัน `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm test` แบบจบครั้งเดียว เก็บ exit code และผลรวม; timeout/interrupted = UNVERIFIED ไม่ใช่ PASS
- ใช้ Playwright ที่มีอยู่ทำ desktop/mobile journey และ failure path; ไม่มี credentials = ระบุ BLOCKED พร้อมขอบเขตที่ยังทดสอบไม่ได้

## Rollout และเอกสาร
- ไม่มี production data write ระหว่างวางแผน ไม่มี migration ลบสินค้า หรือ publish จริงโดยปริยาย
- ตรวจ diff แบบ exact scope; commit/push/deploy เมื่อ Owner อนุญาตตามกฎ ไม่ auto-commit ทุก phase
- rollback source ผ่านกระบวนการ Git ที่ได้รับอนุญาต ไม่แตะภาพ/ข้อมูลเมนูต้นทาง; กรณีบันทึกบางส่วนต้องระบุ reference ที่ค้างและวิธี retry/cleanup ก่อนส่งงาน
- หลัง implementation/validation อัปเดต AI_WORK_STATE.md, BMB_MASTER_STATUS.md และ test pack/remaining live tests ที่เกี่ยวข้องเป็นหลักฐานจริง แยก IMPLEMENTED/TESTED/DEPLOYED/Owner PASS
- คงผล Owner PASS ของ IMG-GEN, D2, D4, D5, R91, R92-G, R92-S; §T-A และรายการ RT/CAP เดิมยังค้าง ไม่ปิด RT-8 เพราะงานนี้

## เกณฑ์รับงาน
Owner เลือกรูปเมนูจากหน้าที่แนบได้จริง ใช้เป็น creative หรือ reference แยกกันได้ ทุกชนิดเนื้อหาใช้ภาพที่เลือกผ่าน approval/consumer เดิมถูกต้อง ไม่มีภาพสินค้าถูกลบ ไม่มี Studio/คลัง/ระบบส่งโพสต์ซ้ำ และผล automated/target runtime แต่ละส่วนมีหลักฐาน ไม่ใช้ build หรือ bundle marker แทน E2E PASS

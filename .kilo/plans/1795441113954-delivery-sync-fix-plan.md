# แผนแก้ "ระบบส่งของตันทั้งวงจร" (ไรเดอร์/ลูกค้า/แอดมิน) + แผนที่รายออเดอร์ขาว + แผนที่ลูกค้า — แบ่ง 5 เฟส

Source of truth ที่ใช้พิสูจน์: โค้ดจริงใน repo (main @ `b087749`) + รูป live test 23/11/2569 (biteme-baby.com)
ตามหลัก `AI_ENTRYPOINT.md` / `AI_WORK_STATE.md` / `UNIVERSAL_MASTER_AI_RULES.md`: แก้ตามอาการที่ Owner รายงาน · ห้าม bypass business rule · ทุก fix ต้องมี migration/code/test/doc ครบชุด

---

## 1) อาการจาก live test (ตรงตามรูป)

| # | อาการ | รูป |
|---|---|---|
| S1 | แอดมินมอบหมายไรเดอร์คนเดียวกันหลายออเดอร์ในรอบเดียว → เตือน override → กดผ่าน | (เล่าของ Owner) |
| S2 | ไรเดอร์กด "รับอาหารเพื่อเดินทางออกส่ง" ไม่ได้ → `ERR_DELIVERY_SYNC_BLOCKED: order PO-20261124-544 cannot advance preparing -> <NULL> (targe…` | 19:36 |
| S3 | เครื่องลูกค้าทุกเครื่องค้างสนิทที่ "จัดทำรอบพรีออเดอร์" — ไทม์ไลน์ไม่ขยับไปไหน | 20:07 |
| S4 | แผนที่รวมของไรเดอร์ใช้ได้ · แผนที่รายออเดอร์ทำงาน 1 ออเดอร์ อีกออเดอร์ขาว | 9:13 |
| S5 | ขึ้น error แต่กดส่งรูป (POD) แล้วแผงงานปิดไปเอง — ดูเหมือนปิดงานสำเร็จ ทั้งที่ server ยังไม่ delivered | 19:54 |
| S6 | แอดมินกด "🏁 แอดมินปิดวงจร (admin_advance)" ตันจุดเดิมเช่นกัน | (เล่าของ Owner) |
| S7 | หน้าที่อยู่ลูกค้า: "แผนที่ยังไม่พร้อมใช้งาน (โหลด Google Maps ไม่สำเร็จ)" + กล่องพิกัดแมนนวลโชว์แดงทั้งที่ GPS ยืนยันแล้ว (☑) | 18:34 |

## 2) Root cause (พิสูจน์จากโค้ดแล้ว — ไม่ใช่การเดา)

**RC1 — hop chain ของ delivery-sync เริ่มที่ `ready_for_dispatch` เท่านั้น → ออเดอร์ที่ยัง `preparing` ตันทันที**
ออเดอร์พรีออเดอร์รอบ `round-20261124-midday` อยู่สถานะ `preparing` (ครัวยังไม่กด "✅ พร้อมส่ง") ไรเดอร์กด picked_up → target `dispatched` → loop หา hop จาก `preparing` ไม่เจอ → `v_hop_to IS NULL` → raise (S2) และลูกค้าค้างที่ preparing ตลอด (S3) และแอดมินปิดวงจรตันเช่นกัน (S6):
- `driver_update_delivery_status` — canonical ล่าสุด `supabase/migrations/197_rider_available_after_loop.sql:87-97` (CASE มีแค่ ready_for_dispatch/dispatched/in_transit/arrived)
- `admin_advance_delivery_status` — canonical `supabase/migrations/116_admin_advance_delivery.sql:89` (chain เดียวกัน)
- `driver_checkin_arrival` — canonical `supabase/migrations/166_r13_rider_pod_path_and_checkin.sql:169-178` (target arrived — เช็คอินขณะ preparing ก็ตันด้วย)
- หมายเหตุ: `order_transition_allowed('preparing','ready_for_dispatch', admin=true)` = true อยู่แล้ว (`migrations/127_pickup_fulfillment.sql:166`) — allow-list ไม่ขวาง แค่ chain ไม่มี hop นี้
- การมอบหมาย/รับงานไม่ตัน: `assign_driver` (m210:529) + `driver_accept_assignment` (m210:156-172) อนุญาต confirmed/preparing อยู่แล้ว — ตันก็ต่อเมื่อ "ก้าวต่อไปของไรเดอร์"

**RC2 — error ไม่ถูกแปลงไทย + ซ่อนปุ่ม retry**
`driverService.ts:517-558` ไม่มี mapping `ERR_DELIVERY_SYNC_BLOCKED` → โชว์อังกฤษดิบตัด 90 ตัวอักษร; `classifyDriverError` จัด kind='state' (สาย :73) → ปุ่ม retry ถูกซ่อน (`RiderPwaPage.tsx:771` เงื่อนไข `kind !== 'state'`)

**RC3 — error แล้วแผง POD ปิดตัวเอง = หลอกว่าปิดงาน**
`RiderPwaPage.tsx:418-425` finally ของ `completeDelivery` เคลียร์ `activeOrder` แม้ความล้มเหลว (lastPhotoRef ยังค้าง = เงื่อนไข true) → กลับไปหน้ารายการทั้งที่ assignment ยัง `accepted`, POD แนบแล้วครึ่งทาง (`driver_attach_pod` m166:87-94 แนบได้แต่ไม่เปลี่ยนสถานะ) = อาการ S5 ตรงเป๊ะ

**RC4 — แผนที่รายออเดอร์ขาว (บางใบ)**
`RiderMiniMap.tsx`: effect Leaflet deps `[status, dropOff…, rider…, stopList]` (:129) → ทุกครั้ง GPS/pin เปลี่ยน = `map.remove()` + สร้างใหม่ทั้งก้อน ไม่มี `invalidateSize`/ResizeObserver/กัน init ซ้ำ; Google effect ไม่ทำลาย instance ตอน unmount (:42-79); สองจุด mount (แผนที่รวม `RiderPwaPage.tsx:685` + รายออเดอร์ `:733`) สลับ activeOrder แล้ว DOM/container โดนรื้อ — ชั้น init พลาด = ขาว (S4)

**RC5 — แผนที่ลูกค้าไม่มี fallback + UX กล่องแมนนวลหลอก**
`DeliveryMapPicker.tsx:60-94` Google เท่านั้น (key ถูกปฏิเสธ = แดงตายตัว S7) — ขณะที่ `RiderMiniMap`/`AdminLiveMap` มี Leaflet/OSM fallback แล้ว; กล่องแมนนวลโชว์ + error แดงทั้งที่มีพิกัด GPS ยืนยันแล้ว

**RC6 — copy เตือนมอบหมายซ้ำไม่ตรงความจริง (S1)**
`DeliveryManagement.tsx:183-185` บอก "ไรเดอร์จะกดรับงานไม่ได้จนกว่าจะเปิดสถานะพร้อมรับงาน" — ผิดสำหรับ busy (multi-job รับเพิ่มได้ตาม m168) · จริงๆ รับไม่ได้เฉพาะ offline (`ERR_DRIVER_OFFLINE`)

## 3) การตัดสินใจสำคัญ (ตัดสินแล้ว — ให้ implementer ทำตามนี้)

**D1 · นโยบาย "กดรับอาหาร" ขณะครัวยังไม่กดพร้อมส่ง:** เลือก **auto-hop `preparing → ready_for_dispatch`** ใน sync chain (พร้อม audit log ต่อ hop)
- เหตุผล: ไรเดอร์กด "รับอาหารแล้ว" = อาหารถูกส่งมอบถึงมือจริง = หลักฐานจริงว่าพร้อมส่ง · Owner รายงานอาการนี้เป็น "ระบบตาย" ไม่ใช่ "ระบบกันผิด" · allow-list อนุญาตอยู่แล้ว (m127:166)
- ขอบเขต: auto-hop **เฉพาะจาก `preparing`** · `pending/confirmed` = ครัวยังไม่เริ่ม ห้ามข้าม → raise error ใหม่ `ERR_KITCHEN_NOT_READY: order % still % (needs ready_for_dispatch)` ที่แปลไทยชัด ๆ
- ทางเลือกที่ปัด (ถ้า Owner ต้องการเข้มกว่านี้ให้แจ้งก่อน implement): strict block ทุกสถานะ + ปิดปุ่มใน UI — แต่นั่นคือสภาพปัจจุบันที่ทำให้วงจรตาย
- ตาม R87b: loop ต้อง bounded และ forward-only เหมือนเดิม (hop เพิ่ม 1 ตัวไม่ทำให้วน)

**D2 · ไม่แตะ flow มอบหมาย/รับงาน/ประกาศงาน** (assign/accept/claim ทำงานถูกแล้ว) และไม่ย้ายปุ่ม "พร้อมส่ง" ออกจากหน้าครัว (D1 คอมเมนต์: แต่ละ transition มีหน้าเจ้าของปุ่ม) — แค่ทำให้ "ก้าวต่อไปของไรเดอร์/แอดมิน" ไม่ตัน + error อ่านออก

---

## 4) แผนแบ่งเฟส (ทยอยแก้ · เฟสบนก่อนเฟสล่าง · แต่ละเฟสปิดได้ด้วยตัวเอง)

### Phase A — Migration 212: ต่อ hop chain + error ใหม่ (แก้ RC1 · ปลดล็อก S2/S3/S6)

ไฟล์ใหม่: `supabase/migrations/212_delivery_sync_preparing_hop.sql`
- คัด body verbatim จาก canonical ล่าสุดทั้ง 3 ฟังก์ชัน แล้วแกเฉพาะจุด:
  1. `driver_update_delivery_status` (จาก m197) — ก่อน loop: `IF v_order_status IN ('pending','confirmed') THEN RAISE EXCEPTION 'ERR_KITCHEN_NOT_READY: order % still % (needs ready_for_dispatch)', ...` · เพิ่ม hop `WHEN 'preparing' THEN 'ready_for_dispatch'` ใน CASE (audit message ระบุ `auto: rider pickup confirms readiness`)
  2. `admin_advance_delivery_status` (จาก m116) — guard + hop เดียวกัน (จาก preparing ไป target ไหนก็เดิน hop ผ่าน ready_for_dispatch ได้ · audit-tagged admin เดิม)
  3. `driver_checkin_arrival` (จาก m166) — guard + hop เดียวกัน (target arrived)
- ห้ามแตะ: เงื่อนไข POD/geofence/available-after-loop/ทุก RAISE เดิม · grant คงเดิม (REVOKE PUBLIC, GRANT authenticated ตามไฟล์เดิมแต่ละฟังก์ชัน)
- หมายเหตุการ apply: ตามธรรมเนียม repo — เขียน e2e script apply+verify แบบ `e2e/_r80Apply209.cjs` (pGrep functiondef ตรวจ hop/guard จริงหลัง apply) + รอ Owner อนุมัติ apply prod (ลง ledger การมอบหมาย migration ด้วย)

Acceptance: ออเดอร์ preparing → ไรเดอร์กดรับอาหารได้ (hop 2 ชั้น audited) → ลูกค้าเห็น "เริ่มจัดส่ง" · ออเดอร์ confirmed → error `ERR_KITCHEN_NOT_READY` ไม่ใช่ NULL-chain

### Phase B — Rider UI + ข้อความไทย (แก้ RC2/RC3 · ปิด S2 ด้านหน้า + S5)

1. `src/lib/driverService.ts`:
   - `DRIVER_ERROR_TH` เพิ่ม: `ERR_KITCHEN_NOT_READY: 'ครัวยังไม่ยืนยันพร้อมส่ง — แจ้งแอดมินกด "✅ พร้อมส่ง" ในหน้าครัวก่อน แล้วกดรับอาหารใหม่'` และ `ERR_DELIVERY_SYNC_BLOCKED: 'ระบบเดินสถานะไม่ได้ชั่วคราว — รีเฟรชรายการแล้วลองใหม่ (ถ้ายังติด แจ้งแอดมิน)'`
   - `classifyDriverError`: เพิ่ม `ERR_KITCHEN_NOT_READY` ในกลุ่ม kind='state' (สาย regex :73)
2. `src/pages/RiderPwaPage.tsx`:
   - `completeDelivery` finally: **ลบการเคลียร์ activeOrder เมื่อ error** (เคลียร์เฉพาะ success; comment R14 แก้ให้ตรง) — แผง POD ค้างเปิดพร้อมรูป + error ไทย (S5)
   - Retry ให้ครบวง: โชว์ปุ่ม "🔄 ลองยืนยันส่งอีกครั้ง" ได้แม้ kind='state' เมื่อความล้มเหลวเกิดที่ขั้น finalize (attach แล้ว) — เพิ่ม `podAttachDoneRef` (order number) · `completeDelivery` ข้ามขั้น upload เมื่อ attach สำเร็จแล้วของออเดอร์เดียวกัน (attach เป็น UPDATE idempotent ตาม m166)
   - การ์ดงาน (บล็อก `assignment_status === 'accepted'` :918-926): ใช้ `a.order_status` (มากับ `my_deliveries` v3 แล้ว · type มีอยู่ `driverService.ts:41`) โชว์ chip บริบท: `preparing → '🍳 ครัวกำลังเตรียม — กดรับอาหารได้เมื่อพร้อมส่ง'` · `pending/confirmed → '🍳 ครัวยังไม่เริ่มทำ — แจ้งแอดมิน'` (ปุ่มยังกดได้ — server เป็นผู้ตัดสินจริง เพราะ auto-hop อนุญาต preparing)
   - เปลี่ยน label ปุ่มเป็น "🛵 รับอาหารเพื่อเดินทางออกส่ง" (ศัพท์ Owner) — อัปเดต test ที่ pin ข้อความเดิมด้วย
3. `PodDeliveryPanel` (ในไฟล์เดียวกัน :989+): เมื่อมี error จาก finalize ให้ปุ่มยืนยันยังกดซ้ำได้ (ไม่ disable ถาวร) — รองรับ retry ข้อ 2

Acceptance: กดรับอาหารสำเร็จ/ล้มเหลวต้องเห็นข้อความไทยเสมอ · error finalize = แผงค้างเปิด + retry ได้โดยไม่อัปรูปซ้ำ

### Phase C — Admin UI (แก้ RC6 · อ่านสถานะครัวได้จากหน้าจัดส่ง · ปิด S1/S6 ด้านหน้า)

1. `src/pages/admin/DeliveryManagement.tsx:183-185` แยก copy ตามสถานะ: busy → `ไรเดอร์กำลังมีงาน — รับงานเพิ่มได้ (multi-job รอบเดียวกัน)` · offline → `ไรเดอร์ออฟไลน์ — ต้องเปิดสถานะพร้อมรับงานก่อนจึงรับงานได้`
2. คิว dispatch (:343-545): แถวที่ `o.status = 'preparing'` เพิ่ม badge `🍳 รอครัวยืนยันพร้อมส่ง` (แทนคำเตือนแดง generic :536-538 สำหรับกรณีนี้) + ปุ่มลิงก์ไป `/admin/kitchen` — ปุ่ม transition ยังอยู่ที่หน้าครัว (หน้าเจ้าของปุ่ม ตาม D2)
3. `adminAdvanceDelivery` failure (จาก Phase A) โชว์ไทยอัตโนมัติผ่าน `driverErrorText` ที่อัปเดตแล้ว — ตรวจว่า path :291-301 เรียก `driverErrorText` ครบ

Acceptance: แอดมินเห็นชัดว่างานตันเพราะครัว ไม่ใช่ระบบพัง · ปิดวงจรจาก preparing ได้หลัง Phase A

### Phase D — แผนที่ (แก้ RC4/RC5 · ปิด S4/S7)

1. `src/components/rider/RiderMiniMap.tsx` restructure (คง testid/props เดิม):
   - สร้าง Leaflet map **ครั้งเดียวต่อ mount** (ไม่ re-create เมื่อ riderGps/dropOff เปลี่ยน) — แยก effect "init" (deps `[]` หลัง status=unavailable) กับ effect "update markers/view" (deps ข้อมูล)
   - กัน init ซ้ำ: เช็ค container `_leaflet_id`/dataset flag ก่อน `L.map()` · `invalidateSize()` หลัง init + ResizeObserver ที่ container
   - ทำลาย Google map instance ใน cleanup ของ Google effect (แก้ leak :42-79)
   - Parent ใส่ `key` ชัดเจน: แผนที่รวม `key="route-plan-map"` · รายออเดอร์ `key={'pod-map-' + activeOrder.order_number}` (สลับงาน = remount สะอาด ไม่ใช่ reuse container พัง ๆ)
2. `src/components/delivery/DeliveryMapPicker.tsx`:
   - เพิ่ม Leaflet/OSM fallback แบบเดียวกับ RiderMiniMap (import `loadLeaflet` จาก `@/lib/leafletLoader` · marker ลากได้ → `onPick`) ทำงานเมื่อ status='unavailable' — ลูกค้าได้แผนที่จริงแม้ Google key ยังไม่แก้ (S7)
   - ซ่อน/ย่อกล่องแมนนวลเมื่อมี candidate อยู่แล้ว (latitude/longitude != null): โชว์ปุ่ม "แก้พิกัดเอง" แทนกล่อง+แดง · ข้อความแดง "พิกัดยังไม่ถูกต้อง" โชว์เฉพาะเมื่อกดแล้วจริง (ไม่ติดค้างจากครั้งก่อนเมื่อ GPS ยืนยันแล้ว)

Acceptance: 2 งานในรอบเดียว — แผนที่รวม + แผนที่รายงานทั้งสอง render ตรง · หน้าที่อยู่ลูกค้าใช้ได้แม้ Google Maps ล้ม

### Phase E — Tests + Gates + Docs + Live-test checklist

1. Tests (รูปแบบ source-contract เดิม เช่น `__tests__/dispatchContract.test.ts`):
   - `r212DeliverySyncPreparingHop.test.ts` — grep source m212: ทั้ง 3 ฟังก์ชันมี `WHEN 'preparing' THEN 'ready_for_dispatch'` + `ERR_KITCHEN_NOT_READY` + grant ครบ · loop ยัง bounded (ไม่มีเงื่อนไขวนออกนอก CASE)
   - อัปเดต `driverService` error-mapping test (ข้อความไทย 2 รายการใหม่)
   - `riderPwaUi` test: ปุ่ม label ใหม่ + chip `order_status` + ห้ามเคลียร์ activeOrder เมื่อ error (grep source) + retry ข้าม upload เมื่อ attach แล้ว
   - `DeliveryManagement` copy test (busy/offline แยกข้อความ) + badge preparing
   - `DeliveryMapPicker` test: Leaflet fallback branch + manual box logic
2. Gates ตามบ้าน: `npm run lint` · `npm run test` · `tsc`/`npm run build` · `npm run typecheck:functions` — ต้องเขียวก่อนส่ง
3. Docs: อัปเดต `docs/BMB_MASTER_STATUS.md` (entry LIVE STATE ใหม่ · ใช้เลขรอบถัดไปตามที่หัวไฟล์บอก) + `AI_WORK_STATE.md` + บันทึก migration 212 ลง ledger
4. Live-test checklist ให้ Owner (map อาการ→วิธีตรวจ):
   - S2: ออเดอร์ preparing → ไรเดอร์กด "รับอาหารเพื่อเดินทางออกส่ง" → ผ่าน (audit: delivery sync preparing → ready_for_dispatch)
   - S6: แอดมิน "🏁 แอดมินปิดวงจร" จาก preparing → ผ่าน
   - S3: เครื่องลูกค้าไทม์ไลน์เดินจาก "จัดทำรอบพรีออเดอร์" → "เริ่มจัดส่ง" → … → "ส่งสำเร็จ"
   - S5: ทดสอบกดยืนยันส่งขณะครัวยังไม่พร้อม (confirmed) → แผงค้างเปิด + ข้อความไทยบอกทางแก้ → แอดมินกดพร้อมส่ง → กด retry → ปิดงานจริง
   - S4: 2 งาน/1 ไรเดอร์ — แผนที่รวม + แผนที่รายงานครบทั้งสองใบ
   - S7: เครื่องลูกค้าที่ Google Maps ล้ม — เลือกที่อยู่บนแผนที่ OSM ได้/GPS/ยืนยัน → สั่งซื้อจบ

## 5) ความเสี่ยง/ข้อควรระวัง

- **5-hop walk จาก preparing → delivered** (ปิดวงจร) ยิง notification trigger ต่อ hop (m161/188) — มี dedupe แล้ว (m188) · audit ต่อ hop ตามดีไซน์เดิม ไม่ถือว่า bypass (allow-list อนุญาต + มีหลักฐานจริงคือไรเดอร์/แอดมินกด)
- **อย่าแก้ chain ในไฟล์ migration เก่า** — สร้าง m212 ใหม่เท่านั้น (migration แบบ append-only ตามบ้าน)
- **idempotency ผู้ใช้กดซ้ำ**: picked_up ซ้ำ = ERR path เดิม (`v_cur = picked_up` ยังผ่าน loop เพราะ target dispatched ≠ …) — ตรวจกรณีกดซ้ำใน test ก่อนส่ง (พฤติกรรมเดิมคงไว้ ไม่แนะนำใหม่)
- **Google Maps key ยังค้างเป็นของ Owner** (R44-48b) — Phase D ทำให้ระบบไม่พังโดยไม่มี key แต่การได้ key จริงยังต้องแก้ที่ Google Cloud Console
- worktree `.kilo/worktrees/satisfying-aphid` เป็นงานขนาน — อย่าแตะ; implement บน main ตาม entrypoint

## 6) Out of scope (ประกาศชัด)

- การเปลี่ยน state machine `order_transition_allowed` / โครงสร้าง assignment / dispatch offers
- Server-side cart, คูปอง, LINE/IG channel — ค้างเดิมตาม master status
- การซื้อ/แก้ Google Maps API key (ฝั่ง Owner)

## 7) เฟสไหนปลดล็อกอะไร (สรุปสั้น)

A = ปลดวงจรทั้งระบบ (ต้องทำก่อน · apply prod ต้องได้รับอนุมัติ) → B+C = หน้าตาผู้ใช้อ่านออก/ไม่หลอก → D = แผนที่ครบทุกใบทุกฝั่ง → E = เกต+หลักฐานปิดงาน

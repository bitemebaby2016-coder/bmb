import { Link } from 'react-router-dom'

export function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-brand-accent mb-2">📜 ข้อกำหนดในการใช้งาน</h1>
      <p className="text-brand-muted mb-6">อัปเดตล่าสุด: 15 ก.ย. 2026</p>

      <div className="space-y-6">
        <section className="card">
          <h2 className="text-xl font-bold text-brand-accent mb-3">1. บทนำ</h2>
          <p className="text-brand-text-secondary">
            โดยการใช้งานบริการ Bite Me Baby ("บริการ") คุณยอมรับข้อกำหนดเหล่านี้ หากไม่ยอมรับ กรุณาอย่าใช้บริการของเรา
          </p>
        </section>

        <section className="card">
          <h2 className="text-xl font-bold text-brand-accent mb-3">2. การสั่งอาหาร</h2>
          <ul className="list-disc list-inside space-y-2 text-brand-text-secondary">
            <li>ออเดอร์ทั้งหมดจะได้รับการยืนยันหลังจากชำระเงินสำเร็จ</li>
            <li>เราขอสงวนสิทธิในการปฏิเสธออเดอร์ในบางกรณี (เช่น ราคาผิด, สินค้าหมด)</li>
            <li>เวลาเตรียมอาหารโดยประมาณ 15-45 นาที ขึ้นอยู่กับความซับซ้อนของเมนู</li>
            <li>การแก้ไขหรือยกเลิกออรเดอร์ต้องทำการภายใน 5 นาทีหลังจากสั่งซื้อ</li>
          </ul>
        </section>

        <section className="card">
          <h2 className="text-xl font-bold text-brand-accent mb-3">3. การจัดส่ง</h2>
          <ul className="list-disc list-inside space-y-2 text-brand-text-secondary">
            <li>เราจัดส่งเฉพาะในรัศมี 5 กม. จากครัวในเมืองจันทบุรี</li>
            <li>ค่าจัดส่งเริ่มต้นที่ ฿30 หรือฟรีเมื่อซื้อครบ ฿200</li>
            <li>เวลาวางส่งโดยประมาณขึ้นอยู่กับรอบจัดส่งที่คุณเลือก</li>
            <li>คุณต้องอยู่ที่ที่อยู่จัดส่งเมื่อรถถึง หากไม่อยู่อาจไม่สามารถส่งได้</li>
          </ul>
        </section>

        <section className="card">
          <h2 className="text-xl font-bold text-brand-accent mb-3">4. นโยบายคืนเงิน</h2>
          <ul className="list-disc list-inside space-y-2 text-brand-text-secondary">
            <li>กรณีที่อาหารไม่ตรงกับคำสั่ง — คืนเงินเต็มจำนวน</li>
            <li>กรณีที่ล่าช้าเกิน 1 ชั่วโมง — คืนค่าจัดส่ง</li>
            <li>กรณีที่อาหารไม่มีคุณภาพ — คืนเงินตามดุลยพินิจ</li>
            <li>การคืนเงินจะดำเนินการภายใน 3-7 วันทำการ</li>
          </ul>
        </section>

        <section className="card">
          <h2 className="text-xl font-bold text-brand-accent mb-3">5. โปรแกรม Loyalty</h2>
          <ul className="list-disc list-inside space-y-2 text-brand-text-secondary">
            <li>แต้มที่ได้จะหมดอายุใน 12 เดือน</li>
            <li>แต้มไม่สามารถแลกเปลี่ยนเป็นเงินสด</li>
            <li>เรขอสงวนสิทธิในการปรับเปลี่ยนเงื่อนไขโปรแกรม Loyalty ได้โดยไม่ต้องแจ้งล่วงหน้า</li>
          </ul>
        </section>

        <section className="card">
          <h2 className="text-xl font-bold text-brand-accent mb-3">6. ข้อจำกัดความรับผิดชอบ</h2>
          <p className="text-brand-text-secondary">
            Bite Me Baby จะไม่รับผิดชอบต่อความเสียหายใดๆ arising from การใช้บริการนี้ รวมถึงแต่ไม่จำกัดเพียง:
          </p>
          <ul className="list-disc list-inside space-y-2 text-brand-text-secondary mt-2">
            <li>อาการแพ้จากอาหาร (ลูกค้าควรแจ้ง过敏ก่อน)</li>
            <li>การล่าช้าจากการขนส่งที่ไม่ใช่ความผิดของเรา</li>
            <li>ปัญหาทางเทคนิคภายนอก (server down, internet outage)</li>
          </ul>
        </section>

        <section className="card">
          <h2 className="text-xl font-bold text-brand-accent mb-3">7. ติดต่อเรา</h2>
          <p className="text-brand-text-secondary mb-2">หากมีคำถามเกี่ยวกับข้อกำหนดเหล่านี้:</p>
          <p>✉️ <a href="mailto:legal@bitemebaby.co.th" className="text-brand-primary hover:underline">legal@bitemebaby.co.th</a></p>
        </section>
      </div>

      <div className="mt-8 text-center">
        <Link to="/" className="text-brand-primary hover:underline">← กลับหน้าแรก</Link>
      </div>
    </div>
  )
}
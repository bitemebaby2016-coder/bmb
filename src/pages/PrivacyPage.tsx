import { Link } from 'react-router-dom'

export function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-brand-accent mb-2">🔒 นโยบายความเป็นส่วนตัว</h1>
      <p className="text-brand-muted mb-6">อัปเดตล่าสุด: 15 ก.ย. 2026</p>

      <div className="space-y-6">
        <section className="card">
          <h2 className="text-xl font-bold text-brand-accent mb-3">1. ข้อมูลที่เราเก็บ</h2>
          <ul className="list-disc list-inside space-y-2 text-brand-text-secondary">
            <li><strong>ข้อมูลบัญชี:</strong> ชื่อ, อีเมล, เบอร์โทรศัพท์</li>
            <li><strong>ข้อมูลการสั่งซื้อ:</strong> ประวัติออเดอร์, รายการที่สั่ง, ที่อยู่จัดส่ง</li>
            <li><strong>ข้อมูลการใช้งาน:</strong> หน้าเว็บที่คุณเข้าใช้, เวลาที่ใช้, กิจกรรมในแอป</li>
            <li><strong>ข้อมูลอุปกรณ์:</strong> ประเภทเบราว์เซอร์, ระบบปฏิบัติการ, ที่อยู่ IP</li>
          </ul>
        </section>

        <section className="card">
          <h2 className="text-xl font-bold text-brand-accent mb-3">2. วิธีที่เราใช้ข้อมูล</h2>
          <ul className="list-disc list-inside space-y-2 text-brand-text-secondary">
            <li>ประมวลผลและส่งออรเดอร์ของคุณ</li>
            <li>ติดต่อคุณเกี่ยวกับออเดอร์และบริการของเรา</li>
            <li>ปรับปรุงประสบการณ์และการใช้งานแพลตฟอร์ม</li>
            <li>ส่งโปรโมชั่นและข่าวสารที่เกี่ยวข้อง</li>
            <li>ป้องกัน fraudulent activity และความปลอดภัย</li>
          </ul>
        </section>

        <section className="card">
          <h2 className="text-xl font-bold text-brand-accent mb-3">3. การแชร์ข้อมูลกับบุคคลที่สาม</h2>
          <p className="text-brand-text-secondary">เราไม่ขายหรือเช่าข้อมูลส่วนบุคคลของคุณให้แก่บุคคลที่สาม เราอาจแชร์ข้อมูลเฉพาะเมื่อจำเป็นเพื่อให้บริการ เช่น:</p>
          <ul className="list-disc list-inside space-y-2 text-brand-text-secondary mt-2">
            <li>ผู้ให้บริการจัดส่ง (Grab, Lineman, Foodpanda)</li>
            <li>ระบบชำระเงิน (QR PromptPay Gateway)</li>
            <li>บริการวิเคราะห์ข้อมูล (เช่น Google Analytics)</li>
          </ul>
        </section>

        <section className="card">
          <h2 className="text-xl font-bold text-brand-accent mb-3">4. สิทธิของคุณ (GDPR)</h2>
          <ul className="list-disc list-inside space-y-2 text-brand-text-secondary">
            <li><strong>เข้าถึง:</strong> ขอสำเนาของข้อมูลทั้งหมดที่เราเก็บเกี่ยวกับคุณ</li>
            <li><strong>แก้ไข:</strong> ขอร้องให้แก้ไขข้อมูลที่ไม่ถูกต้อง</li>
            <li><strong>ลบ:</strong> ขอร้องให้ลบข้อมูลส่วนบุคคลของคุณ (สิทธิ์ถูกลืม)</li>
            <li><strong>จำกัด:</strong> ขอร้องไม่ให้ประมวลผลข้อมูลของคุณ</li>
            <li><strong>โอนย้าย:</strong> ขอข้อมูลในรูปแบบเครื่องอ่านได้</li>
          </ul>
        </section>

        <section className="card">
          <h2 className="text-xl font-bold text-brand-accent mb-3">5. ติดต่อฝ่ายคุ้มครองข้อมูล</h2>
          <p className="text-brand-text-secondary mb-2">หากคุณมีคำถามเกี่ยวกับนโยบายความเป็นส่วนตัวหรือต้องการใช้สิทธิของคุณ:</p>
          <p>✉️ <a href="mailto:privacy@bitemebaby.co.th" className="text-brand-primary hover:underline">privacy@bitemebaby.co.th</a></p>
          <p className="mt-2">📞 <a href="tel:+66xxxxxxxxx" className="text-brand-primary hover:underline">08X-XXX-XXXX</a></p>
        </section>
      </div>

      <div className="mt-8 text-center">
        <Link to="/" className="text-brand-primary hover:underline">← กลับหน้าแรก</Link>
      </div>
    </div>
  )
}
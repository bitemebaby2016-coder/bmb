// ============================================
// Bite Me Baby — Admin Control page shell
// ============================================
// ภาพรวมร้านจากข้อมูลจริง (ออเดอร์วันนี้ + ไรเดอร์ในระบบ) —
// ไทม์ไลน์ตัวอย่าง BMB-ADMIN-DEMO ถูกนำออกแล้วตามคำสั่ง Owner 2026-10-18

import { Link } from 'react-router-dom'
import { AdminControl } from '@/components/dashboard/AdminControl'

export function AdminControlPage() {
  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-5">
      <h1 className="text-2xl font-bold text-brand-accent">🛎️ ควบคุมร้าน</h1>
      <AdminControl />

      <div className="card text-sm text-brand-muted">
        <p className="font-semibold text-brand-accent mb-1">จัดการไรเดอร์และงานส่ง</p>
        <p className="mb-2">เพิ่ม/ลงทะเบียนไรเดอร์ ผูกบัญชีเข้าใช้งาน และมอบหมายงานได้ที่หน้า "จัดส่ง"</p>
        <Link to="/admin/delivery" className="btn btn-primary btn-sm">ไปหน้าจัดส่ง →</Link>
      </div>
    </div>
  )
}


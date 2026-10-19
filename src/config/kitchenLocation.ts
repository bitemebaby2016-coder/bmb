// ============================================
// Bite Me Baby — Kitchen location (SINGLE SOURCE OF TRUTH)
// ============================================
// Owner fix 2026-10-19: เดิมหลายไฟล์ใช้ fallback (10.7016, 102.1429) ซึ่งไม่ใช่
// พิกัดครัวจริง → ปักหมุดที่ครัวแต่ระบบคิดระยะทางได้ 200+ กม. / ค่าจัดส่งมั่ว
// ค่า fallback ด้านล่าง = ครัวจริง (business_settings.kitchen_location) —
// ทุกจุดที่ต้องใช้พิกัดครัวให้นำเข้าจากไฟล์นี้เท่านั้น (env override ได้ตามเดิม)
// ============================================

export const KITCHEN_LAT = Number(import.meta.env.VITE_DELIVERY_KITCHEN_LAT ?? '12.615659')
export const KITCHEN_LNG = Number(import.meta.env.VITE_DELIVERY_KITCHEN_LNG ?? '102.098063')

export const KITCHEN_POINT: { latitude: number; longitude: number } = {
  latitude: KITCHEN_LAT,
  longitude: KITCHEN_LNG,
}
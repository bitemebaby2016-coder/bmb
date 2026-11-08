// ============================================
// Bite Me Baby — codToggle (R86 · Owner 2026-11-08:
// "ระบบจ่ายเงิน ซ่อนแบบ COD ไว้ ให้แอดมิน กดเปิดปิด COD ได้")
// ============================================
// business_settings.cod_enabled = { enabled: boolean } — แก้ผ่าน AdminSettings (Master Switch area)
// ค่าเริ่มต้น/คีย์หาย/รูปแบบผิด = "ซ่อน COD" (ZERO-FAKE — ไม่เดาว่าร้านเปิดใช้)
// ทางอ่านเดียวของทุกจุดแสดงผล: CheckoutPage (ลูกค้า) + AdminPos (หน้าร้าน)
// ============================================

export type CodSettingsLike = Record<string, unknown> | null | undefined

/** COD เปิดใช้ไหม — ขาดคีย์/อ่านไม่ได้ = ซ่อน (default OFF) */
export function isCodEnabled(settings: CodSettingsLike): boolean {
  const v = settings?.['cod_enabled']
  if (typeof v === 'boolean') return v
  if (v && typeof v === 'object' && 'enabled' in (v as Record<string, unknown>)) {
    return Boolean((v as { enabled: unknown }).enabled)
  }
  return false
}

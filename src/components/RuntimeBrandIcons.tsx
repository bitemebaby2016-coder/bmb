// ============================================
// Bite Me Baby — RuntimeBrandIcons
// ============================================
// อ่าน brandLogoUrl จาก platform config (แอดมินตั้งในองค์กรและแบรนด์) แล้วยิง
// applyRuntimeBrandIcons ตอน mount/เปลี่ยน → ไอคอนแท็บ/apple-touch/PWA ตามโลโก้จริง
// ห่อเป็น component เดียว วางใน App ครั้งเดียว
// ============================================

import { useEffect } from 'react'
import { usePlatformConfig } from '@/config/platformConfig'
import { applyRuntimeBrandIcons } from '@/lib/runtimeBrandIcons'

export function RuntimeBrandIcons() {
  const { brandLogoUrl } = usePlatformConfig()
  useEffect(() => {
    applyRuntimeBrandIcons(brandLogoUrl)
  }, [brandLogoUrl])
  return null
}
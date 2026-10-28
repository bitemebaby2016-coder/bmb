-- ============================================
-- R12 (Owner สั่ง 2026-10-28): ยืนยันใช้ค่า LINE/Social จริง —
-- SEO copy ให้ admin แก้เองได้: seed คีย์ business_settings `seo`
-- = {description, tagline} (ค่า == DEFAULT ใน src/lib/seoSettings.ts)
-- หน้าแรก/meta/JSON-LD อ่านค่านี้ (fallback = ค่าจริงที่ยืนยันแล้ว)
-- anon/guest อ่านได้อยู่แล้ว (policy 164 = SELECT USING true)
-- re-run ปลอดภัย (WHERE NOT EXISTS)
-- ============================================
INSERT INTO public.business_settings (key, value, updated_at)
SELECT 'seo',
  jsonb_build_object(
    'description', 'ร้านอาหารไทยจัดส่งถึงบ้านในรัศมี 5 กม. จากตัวเมืองจันทบุรี ให้บริการรอบเช้า กลางวัน เย็น ส่งด้วยรถไฟฟ้าอัจฉริยะ',
    'tagline', 'สั่งอาหารจัดส่งเมืองจันทบุรี รัศมี 5 กม.'
  ),
  now()
WHERE NOT EXISTS (SELECT 1 FROM public.business_settings WHERE key = 'seo');
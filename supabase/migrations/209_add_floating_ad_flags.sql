-- 209_add_floating_ad_flags.sql
-- R80 (Owner 2026-11-20): Floating Ad ต้องโคลนข้อมูลตรงจากที่แอดมินเลือก
-- เพิ่ม flag is_floating_ad บน products และ marketing_posts
-- เพื่อให้แอดมินติ๊กเลือกได้ว่า "อยากให้รายการนี้ขึ้นโฆษณาลอยหน้าแรก"
-- ไม่ใช่ให้ระบบเดา/เลือกอัตโนมัติเหมือนเดิม (popular / marketing_feed_posts)

BEGIN;

-- products: flag ให้แอดมินติ๊กเมนูที่อยากให้ขึ้น floating ad
-- ไม่ใช่ best-seller auto-select — เลือกได้เมนูไหนก็ได้ที่ is_available=true
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS is_floating_ad BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.products.is_floating_ad IS 
'R80: true = แอดมินต้องการให้เมนูนี้แสดงเป็น Floating Ad บนหน้าแรก (โคลนข้อมูลตรง ไม่ได้จาก popular auto-select)';

-- marketing_posts: flag ให้แอดมินติ๊กโพสต์ที่อยากให้ขึ้น floating ad
-- เฉพาะโพสต์ที่ status='published' + is_floating_ad=true จะได้ขึ้น
ALTER TABLE public.marketing_posts 
ADD COLUMN IF NOT EXISTS is_floating_ad BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.marketing_posts.is_floating_ad IS 
'R80: true = แอดมินต้องการให้โพสต์นี้แสดงเป็น Floating Ad บนหน้าแรก (โคลน title/body/image_urls[0] ตรง ไม่ได้จาก marketing_feed_posts auto-select)';

-- Index สำหรับ query floating ad products
CREATE INDEX IF NOT EXISTS idx_products_is_floating_ad 
ON public.products (is_floating_ad) 
WHERE is_floating_ad = TRUE AND is_available = TRUE AND archived = FALSE;

-- Index สำหรับ query floating ad marketing posts
CREATE INDEX IF NOT EXISTS idx_marketing_posts_is_floating_ad 
ON public.marketing_posts (is_floating_ad) 
WHERE is_floating_ad = TRUE AND status = 'published';

COMMIT;
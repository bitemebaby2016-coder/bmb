import type { SEOMeta } from '@/types'

export function generateJsonLd(schema: Record<string, any>): string {
  return JSON.stringify(schema).replace(/<\/script>/g, '<\\/script>')
}

export const SITE_CONFIG = {
  name: 'Bite Me Baby',
  nameShort: 'BMB',
  url: 'https://bitemebaby.com',
  description: 'ร้านอาหารไทยจัดส่งถึงบ้านในรัศมี 5 กม. จากตัวเมืองจันทบุรี ให้บริการรอบเช้า กลางวัน เย็น ส่งด้วยรถไฟฟ้าอัจฉริยะ',
  ogImage: '/og-image.png',
  keywords: ['สั่งอาหารจันทบุรี', 'อาหารจัดส่ง', 'ร้านอาหารเมืองจันทบุรี', 'Bite Me Baby', 'ส่งอาหารจันทบุรี', 'cloud kitchen จันทบุรี'],
}

/** Absolute page URL used for canonical / hreflang / og:url. */
export function seoUrl(path: string = '/'): string {
  return path && path !== '/' ? SITE_CONFIG.url + path : SITE_CONFIG.url + '/'
}

const HOME_SCHEMA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Restaurant",
      "@id": "https://bitemebaby.com/#restaurant",
      "name": SITE_CONFIG.name,
      "url": "https://bitemebaby.com/",
      "image": "https://bitemebaby.com/og-image.png",
      "servesCuisine": ["Thai", "Asian"],
      "priceRange": "$$",
      "currenciesAccepted": "THB",
      "paymentAccepted": "QR PromptPay, Cash",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "ในตัวเมืองจันทบุรี",
        "addressLocality": "Chanthaburi",
        "addressRegion": "Chanthaburi",
        "postalCode": "22000",
        "addressCountry": "TH"
      },
      "geo": { "@type": "GeoCoordinates", "latitude": 10.7016, "longitude": 102.1429 },
      "openingHoursSpecification": [{
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],
        "opens": "06:00",
        "closes": "20:00"
      }],
      "areaServed": { "@type": "AdministrativeArea", "name": "Chanthaburi" },
      "hasMenu": { "@type": "Menu", "name": "Bite Me Baby Menu", "url": "https://bitemebaby.com/menu" },
      "sameAs": [
        "https://facebook.com/bitemebaby",
        "https://instagram.com/bitemebaby",
        "https://line.me/R/ti/p/@bitemebaby"
      ]
    },
    {
      "@type": "WebSite",
      "@id": "https://bitemebaby.com/#website",
      "url": "https://bitemebaby.com/",
      "name": SITE_CONFIG.name,
      "description": "สั่งอาหารจัดส่งเมืองจันทบุรี รัศมี 5 กม.",
      "inLanguage": ["th", "en"],
      "publisher": { "@id": "https://bitemebaby.com/#restaurant" }
    }
  ]
}

export function getHomeMeta(): SEOMeta {
  return {
    title: `${SITE_CONFIG.name} - สั่งอาหารจัดส่งเมืองจันทบุรี รัศมี 5 กม.`,
    description: SITE_CONFIG.description,
    keywords: SITE_CONFIG.keywords,
    ogImage: SITE_CONFIG.ogImage,
    url: seoUrl('/'),
    schema: HOME_SCHEMA,
  }
}

export function getMenuMeta(): SEOMeta {
  return {
    title: `เมนูอาหาร | ${SITE_CONFIG.name}`,
    description: `ดูเมนูอาหารทั้งหมดของ Bite Me Baby สั่งออนไลน์ได้ ส่งถึงบ้านในรัศมี 5 กม.`,
    keywords: [...SITE_CONFIG.keywords, 'menu food', 'อาหารจันทบุรี', 'order online'],
    ogImage: SITE_CONFIG.ogImage,
    url: seoUrl('/menu'),
    schema: { "@context": "https://schema.org", "@type": "Menu", "name": "Bite Me Baby Menu", "url": seoUrl('/menu') }
  }
}

export function getCartMeta(): SEOMeta {
  return {
    title: `ตะกร้า | ${SITE_CONFIG.name}`,
    description: `ตรวจสอบรายการสินค้าในตะกร้าและดำเนินการสั่งซื้อ`,
    keywords: [...SITE_CONFIG.keywords, 'ตะกร้า', 'shopping cart'],
    ogImage: SITE_CONFIG.ogImage, url: seoUrl('/cart'), schema: {}
  }
}

export function getCheckoutMeta(): SEOMeta {
  return {
    title: `ชำระเงิน | ${SITE_CONFIG.name}`,
    description: `หน้าชำระเงิน สั่งซื้ออาหารจาก Bite Me Baby`,
    keywords: [...SITE_CONFIG.keywords, 'ชำระเงิน', 'checkout', 'payment'],
    ogImage: SITE_CONFIG.ogImage, url: seoUrl('/checkout'), schema: {}
  }
}

export function getOrderTrackMeta(orderNumber: string): SEOMeta {
  return {
    title: `ติดตามออเดอร์ ${orderNumber} | ${SITE_CONFIG.name}`,
    description: `ติดตามสถานะออเดอร์เลขที่ ${orderNumber}`,
    keywords: [...SITE_CONFIG.keywords, 'tracking', 'order tracking'],
    ogImage: SITE_CONFIG.ogImage,
    url: seoUrl('/track/' + orderNumber),
    schema: { "@context": "https://schema.org", "@type": "Order", "orderNumber": orderNumber }
  }
}
export function getAboutMeta(): SEOMeta {
  return {
    title: `เกี่ยวกับเรา | ${SITE_CONFIG.name}`,
    description: `เรียนรู้เกี่ยวกับ Bite Me Baby Cloud Kitchen ในเมืองจันทบุรี บริการจัดส่งอาหารสดใหม่คุณภาพสูง`,
    keywords: [...SITE_CONFIG.keywords, 'about us', 'cloud kitchen'],
    ogImage: SITE_CONFIG.ogImage,
    url: seoUrl('/about'),
    schema: { "@context": "https://schema.org", "@type": "AboutPage" }
  }
}

export function getFaqMeta(): SEOMeta {
  return {
    title: `คำถามที่พบบ่อย (FAQ) | ${SITE_CONFIG.name}`,
    description: `คำตอบสำหรับคำถามที่พบบ่อยเกี่ยวกับการจัดส่ง โปรโมชั่น และวิธีการสั่ง`,
    keywords: [...SITE_CONFIG.keywords, 'FAQ', 'คำถามที่พบบ่อย'],
    ogImage: SITE_CONFIG.ogImage,
    url: seoUrl('/faq'),
    schema: { "@context": "https://schema.org", "@type": "FAQPage" }
  }
}

export function getBlogMeta(): SEOMeta {
  return {
    title: `บทความ | ${SITE_CONFIG.name}`,
    description: `อ่านบทความ เคล็ดลับการทำอาหาร ข่าวสาร และโปรโมชั่นล่าสุด`,
    keywords: [...SITE_CONFIG.keywords, 'blog', 'ข่าวสาร', 'เคล็ดลับอาหาร'],
    ogImage: SITE_CONFIG.ogImage,
    url: seoUrl('/blog'),
    schema: { "@context": "https://schema.org", "@type": "Blog" }
  }
}

export function getContactMeta(): SEOMeta {
  return {
    title: `ติดต่อเรา | ${SITE_CONFIG.name}`,
    description: `ติดต่อ Bite Me Baby สำหรับคำถาม ข้อเสนอแนะ หรือร่วมงานกับเรา`,
    keywords: [...SITE_CONFIG.keywords, 'contact', 'ติดต่อเรา'],
    ogImage: SITE_CONFIG.ogImage,
    url: seoUrl('/contact'),
    schema: { "@context": "https://schema.org", "@type": "ContactPage" }
  }
}

export function getPrivacyMeta(): SEOMeta {
  return {
    title: `นโยบายความเป็นส่วนตัว | ${SITE_CONFIG.name}`,
    description: `นโยบายความเป็นส่วนตัวในการใช้ข้อมูลส่วนบุคคลของคุณที่ Bite Me Baby`,
    keywords: [...SITE_CONFIG.keywords, 'privacy', 'ส่วนตัว', 'GDPR'],
    ogImage: SITE_CONFIG.ogImage, url: seoUrl('/privacy'), schema: {}
  }
}

export function getTermsMeta(): SEOMeta {
  return {
    title: `ข้อกำหนดในการใช้งาน | ${SITE_CONFIG.name}`,
    description: `ข้อกำหนดและเงื่อนไขในการใช้งานบริการ Bite Me Baby`,
    keywords: [...SITE_CONFIG.keywords, 'terms', 'ข้อกำหนด', 'เงื่อนไข'],
    ogImage: SITE_CONFIG.ogImage, url: seoUrl('/terms'), schema: {}
  }
}

export function getPromotionsMeta(): SEOMeta {
  return {
    title: `โปรโมชั่น | ${SITE_CONFIG.name}`,
    description: `ดูโปรโมชั่นและส่วนลดสุดพิเศษจาก Bite Me Baby คูปองโค้ดและข้อเสนอจำกัดเวลา`,
    keywords: [...SITE_CONFIG.keywords, 'promotions', 'โปรโมชั่น', 'คูปอง'],
    ogImage: SITE_CONFIG.ogImage,
    url: seoUrl('/promotions'),
    schema: { "@context": "https://schema.org", "@type": "OfferPage" }
  }
}

export function getRewardsMeta(): SEOMeta {
  return {
    title: `รางวัลและแต้ม | ${SITE_CONFIG.name}`,
    description: `สะสมแต้มแลกของขวัญกับโปรแกรม Loyalty ของ Bite Me Baby`,
    keywords: [...SITE_CONFIG.keywords, 'rewards', 'แต้มสะสม', 'loyalty'],
    ogImage: SITE_CONFIG.ogImage, url: seoUrl('/rewards'), schema: {}
  }
}

export function getVoteMeta(): SEOMeta {
  return {
    title: `โหวตเมนู | ${SITE_CONFIG.name}`,
    description: `ช่วยเลือกเมนูใหม่ของ Bite Me Baby โหวตเมนูที่คุณอยากกิน!`,
    keywords: [...SITE_CONFIG.keywords, 'vote', 'โหวต', 'เมนูใหม่'],
    ogImage: SITE_CONFIG.ogImage, url: seoUrl('/vote'), schema: {}
  }
}

export function getRandomMenuMeta(): SEOMeta {
  return {
    title: `สุ่มเมนู | ${SITE_CONFIG.name}`,
    description: `ให้ Bite Me Baby สุ่มเมนูอร่อยให้คุณ ลองสุ่มเมนูวันนี้เลย!`,
    keywords: [...SITE_CONFIG.keywords, 'random menu', 'สุ่มเมนู'],
    ogImage: SITE_CONFIG.ogImage, url: seoUrl('/random-menu'), schema: {}
  }
}

export function getShareMeta(): SEOMeta {
  return {
    title: `เชิญเพื่อน รับแต้ม | ${SITE_CONFIG.name}`,
    description: `เชิญเพื่อนมาสั่งอาหารกับ Bite Me Baby รับคูปองคนละ ฿30`,
    keywords: [...SITE_CONFIG.keywords, 'share', 'เชิญเพื่อน', 'referral'],
    ogImage: SITE_CONFIG.ogImage, url: seoUrl('/share'), schema: {}
  }
}
export function getViralMeta(): SEOMeta {
  return {
    title: `ไวรัล | ${SITE_CONFIG.name}`,
    description: `เข้าร่วมกิจกรรมไวรัลของ Bite Me Baby เพื่อรับรางวัลพิเศษ`,
    keywords: [...SITE_CONFIG.keywords, 'viral', 'กิจกรรมไวรัล'],
    ogImage: SITE_CONFIG.ogImage, url: seoUrl('/viral'), schema: {}
  }
}

export function getProfileMeta(): SEOMeta {
  return {
    title: `โปรไฟล์ | ${SITE_CONFIG.name}`,
    description: `ดูประวัติการสั่งอาหาร แต้มสะสม และคูปองของคุณที่ Bite Me Baby`,
    keywords: [...SITE_CONFIG.keywords, 'profile', 'แต้มสะสม'],
    ogImage: SITE_CONFIG.ogImage, url: seoUrl('/profile'), schema: {}
  }
}

export function getAdminMeta(): SEOMeta {
  return {
    title: `Admin Dashboard | ${SITE_CONFIG.name}`,
    description: `แดชบอร์ดจัดการร้าน Bite Me Baby จัดการออเดอร์ เมนู สต็อก และโปรโมชั่น`,
    keywords: [...SITE_CONFIG.keywords, 'admin', 'dashboard'],
    ogImage: SITE_CONFIG.ogImage, url: seoUrl('/admin'), schema: {}
  }
}

export function getLoginMeta(): SEOMeta {
  return {
    title: `เข้าสู่ระบบ | ${SITE_CONFIG.name}`,
    description: `เข้าสู่ระบบหรือสมัครสมาชิกเพื่อสั่งอาหาร`,
    keywords: [...SITE_CONFIG.keywords, 'login', 'register', 'เข้าสู่ระบบ'],
    ogImage: SITE_CONFIG.ogImage, url: seoUrl('/login'), schema: {}
  }
}
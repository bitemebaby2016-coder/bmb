import type { SEOMeta } from '@/types'

export function generateJsonLd(schema: Record<string, any>): string {
  return JSON.stringify(schema).replace(/<\/script>/g, '<\\/script>')
}

export const SITE_CONFIG = {
  name: 'Bite Me Baby',
  nameShort: 'BMB',
  url: 'https://bitemebaby.com',
  description: 'ร้านอาหารไทยจัดส่งถึงบ้านในรัศมี 5 กม. จากตัวเมืองจันทบุรี ให้บริการรอบเช้า กลางวัน เยน ส่งด้วยรถไฟฟ้าอัจริยะ',
  ogImage: '/og-image.png',
  keywords: ['สั่งอาหารจันทบุรี', 'อาหารจัดส่ง', 'ร้านอาหารเมืองจันทบุรี', 'Bite Me Baby', 'ส่งอาหารจันทบุรี', 'cloud kitchen จันทบุรี'],
}

export function getHomeMeta(): SEOMeta {
  return {
    title: `${SITE_CONFIG.name} - สั่งอาหารจัดส่งเมืองจันทบุรี รัศมี 5 กม.`,
    description: SITE_CONFIG.description,
    keywords: SITE_CONFIG.keywords,
    ogImage: SITE_CONFIG.ogImage,
    schema: {
      "@context": "https://schema.org",
      "@type": "Restaurant",
      "name": SITE_CONFIG.name,
      "servesCuisine": ["Thai", "Asian"],
      "priceRange": "$$",
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
        "opens": "06:00", "closes": "20:00"
      }],
      "hasMenu": { "@type": "Menu", "name": "Bite Me Baby Menu" },
      "telephone": "+66-xx-xxxx-xxx",
      "image": SITE_CONFIG.ogImage
    }
  }
}

export function getMenuMeta(): SEOMeta {
  return {
    title: `เมนอาหาร | ${SITE_CONFIG.name}`,
    description: `ดเมนอาหารทั้งหมดของ Bite Me Baby สั่งออนไลนได้ ส่งถึงบ้านในรัศมี 5 กม.`,
    keywords: [...SITE_CONFIG.keywords, 'menu food', 'อาหารจันทบุรี', 'order online'],
    ogImage: SITE_CONFIG.ogImage,
    schema: { "@context": "https://schema.org", "@type": "Menu" }
  }
}

export function getCartMeta(): SEOMeta {
  return {
    title: `ตะกร้า | ${SITE_CONFIG.name}`,
    description: `ตรวจสอบรายการสินค้าในตะกร้าและดำเนินการสั่งื้อ`,
    keywords: [...SITE_CONFIG.keywords, 'ตะกร้า', 'shopping cart'],
    ogImage: SITE_CONFIG.ogImage, schema: {}
  }
}

export function getCheckoutMeta(): SEOMeta {
  return {
    title: `ชำระเงิน | ${SITE_CONFIG.name}`,
    description: `หน้าชำระเงิน สั่งื้ออาหารจาก Bite Me Baby`,
    keywords: [...SITE_CONFIG.keywords, 'ชำระเงิน', 'checkout', 'payment'],
    ogImage: SITE_CONFIG.ogImage, schema: {}
  }
}

export function getOrderTrackMeta(orderNumber: string): SEOMeta {
  return {
    title: `ติดตามออเดอร ${orderNumber} | ${SITE_CONFIG.name}`,
    description: `ติดตามสถานะออเดอรเลขที่ ${orderNumber}`,
    keywords: [...SITE_CONFIG.keywords, 'tracking', 'order tracking'],
    ogImage: SITE_CONFIG.ogImage,
    schema: { "@context": "https://schema.org", "@type": "Order", "orderNumber": orderNumber }
  }
}

export function getAboutMeta(): SEOMeta {
  return {
    title: `เกี่ยวกับเรา | ${SITE_CONFIG.name}`,
    description: `เรียนร้เกี่ยวกับ Bite Me Baby Cloud Kitchen ในเมืองจันทบุรี บริการจัดส่งอาหารสดใหม่คุภาพสง`,
    keywords: [...SITE_CONFIG.keywords, 'about us', 'cloud kitchen'],
    ogImage: SITE_CONFIG.ogImage,
    schema: { "@context": "https://schema.org", "@type": "AboutPage" }
  }
}

export function getFaqMeta(): SEOMeta {
  return {
    title: `คำถามที่พบบ่อย (FAQ) | ${SITE_CONFIG.name}`,
    description: `คำตอบสำหรับคำถามที่พบบ่อยเกี่ยวกับการจัดส่ง ปรมชั่น และวิีการสั่ง`,
    keywords: [...SITE_CONFIG.keywords, 'FAQ', 'คำถามที่พบบ่อย'],
    ogImage: SITE_CONFIG.ogImage,
    schema: { "@context": "https://schema.org", "@type": "FAQPage" }
  }
}

export function getBlogMeta(): SEOMeta {
  return {
    title: `บลอก | ${SITE_CONFIG.name}`,
    description: `อ่านบทความ เคลดลับการทำอาหาร ข่าวสาร และปรมชั่นล่าสุด`,
    keywords: [...SITE_CONFIG.keywords, 'blog', 'ข่าวสาร', 'เคลดลับอาหาร'],
    ogImage: SITE_CONFIG.ogImage,
    schema: { "@context": "https://schema.org", "@type": "Blog" }
  }
}

export function getContactMeta(): SEOMeta {
  return {
    title: `ติดต่อเรา | ${SITE_CONFIG.name}`,
    description: `ติดต่อ Bite Me Baby สำหรับคำถาม ข้อเสนอแนะ หรือร่วมงานกับเรา`,
    keywords: [...SITE_CONFIG.keywords, 'contact', 'ติดต่อเรา'],
    ogImage: SITE_CONFIG.ogImage,
    schema: { "@context": "https://schema.org", "@type": "ContactPage" }
  }
}

export function getPrivacyMeta(): SEOMeta {
  return {
    title: `นยบายความเปนส่วนตัว | ${SITE_CONFIG.name}`,
    description: `นยบายความเปนส่วนตัวในการใช้ข้อมลส่วนบุคคลของคุที่ Bite Me Baby`,
    keywords: [...SITE_CONFIG.keywords, 'privacy', 'ส่วนตัว', 'GDPR'],
    ogImage: SITE_CONFIG.ogImage, schema: {}
  }
}

export function getTermsMeta(): SEOMeta {
  return {
    title: `ข้อกำหนดในการใช้งาน | ${SITE_CONFIG.name}`,
    description: `ข้อกำหนดและเงื่อนไขในการใช้งานบริการ Bite Me Baby`,
    keywords: [...SITE_CONFIG.keywords, 'terms', 'ข้อกำหนด', 'เงื่อนไข'],
    ogImage: SITE_CONFIG.ogImage, schema: {}
  }
}

export function getPromotionsMeta(): SEOMeta {
  return {
    title: `ปรมชั่น | ${SITE_CONFIG.name}`,
    description: `ดปรมชั่นและส่วนลดสุดพิเศษจาก Bite Me Baby คปองค้ดและข้อเสนอจำกัดเวลา`,
    keywords: [...SITE_CONFIG.keywords, 'promotions', 'ปรมชั่น', 'คปอง'],
    ogImage: SITE_CONFIG.ogImage,
    schema: { "@context": "https://schema.org", "@type": "OfferPage" }
  }
}

export function getRewardsMeta(): SEOMeta {
  return {
    title: `รางวัลและแต้ม | ${SITE_CONFIG.name}`,
    description: `สะสมแต้มแลกของขวักับปรแกรม Loyalty ของ Bite Me Baby`,
    keywords: [...SITE_CONFIG.keywords, 'rewards', 'แต้มสะสม', 'loyalty'],
    ogImage: SITE_CONFIG.ogImage, schema: {}
  }
}

export function getVoteMeta(): SEOMeta {
  return {
    title: `หวตเมน | ${SITE_CONFIG.name}`,
    description: `ช่วยเลือกเมนใหม่ของ Bite Me Baby หวตเมนที่คุอยากกิน!`,
    keywords: [...SITE_CONFIG.keywords, 'vote', 'หวต', 'เมนใหม่'],
    ogImage: SITE_CONFIG.ogImage, schema: {}
  }
}

export function getRandomMenuMeta(): SEOMeta {
  return {
    title: `สุ่มเมน | ${SITE_CONFIG.name}`,
    description: `ให้ Bite Me Baby สุ่มเมนอร่อยให้คุ ลองสุ่มเมนวันนี้เลย!`,
    keywords: [...SITE_CONFIG.keywords, 'random menu', 'สุ่มเมน'],
    ogImage: SITE_CONFIG.ogImage, schema: {}
  }
}

export function getShareMeta(): SEOMeta {
  return {
    title: `เชิเพื่อน รับแต้ม | ${SITE_CONFIG.name}`,
    description: `เชิเพื่อนมาสั่งอาหารกับ Bite Me Baby รับคปองคนละ ฿30`,
    keywords: [...SITE_CONFIG.keywords, 'share', 'เชิเพื่อน', 'referral'],
    ogImage: SITE_CONFIG.ogImage, schema: {}
  }
}

export function getViralMeta(): SEOMeta {
  return {
    title: `ไวรัล | ${SITE_CONFIG.name}`,
    description: `เข้าร่วมกิจกรรมไวรัลของ Bite Me Baby เพื่อรับรางวัลพิเศษ`,
    keywords: [...SITE_CONFIG.keywords, 'viral', 'กิจกรรมไวรัล'],
    ogImage: SITE_CONFIG.ogImage, schema: {}
  }
}

export function getProfileMeta(): SEOMeta {
  return {
    title: `ปรไฟล | ${SITE_CONFIG.name}`,
    description: `ดประวัติการสั่งอาหาร แต้มสะสม และคปองของคุที่ Bite Me Baby`,
    keywords: [...SITE_CONFIG.keywords, 'profile', 'แต้มสะสม'],
    ogImage: SITE_CONFIG.ogImage, schema: {}
  }
}

export function getAdminMeta(): SEOMeta {
  return {
    title: `Admin Dashboard | ${SITE_CONFIG.name}`,
    description: `แดชบอรดจัดการร้าน Bite Me Baby จัดการออเดอร เมน สตอก และปรมชั่น`,
    keywords: [...SITE_CONFIG.keywords, 'admin', 'dashboard'],
    ogImage: SITE_CONFIG.ogImage, schema: {}
  }
}

export function getLoginMeta(): SEOMeta {
  return {
    title: `เข้าส่ระบบ | ${SITE_CONFIG.name}`,
    description: `เข้าส่ระบบหรือสมัครสมาชิกเพื่อสั่งอาหาร`,
    keywords: [...SITE_CONFIG.keywords, 'login', 'register', 'เข้าส่ระบบ'],
    ogImage: SITE_CONFIG.ogImage, schema: {}
  }
}
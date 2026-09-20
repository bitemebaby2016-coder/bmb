// ============================================
// Bite Me Baby — Snacks Menu (Home section)
// MOCKUP DATA — owner-friendly. เปลี่ยนรายละเอียดได้ที่นี่ไฟล์เดียว
// (ชื่อ / ราคา / คำอธิบาย / ป้าย / รูป) โดยไม่ต้องแตะ component หรือ CSS
// ============================================
// วิธีแก้รูป:
//   1. วางรูปจริงไว้ที่ public/images/snacks/ (เช่น snack-1.webp)
//   2. แก้ค่า image ด้านล่างเป็น path ใหม่ เช่น '/images/snacks/snack-1.webp'
//   3. แก้ name / price / description / tag ได้ทันที
// ถ้ายังไม่พร้อมขายจริง ปล่อย comingSoon: true ไว้ — จะแสดงป้าย "เร็ว ๆ นี้"
// ============================================

export interface HomeSnack {
  id: string
  name: string
  price: number
  description: string
  tag: string
  image: string
  comingSoon?: boolean
}

export const SNACKS_MENU: HomeSnack[] = [
  {
    id: 'snack-1',
    name: 'ปีซซามินิชีส',
    price: 49,
    description: 'Bite-size crispy baked pizza bites topped with melted cheese',
    tag: 'ขายดี',
    image: '/images/snacks/snack-1.svg',
    comingSoon: true,
  },
  {
    id: 'snack-2',
    name: 'นักเกตไ่ไ่กรอบ',
    price: 39,
    description: 'นักเกตไ่รีรมร้อน กรอบนอกนมใน กับซอสหวิล',
    tag: 'ใหม่!',
    image: '/images/snacks/snack-2.svg',
    comingSoon: true,
  },
  {
    id: 'snack-3',
    name: 'เฟรนไฟรายส์ชีส',
    price: 45,
    description: 'มันทอดกรอบ ราดชีสซอสแร์ๆ กับปาปริกา',
    tag: 'ฮิตติดเทรนด',
    image: '/images/snacks/snack-3.svg',
    comingSoon: true,
  },
  {
    id: 'snack-4',
    name: 'เกียซาไ่',
    price: 55,
    description: 'Homemade gyoza dumplings, steamed fresh, served with a dipping sauce',
    tag: 'สุดฟิน',
    image: '/images/snacks/snack-4.svg',
    comingSoon: true,
  },
  {
    id: 'snack-5',
    name: 'Chicken Strips',
    price: 59,
    description: 'Crispy fried chicken tenders served with a smoky BBQ dip',
    tag: 'เฮลท์ตี้',
    image: '/images/snacks/snack-5.svg',
    comingSoon: true,
  },
]
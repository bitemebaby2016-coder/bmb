// ============================================
// Bite Me Baby — Drinks Menu (Home section)
// MOCKUP DATA — owner-friendly. เปลี่ยนรายละเอียดได้ที่นี่ไฟล์เดียว
// (ชื่อ / ราคา / คำอธิบาย / ป้าย / รูป) โดยไม่ต้องแตะ component หรือ CSS
// ============================================
// วิธีแก้รูป:
//   1. วางรูปจริงไว้ที่ public/images/drinks/ (เช่น drink-1.webp)
//   2. แก้ค่า image ด้านล่างเป็น path ใหม่ เช่น '/images/drinks/drink-1.webp'
//   3. แก้ name / price / description / tag ได้ทันที
// ถ้ายังไม่พร้อมขายจริง ปล่อย comingSoon: true ไว้ — จะแสดงป้าย "เร็ว ๆ นี้"
// ============================================

export interface HomeDrink {
  id: string
  name: string
  price: number
  description: string
  tag: string
  image: string
  comingSoon?: boolean
}

export const DRINKS_MENU: HomeDrink[] = [
  {
    id: 'drink-1',
    name: 'ชามะนาวสด',
    price: 35,
    description: 'ชาดำหอม ๆ ดับสดชื่น สาดน้ำมะนาวแท้ หวานน้อย',
    tag: 'ฮิตติดเทรนด์',
    image: '/images/drinks/drink-1.svg',
    comingSoon: true,
  },
  {
    id: 'drink-2',
    name: 'ชาเขียวมัตฉะ',
    price: 45,
    description: 'มัตฉะเกรดพรีเมียม ผสมนมสด หอมมันกำลังดี',
    tag: 'ใหม่!',
    image: '/images/drinks/drink-2.svg',
    comingSoon: true,
  },
  {
    id: 'drink-3',
    name: 'น้ำอัญชันมะนาว',
    price: 30,
    description: 'อัญชันสีฟ้าเปลี่ยนสี เพิ่มความสดชื่นแบบสายเฮลท์ตี้',
    tag: 'เฮลท์ตี้',
    image: '/images/drinks/drink-3.svg',
    comingSoon: true,
  },
  {
    id: 'drink-4',
    name: 'โกโก้เย็นเข้มข้น',
    price: 40,
    description: 'โกโก้สูตรเข้มข้น หวานน้อย หอมช็อกโกแลตแท้',
    tag: 'สุดฟิน',
    image: '/images/drinks/drink-4.svg',
    comingSoon: true,
  },
  {
    id: 'drink-5',
    name: 'น้ำผลไม้รวมมิตร',
    price: 38,
    description: 'ส้ม แอปเปิ้ล เสาวรส คั้นสดผสมรวม ไม่ใช้น้ำเชื่อม',
    tag: 'วิตามินซี',
    image: '/images/drinks/drink-5.svg',
    comingSoon: true,
  },
]
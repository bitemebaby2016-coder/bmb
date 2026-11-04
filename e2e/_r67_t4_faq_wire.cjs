'use strict'
// _r67_t4_faq_wire — wire FaqPage + seo.ts to the live builder (auto-adjust)
//  A) FaqPage.tsx — buildFaqs from usePlatformConfig (reactive) + getShopHours
//  B) seo.ts — getFaqMeta schema uses getFaqs() (same builder as the page = AEO)
const fs = require('fs')

function patch(file, edits) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
  for (const e of edits) {
    const idx = e.n - 1
    if (!lines[idx].includes(e.mustContain)) {
      console.error('FAIL ' + file + ' line ' + e.n + ' expected: ' + e.mustContain + ' got: ' + lines[idx])
      process.exit(1)
    }
    lines[idx] = e.next
    console.log('OK replace ' + file + ':' + e.n)
  }
  fs.writeFileSync(file, lines.join('\n'), 'utf8')
}

patch('src/pages/FaqPage.tsx', [
  {
    n: 4,
    mustContain: "import { faqs } from '@/lib/faqContent'",
    next: "import { buildFaqs } from '@/lib/faqContent'\nimport { usePlatformConfig } from '@/config/platformConfig'\nimport { getShopHours } from '@/lib/shopHours'",
  },
  {
    n: 8,
    mustContain: 'const [openIndex, setOpenIndex] = useState<number | null>(null)',
    next: '  const [openIndex, setOpenIndex] = useState<number | null>(null)\n  // R67-T4: คำตอบ FAQ สร้างจากค่าจริงของระบบ (PlatformConfig + shopHours) ทุกครั้งที่\n  // render — ค่า backend เปลี่ยน (ค่าส่ง/ส่งฟรี/เวลา) → หน้านี้ปรับเองอัตโนมัติ\n  const delivery = usePlatformConfig().delivery\n  const faqs = buildFaqs({ delivery, shopHours: getShopHours() })',
  },
])

patch('src/lib/seo.ts', [
  {
    n: 2,
    mustContain: "import { faqs } from './faqContent'",
    next: "import { getFaqs } from './faqContent'",
  },
  {
    n: 186,
    mustContain: 'mainEntity: faqs.map((f) => ({',
    next: '      mainEntity: getFaqs().map((f) => ({',
  },
])

console.log('ALL_WIRE_PATCHES_OK')

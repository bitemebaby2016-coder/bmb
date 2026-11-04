'use strict'
// _r67_t4_faq_fix2 — fix type import: ShopHours type lives in shopHoursLogic
const fs = require('fs')
const TARGET = 'src/lib/faqContent.ts'
const lines = fs.readFileSync(TARGET, 'utf8').split(/\r?\n/)
const at = lines.findIndex((l) => l.includes("import { getShopHours, type ShopHours } from '@/lib/shopHours'"))
if (at < 0) { console.error('FAIL import line not found'); process.exit(1) }
lines[at] = "import { getShopHours } from '@/lib/shopHours'"
lines.splice(at + 1, 0, "import type { ShopHours } from '@/lib/shopHoursLogic'")
fs.writeFileSync(TARGET, lines.join('\n'), 'utf8')
console.log('OK fixed imports @' + (at + 1))
console.log('FIX2_OK')

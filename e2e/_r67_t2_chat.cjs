'use strict'
// _r67_t2_chat — R67-T1 Chat-Hang (part 2): line-assert patches
//  A) src/lib/mascotService.ts — withDeadline accepts PromiseLike (supabase builder)
//  B) src/components/ai/TalkToBite.tsx — time-box every send-path query so `typing`
//     can never stick forever (README §10.4 close: a stalled network must settle
//     within CHAT_QUERY_TIMEOUT_MS → existing catch/finally always runs).
const fs = require('fs')

function patch(file, edits) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
  for (const e of edits) {
    if (e.insertBefore) {
      const idx = e.insertBefore - 1
      if (!lines[idx].includes(e.mustContain)) {
        console.error('FAIL ' + file + ' insertBefore ' + e.insertBefore + ' expected: ' + e.mustContain + ' got: ' + lines[idx])
        process.exit(1)
      }
      const add = Array.isArray(e.next) ? e.next : [e.next]
      lines.splice(idx, 0, ...add)
      console.log('OK insert ' + file + ' @' + e.insertBefore + ' (+' + add.length + ' lines)')
    } else {
      const idx = e.n - 1
      if (!lines[idx].includes(e.mustContain)) {
        console.error('FAIL ' + file + ' line ' + e.n + ' expected: ' + e.mustContain + ' got: ' + lines[idx])
        process.exit(1)
      }
      lines[idx] = e.next
      console.log('OK replace ' + file + ':' + e.n)
    }
  }
  fs.writeFileSync(file, lines.join('\n'), 'utf8')
}

// ---- A) mascotService: supabase builder is PromiseLike, not Promise ----
patch('src/lib/mascotService.ts', [
  {
    n: 21,
    mustContain: 'function withDeadline<T>(promise: Promise<T>',
    next: 'function withDeadline<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {',
  },
])

// ---- B) TalkToBite: time-box send-path queries (bottom-up to keep line numbers) ----
const HELPER = [
  '// R67 Chat-hang close (README §10.4): ทุก query ในเส้นทางส่งข้อความต้อง time-box —',
  '// เน็ตค้าง = promise ไม่ settle = typing ติดถาวร (ปุ่มส่ง disable ตลอดกาล).',
  '// เกินเวลานี้ reject เข้า catch/finally เดิมทันที (ข้อความไทยเดิม + typing รีเซ็ต)',
  'const CHAT_QUERY_TIMEOUT_MS = 15000',
  'function withDeadline<T>(promise: PromiseLike<T>, ms: number = CHAT_QUERY_TIMEOUT_MS): Promise<T> {',
  "  return new Promise<T>((resolve, reject) => {",
  "    const timer = setTimeout(() => reject(new Error('chat_query_timeout')), ms)",
  '    promise.then(',
  '      (value) => { clearTimeout(timer); resolve(value) },',
  '      (err) => { clearTimeout(timer); reject(err) },',
  '    )',
  '  })',
  '}',
]

patch('src/components/ai/TalkToBite.tsx', [
  // tryOrderIntent (535-538)
  { n: 538, mustContain: '      ])', next: '      ]))' },
  { n: 535, mustContain: 'const [orders, catalog] = await Promise.all([', next: '      const [orders, catalog] = await withDeadline(Promise.all([' },
  // handleCheckOrders (384)
  { n: 384, mustContain: 'await getOrdersByCustomer(customer!.id)', next: '      const orders = await withDeadline(getOrdersByCustomer(customer!.id))' },
  // handleOrderAgain (341-344)
  { n: 344, mustContain: '      ])', next: '      ]))' },
  { n: 341, mustContain: 'const [orders, catalog] = await Promise.all([', next: '      const [orders, catalog] = await withDeadline(Promise.all([' },
  // quick actions (316 / 289 / 266 / 244)
  { n: 316, mustContain: 'pickTopAvailable(await load(), 12)', next: '      const products = pickTopAvailable(await withDeadline(load()), 12)' },
  { n: 289, mustContain: 'pickFavoriteProducts(await load(), favoriteCats, 3)', next: '      const products = pickFavoriteProducts(await withDeadline(load()), favoriteCats, 3)' },
  { n: 266, mustContain: 'pickTopAvailable(await load(), 3)', next: '      const products = pickTopAvailable(await withDeadline(load()), 3)' },
  { n: 244, mustContain: 'pickTopAvailable(await load(), 3)', next: '      const products = pickTopAvailable(await withDeadline(load()), 3)' },
  // helper before component
  { insertBefore: 96, mustContain: 'export function TalkToBite(', next: HELPER },
])

console.log('ALL_PATCHES_OK')

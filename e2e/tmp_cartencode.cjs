'use strict'
const j = JSON.stringify({ v: 1, items: [{ id: 'abc-123-XYZ', q: 1 }] })
const enc = Buffer.from(j, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
console.log('enc=' + enc)
const p = enc.replace(/-/g, '+').replace(/_/g, '/')
const pad = p.length % 4 === 0 ? '' : '='.repeat(4 - (p.length % 4))
console.log('dec=' + Buffer.from(p + pad, 'base64').toString('utf8'))
console.log('match=' + (Buffer.from(p + pad, 'base64').toString('utf8') === j))
// จำลอง URLSearchParams ของเบราว์เซอร์: + = space
const qs = new URLSearchParams('?cart=' + enc).get('cart')
console.log('viaURLSearch=' + (qs === enc))

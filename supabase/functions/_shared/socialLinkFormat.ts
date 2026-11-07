// ============================================
// R75 (Owner 2026-11-07: "ลิ้งที่เอไอสร้างใช้ไม่ได้เลยสักลิ้ง ต่อออกภายนอกก็ไม่ได้")
//
// Root cause (live evidence e2e/_r75_link_audit.log): ทุกข้อความที่ AI เขียน
// (และ footer ระบบบางบรรทัด) ใช้ "โดเมนเปล่า" เช่น biteme-baby.com/shop
// — Facebook จะทำลิงก์ให้แตะได้เฉพาะ URL ที่มี scheme (https://) เท่านั้น
// โดเมนเปล่า/ markdown [label](url) = ข้อความธรรมดา แตะไม่ได้ เปิดออกภายนอกไม่ได้
//
// กติกา: ข้อความทุกบรรทัดที่ AI สร้าง/ระบบส่งออก Facebook/Messenger ต้องผ่าน
// normalizeAiTextLinks() ก่อนบันทึก/ส่งเสมอ
//   - biteme-baby.com/... | www. | http://  → https://biteme-baby.com/...
//   - markdown [label](url)                 → "label: url" (FB ไม่ render markdown)
//   - คงเดิมถ้าถูกต้องแล้ว (idempotent) + ไม่แตะ URL ภายนอกอื่น
//
// PURE — ไม่มี I/O (vitest ฝั่งเว็บ import ตรงได้)
// ============================================

export const SITE_URL = 'https://biteme-baby.com'

/**
 * token ลิงก์ร้าน: host biteme-baby.com (+ path/query/fragment แบบ URL)
 * - (?<![A-Za-z0-9./_@=-]) กันไม่ให้ไปขึ้นกลาง URL อื่น
 * - (?![A-Za-z0-9]) กัน host ที่ยาวกว่า เช่น biteme-baby.commerce
 * - path หยุดที่อักขระนอกคลาส (วรรค/อักขระไทย/เครื่องหมายท้ายประโยค)
 */
const BMB_URL_RE = /(?<![A-Za-z0-9./_@=-])(?:https?:\/\/)?(?:www\.)?biteme-baby\.com(?![A-Za-z0-9])(?:[/?#][-A-Za-z0-9._~:/?#[\]@!$&'()*+,;=%]*)?/gi

/** markdown link [label](url) — Facebook ไม่ render → ต้องถอดเป็นข้อความ+URL */
const MD_LINK_RE = /\[([^\]]*)\]\(([^()\s]+)\)/g

/** แยกเครื่องหมายท้ายประโยคที่ไม่ได้เป็นส่วนของ URL ออกจาก token */
function splitTrailingPunct(token: string): { url: string; tail: string } {
  let t = token
  let tail = ''
  for (;;) {
    const last = t.slice(-1)
    if (last === '') return { url: t, tail }
    if (/[.,;:!'"]/.test(last)) { t = t.slice(0, -1); tail = last + tail; continue }
    if (last === ')' && !t.includes('(')) { t = t.slice(0, -1); tail = last + tail; continue }
    return { url: t, tail }
  }
}

/** ทำ token ให้เป็น https:// URL เต็มรูปแบบเสมอ (idempotent) — เก็บวรรคตอนท้ายไว้หลัง URL */
function canonicalizeBmbUrl(token: string): string {
  const { url, tail } = splitTrailingPunct(token)
  const host = url
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
  return 'https://' + host + tail
}

/**
 * แปลงลิงก์ในข้อความที่ AI/ระบบสร้าง ให้เป็น URL ที่แตะได้จริงบน Facebook
 * (ต้องเรียกก่อนบันทึก draft / ก่อนส่ง reply / ก่อน publish เสมอ)
 */
export function normalizeAiTextLinks(text: string): string {
  if (!text) return text
  let out = String(text)
  // 1) markdown [label](url) → "label: url" (label ว่าง/ซ้ำกับ url → เหลือแค่ url)
  out = out.replace(MD_LINK_RE, (_m, label: string, url: string) => {
    const l = String(label).trim()
    return !l || l === url ? url : l + ': ' + url
  })
  // 2) โดเมนเปล่า / www / http → https:// URL เต็ม
  out = out.replace(BMB_URL_RE, (m) => canonicalizeBmbUrl(m))
  return out
}
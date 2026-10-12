// ============================================
// Bite Me Baby — Brand name sanitizer (Edge Function / server side)
// ============================================
// MUST mirror src/lib/brandName.ts — ทั้งสองไฟล์ต้องตรงกันทุกตัวอักษร
// และมี test บังคับ (`brandNameParity.test.ts`) ถ้าใครแก้ฝั่งเดียว CI จะตก
//
// ทำไมต้องฝั่ง server: ข้อความจากโมเดล "ทุกตัว" ต้องผ่าน ai-proxy
// ⇒ sanitize ตรงนี้ = ครอบคลุมทุก channel (แชท, TTS, tool-calling)
//   ไม่ต้องหวังว่า client ทุกจุดจะไม่ลืมเรียก
// ============================================

export const MASCOT_TH = 'ไบ๊'
export const BRAND_TH = 'ไบ๊มีเบบี้'

export const BANNED_MASCOT_NAMES: readonly string[] = [
  // ⚠️ คัดเฉพาะชื่อที่ "ไม่ชน" กับคำไทยปกติเท่านั้น
  // ห้ามใส่ 'บิต' (⊂ เครดิต/เดบิต) · 'บับ' (⊂ บับเบิล) · 'บิด' · 'บีท'
  // เพราะจะทำให้ guard test จับผิดแล้วแก้ไม่จบ
  'บั๊บ', 'บัป', 'บัพ',
  'บิท',
  'ไบท', 'ไบท์', 'ไบท๊', 'ไบด์', 'ไบช์',
  'ไบ๊ท์', 'ไบ๊ท', 'ไบ๊ด์',
]

/**
 * เรียงจาก "ยาวไปสั้น" เสมอ — กันแทนที่ทับซ้อนผิด
 * เช่น ต้องแทน "ไบ๊ท์มีเบบี้" ก่อน ไม่งั้นจะโดนแทน "ไบ๊ท์" ทิ้งครึ่งหนึ่ง
 */
const REPLACEMENTS: readonly [string, string][] = [
  ['ไบ๊ท์มีเบบี้', BRAND_TH],
  ['ไบท์มีเบบี้', BRAND_TH],
  ['ไบทมีเบบี้', BRAND_TH],
  ['บิทมีเบบี้', BRAND_TH],
  ['Bite Me Baby', BRAND_TH],
  ['ไบ๊ท์', MASCOT_TH],
  ['ไบ๊ด์', MASCOT_TH],
  ['ไบ๊ท', MASCOT_TH],
  ['ไบท์', MASCOT_TH],
  ['ไบท๊', MASCOT_TH],
  ['ไบด์', MASCOT_TH],
  ['ไบช์', MASCOT_TH],
  ['ไบท', MASCOT_TH],
  ['บั๊บ', MASCOT_TH],
  ['บัป', MASCOT_TH],
  ['บัพ', MASCOT_TH],
  // ⚠️ ห้ามใส่ 'บับ' / 'บิด' / 'บิต' ตรงนี้ — ชนกับคำไทยปกติ
  // (บับเบิล · บิด/บิดมือ · เครดิต/เดบิต) ถ้าใส่ runtime จะแปลงคำผิด
  ['บิท', MASCOT_TH],
]

export function normalizeBrandNames(text: string): string {
  if (!text) return text
  let out = text
  for (const [from, to] of REPLACEMENTS) {
    if (out.includes(from)) out = out.split(from).join(to)
  }
  // กัน "ไบ๊" ซ้อนจากการแทนที่หลายชั้น
  while (out.includes(MASCOT_TH + MASCOT_TH)) {
    out = out.split(MASCOT_TH + MASCOT_TH).join(MASCOT_TH)
  }
  return out
}

export function containsWrongMascotName(text: string): boolean {
  if (!text) return false
  return BANNED_MASCOT_NAMES.some((n) => text.includes(n))
}

/**
 * ความยาวที่ต้อง "กันไว้" ท้ายบัฟเฟอร์ระหว่าง stream
 *
 * เหตุผล: ชื่อแบรนด์อาจถูกตัดข้าม delta ได้ เช่น delta1="บั" delta2="๊บ"
 * ถ้าปล่อยออกทันที ผู้ใช้จะเห็นข้อความแตกและ sanitizer จับไม่ได้
 * ค่านี้ยาวกว่า string ที่ยาวที่สุดใน REPLACEMENTS ("ไบ๊ท์มีเบบี้" = 11 ตัว)
 */
export const STREAM_HOLD_CHARS = 16

/**
 * ใช้กับ SSE streaming: เก็บท้ายบัฟเฟอร์ไว้ แล้วปล่อยเฉพาะส่วนที่
 * "ปลอดภัยแล้ว" — เรียกทุกครั้งที่ได้ delta ใหม่
 *
 * @param carry  บัฟเฟอร์สะสม (ส่งกลับเข้าไปรอบถัดไป)
 * @param delta  chunk ใหม่จาก upstream
 * @param flush  true = สตรีมจบ → ปล่อยทุกอย่างที่เหลือ
 * @returns      ข้อความที่ปลอดภัยพร้อมส่งต่อ (อาจเป็น '' ถ้ายังต้องกักไว้)
 */
export function sanitizeStreamChunk(
  carry: string,
  delta: string,
  flush = false,
): { emit: string; carry: string } {
  const buffered = normalizeBrandNames(carry + delta)
  if (flush) return { emit: buffered, carry: '' }
  if (buffered.length <= STREAM_HOLD_CHARS) return { emit: '', carry: buffered }
  const cut = buffered.length - STREAM_HOLD_CHARS
  return { emit: buffered.slice(0, cut), carry: buffered.slice(cut) }
}

/** ข้อความ system prompt สั้น ๆ ให้ต่อท้าย prompt ทุกจุด (คู่กับ sanitizer) */
export function mascotNameRule(): string {
  return (
    `BRAND NAME RULES (ห้ามฝ่าฝืนเด็ดขาด — เขียนทับศัพท์ตรง ๆ): ` +
    `ชื่อคุณ = "${MASCOT_TH}" · ชื่อร้าน = "${BRAND_TH}" · ` +
    `ห้ามเขียน/ออกเสียงว่า "บั๊บ" "บิท" "ไบท" "ไบท์" "ไบท๊" หรือชื่ออื่นใดโดยเด็ดขาด ` +
    `ถ้าผู้ใช้เรียกชื่อคุณผิด ให้ตอบสั้น ๆ ว่า "${MASCOT_TH} ครับ" แล้วไปต่อ`
  )
}

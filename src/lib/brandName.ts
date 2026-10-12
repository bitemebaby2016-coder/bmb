// ============================================
// Bite Me Baby — ชื่อแบรนด์/มาสคอต (single source of truth)
// ============================================
// ทำไมต้องมีไฟล์นี้ (Owner สั่ง 2026-10-12):
//   โมเดล AI "มั่ว" ชื่อตัวเองบ่อยครั้ง — เคยออกเสียงเป็น "บั๊บ" / "บิท"
//   ทั้งที่ prompt บอกชัดเจนแล้ว
//   ⇒ **prompt อย่างเดียว "บังคับ" โมเดลไม่ได้**
//      ต้องมี sanitizer ฝั่งโค้ดที่แก้ "ก่อน" แสดงผลเสมอ
//
// กฎที่ Owner บังคับ (2026-10-12):
//   * ชื่อมาสคอต = "ไบ๊" เสมอ (ทับศัพท์ตรง ๆ ห้ามเติม "ท์")
//   * ชื่อร้านในภาษาไทย = "ไบ๊มีเบบี้" เสมอ
//   * ห้ามใช้ "บั๊บ" "บิท" "ไบท" "ไบท์" "ไบท๊" "Bai" แทนชื่อในประโยคไทย
// ============================================

/** ชื่อมาสคอต/พนักงานเสิร์ฟ — สะกดที่ถูกต้องเพียงแบบเดียว */
export const MASCOT_TH = 'ไบ๊'

/** ชื่อร้านในประโยคภาษาไทย */
export const BRAND_TH = 'ไบ๊มีเบบี้'

/**
 * ชื่อ/การออกเสียงที่ "ห้ามใช้" — ทั้งหมดเคยถูกโมเดลหรือโค้ดสร้างขึ้นจริง
 * และเป็นที่มารายงานของ Owner ว่า "มั่ว"
 */
export const BANNED_MASCOT_NAMES: readonly string[] = [
  // ⚠️ คัดเฉพาะชื่อที่ "ไม่ชน" กับคำไทยปกติเท่านั้น
  // ห้ามใส่ 'บิต' (⊂ เครดิต/เดบิต) · 'บับ' (⊂ บับเบิล) · 'บิด' · 'บีท'
  // เพราะจะทำให้ guard test จับผิดแล้วแก้ไม่จบ
  'บั๊บ', 'บัป', 'บัพ',
  'บิท',
  'ไบท', 'ไบท์', 'ไบท๊', 'ไบด์', 'ไบช์',
  'ไบ๊ท์', 'ไบ๊ท', 'ไบ๊ด์',
]

/** รายการแทนที่ — ทำจากสั้นไปยาวเพื่อกันแทนที่ทับซ้อนผิด */
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

/** ตรวจว่าข้อความมีชื่อผิดหรือไม่ (ใช้ตอน assert ใน test) */
export function containsWrongMascotName(text: string): boolean {
  if (!text) return false
  return BANNED_MASCOT_NAMES.some((n) => text.includes(n))
}

/**
 * แก้ชื่อมาสคอต/แบรนด์ให้ถูกต้อง — **เรียกทุกครั้งก่อนแสดงผล**
 *
 * นี่คือกลไกหลักที่ทำให้ "บังคับ" ได้จริง ไม่ใช่แค่หวังพึ่ง prompt
 * (prompt = ความน่าจะเป็น · sanitizer = ต้องถูกทุกครั้ง)
 */
export function normalizeBrandNames(text: string): string {
  if (!text) return text
  let out = text
  for (const [from, to] of REPLACEMENTS) {
    // ใช้ split/join แทน regex — กันปัญหา escaping และ surrogate pairs
    if (out.includes(from)) out = out.split(from).join(to)
  }
  // กันกรณี "ไบ๊" ซ้อนกันจากการแทนที่หลายชั้น (เช่น ไบ๊ท์ → ไบ๊ แล้วเจอ ไบ๊ อีก)
  while (out.includes(MASCOT_TH + MASCOT_TH)) {
    out = out.split(MASCOT_TH + MASCOT_TH).join(MASCOT_TH)
  }
  return out
}

/**
 * ข้อความ system prompt สั้น ๆ เกี่ยวกับชื่อ — ใช้ต่อท้าย prompt ทุกจุด
 * (คู่กับ sanitizeBrandNames: prompt บอกให้ถูก + sanitizer บังคับให้ถูก)
 */
export function mascotNameRule(): string {
  return (
    `BRAND NAME RULES (ห้ามฝ่าฝืนเด็ดขาด — เขียนทับศัพท์ตรง ๆ): ` +
    `ชื่อคุณ = "${MASCOT_TH}" · ชื่อร้าน = "${BRAND_TH}" · ` +
    `ห้ามเขียน/ออกเสียงว่า "บั๊บ" "บิท" "ไบท" "ไบท์" "ไบท๊" หรือชื่ออื่นใดโดยเด็ดขาด ` +
    `ถ้าผู้ใช้เรียกชื่อคุณผิด ให้ตอบสั้น ๆ ว่า "${MASCOT_TH} ครับ" แล้วไปต่อ`
  )
}

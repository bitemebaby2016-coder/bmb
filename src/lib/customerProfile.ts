// ============================================
// Bite Me Baby — Customer CRM profile (birthday + consent)
// R73g: UI เก็บวันเกิด + ความยินยอมรับข้อความ CRM (m192/m193)
//   - birthday    = วัน/เดือน สำหรับคำอวยพร (crm_birthday_scan · category Marketing)
//   - crm_consent = ยินยอมรับข้อความ CRM in-app · default false = ยังไม่รับอะไรเลย
//   เขียนผ่าน RLS customers_own_update (m163 · user_id = auth.uid()) — ไม่มีช่องทาง
//   เขียนโดยไม่ผูกเจ้าของ · ไม่แตะ business rules/ราคา/คำสั่งซื้อ
// ============================================
import { supabase } from './supabase'

export interface MyCrmProfile {
  birthday: string | null
  crm_consent: boolean
}

/** validate วันเกิด (YYYY-MM-DD): ต้องเป็นวันในอดีต · ปีสมเหตุสมผล — คืน null = ผ่าน */
export function validateBirthday(value: string | null | undefined): string | null {
  const v = String(value || '').trim()
  if (!v) return null // ว่าง = ยังไม่ตั้ง = ผ่าน
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return 'รูปแบบวันที่ไม่ถูกต้อง'
  const d = new Date(v + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return 'วันที่ไม่ถูกต้อง'
  if (d.getTime() > Date.now()) return 'วันเกิดต้องไม่เป็นวันในอนาคต'
  if (d.getFullYear() < 1900) return 'ปีที่กรอกไม่สมเหตุสมผล'
  return null
}

/** อ่านค่า birthday/consent ของฉัน (แถว customers ผูก user_id = auth.uid()) */
export async function fetchMyCrmProfile(): Promise<MyCrmProfile | null> {
  try {
    const uid = (await supabase.auth.getSession()).data.session?.user?.id ?? null
    if (!uid) return null
    const { data, error } = await supabase
      .from('customers')
      .select('birthday, crm_consent')
      .eq('user_id', uid)
      .maybeSingle()
    if (error || !data) return null
    const row = data as { birthday?: string | null; crm_consent?: boolean }
    return { birthday: row.birthday ?? null, crm_consent: Boolean(row.crm_consent) }
  } catch {
    return null
  }
}

/** บันทึก birthday/consent — เฉพาะแถวของตัวเอง (RLS บังคับซ้ำอีกชั้น) */
export async function saveMyCrmProfile(input: MyCrmProfile): Promise<{ ok: boolean; error?: string }> {
  const invalid = validateBirthday(input.birthday)
  if (invalid) return { ok: false, error: invalid }
  try {
    const uid = (await supabase.auth.getSession()).data.session?.user?.id ?? null
    if (!uid) return { ok: false, error: 'ยังไม่ได้เข้าสู่ระบบ' }
    const { error } = await supabase
      .from('customers')
      .update({
        birthday: input.birthday || null,
        crm_consent: !!input.crm_consent,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', uid)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e instanceof Error ? e.message : e).slice(0, 200) }
  }
}
// ============================================
// Bite Me Baby — Phone number profile management
// R130: เพิ่ม/แก้ไขเบอร์โทรศัพท์ใน ProfilePage + AdminCustomers
//   - validate Thai phone format → E.164
//   - update via supabase.auth.updateUser({ phone }) for official auth.users.phone
//   - fallback: update user_metadata.phone if Supabase phone provider not configured
// ============================================
import { supabase } from './supabase'

/** Validate Thai phone number and convert to E.164 format (+66XXXXXXXXX) */
export function validateAndNormalizePhone(input: string): { valid: boolean; e164?: string; error?: string } {
  const raw = String(input || '').trim()
  if (!raw) return { valid: false, error: 'กรุณากรอกเบอร์โทรศัพท์' }
  
  // Remove all non-digits
  const digits = raw.replace(/\D/g, '')
  
  // Thai mobile: 0XXXXXXXXX (10 digits) or 9 digits starting with 1-9
  if (digits.length === 10 && digits.startsWith('0')) {
    return { valid: true, e164: '+66' + digits.slice(1) }
  }
  if (digits.length === 9 && /^[1-9]\d{8}$/.test(digits)) {
    return { valid: true, e164: '+66' + digits }
  }
  
  // Already E.164 format
  if (raw.startsWith('+66') && digits.length === 11) {
    return { valid: true, e164: '+' + digits }
  }
  
  return { valid: false, error: 'รูปแบบเบอร์โทรไม่ถูกต้อง — ใช้ 0XXXXXXXXX หรือ +66XXXXXXXXX' }
}

/** Update phone number via Supabase Auth (official auth.users.phone) */
export async function updateMyPhone(phoneE164: string): Promise<{ ok: boolean; error?: string; needsVerification?: boolean }> {
  try {
    const { error } = await supabase.auth.updateUser({ phone: phoneE164 })
    if (error) {
      // If phone provider not configured, fallback to metadata
      if (error.message.includes('phone') || error.message.includes('Phone')) {
        return updatePhoneMetadata(phoneE164)
      }
      return { ok: false, error: error.message }
    }
    // Supabase will send SMS OTP if autoconfirm is false
    return { ok: true, needsVerification: true }
  } catch (e) {
    return { ok: false, error: String(e instanceof Error ? e.message : e).slice(0, 200) }
  }
}

/** Fallback: update user_metadata.phone (for display only, not for OTP login) */
async function updatePhoneMetadata(phoneE164: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabase.auth.updateUser({
      data: { phone: phoneE164 }
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e instanceof Error ? e.message : e).slice(0, 200) }
  }
}

/** Get current phone from auth user */
export async function fetchMyPhone(): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    return user.phone || user.user_metadata?.phone || null
  } catch {
    return null
  }
}
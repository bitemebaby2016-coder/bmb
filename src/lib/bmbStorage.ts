// ============================================
// Bite Me Baby Storage Layer
// ใช้ localStorage เป็น data store (แทน Supabase ในระยะแรก)
// Prefix: bmb_ เพื่อป้องกันทับกับโปรเจคอื่น
// ============================================

const PREFIX = 'bmb_'

export function storageGet<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (raw === null) return defaultValue
    return JSON.parse(raw) as T
  } catch {
    return defaultValue
  }
}

export function storageSet<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch (e) {
    console.error('bmbStorageSet failed:', e)
  }
}

export function storageRemove(key: string): void {
  localStorage.removeItem(PREFIX + key)
}

export function storageClear(): void {
  const keys = Object.keys(localStorage)
    .filter((k) => k.startsWith(PREFIX))
  keys.forEach((k) => localStorage.removeItem(k))
}

// Image upload helper - convert to base64 for localStorage
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Generate unique ID
export function generateId(prefix: string = 'id'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

// ============================================
// Secure Password Hashing using bcrypt
// Production-ready password security
// ============================================
import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 12

/**
 * Hash a password using bcrypt with configurable salt rounds
 * @param password - Plain text password to hash
 * @returns bcrypt hashed password (with embedded salt)
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(SALT_ROUNDS)
  return await bcrypt.hash(password, salt)
}

/**
 * Verify a password against a bcrypt hash
 * @param password - Plain text password to verify
 * @param hash - bcrypt hash to compare against
 * @returns true if password matches the hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash)
}
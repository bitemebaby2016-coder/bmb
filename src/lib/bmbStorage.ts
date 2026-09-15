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

// Simple hash for passwords (NOT for production - use bcrypt on server)
export function hashPassword(password: string): string {
  let hash = 0
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return `h_${Math.abs(hash).toString(36)}_${password.length}`
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash
}
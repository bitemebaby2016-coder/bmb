// ============================================
// Bite Me Baby Storage Layer
// Local storage wrapper for non-critical UI state
// All business/auth data lives in Supabase
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
  // Remove only our prefixed keys safely
  try {
    if (typeof localStorage !== 'undefined' && localStorage.hasOwnProperty('getItem')) {
      const keys: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith(PREFIX)) keys.push(key)
      }
      keys.forEach((k) => localStorage.removeItem(k))
    }
  } catch {
    localStorage.clear()
  }
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
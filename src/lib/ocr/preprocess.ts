// ============================================
// Bite Me Baby — Image preprocessing for OCR (Owner §3: ~1,500–2,000 px)
// Browser-only (canvas / createImageBitmap). No deps.
// ============================================

export interface PreprocessedImage {
  base64: string
  mime: string
  width: number
  height: number
}

/** Longest edge target (Owner: ~1,500–2,000 px). */
export const OCR_MAX_DIM = 1600

export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result))
    fr.onerror = () => reject(new Error('file_read_failed'))
    fr.readAsDataURL(file)
  })
}

/**
 * Resize so the longest edge ≤ OCR_MAX_DIM, re-encode as JPEG (quality 0.82).
 * Returns base64 (no data: prefix) + mime + dims. Falls back to the original
 * data URL if canvas is unavailable (e.g. non-browser test env).
 */
export async function preprocessImage(file: Blob, maxDim = OCR_MAX_DIM): Promise<PreprocessedImage> {
  const dataUrl = await fileToDataUrl(file)
  if (typeof document === 'undefined' || typeof createImageBitmap === 'undefined') {
    const b64 = dataUrl.replace(/^data:[^,]+,/, '')
    return { base64: b64, mime: 'image/jpeg', width: 0, height: 0 }
  }
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height))
  const w = Math.round(bmp.width * scale)
  const h = Math.round(bmp.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    const b64 = dataUrl.replace(/^data:[^,]+,/, '')
    return { base64: b64, mime: 'image/jpeg', width: bmp.width, height: bmp.height }
  }
  ctx.drawImage(bmp, 0, 0, w, h)
  const out = canvas.toDataURL('image/jpeg', 0.82)
  const base64 = out.replace(/^data:[^,]+,/, '')
  return { base64, mime: 'image/jpeg', width: w, height: h }
}

/** SHA-256 hex of a base64 image (duplicate detection). Uses Web Crypto. */
export async function hashImage(base64: string): Promise<string> {
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}
// Shared SMS helpers (W-2.3) — pure TS, importable by Edge Functions and vitest.
/** Thai mobile normalisation: keep leading 0, +66xx → 0xx; else passthrough. */
export function normalizeThaiPhone(raw: string): string {
  const t = (raw || '').replace(/[^\d+]/g, '')
  if (/^\+66\d{8,9}$/.test(t)) return '0' + t.slice(3)
  return t
}

/** Mask a phone for logs/responses: 0812345678 → 081***5678 */
export function maskPhone(raw: string): string {
  return (raw || '').replace(/(\d{3})\d{3}(\d{3,4})/, '$1***$2')
}
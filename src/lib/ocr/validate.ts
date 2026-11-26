// ============================================
// Bite Me Baby — OCR field validation (Owner §4 Data Accuracy)
// Pure functions, no deps. Programmatic subtotal/tax/total + qty×price checks.
// Unclear values are null + needsReview — never guessed.
// ============================================
import type { FieldValidation, OcrFields, OcrLine } from './types'

const EPS = 0.02

export const LOW_CONFIDENCE = 0.6

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/** Validate a single line's qty × unit_price ≈ line_total. */
export function validateLine(line: OcrLine): { errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []
  const q = num(line.quantity)
  const p = num(line.unit_price)
  const t = num(line.line_total)
  if (q !== null && p !== null && t !== null) {
    const calc = q * p
    if (Math.abs(calc - t) > EPS) {
      errors.push(`line "${line.description}": qty×price=${calc.toFixed(2)} ≠ line_total=${t.toFixed(2)}`)
    }
  }
  if (line.confidence < LOW_CONFIDENCE) {
    warnings.push(`line "${line.description}": low confidence (${line.confidence.toFixed(2)}) — needs review`)
  }
  return { errors, warnings }
}

/**
 * Full programmatic validation of extracted fields.
 * - subtotal + tax ≈ total (when all present)
 * - each line qty×price ≈ line_total
 * - any low-confidence field / null total ⇒ needsReview
 */
export function validateOcrFields(fields: OcrFields): FieldValidation {
  const errors: string[] = []
  const warnings: string[] = []
  const fieldConfidence: Record<string, number> = {}

  const subtotal = num(fields.subtotal)
  const tax = num(fields.tax)
  const total = num(fields.total)

  if (subtotal !== null && tax !== null && total !== null) {
    const calc = subtotal + tax
    if (Math.abs(calc - total) > EPS) {
      errors.push(`subtotal(${subtotal.toFixed(2)}) + tax(${tax.toFixed(2)}) = ${calc.toFixed(2)} ≠ total(${total.toFixed(2)})`)
    }
    fieldConfidence.totals = 1
  } else {
    warnings.push('subtotal/tax/total incomplete — needs review')
    fieldConfidence.totals = 0.5
  }

  const lines = Array.isArray(fields.lines) ? fields.lines : []
  let minLineConf = 1
  for (const line of lines) {
    const r = validateLine(line)
    errors.push(...r.errors)
    warnings.push(...r.warnings)
    minLineConf = Math.min(minLineConf, typeof line.confidence === 'number' ? line.confidence : 0)
  }
  if (lines.length > 0) fieldConfidence.lines = minLineConf
  else warnings.push('no line items extracted — needs review')

  if (total === null) warnings.push('total is null — needs review')

  const needsReview = warnings.length > 0 || errors.length > 0 || fieldConfidence.totals < LOW_CONFIDENCE
  return { ok: errors.length === 0, errors, warnings, fieldConfidence, needsReview }
}

/** True when any field/line is unclear and a human must review before approval. */
export function needsReview(fields: OcrFields): boolean {
  return validateOcrFields(fields).needsReview
}
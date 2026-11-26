// ============================================
// OCR unit/contract tests (Phase 2 Cost Intelligence)
// Mock is used ONLY here (unit/contract) — never as production evidence.
// ============================================
import { describe, it, expect } from 'vitest'
import { validateOcrFields, needsReview, validateLine } from '../lib/ocr/validate'
import { scoreMatch, matchSupplier, matchIngredient, normalizeName } from '../lib/ocr/match'
import { parseCsv, parseCsvToLines, matrixToLines } from '../lib/ocr/import'
import { TASK_POLICY, MODEL_OCR_PRIMARY, MODEL_OCR_FALLBACK } from '../../supabase/functions/_shared/aiPolicy.ts'

describe('OCR validation (Owner §4)', () => {
  it('passes when subtotal + tax = total and lines reconcile', () => {
    const r = validateOcrFields({
      subtotal: 100, tax: 7, total: 107,
      lines: [{ description: 'x', quantity: 2, unit: 'pc', unit_price: 50, line_total: 100, confidence: 0.95 }],
    })
    expect(r.ok).toBe(true)
    expect(r.errors).toHaveLength(0)
  })

  it('errors when subtotal + tax ≠ total', () => {
    const r = validateOcrFields({ subtotal: 100, tax: 7, total: 200, lines: [] })
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toMatch(/≠ total/)
  })

  it('errors when qty×price ≠ line_total', () => {
    const r = validateLine({ description: 'a', quantity: 3, unit: null, unit_price: 10, line_total: 999, confidence: 1 })
    expect(r.errors.join(' ')).toMatch(/qty×price/)
  })

  it('flags low confidence + null total as needsReview (never guessed)', () => {
    const r = validateOcrFields({ total: null, lines: [{ description: 'a', quantity: null, unit: null, unit_price: null, line_total: null, confidence: 0.3 }] })
    expect(r.needsReview).toBe(true)
    expect(r.warnings.join(' ')).toMatch(/low confidence/)
  })

  it('needsReview() mirrors validateOcrFields', () => {
    expect(needsReview({ total: 10, subtotal: 10, tax: 0, lines: [{ description: 'x', quantity: 1, unit: null, unit_price: 10, line_total: 10, confidence: 1 }] })).toBe(false)
  })
})

describe('OCR matching (suggest only)', () => {
  it('normalizes Thai/Latin case + punctuation', () => {
    expect(normalizeName('  ACME  Co., Ltd ')).toBe('acme co ltd')
  })
  it('scores exact=1, contains=0.85, none=0', () => {
    expect(scoreMatch('acme', 'acme')).toBe(1)
    expect(scoreMatch('acme', 'acme foods')).toBe(0.85)
    expect(scoreMatch('acme', 'zzz')).toBe(0)
  })
  it('ranks supplier candidates desc', () => {
    const c = matchSupplier('acme foods', [{ id: '1', name: 'acme foods' }, { id: '2', name: 'other' }])
    expect(c[0].id).toBe('1')
  })
  it('ranks ingredient candidates', () => {
    const c = matchIngredient('chicken', [{ id: 'a', name: 'chicken breast' }])
    expect(c[0].id).toBe('a')
  })
})

describe('CSV / Excel import', () => {
  it('parses quoted commas', () => {
    expect(parseCsv('a,"b,c",d')).toEqual([['a', 'b,c', 'd']])
  })
  it('maps headered rows to purchase lines', () => {
    const lines = parseCsvToLines('description,qty,unit,unit_price,line_total\nRice,2,bag,100,200')
    expect(lines[0]).toMatchObject({ description: 'Rice', quantity: 2, unit: 'bag', unit_price: 100, line_total: 200 })
  })
  it('falls back to positional order without header', () => {
    const lines = matrixToLines([['Milk', '1', 'carton', '50', '50']])
    expect(lines[0].description).toBe('Milk')
    expect(lines[0].unit_price).toBe(50)
  })
})

describe('AI policy — OCR task (Owner §3)', () => {
  it('GLM 5.3 Flash primary / Qwen fallback, ACTIVE, bounded', () => {
    expect(TASK_POLICY.ocr_extract.primary).toBe('z-ai/glm-5.3-flash')
    expect(TASK_POLICY.ocr_extract.fallback).toBe('qwen/qwen3.7-flash')
    expect(TASK_POLICY.ocr_extract.status).toBe('ACTIVE')
    expect(TASK_POLICY.ocr_extract.maxTokens).toBeLessThanOrEqual(3000)
    expect(MODEL_OCR_PRIMARY).toBe('z-ai/glm-5.3-flash')
    expect(MODEL_OCR_FALLBACK).toBe('qwen/qwen3.7-flash')
  })
})
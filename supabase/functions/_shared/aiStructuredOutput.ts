// ============================================
// Bite Me Baby — Structured Output Contract (G5, STEP 6 / F4 fix)
// ============================================
// Generic LLM-output validation layer for G6/G7 and machine-consumed paths.
// Principle: LLM output is UNTRUSTED DATA — HTTP 200 alone is never "valid".
//   LLM output → parse → schema validate → accept / reject (fail-closed)
// Pure TS (Deno + browser + vitest compatible), zero dependencies.

export type FieldType = 'string' | 'number' | 'boolean' | 'array' | 'object'

export interface FieldSpec {
  type: FieldType
  required?: boolean
  /** Restrict allowed values (invalid enum/value → reject). */
  enumValues?: ReadonlyArray<string | number>
  minItems?: number
  maxItems?: number
}

/** Schema = flat field map; unknown extra keys are allowed (ignored). */
export type SchemaSpec = Record<string, FieldSpec>

export type StructuredResult<T = Record<string, unknown>> =
  | { ok: true; value: T }
  | { ok: false; reason: string }

/**
 * Pull the first complete JSON value (object/array) out of a raw LLM string.
 * Handles markdown fences / prose wrappers / trailing text.
 */
export function extractJson(text: string): unknown {
  if (typeof text !== 'string' || text.trim() === '') return undefined
  const cleaned = text.replace(/```(?:json)?/gi, '')
  const start = cleaned.search(/[[{]/)
  if (start === -1) return undefined
  const open = cleaned[start]
  const close = open === '[' ? ']' : '}'
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i]
    if (inStr) {
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') inStr = true
    else if (ch === open) depth++
    else if (ch === close) {
      depth--
      if (depth === 0) {
        try {
          return JSON.parse(cleaned.slice(start, i + 1))
        } catch {
          return undefined
        }
      }
    }
  }
  return undefined
}

function typeOf(v: unknown): FieldType | 'null' | 'other' {
  if (v === null || v === undefined) return 'null'
  if (Array.isArray(v)) return 'array'
  if (typeof v === 'string') return 'string'
  if (typeof v === 'number') return Number.isFinite(v) ? 'number' : 'other'
  if (typeof v === 'boolean') return 'boolean'
  if (typeof v === 'object') return 'object'
  return 'other'
}

/**
 * Validate a parsed value against the schema (fail-closed):
 * missing required field / wrong type / invalid enum / empty container → reject.
 *
 * opts.rejectUnknown (additive, G7-S3): when true, keys NOT in the schema cause
 * rejection instead of being silently ignored. Default false = exact previous
 * behavior for existing G5/G6 callers (behavior-preserving).
 */
export function validateStructured(
  raw: unknown,
  schema: SchemaSpec,
  opts: { rejectUnknown?: boolean } = {}
): StructuredResult {
  if (typeOf(raw) !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, reason: 'not_an_object' }
  }
  const value: Record<string, unknown> = {}
  const obj = raw as Record<string, unknown>
  if (opts.rejectUnknown) {
    const allowed = new Set(Object.keys(schema))
    for (const key of Object.keys(obj)) {
      if (!allowed.has(key)) return { ok: false, reason: `unknown_field:${key}` }
    }
  }
  for (const [key, spec] of Object.entries(schema)) {
    const v = obj[key]
    const t = typeOf(v)
    if (t === 'null' || t === 'other') {
      if (spec.required) return { ok: false, reason: `missing_required_field:${key}` }
      continue
    }
    if (t !== spec.type) return { ok: false, reason: `wrong_type:${key}:expected_${spec.type}_got_${t}` }
    if (spec.enumValues && !spec.enumValues.includes(v as string | number)) {
      return { ok: false, reason: `invalid_value:${key}` }
    }
    if (spec.type === 'array') {
      const arr = v as unknown[]
      if (spec.minItems !== undefined && arr.length < spec.minItems) {
        return { ok: false, reason: `too_few_items:${key}` }
      }
      if (spec.maxItems !== undefined && arr.length > spec.maxItems) {
        return { ok: false, reason: `too_many_items:${key}` }
      }
    }
    value[key] = v
  }
  return { ok: true, value }
}

/** Full pipeline: raw LLM text → parsed → validated. Never throws. */
export function parseStructuredOutput(
  text: string,
  schema: SchemaSpec,
  opts: { rejectUnknown?: boolean } = {}
): StructuredResult {
  const raw = extractJson(text)
  if (raw === undefined) return { ok: false, reason: 'malformed_json_or_empty' }
  return validateStructured(raw, schema, opts)
}

/** Validate a JSON ARRAY of objects against an item schema (fail-closed). */
export function validateStructuredList(
  raw: unknown,
  itemSchema: SchemaSpec,
  opts: { minItems?: number; maxItems?: number } = {}
): StructuredResult<Record<string, unknown>[]> {
  if (!Array.isArray(raw)) return { ok: false, reason: 'not_an_array' }
  if (opts.minItems !== undefined && raw.length < opts.minItems) {
    return { ok: false, reason: 'too_few_items:root' }
  }
  if (opts.maxItems !== undefined && raw.length > opts.maxItems) {
    return { ok: false, reason: 'too_many_items:root' }
  }
  const items: Record<string, unknown>[] = []
  for (let i = 0; i < raw.length; i++) {
    const res = validateStructured(raw[i], itemSchema)
    if (!res.ok) return { ok: false, reason: `item_${i}:${res.reason}` }
    items.push(res.value)
  }
  return { ok: true, value: items }
}

/** Full pipeline for list outputs: raw LLM text → parsed → item-validated. Never throws. */
export function parseStructuredListOutput(
  text: string,
  itemSchema: SchemaSpec,
  opts: { minItems?: number; maxItems?: number } = {}
): StructuredResult<Record<string, unknown>[]> {
  const raw = extractJson(text)
  if (raw === undefined) return { ok: false, reason: 'malformed_json_or_empty' }
  return validateStructuredList(raw, itemSchema, opts)
}

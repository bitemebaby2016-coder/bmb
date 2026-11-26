// ============================================
// Bite Me Baby — OCR service (client → ai-proxy ocr_extract → structured JSON)
// Owner §3: OpenRouter Vision, GLM 5.3 Flash primary / Qwen fallback (server
// policy), structured JSON, reasoning off, image ~1,600 px.
// NEVER writes to the DB — returns extracted fields for human review only.
// ============================================
import { supabase } from './supabase'
import { extractJson } from '../../supabase/functions/_shared/aiStructuredOutput.ts'
import type { OcrFields } from './ocr/types'

export const OCR_PROMPT_VERSION = 'ocr-v1'

export interface OcrExtractResult {
  fields: OcrFields
  raw: unknown
  model: string | null
  promptVersion: string
}

/**
 * Run OCR on a preprocessed image (base64, no data: prefix).
 * Throws on transport/upstream failure — callers must degrade to manual entry.
 */
export async function extractOcr(imageBase64: string, mimeType = 'image/jpeg'): Promise<OcrExtractResult> {
  const { data, error } = await supabase.functions.invoke('ai-proxy', {
    body: { task: 'ocr_extract', imageBase64, mimeType },
  })
  if (error) throw new Error(`ocr_proxy_error: ${error.message || 'invoke_failed'}`)
  const content: string | undefined = data?.data?.choices?.[0]?.message?.content
  if (!content) throw new Error('ocr_empty_content')
  const parsed = extractJson(content)
  if (parsed === undefined || typeof parsed !== 'object') throw new Error('ocr_malformed_json')
  const fields = parsed as OcrFields
  return {
    fields,
    raw: parsed,
    model: data?.routing?.model ?? null,
    promptVersion: OCR_PROMPT_VERSION,
  }
}
// ============================================
// Bite Me Baby — Content approval workflow (CNT-01, migration 022)
// "ห้าม auto-publish" — any promotional/announcement content must pass an
// explicit admin approval before the publish gate opens.
// ============================================

import { supabase } from './supabase'

export type ContentApprovalStatus = 'pending' | 'approved' | 'rejected'
export type ContentType = 'promotion' | 'banner' | 'post' | 'announcement'

export interface ContentApprovalRow {
  id: string
  content_type: ContentType
  title: string
  body: string
  status: ContentApprovalStatus
  created_by: string
  created_at: string
  image_url?: string | null
  mascot?: string | null
  reviewer_id?: string | null
  reviewed_at?: string | null
  review_note?: string | null
}

/** Pure publish gate — the ONLY check content automation may use. */
export function canPublish(status: ContentApprovalStatus | undefined): boolean {
  return status === 'approved'
}

/** Submit content for human review (never auto-published). Rich content: body
 *  (รายละเอียด), image_url (ลิงก์/รูปที่อัปโหลด) และ mascot (ท่ามาสคอต). */
export async function submitContentForApproval(
  contentType: ContentType,
  title: string,
  body = '',
  imageUrl?: string,
  mascot?: string,
): Promise<string | null> {
  const { data, error } = await supabase.rpc('submit_content_for_approval', {
    p_content_type: contentType,
    p_title: title,
    p_body: body,
    p_image_url: imageUrl ?? null,
    p_mascot: mascot ?? null,
  })
  if (error) return null
  return (data as unknown as { id: string }).id ?? null
}

/** Admin review: approve or reject a pending submission. */
export async function reviewContent(id: string, decision: ContentApprovalStatus, note = ''): Promise<boolean> {
  const { error } = await supabase.rpc('review_content', { p_approval_id: id, p_decision: decision, p_note: note })
  return !error
}

/** Read my submissions + admin sees all (RLS). Supports status filter and pagination. */
export async function listContentApprovals(opts?: {
  status?: ContentApprovalStatus
  limit?: number
  offset?: number
}): Promise<ContentApprovalRow[]> {
  let query = supabase
    .from('content_approvals')
    .select('id,content_type,title,body,status,created_by,created_at,image_url,mascot,reviewer_id,reviewed_at,review_note')
    .order('created_at', { ascending: false })

  if (opts?.status) {
    query = query.eq('status', opts.status)
  }
  if (opts?.limit) {
    query = query.limit(opts.limit)
  }
  if (opts?.offset) {
    query = query.range(opts.offset, opts.offset + (opts.limit || 50) - 1)
  }

  const { data, error } = await query
  if (error) return []
  return (data ?? []) as ContentApprovalRow[]
}
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
}

/** Pure publish gate — the ONLY check content automation may use. */
export function canPublish(status: ContentApprovalStatus | undefined): boolean {
  return status === 'approved'
}

/** Submit content for human review (never auto-published). */
export async function submitContentForApproval(contentType: ContentType, title: string, body = ''): Promise<string | null> {
  const { data, error } = await supabase.rpc('submit_content_for_approval', {
    p_content_type: contentType,
    p_title: title,
    p_body: body,
  })
  if (error) return null
  return (data as unknown as { id: string }).id ?? null
}

/** Admin review: approve or reject a pending submission. */
export async function reviewContent(id: string, decision: ContentApprovalStatus, note = ''): Promise<boolean> {
  const { error } = await supabase.rpc('review_content', { p_approval_id: id, p_decision: decision, p_note: note })
  return !error
}

/** Read my submissions + admin sees all (RLS). */
export async function listContentApprovals(): Promise<ContentApprovalRow[]> {
  const { data, error } = await supabase
    .from('content_approvals')
    .select('id,content_type,title,body,status,created_by,created_at')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) return []
  return (data ?? []) as ContentApprovalRow[]
}
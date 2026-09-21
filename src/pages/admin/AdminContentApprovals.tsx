// ============================================
// Admin — Content Approvals (CNT-01, migration 022, PHASE 7 completeness)
// Submit + review workflow: nothing publishes automatically; an item is
// live only after an admin approves it (canPublish gate).
// ============================================

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { showToast } from '@/components/ui/ToastContainer'
import { submitContentForApproval, reviewContent, listContentApprovals, canPublish, type ContentApprovalRow } from '@/lib/contentApproval'

const TYPE_LABEL: Record<string, string> = {
  promotion: 'Promotion',
  banner: 'Banner',
  post: 'Post',
  announcement: 'Announcement',
}

export function AdminContentApprovals() {
  const [rows, setRows] = useState<ContentApprovalRow[]>([])
  const [contentType, setContentType] = useState<ContentApprovalRow['content_type']>('promotion')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [reviewNote, setReviewNote] = useState<Record<string, string>>({})

  useEffect(() => { load() }, [])

  async function load() {
    setRows(await listContentApprovals())
  }

  function resetForm() {
    setTitle('')
    setBody('')
    setContentType('promotion')
  }

  async function handleSubmit() {
    if (!title.trim()) { showToast('Please enter a title', 'warning'); return }
    const id = await submitContentForApproval(contentType, title.trim(), body.trim())
    if (!id) { showToast('Submit failed — try again', 'error'); return }
    showToast('Submitted for approval (no auto-publish)', 'success')
    resetForm()
    load()
  }

  async function handleReview(row: ContentApprovalRow, decision: 'approved' | 'rejected') {
    const note = (reviewNote[row.id] ?? '').trim()
    const ok = await reviewContent(row.id, decision, note)
    if (!ok) { showToast('Review failed — not pending anymore?', 'error'); return }
    showToast(decision === 'approved' ? 'Approved — content may now publish' : 'Rejected', decision === 'approved' ? 'success' : 'warning')
    load()
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <Link to="/admin" className="text-sm text-brand-muted hover:underline">← กลับแดшборд</Link>
      <h1 className="text-2xl font-bold text-brand-accent mt-2 mb-1">🛡️ Content Approvals (CNT-01)</h1>
      <p className="text-sm text-brand-muted mb-6">
        Nothing publishes automatically — submit for review, then an admin approves. Only approved content passes the publish gate.
      </p>

      {/* Submit new content */}
      <div className="card p-4 mb-6">
        <h3 className="font-bold text-brand-accent mb-3">➕ Submit new content</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <select className="input" value={contentType} onChange={(e) => setContentType(e.target.value as ContentApprovalRow['content_type'])}>
            {Object.keys(TYPE_LABEL).map((k) => <option key={k} value={k}>{TYPE_LABEL[k]}</option>)}
          </select>
          <input className="input" placeholder="Title (e.g. New promo -10%)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input className="input" placeholder="Body / details (optional)" value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={handleSubmit} className="btn btn-primary">Send for approval</button>
          <button onClick={resetForm} className="btn btn-outline">Clear</button>
        </div>
      </div>

      {/* Review queue + history */}
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="card">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`badge ${row.status === 'approved' ? 'badge-success' : row.status === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>
                  {TYPE_LABEL[row.content_type] || row.content_type} · {row.status.toUpperCase()}
                </span>
                <span className="text-sm font-medium text-brand-accent">{row.title}</span>
              </div>
              <span className="text-xs text-brand-muted">{row.created_at.slice(0, 16).replace('T', ' ')}</span>
            </div>
            {row.body && <p className="text-sm text-brand-muted">{row.body}</p>}
            <div className="text-xs text-brand-muted">
              {row.status === 'approved' ? '✅ Publish gate OPEN' : row.status === 'rejected' ? '⛔ Rejected — not publishable' : '⏳ Pending review — not publishable yet'}
            </div>
            {row.status === 'pending' && (
              <div className="flex gap-2 mt-2">
                <input
                  className="input flex-1"
                  placeholder="Review note (optional)"
                  value={reviewNote[row.id] ?? ''}
                  onChange={(e) => setReviewNote({ ...reviewNote, [row.id]: e.target.value })}
                />
                <button onClick={() => handleReview(row, 'approved')} className="btn btn-success text-sm">✅ Approve</button>
                <button onClick={() => handleReview(row, 'rejected')} className="btn btn-outline text-sm text-red-500">✖ Reject</button>
              </div>
            )}
          </div>
        ))}
        {rows.length === 0 && (
          <p className="text-brand-muted text-center py-8">No submissions yet — create one above.</p>
        )}
      </div>
    </div>
  )
}
import { useState, useEffect } from 'react'
import type { AuditLogEntry } from '@/lib/auditLog'
import { getAuditLogs, getAuditSummary, clearAuditLogs } from '@/lib/auditLog'
import { ACTION_LABELS } from '@/lib/auditLogConstants'
import { showToast } from '@/components/ui/ToastContainer'

export function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [filterAction, setFilterAction] = useState('')
  const [filterEntityType, setFilterEntityType] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  useEffect(() => { fetchData() }, [])
  async function fetchData() {
    setIsLoading(true)
    try { setLogs(getAuditLogs({ limit: 500 })); setSummary(getAuditSummary()) }
    finally { setIsLoading(false) }
  }
  function handleClear() {
    if (window.confirm('ยืนยันล้าง audit log ทั้งหมด?')) { clearAuditLogs(); fetchData(); showToast('ล้าง audit log แล้ว', 'warning') }
  }
  const filteredLogs = logs.filter(l => (!filterAction || l.action === filterAction) && (!filterEntityType || l.entity_type === filterEntityType))
  const uniqueActions = [...new Set(logs.map(l => l.action))]
  const uniqueEntityTypes = [...new Set(logs.map(l => l.entity_type))]

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-brand-accent">บันทึกตรวจสอบ (Audit Log)</h1>
        <button onClick={handleClear} className="btn btn-warning text-sm">ล้างทั้งหมด</button>
      </div>
      {summary && <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card bg-blue-50 border-blue-200 p-4"><div className="text-sm text-blue-600">บันทึกทั้งหมด</div><div className="text-3xl font-bold text-blue-800">{summary.totalEntries}</div></div>
        <div className="card bg-green-50 border-green-200 p-4"><div className="text-sm text-green-600">วันนี้</div><div className="text-3xl font-bold text-green-800">{summary.todayEntries}</div></div>
        <div className="card bg-yellow-50 border-yellow-200 p-4">
          <div className="text-sm text-yellow-600">กิจกรรมยอดนิยม</div>
          <div className="text-sm font-bold mt-1">{summary.topActions.slice(0, 3).map((a: {action:string;count:number}) => <div key={a.action}>{ACTION_LABELS[a.action] || a.action}: {a.count}</div>)}</div>
        </div>
        <div className="card bg-red-50 border-red-200 p-4"><div className="text-sm text-red-600">น่าสงสัย</div><div className="text-3xl font-bold text-red-800">{summary.suspiciousActivities}</div></div>
      </div>}
      <div className="card mb-6"><div className="flex flex-wrap gap-3">
        <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)} className="input">
          <option value="">ทุกกิจกรรม</option>{uniqueActions.map(action => <option key={action} value={action}>{ACTION_LABELS[action] || action}</option>)}
        </select>
        <select value={filterEntityType} onChange={(e) => setFilterEntityType(e.target.value)} className="input">
          <option value="">ทุกประเภท</option>{uniqueEntityTypes.map(type => <option key={type} value={type}>{type}</option>)}
        </select>
      </div></div>
      <div className="card overflow-hidden p-0">
        {isLoading ? <div className="p-8 text-center text-brand-muted">กำลังโหลด...</div>
          : filteredLogs.length === 0 ? <div className="p-8 text-center text-brand-muted">ยังไม่มีบันทึก</div>
          : <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="bg-brand-bg border-b-2 border-brand-border">
              <tr><th className="px-4 py-3 text-left font-semibold text-brand-accent">เวลา</th><th className="px-4 py-3 text-left font-semibold text-brand-accent">กิจกรรม</th><th className="px-4 py-3 text-left font-semibold text-brand-accent">ผู้ใช้</th><th className="px-4 py-3 text-left font-semibold text-brand-accent">รายละเอียด</th></tr>
            </thead>
            <tbody>{filteredLogs.map((log) => (
              <tr key={log.id} className="border-b border-brand-border hover:bg-brand-bg">
                <td className="px-4 py-3 whitespace-nowrap text-brand-muted">{new Date(log.timestamp).toLocaleString('th-TH')}</td>
                <td className="px-4 py-3"><span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${log.action.includes('order') ? 'bg-orange-100 text-orange-800' : log.action.includes('user') ? 'bg-blue-100 text-blue-800' : log.action.includes('inventory') ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{ACTION_LABELS[log.action] || log.action}</span></td>
                <td className="px-4 py-3"><div className="text-brand-accent font-medium">{log.user_email || log.user_id}</div>{log.metadata && Object.keys(log.metadata).length > 0 && <details className="mt-1"><summary className="text-xs text-brand-muted cursor-pointer">meta</summary><pre className="text-xs bg-brand-bg p-2 rounded mt-1 max-h-32 overflow-auto">{JSON.stringify(log.metadata, null, 2)}</pre></details>}</td>
                <td className="px-4 py-3 text-brand-text">{log.description}</td>
              </tr>))}
            </tbody>
          </table></div>}
      </div>
    </div>
  )
}
// ============================================
// Bite Me Baby — ScheduleDateBadge (ปฏิทินลอยของการ์ดเมนูจองล่วงหน้า)
// ============================================
// มุมบนของการ์ดเมนูจองล่วงหน้า: แสดง "วันจริงของเมนู" เป็นป้ายปฏิทินเล็ก ๆ
// และเมื่อ hover บนเมนู → ปฏิทินเดือนนั้นจะลอยขึ้นมาโดยวันจัดส่งของเมนู
// ถูกไฮไลต์ไว้ให้เห็นชัดเจน (pointer-events: none — ไม่บังปุ่มสั่ง)
// ============================================

interface ScheduleDateBadgeProps {
  /** วันจัดส่งจริงของเมนู (YYYY-MM-DD) */
  date: string
  className?: string
}

const WEEK_DAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']

function parseDate(date: string): Date | null {
  const d = new Date(`${date}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

/** วันที่แบบไทย — สั้น: "14 ต.ค." / ยาว: "อังคารที่ 14 ตุลาคม 2569" */
export function formatThaiDate(date: string, style: 'short' | 'long' = 'short'): string {
  const d = parseDate(date)
  if (!d) return ''
  return d.toLocaleDateString('th-TH', style === 'long'
    ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
    : { day: 'numeric', month: 'short' })
}

export function ScheduleDateBadge({ date, className = '' }: ScheduleDateBadgeProps) {
  const d = parseDate(date)
  if (!d) return null
  const dayNum = d.getDate()
  const monthShort = d.toLocaleDateString('th-TH', { month: 'short' })
  const monthTitle = d.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })

  // ตารางเดือนของวันจัดส่งจริง (เริ่มคอลัมน์ที่วันอาทิตย์)
  const year = d.getFullYear()
  const month = d.getMonth()
  const leadingBlanks = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: Array<number | null> = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  return (
    <div className={`sched-cal ${className}`.trim()} data-testid="schedule-date-badge">
      <div className="sched-cal-corner" aria-label={`เมนูนี้พร้อมส่ง ${formatThaiDate(date, 'long')}`}>
        <span className="sched-cal-corner-day">{dayNum}</span>
        <span className="sched-cal-corner-month">{monthShort}</span>
      </div>
      <div className="sched-cal-pop" role="tooltip" data-testid="schedule-date-calendar">
        <div className="sched-cal-pop-title">📅 พร้อมส่ง {formatThaiDate(date, 'long')}</div>
        <div className="sched-cal-month">{monthTitle}</div>
        <div className="sched-cal-grid">
          {WEEK_DAYS.map((w) => (
            <span key={w} className="sched-cal-dow">{w}</span>
          ))}
          {cells.map((c, i) => (
            <span
              key={i}
              className={`sched-cal-cell${c === null ? ' is-empty' : ''}${c === dayNum ? ' is-target' : ''}`}
            >
              {c ?? ''}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

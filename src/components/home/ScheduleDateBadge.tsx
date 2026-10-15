// ============================================
// Bite Me Baby — ScheduleDateBadge (ปฏิทินลอยของการ์ดเมนูจองล่วงหน้า)
// ============================================
// มุมบนของการ์ดเมนูจองล่วงหน้า: แสดง "วันจริงของเมนู" เป็นป้ายปฏิทินเล็ก ๆ
// และลอยเป็นปฏิทินเดือนนั้น (วันจัดส่งไฮไลต์) — ดีไซน์มาตรฐานเดียวทุกการ์ด/ทุกหน้า
// UX fix 2026-10-15:
// - เปิดได้ทั้ง hover (เดสก์ท็อป), โฟกัสคีย์บอร์ด (:focus-within) และแตะ (มือถือ —
//   แตะปุ่มมุมรูปอีกครั้ง/แตะนอกป้าย/กด Esc เพื่อปิด)
// - popup เป็น info-only (pointer-events: none) — ไม่บังปุ่ม CTA/การ์ดข้าง ๆ
// - พลิกตำแหน่งอัตโนมัติเมื่อชนขอบจอ (flip-left / flip-up)
// ============================================

import { useEffect, useRef, useState } from 'react'

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
  const [open, setOpen] = useState(false)
  const [flipLeft, setFlipLeft] = useState(false)
  const [flipUp, setFlipUp] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // พลิกป๊อปอัปเมื่อชนขอบจอ (วัดจากตำแหน่งป้ายจริง — mount + ตอน resize)
  useEffect(() => {
    const measure = () => {
      const wrap = wrapRef.current
      if (!wrap) return
      const r = wrap.getBoundingClientRect()
      const POP_W = 232
      const POP_H = 300
      const spaceLeft = r.right - POP_W
      const spaceRight = window.innerWidth - r.left - POP_W
      setFlipLeft(spaceLeft < 8 && spaceRight >= 8)
      const spaceBelow = window.innerHeight - r.bottom - 8 - POP_H
      const spaceAbove = r.top - 8 - POP_H
      setFlipUp(spaceBelow < 8 && spaceAbove >= 8)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  // แตะนอกป้าย / กด Esc = ปิด (โหมดแตะบนมือถือ)
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

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
    <div
      ref={wrapRef}
      className={`sched-cal${open ? ' is-open' : ''}${className ? ` ${className}` : ''}`.trim()}
      data-testid="schedule-date-badge"
    >
      <button
        type="button"
        className="sched-cal-corner"
        aria-label={`เมนูนี้พร้อมส่ง ${formatThaiDate(date, 'long')} — เปิดปฏิทิน`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="sched-cal-corner-day">{dayNum}</span>
        <span className="sched-cal-corner-month">{monthShort}</span>
      </button>
      <div
        className={`sched-cal-pop${flipLeft ? ' sched-cal-pop--left' : ''}${flipUp ? ' sched-cal-pop--up' : ''}`.trim()}
        role="tooltip"
        data-testid="schedule-date-calendar"
      >
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

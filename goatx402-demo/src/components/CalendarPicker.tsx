/**
 * CalendarPicker — flat 2D calendar, no native <input type="date">
 * Supports single-date and range selection.
 */

import { useState } from 'react'

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}
function toISO(d: Date) {
  return d.toISOString().slice(0, 10)
}
function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}
function daysInMonth(y: number, m: number) {
  return new Date(y, m + 1, 0).getDate()
}

export function fmtReadable(iso: string) {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

interface CalendarPickerProps {
  mode: 'single' | 'range'
  startDate: string
  endDate: string
  onSelect: (start: string, end: string) => void
}

export function CalendarPicker({ mode, startDate, endDate, onSelect }: CalendarPickerProps) {
  const today = startOfDay(new Date())
  const [baseMonth, setBaseMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  )
  const [hovered, setHovered] = useState<string | null>(null)

  const handleDay = (iso: string) => {
    const d = new Date(iso + 'T00:00:00')
    if (d < today) return

    if (mode === 'single') {
      onSelect(iso, iso)
      return
    }

    // range mode
    if (!startDate || (startDate && endDate && endDate !== startDate)) {
      // first click (or reset)
      onSelect(iso, '')
    } else if (startDate && !endDate) {
      // second click
      const s = new Date(startDate + 'T00:00:00')
      if (d < s) onSelect(iso, startDate)
      else        onSelect(startDate, iso)
    }
  }

  const renderMonth = (base: Date) => {
    const y = base.getFullYear()
    const m = base.getMonth()
    const firstDow = new Date(y, m, 1).getDay()
    const total = daysInMonth(y, m)
    const blanks = Array<null>(firstDow).fill(null)
    const days: (Date | null)[] = [...blanks]
    for (let d = 1; d <= total; d++) days.push(new Date(y, m, d))

    return (
      <div className="cal-month">
        <div className="cal-month-header">
          <span>{MONTH_NAMES[m]} {y}</span>
        </div>
        <div className="cal-grid">
          {WEEKDAYS.map(wd => <span key={wd} className="cal-wd">{wd}</span>)}
          {days.map((day, i) => {
            if (!day) return <span key={`b-${i}`} className="cal-blank" />
            const iso = toISO(day)
            const isPast = day < today
            const isToday = toISO(day) === toISO(today)
            const isStart = iso === startDate
            const isEnd = iso === endDate
            const effectiveEnd = hovered || endDate

            let inRange = false
            if (mode === 'range' && startDate && effectiveEnd && effectiveEnd !== startDate) {
              const lo = startDate < effectiveEnd ? startDate : effectiveEnd
              const hi = startDate < effectiveEnd ? effectiveEnd : startDate
              inRange = iso > lo && iso < hi
            }

            const cls = [
              'cal-day',
              isPast ? 'cal-past' : '',
              isToday ? 'cal-today' : '',
              isStart || isEnd ? 'cal-sel' : '',
              inRange ? 'cal-range' : '',
            ].filter(Boolean).join(' ')

            return (
              <button
                key={iso}
                className={cls}
                disabled={isPast}
                onClick={() => handleDay(iso)}
                onMouseEnter={() => {
                  if (mode === 'range' && startDate && !endDate) setHovered(iso)
                }}
                onMouseLeave={() => setHovered(null)}
              >
                {day.getDate()}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const nights =
    startDate && endDate && endDate !== startDate
      ? Math.round(
          (new Date(endDate + 'T00:00:00').getTime() - new Date(startDate + 'T00:00:00').getTime()) /
            86400000
        )
      : 0

  return (
    <div className="cal-root">
      <div className="cal-nav-row">
        <button className="cal-nav-btn" onClick={() => setBaseMonth(b => addMonths(b, -1))}>‹</button>
        <button className="cal-nav-btn" onClick={() => setBaseMonth(b => addMonths(b, 1))}>›</button>
      </div>
      <div className="cal-months-wrap">
        {renderMonth(baseMonth)}
        {renderMonth(addMonths(baseMonth, 1))}
      </div>
      {startDate && (
        <div className="cal-hint">
          {mode === 'range' && endDate && endDate !== startDate
            ? `${fmtReadable(startDate)} → ${fmtReadable(endDate)}${nights > 0 ? ` (${nights} night${nights > 1 ? 's' : ''})` : ''}`
            : `📅 ${fmtReadable(startDate)}`}
        </div>
      )}
    </div>
  )
}

import { useState, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'

interface Props {
  value: string            // YYYY-MM-DD or ''
  onChange: (date: string) => void
  label?: string
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

export function DatePicker({ value, onChange, label }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Calendar navigation state — initialize from value or today
  const init = value ? new Date(value + 'T00:00') : new Date()
  const [viewYear, setViewYear] = useState(init.getFullYear())
  const [viewMonth, setViewMonth] = useState(init.getMonth())

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Re-sync view when value changes externally
  useEffect(() => {
    if (value) {
      const d = new Date(value + 'T00:00')
      setViewYear(d.getFullYear())
      setViewMonth(d.getMonth())
    }
  }, [value])

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const firstDay = new Date(viewYear, viewMonth, 1)
  const startOffset = (firstDay.getDay() + 6) % 7 // Monday = 0
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  const cells: (number | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const todayStr = new Date().toISOString().split('T')[0]
  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

  const selectDay = (day: number) => {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    onChange(dateStr)
    setOpen(false)
  }

  const displayValue = value
    ? new Date(value + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : ''

  return (
    <div className="relative" ref={ref}>
      {label && <label className="text-[10px] text-gray-600 block mb-1">{label}</label>}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 bg-gray-800 border rounded px-2.5 py-1.5 text-xs transition-colors focus:outline-none ${
          open ? 'border-blue-600 text-gray-200' : 'border-gray-700 text-gray-400 hover:border-gray-600'
        } ${!value ? 'text-gray-600' : 'text-gray-300'}`}
      >
        <Calendar className="w-3 h-3 shrink-0 text-gray-600" />
        <span className="min-w-[90px] text-left">{displayValue || 'Select date'}</span>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-2.5 w-[240px]">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-2">
            <button onClick={prevMonth} className="p-0.5 text-gray-500 hover:text-gray-300 transition-colors">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-medium text-gray-300">{monthLabel}</span>
            <button onClick={nextMonth} className="p-0.5 text-gray-500 hover:text-gray-300 transition-colors">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-0.5">
            {WEEKDAYS.map(wd => (
              <div key={wd} className="text-center text-[10px] text-gray-600 py-0.5">{wd}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              if (day === null) return <div key={i} className="h-7" />
              const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const isSelected = dateStr === value
              const isToday = dateStr === todayStr

              return (
                <button
                  key={i}
                  onClick={() => selectDay(day)}
                  className={`h-7 w-full rounded text-xs transition-colors ${
                    isSelected
                      ? 'bg-blue-600 text-white font-medium'
                      : isToday
                      ? 'text-blue-400 hover:bg-gray-800 font-medium'
                      : 'text-gray-400 hover:bg-gray-800'
                  }`}
                >
                  {day}
                </button>
              )
            })}
          </div>

          {/* Today shortcut */}
          <div className="mt-1.5 pt-1.5 border-t border-gray-800 flex justify-center">
            <button
              onClick={() => { onChange(todayStr); setOpen(false) }}
              className="text-[10px] text-gray-500 hover:text-blue-400 transition-colors"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

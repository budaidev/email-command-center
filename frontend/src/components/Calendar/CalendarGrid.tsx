import { CalendarDay, CalendarEventCount } from '../../api/client'
import { CalendarDayCell } from './CalendarDayCell'

interface Props {
  year: number
  month: number // 0-indexed
  days: CalendarDay[]
  eventCounts: CalendarEventCount[]
  selectedDate: string | null
  onSelectDate: (date: string) => void
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function CalendarGrid({ year, month, days, eventCounts, selectedDate, onSelectDate }: Props) {
  const dayMap = new Map(days.map(d => [d.date, d]))
  const eventMap = new Map(eventCounts.map(e => [e.day, e.count]))

  const firstDay = new Date(year, month, 1)
  // Monday = 0, Sunday = 6
  const startOffset = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const today = new Date().toISOString().split('T')[0]

  const cells: (number | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div>
      <div className="grid grid-cols-7 gap-0.5 mb-0.5">
        {WEEKDAYS.map(wd => (
          <div key={wd} className="text-center text-[10px] text-gray-600 py-1 font-medium">
            {wd}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          const dateStr = day !== null
            ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            : ''
          return (
            <CalendarDayCell
              key={i}
              day={day}
              data={day !== null ? dayMap.get(dateStr) : undefined}
              eventCount={day !== null ? (eventMap.get(dateStr) || 0) : 0}
              isToday={dateStr === today}
              isSelected={dateStr === selectedDate}
              onClick={() => day !== null && onSelectDate(dateStr)}
            />
          )
        })}
      </div>
    </div>
  )
}

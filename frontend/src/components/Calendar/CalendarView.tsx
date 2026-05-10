import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, X, Database } from 'lucide-react'
import { api } from '../../api/client'
import { CalendarGrid } from './CalendarGrid'
import { DailyDigestDetail } from './DailyDigestDetail'
import { BackfillControls } from './BackfillControls'

interface Props {
  onClose: () => void
  onSelectEmail?: (emailId: string) => void
}

export function CalendarView({ onClose, onSelectEmail }: Props) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth()) // 0-indexed
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showBackfill, setShowBackfill] = useState(false)

  const yearMonth = `${year}-${String(month + 1).padStart(2, '0')}`

  const { data } = useQuery({
    queryKey: ['daily-digests-calendar', yearMonth],
    queryFn: () => api.getDailyDigestCalendar(yearMonth),
  })

  const { data: eventCounts } = useQuery({
    queryKey: ['calendar-event-counts', yearMonth],
    queryFn: () => api.getCalendarEventCounts(yearMonth),
  })

  const goToday = () => {
    setYear(now.getFullYear())
    setMonth(now.getMonth())
    setSelectedDate(now.toISOString().split('T')[0])
  }

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }

  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  const monthLabel = new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="shrink-0 h-11 bg-gray-900 border-b border-gray-800 flex items-center px-4 gap-3">
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="p-1 text-gray-500 hover:text-gray-300 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-white min-w-[140px] text-center">{monthLabel}</span>
          <button onClick={nextMonth} className="p-1 text-gray-500 hover:text-gray-300 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <button onClick={goToday}
          className="px-2.5 py-1 text-xs text-gray-400 hover:text-gray-200 bg-gray-800 hover:bg-gray-700 rounded transition-colors">
          Today
        </button>

        <button onClick={() => setShowBackfill(!showBackfill)}
          className={`px-2.5 py-1 text-xs rounded transition-colors flex items-center gap-1.5 ${
            showBackfill ? 'text-blue-400 bg-blue-900/30' : 'text-gray-400 hover:text-gray-200 bg-gray-800 hover:bg-gray-700'
          }`}>
          <Database className="w-3 h-3" />
          Backfill
        </button>

        <div className="flex-1" />

        <button onClick={onClose} className="p-1.5 text-gray-600 hover:text-gray-400 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </header>

      {/* Backfill panel */}
      {showBackfill && (
        <div className="shrink-0 p-3 border-b border-gray-800">
          <BackfillControls onClose={() => setShowBackfill(false)} />
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Calendar grid */}
        <div className={`${selectedDate ? 'w-80 shrink-0 border-r border-gray-800' : 'flex-1'} overflow-y-auto p-3 transition-all`}>
          <CalendarGrid
            year={year}
            month={month}
            days={data?.days || []}
            eventCounts={eventCounts || []}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        </div>

        {/* Detail panel */}
        {selectedDate && (
          <div className="flex-1 overflow-hidden">
            <DailyDigestDetail date={selectedDate} onSelectEmail={onSelectEmail} />
          </div>
        )}
      </div>
    </div>
  )
}

import { CalendarDay } from '../../api/client'

interface Props {
  day: number | null
  data: CalendarDay | undefined
  eventCount: number
  isToday: boolean
  isSelected: boolean
  onClick: () => void
}

export function CalendarDayCell({ day, data, eventCount, isToday, isSelected, onClick }: Props) {
  if (day === null) {
    return <div className="h-20 bg-gray-950/50" />
  }

  const statusDot = data?.digest_status === 'complete'
    ? 'bg-green-500'
    : data?.digest_status === 'generating'
    ? 'bg-yellow-500 animate-pulse'
    : data?.email_count
    ? 'bg-gray-600'
    : null

  return (
    <button
      onClick={onClick}
      className={`h-20 p-1.5 text-left transition-colors border border-gray-800/50 rounded ${
        isSelected
          ? 'bg-blue-900/30 border-blue-600'
          : 'hover:bg-gray-900/70'
      }`}
    >
      <div className="flex items-start justify-between">
        <span className={`text-xs font-medium ${isToday ? 'text-blue-400' : 'text-gray-400'}`}>
          {day}
        </span>
        <div className="flex items-center gap-1">
          {statusDot && <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />}
          {data && data.email_count > 0 && (
            <span className="text-[10px] text-gray-600">{data.email_count}</span>
          )}
          {eventCount > 0 && (
            <span className="text-[10px] text-purple-500">{eventCount}ev</span>
          )}
        </div>
      </div>
      {data?.headline && (
        <p className="mt-1 text-[10px] text-gray-600 leading-tight line-clamp-2">
          {data.headline.slice(0, 60)}
        </p>
      )}
    </button>
  )
}
